'use client';

import React, { useState, useEffect } from 'react';
import { Plus, ChevronRight, Play, XCircle, RotateCcw, Trash2 } from 'lucide-react';
import { useTranslation } from '../lib/i18n';

interface Task {
  id: number;
  name: string;
  target: 'incremental' | 'full';
  url_template: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  total_urls: number;
  scanned_urls: number;
  hits: number;
  created_at: string;
}

interface TasksViewProps {
  onCreateOpen: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onViewResults: (taskId: number) => void;
}

interface StatusBadgeProps {
  status: string;
}

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const { t } = useTranslation();
  const styles: Record<string, string> = {
    running: 'bg-blue-100/50 text-blue-600 ring-1 ring-blue-200',
    completed: 'bg-emerald-100/50 text-emerald-600 ring-1 ring-emerald-200',
    failed: 'bg-red-100/50 text-red-600 ring-1 ring-red-200',
    pending: 'bg-amber-100/50 text-amber-600 ring-1 ring-amber-200',
  };

  const config: Record<string, { label: string; emoji: string; animate: boolean }> = {
    running: { label: t('status_running'), emoji: '⏳', animate: true },
    completed: { label: t('status_done'), emoji: '✅', animate: false },
    failed: { label: t('status_failed'), emoji: '❌', animate: false },
    pending: { label: t('status_waiting'), emoji: '💤', animate: false },
  };

  const current = config[status] || config.pending;

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 backdrop-blur-sm ${styles[status]}`}>
      {current.animate ? (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
        </span>
      ) : (
        <span>{current.emoji}</span>
      )}
      {current.label}
    </span>
  );
};

export const TasksView = ({ onCreateOpen, showToast, onViewResults }: TasksViewProps) => {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks?page=${page}&limit=20`);
      const data = await res.json();
      if (data.success) {
        setTasks(data.data.tasks);
        setTotal(data.data.pagination.total);
      }
    } catch (error) {
      console.error('Failed to fetch tasks', error);
      showToast(t('failed_load_tasks'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();

    // 轮询更新运行中的任务
    const interval = setInterval(() => {
      const hasRunningTasks = tasks.some(t => t.status === 'running');
      if (hasRunningTasks) {
        fetchTasks();
      }
    }, 5000); // 每5秒刷新一次

    return () => clearInterval(interval);
  }, [page]);

  const handleStartTask = async (taskId: number) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/start`, {
        method: 'POST'
      });
      const data = await res.json();

      if (data.success) {
        showToast(t('task_started_success'), 'success');
        fetchTasks();
      } else {
        showToast(data.message || t('failed_start_task'), 'error');
      }
    } catch (error) {
      showToast(t('failed_start_task'), 'error');
    }
  };

  const handleClearAll = async () => {
    if (!confirm(t('confirm_clear_all_tasks'))) {
      return;
    }

    try {
      const res = await fetch('/api/tasks/clear', {
        method: 'DELETE'
      });
      const data = await res.json();

      if (data.success) {
        showToast(t('cleared_tasks_success').replace('{count}', data.count), 'success');
        fetchTasks();
      } else {
        showToast(data.message || t('failed_clear_tasks'), 'error');
      }
    } catch (error) {
      showToast(t('failed_clear_tasks'), 'error');
    }
  };

  const handleResetAll = async () => {
    if (!confirm(t('confirm_reset_all_tasks'))) {
      return;
    }

    try {
      const res = await fetch('/api/tasks/reset', {
        method: 'POST'
      });
      const data = await res.json();

      if (data.success) {
        showToast(t('reset_tasks_success').replace('{count}', data.count), 'success');
        fetchTasks();
      } else {
        showToast(data.message || t('failed_reset_tasks'), 'error');
      }
    } catch (error) {
      showToast(t('failed_reset_tasks'), 'error');
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex justify-between items-center glass-panel p-4 rounded-2xl">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">{t('task_center')}</h2>
          <p className="text-slate-500 text-sm mt-1 ml-9">{t('manage_missions').replace('{total}', total.toString())}</p>
        </div>
        <div className="flex gap-3">
          {total > 0 && (
            <>
              <button
                onClick={handleResetAll}
                className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-3 rounded-xl flex items-center text-sm font-bold transition-all shadow-lg shadow-amber-300 hover:shadow-amber-400 hover:-translate-y-1"
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                {t('reset_all')}
              </button>
              <button
                onClick={handleClearAll}
                className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-3 rounded-xl flex items-center text-sm font-bold transition-all shadow-lg shadow-rose-300 hover:shadow-rose-400 hover:-translate-y-1"
              >
                <Trash2 className="w-5 h-5 mr-2" />
                {t('clear_all')}
              </button>
            </>
          )}
          <button
            onClick={onCreateOpen}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl flex items-center text-sm font-bold transition-all shadow-lg shadow-indigo-300 hover:shadow-indigo-400 hover:-translate-y-1 hover-scale"
          >
            <Plus className="w-5 h-5 mr-2" />
            {t('new_mission')}
          </button>
        </div>
      </div>

      <div className="glass-panel rounded-3xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50/80 text-slate-500">
            <tr>
              <th className="px-8 py-5 font-semibold">{t('task_name')}</th>
              <th className="px-6 py-5 font-semibold">{t('type')}</th>
              <th className="px-6 py-5 font-semibold">{t('progress')}</th>
              <th className="px-6 py-5 font-semibold">{t('hits')}</th>
              <th className="px-6 py-5 font-semibold">{t('status')}</th>
              <th className="px-8 py-5 font-semibold text-right">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-slate-400">
                  {t('loading_tasks')}
                </td>
              </tr>
            ) : tasks.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-slate-400">
                  {t('no_tasks_yet')}
                </td>
              </tr>
            ) : (
              tasks.map((task, idx) => (
                <tr
                  key={task.id}
                  className={`hover:bg-indigo-50/30 transition-colors group animate-slide-up`}
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <td className="px-8 py-5">
                    <div className="font-bold text-slate-800 text-base">{task.name}</div>
                    <div className="text-xs text-slate-400 font-mono mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      ID: {task.id}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-slate-600">
                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-lg text-xs font-medium">
                      {task.target === 'incremental' ? t('incremental_short') : t('full_short')}
                    </span>
                  </td>
                  <td className="px-6 py-5 w-48">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ease-out relative ${task.status === 'failed'
                              ? 'bg-red-400'
                              : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                            }`}
                          style={{ width: `${task.progress}%` }}
                        >
                          {task.status === 'running' && (
                            <div className="absolute inset-0 bg-white/30 w-full h-full animate-[shimmer_2s_infinite]"></div>
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-bold text-slate-500">{task.progress}%</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {task.scanned_urls} / {task.total_urls}
                    </div>
                  </td>
                  <td className="px-6 py-5 font-mono text-xs text-slate-600">
                    <span className="text-emerald-600 font-black bg-emerald-100 px-2 py-0.5 rounded-md">
                      {task.hits}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <StatusBadge status={task.status} />
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {task.status === 'pending' && (
                        <button
                          onClick={() => handleStartTask(task.id)}
                          className="text-emerald-600 hover:text-emerald-800 p-2 hover:bg-emerald-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          title={t('start_task')}
                        >
                          <Play className="w-5 h-5" />
                        </button>
                      )}
                      <button
                        onClick={() => onViewResults(task.id)}
                        className="text-indigo-600 hover:text-indigo-800 p-2 hover:bg-indigo-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0"
                        title={t('view_results')}
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {!loading && tasks.length > 0 && (
          <div className="p-4 flex justify-center gap-2 border-t border-slate-100">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="px-4 py-2 bg-white rounded-lg disabled:opacity-50 hover:bg-slate-50 transition-colors font-medium text-sm"
            >
              {t('prev_page')}
            </button>
            <span className="px-4 py-2 font-medium text-sm text-slate-600">{t('page_num').replace('{page}', page.toString())}</span>
            <button
              disabled={tasks.length < 20}
              onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 bg-white rounded-lg disabled:opacity-50 hover:bg-slate-50 transition-colors font-medium text-sm"
            >
              {t('next_page')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
