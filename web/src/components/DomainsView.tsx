'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, Search, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from '../lib/i18n';

interface Domain {
  id: number;
  domain: string;
  rank: number;
  first_seen_at: string;
  has_been_scanned: number;
}

interface DomainsViewProps {
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

interface StatusBadgeProps {
  status: string;
}

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const { t } = useTranslation();
  const styles: Record<string, string> = {
    scanned: 'bg-slate-100/50 text-slate-600 ring-1 ring-slate-200',
    pending: 'bg-amber-100/50 text-amber-600 ring-1 ring-amber-200',
  };

  const config: Record<string, { label: string; emoji: string }> = {
    scanned: { label: t('status_scanned'), emoji: '🔍' },
    pending: { label: t('status_waiting'), emoji: '💤' },
  };

  const current = config[status] || config.pending;

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 backdrop-blur-sm ${styles[status]}`}>
      <span>{current.emoji}</span>
      {current.label}
    </span>
  );
};

export const DomainsView = ({ showToast }: DomainsViewProps) => {
  const { t } = useTranslation();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newDomains, setNewDomains] = useState('');
  const [adding, setAdding] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  const fetchDomains = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/domains?page=${page}&limit=10&search=${search}`);
      const data = await res.json();
      if (data.success) {
        setDomains(data.data);
        setTotal(data.pagination.total);
      }
    } catch (error) {
      console.error('Failed to fetch domains', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDomains();
  }, [page, search]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/domains/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(t('sync_success').replace('{count}', data.count), 'success');
        fetchDomains();
      } else {
        showToast(t('sync_failed_prefix') + data.message, 'error');
      }
    } catch (error) {
      showToast(t('sync_failed'), 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleAddDomains = async () => {
    if (!newDomains.trim()) {
      showToast(t('enter_at_least_one_domain'), 'error');
      return;
    }

    setAdding(true);
    try {
      const res = await fetch('/api/domains/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domains: newDomains })
      });

      const data = await res.json();

      if (data.success) {
        showToast(t('add_domains_success').replace('{count}', data.count), 'success');
        setIsAddModalOpen(false);
        setNewDomains('');
        fetchDomains();
      } else {
        showToast(data.message || t('failed_add_domains'), 'error');
      }
    } catch (error) {
      showToast(t('failed_add_domains'), 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleClearAll = async () => {
    setShowClearConfirm(false);

    try {
      const res = await fetch('/api/domains/clear-all', {
        method: 'DELETE'
      });
      const data = await res.json();

      if (data.success) {
        showToast(t('cleared_domains_success').replace('{count}', data.deletedCount), 'success');
        fetchDomains();
      } else {
        showToast(data.message || t('failed_clear_domains'), 'error');
      }
    } catch (error) {
      showToast(t('failed_clear_domains'), 'error');
    }
  };

  const handleResetStatus = async () => {
    setResetting(true);
    try {
      const res = await fetch('/api/domains/reset-status', { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        showToast(t('reset_status_success').replace('{count}', data.count), 'success');
        setShowResetConfirm(false);
        fetchDomains();
      } else {
        showToast(data.message || t('failed_reset_status'), 'error');
      }
    } catch (error) {
      showToast(t('failed_reset_status'), 'error');
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
      <div className="space-y-6 animate-slide-up">
        <div className="glass-panel p-6 rounded-3xl flex flex-col md:flex-row justify-between items-end gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">{t('domain_assets')}</h2>
            <p className="text-slate-500 text-sm mt-1">{t('domain_assets_desc').replace('{total}', total.toString())}</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto flex-wrap">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-emerald-600 text-white px-4 py-3 rounded-2xl hover:bg-emerald-700 transition-all shadow-sm flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              {t('add_domains')}
            </button>
            {total > 0 && (
              <>
                <button
                  onClick={() => setShowResetConfirm(true)}
                  className="bg-amber-500 text-white px-4 py-3 rounded-2xl hover:bg-amber-600 transition-all shadow-sm flex items-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  {t('reset_status')}
                </button>
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="bg-rose-500 text-white px-4 py-3 rounded-2xl hover:bg-rose-600 transition-all shadow-sm flex items-center gap-2"
                >
                  <Trash2 className="w-5 h-5" />
                  {t('clear_all')}
                </button>
              </>
            )}
            <button
              onClick={handleSync}
              disabled={syncing}
              className="bg-indigo-600 text-white px-4 py-3 rounded-2xl hover:bg-indigo-700 transition-all shadow-sm flex items-center gap-2 disabled:opacity-70"
            >
              <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? t('syncing') : t('sync_csv')}
            </button>
            <div className="relative flex-1 md:w-80 group">
              <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('search_domain_placeholder')}
                className="w-full glass-input rounded-2xl pl-11 pr-4 py-3 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-all shadow-sm"
              />
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-3xl overflow-hidden">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/80 text-slate-500">
              <tr>
                <th className="px-8 py-5 font-semibold">{t('rank')}</th>
                <th className="px-6 py-5 font-semibold">{t('domain')}</th>
                <th className="px-6 py-5 font-semibold">{t('first_seen')}</th>
                <th className="px-6 py-5 font-semibold">{t('status')}</th>
                <th className="px-8 py-5 font-semibold text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-10">
                    {t('loading')}
                  </td>
                </tr>
              ) : domains.map((d, idx) => (
                <tr
                  key={d.id}
                  className="hover:bg-indigo-50/30 transition-colors animate-slide-up"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <td className="px-8 py-5 font-mono text-slate-400">#{d.rank}</td>
                  <td className="px-6 py-5 font-bold text-slate-700">{d.domain}</td>
                  <td className="px-6 py-5 text-slate-500">
                    {new Date(d.first_seen_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-5">
                    <StatusBadge status={d.has_been_scanned ? 'scanned' : 'pending'} />
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button className="text-indigo-600 font-bold text-xs hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-all">
                      {t('scan_now')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-6 flex justify-center items-center gap-6 border-t border-slate-100/50">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="group px-6 py-2.5 bg-gradient-to-b from-white to-slate-50 border border-slate-200 rounded-xl text-slate-600 font-bold shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:shadow-inner disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none transition-all flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              {t('prev_page')}
            </button>

            <div className="px-6 py-2.5 bg-slate-100/50 rounded-xl border border-slate-200/50 text-slate-500 font-mono font-bold shadow-inner min-w-[100px] text-center">
              {t('page_num').replace('{page}', page.toString())}
            </div>

            <button
              disabled={domains.length < 10}
              onClick={() => setPage(p => p + 1)}
              className="group px-6 py-2.5 bg-gradient-to-b from-white to-slate-50 border border-slate-200 rounded-xl text-slate-600 font-bold shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:shadow-inner disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none transition-all flex items-center gap-2"
            >
              {t('next_page')}
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
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
                  {t('clear_all_domains_confirm_title')}
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  {t('clear_all_domains_confirm_desc').replace('{total}', total.toString())}
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-6 py-2.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all font-bold"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleClearAll}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white transition-all shadow-lg shadow-rose-200 font-bold"
              >
                {t('confirm_clear')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Status Confirmation Dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel p-8 rounded-3xl max-w-md w-full mx-4 shadow-2xl animate-scale-in border-2 border-amber-200">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 rounded-xl bg-amber-100">
                <RefreshCw className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-slate-800 mb-2">
                  {t('reset_status_confirm_title')}
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  {t('reset_status_confirm_desc').replace('{total}', total.toString())}
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowResetConfirm(false)}
                disabled={resetting}
                className="px-6 py-2.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all font-bold disabled:opacity-50"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleResetStatus}
                disabled={resetting}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white transition-all shadow-lg shadow-amber-200 font-bold disabled:opacity-50 flex items-center gap-2"
              >
                {resetting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                {t('confirm_reset')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Domains Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)}></div>
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden transform scale-100 animate-slide-up border border-white/50 m-4 relative z-10">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-emerald-50/50 to-teal-50/50">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">{t('add_domains_title')}</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-rose-500 transition-colors bg-white p-2 rounded-full shadow-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-8 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  {t('domain_list_label')}
                </label>
                <textarea
                  value={newDomains}
                  onChange={(e) => setNewDomains(e.target.value)}
                  placeholder={t('domain_list_placeholder')}
                  rows={8}
                  className="w-full glass-input rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200 font-mono text-sm"
                />
                <p className="text-xs text-slate-400 mt-2">
                  {t('domain_list_hint')}
                </p>
              </div>
            </div>

            <div className="px-8 py-6 bg-slate-50/50 flex justify-end gap-4">
              <button
                onClick={() => setIsAddModalOpen(false)}
                disabled={adding}
                className="px-6 py-3 text-slate-500 hover:text-slate-800 font-bold hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleAddDomains}
                disabled={adding}
                className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 hover:shadow-emerald-300 transform hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {adding ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    {t('add_domains')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
