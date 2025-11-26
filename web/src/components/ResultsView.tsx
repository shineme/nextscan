'use client';

import React, { useState, useEffect } from 'react';
import { Download, Filter, Trash2 } from 'lucide-react';
import { useTranslation } from '../lib/i18n';

interface ScanResult {
  id: number;
  task_id: number;
  domain: string;
  url: string;
  status: number;
  content_type: string | null;
  size: number;
  scanned_at: string;
  task_name?: string;
}

interface Task {
  id: number;
  name: string;
  status: string;
  total_urls: number;
  scanned_urls: number;
  hits: number;
}

interface ResultsViewProps {
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  selectedTaskId?: number | null;
}

export const ResultsView = ({ showToast, selectedTaskId: propSelectedTaskId }: ResultsViewProps) => {
  const { t } = useTranslation();
  const [results, setResults] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(propSelectedTaskId || null);
  const [statusFilter, setStatusFilter] = useState<number | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showAllResults, setShowAllResults] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks?limit=100');
      const data = await res.json();
      if (data.success) {
        setTasks(data.data.tasks);
      }
    } catch (error) {
      console.error('Failed to fetch tasks', error);
    }
  };

  const fetchResults = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50'
      });

      if (statusFilter !== '') {
        params.append('status', statusFilter.toString());
      }

      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      let url = '';
      if (showAllResults || !selectedTaskId) {
        url = `/api/results/all?${params}`;
      } else {
        url = `/api/tasks/${selectedTaskId}/results?${params}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        setResults(data.data.results);
        setTotal(data.data.pagination.total);
      }
    } catch (error) {
      console.error('Failed to fetch results', error);
      showToast(t('failed_load_results'), 'error');
    } finally {
      setLoading(false);
    }
  };

  // 当从外部传入taskId时更新
  useEffect(() => {
    if (propSelectedTaskId) {
      setSelectedTaskId(propSelectedTaskId);
      setShowAllResults(false);
    }
  }, [propSelectedTaskId]);

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    if (showAllResults || selectedTaskId) {
      fetchResults();
    }
  }, [selectedTaskId, showAllResults, page, statusFilter, searchQuery]);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleClearAll = async () => {
    setClearing(true);
    try {
      const res = await fetch('/api/results/clear-all', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast(t('cleared_results_success').replace('{count}', data.deletedCount), 'success');
        setShowClearConfirm(false);
        setResults([]);
        setTotal(0);
        fetchTasks(); // 刷新任务列表以更新 hits 计数
      } else {
        showToast(data.message || t('failed_clear_results'), 'error');
      }
    } catch (error) {
      showToast(t('failed_clear_results'), 'error');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex justify-between items-center glass-panel p-4 rounded-2xl">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">{t('scan_results')}</h2>
          <p className="text-slate-500 text-sm mt-1 ml-9">
            {showAllResults
              ? t('showing_all_results').replace('{count}', tasks.length.toString())
              : selectedTaskId
                ? t('showing_task_results').replace('{id}', selectedTaskId.toString())
                : t('select_task_hint')
            }
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <select
            value={showAllResults ? 'all' : (selectedTaskId || '')}
            onChange={(e) => {
              const value = e.target.value;
              if (value === 'all') {
                setShowAllResults(true);
                setSelectedTaskId(null);
              } else if (value === '') {
                setShowAllResults(false);
                setSelectedTaskId(null);
              } else {
                setShowAllResults(false);
                setSelectedTaskId(parseInt(value));
              }
              setPage(1);
            }}
            className="glass-input rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 min-w-48"
          >
            <option value="">{t('select_task')}</option>
            <option value="all">{t('all_tasks_results')}</option>
            {tasks.map(task => (
              <option key={task.id} value={task.id}>
                #{task.id} {task.name} ({task.hits} hits)
              </option>
            ))}
          </select>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder={t('search_results_placeholder')}
            className="glass-input rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 min-w-64"
          />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value === '' ? '' : parseInt(e.target.value));
              setPage(1);
            }}
            className="glass-input rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            <option value="">{t('all_status')}</option>
            <option value="200">200 OK</option>
            <option value="403">403 Forbidden</option>
            <option value="404">404 Not Found</option>
            <option value="-1">{t('timeout_error')}</option>
          </select>
          {total > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="bg-rose-500 text-white px-5 py-2.5 rounded-xl flex items-center text-sm font-bold hover:bg-rose-600 transition-all shadow-sm hover:shadow-md hover-scale"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t('clear_all')}
            </button>
          )}
          <button className="bg-white border border-slate-200 text-slate-700 px-5 py-2.5 rounded-xl flex items-center text-sm font-bold hover:bg-slate-50 transition-all shadow-sm hover:shadow-md hover-scale">
            <Download className="w-4 h-4 mr-2" />
            {t('export_csv')}
          </button>
        </div>
      </div>

      {/* Clear All Confirmation Dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel p-8 rounded-3xl max-w-md w-full mx-4 shadow-2xl animate-scale-in border-2 border-rose-200">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 rounded-xl bg-rose-100">
                <Trash2 className="w-6 h-6 text-rose-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-slate-800 mb-2">
                  {t('clear_all_results_confirm_title')}
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  {t('clear_all_results_confirm_desc').replace('{total}', total.toString())}
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowClearConfirm(false)}
                disabled={clearing}
                className="px-6 py-2.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all font-bold disabled:opacity-50"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleClearAll}
                disabled={clearing}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white transition-all shadow-lg shadow-rose-200 font-bold disabled:opacity-50 flex items-center gap-2"
              >
                {clearing && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                {t('confirm_clear')}
              </button>
            </div>
          </div>
        </div>
      )}

      {!selectedTaskId && !showAllResults ? (
        <div className="glass-panel rounded-3xl p-12 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">{t('no_task_selected')}</h3>
          <p className="text-slate-500">
            {t('go_to_tasks_hint')}
          </p>
        </div>
      ) : (
        <div className="glass-panel rounded-3xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/80 text-slate-500">
              <tr>
                <th className="px-8 py-5 font-semibold">{t('domain')}</th>
                <th className="px-6 py-5 font-semibold">{t('url')}</th>
                <th className="px-6 py-5 font-semibold">{t('status')}</th>
                <th className="px-6 py-5 font-semibold">{t('size')}</th>
                <th className="px-8 py-5 font-semibold text-right">{t('time')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-10">
                    {t('loading_results')}
                  </td>
                </tr>
              ) : results.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400">
                    {t('no_results_found')}
                  </td>
                </tr>
              ) : (
                results.map((r, idx) => (
                  <tr
                    key={r.id}
                    className="hover:bg-slate-50 transition-colors animate-slide-up"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <td className="px-8 py-5 font-medium text-slate-700">
                      {r.domain}
                    </td>
                    <td className="px-6 py-5 max-w-md truncate text-slate-600 font-mono text-xs">
                      {r.url}
                    </td>
                    <td className="px-6 py-5">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold ${r.status === 200
                            ? 'bg-emerald-100 text-emerald-600 border border-emerald-200'
                            : r.status === -1
                              ? 'bg-slate-100 text-slate-600 border border-slate-200'
                              : 'bg-amber-100 text-amber-600 border border-amber-200'
                          }`}
                      >
                        {r.status === -1 ? 'ERR' : r.status}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-slate-500 text-xs">
                      {formatSize(r.size)}
                    </td>
                    <td className="px-8 py-5 text-right text-slate-400 text-xs">
                      {new Date(r.scanned_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {!loading && results.length > 0 && (
            <div className="p-4 flex justify-center gap-2 border-t border-slate-100">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-4 py-2 bg-white rounded-lg disabled:opacity-50 hover:bg-slate-50 transition-colors font-medium text-sm"
              >
                {t('prev_page')}
              </button>
              <span className="px-4 py-2 font-medium text-sm text-slate-600">
                {t('page_num_total').replace('{page}', page.toString()).replace('{total}', total.toString())}
              </span>
              <button
                disabled={results.length < 50}
                onClick={() => setPage(p => p + 1)}
                className="px-4 py-2 bg-white rounded-lg disabled:opacity-50 hover:bg-slate-50 transition-colors font-medium text-sm"
              >
                {t('next_page')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
