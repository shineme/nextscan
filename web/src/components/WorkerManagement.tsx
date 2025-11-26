'use client';

import React, { useState, useEffect } from 'react';
import { Server, Plus, Trash2, RefreshCw, CheckCircle, XCircle, AlertTriangle, Settings, Activity, Zap } from 'lucide-react';
import { useTranslation } from '../lib/i18n';

interface Worker {
  id: string;
  url: string;
  enabled: boolean;
  healthy: boolean;
  dailyQuota: number;
  dailyUsage: number;
  quotaResetAt: string;
  errorCount: number;
  successCount: number;
  permanentlyDisabled: boolean;
  disabledReason: string | null;
  lastCheck: Date;
}

export default function WorkerManagement() {
  const { t } = useTranslation();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 添加 Worker 表单
  const [showAddForm, setShowAddForm] = useState(false);
  const [newWorkerUrl, setNewWorkerUrl] = useState('');
  const [newWorkerQuota, setNewWorkerQuota] = useState('100000');

  // 编辑 Worker 表单
  const [editingWorker, setEditingWorker] = useState<string | null>(null);
  const [editQuota, setEditQuota] = useState('');

  // 确认对话框
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    loadWorkers();
    // 每30秒自动刷新
    const interval = setInterval(loadWorkers, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const loadWorkers = async () => {
    try {
      const res = await fetch('/api/workers/list');
      const data = await res.json();

      if (data.success) {
        setWorkers(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load workers:', error);
    }
  };

  const handleAddWorker = async () => {
    if (!newWorkerUrl.trim()) {
      setMessage({ type: 'error', text: t('enter_worker_url') });
      return;
    }

    if (!newWorkerUrl.startsWith('https://')) {
      setMessage({ type: 'error', text: t('worker_url_https_required') });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/workers/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: newWorkerUrl,
          dailyQuota: parseInt(newWorkerQuota)
        })
      });

      const data = await res.json();

      if (data.success) {
        setMessage({ type: 'success', text: t('worker_added_success') });
        setNewWorkerUrl('');
        setNewWorkerQuota('100000');
        setShowAddForm(false);
        await loadWorkers();
      } else {
        setMessage({ type: 'error', text: data.message || t('add_failed') });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || t('add_failed') });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWorker = async (workerId: string, workerUrl: string) => {
    setConfirmDialog({
      show: true,
      title: t('delete_worker_title'),
      message: t('delete_worker_confirm').replace('{url}', workerUrl),
      onConfirm: async () => {
        setConfirmDialog(null);
        setLoading(true);
        try {
          const res = await fetch('/api/workers/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workerId })
          });

          const data = await res.json();

          if (data.success) {
            setMessage({ type: 'success', text: t('worker_deleted_success') });
            await loadWorkers();
          } else {
            setMessage({ type: 'error', text: data.message || t('delete_failed') });
          }
        } catch (error: any) {
          setMessage({ type: 'error', text: error.message || t('delete_failed') });
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleToggleEnabled = async (workerId: string, currentEnabled: boolean) => {
    setLoading(true);
    try {
      const endpoint = currentEnabled ? '/api/workers/disable' : '/api/workers/enable';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerId })
      });

      const data = await res.json();

      if (data.success) {
        setMessage({
          type: 'success',
          text: currentEnabled ? t('worker_disabled') : t('worker_enabled')
        });
        await loadWorkers();
      } else {
        setMessage({ type: 'error', text: data.message || t('operation_failed') });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || t('operation_failed') });
    } finally {
      setLoading(false);
    }
  };

  const handleTestWorker = async (workerId: string, url: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/workers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerUrl: url })
      });

      const data = await res.json();

      if (data.success && data.data.healthy) {
        setMessage({ type: 'success', text: t('worker_test_success').replace('{time}', data.data.responseTime) });
      } else {
        setMessage({
          type: 'error',
          text: data.data?.message || t('test_failed')
        });
      }

      await loadWorkers();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || t('test_failed') });
    } finally {
      setLoading(false);
    }
  };

  const handleResetQuota = async (workerId: string, workerUrl: string) => {
    setConfirmDialog({
      show: true,
      title: t('reset_quota_title'),
      message: t('reset_quota_confirm').replace('{url}', workerUrl),
      onConfirm: async () => {
        setConfirmDialog(null);
        setLoading(true);
        try {
          const res = await fetch('/api/workers/reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workerId })
          });

          const data = await res.json();

          if (data.success) {
            setMessage({ type: 'success', text: t('quota_reset_success') });
            await loadWorkers();
          } else {
            setMessage({ type: 'error', text: data.message || t('reset_failed') });
          }
        } catch (error: any) {
          setMessage({ type: 'error', text: error.message || t('reset_failed') });
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleUpdateQuota = async (workerId: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/workers/update-quota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId,
          dailyQuota: parseInt(editQuota)
        })
      });

      const data = await res.json();

      if (data.success) {
        setMessage({ type: 'success', text: t('quota_update_success') });
        setEditingWorker(null);
        await loadWorkers();
      } else {
        setMessage({ type: 'error', text: data.message || t('update_failed') });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || t('update_failed') });
    } finally {
      setLoading(false);
    }
  };

  const getQuotaPercentage = (usage: number, quota: number): number => {
    return Math.min((usage / quota) * 100, 100);
  };

  const getQuotaResetCountdown = (resetAt: string): string => {
    const now = new Date();
    const reset = new Date(resetAt);
    const diff = reset.getTime() - now.getTime();

    if (diff <= 0) return t('resetting_soon');

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return t('reset_countdown').replace('{hours}', hours.toString()).replace('{minutes}', minutes.toString());
  };

  const getStatusIcon = (worker: Worker) => {
    if (worker.permanentlyDisabled) {
      return <XCircle className="w-5 h-5 text-rose-500" />;
    }
    if (!worker.enabled) {
      return <AlertTriangle className="w-5 h-5 text-amber-500" />;
    }
    if (worker.healthy) {
      return <CheckCircle className="w-5 h-5 text-emerald-500" />;
    }
    return <AlertTriangle className="w-5 h-5 text-amber-500" />;
  };

  const getStatusText = (worker: Worker) => {
    if (worker.permanentlyDisabled) {
      return <span className="text-rose-600 font-bold">{t('status_blocked')}</span>;
    }
    if (!worker.enabled) {
      return <span className="text-amber-600 font-bold">{t('status_disabled')}</span>;
    }
    if (worker.healthy) {
      return <span className="text-emerald-600 font-bold">{t('status_healthy')}</span>;
    }
    return <span className="text-amber-600 font-bold">{t('status_unhealthy')}</span>;
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Confirmation Dialog */}
      {confirmDialog?.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel p-8 rounded-3xl max-w-md w-full mx-4 shadow-2xl animate-scale-in border-2 border-slate-200">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 rounded-xl bg-rose-100">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-slate-800 mb-2">
                  {confirmDialog.title}
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  {confirmDialog.message}
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-6 py-2.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all font-bold"
              >
                取消
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white transition-all shadow-lg shadow-rose-200 font-bold"
              >
                {t('confirm_delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between glass-panel p-4 rounded-2xl">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-200">
            <Server className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">{t('worker_management')}</h2>
            <p className="text-slate-500 text-sm font-medium">{t('worker_management_desc')}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadWorkers}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-all shadow-sm hover:shadow-md flex items-center gap-2 hover-jelly hover-lift font-bold"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white transition-all shadow-lg shadow-blue-200 hover:shadow-blue-300 flex items-center gap-2 hover-jelly hover-lift font-bold"
          >
            <Plus className="w-4 h-4" />
            {t('add_worker')}
          </button>
        </div>
      </div>

      {/* Message Toast */}
      {message && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-droplet pointer-events-none">
          <div className={`px-6 py-3 rounded-2xl border shadow-2xl flex items-center gap-3 backdrop-blur-md ${message.type === 'success'
              ? 'bg-emerald-50/90 border-emerald-200 text-emerald-700'
              : 'bg-rose-50/90 border-rose-200 text-rose-700'
            }`}>
            <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${message.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'
              }`}></div>
            <span className="font-bold text-sm tracking-wide">{message.text}</span>
          </div>
        </div>
      )}

      {/* Add Worker Form */}
      {showAddForm && (
        <div className="glass-panel p-6 rounded-3xl space-y-4 border-2 border-blue-200">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-600" />
            {t('add_new_worker')}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-2">{t('worker_url')}</label>
              <input
                type="text"
                value={newWorkerUrl}
                onChange={(e) => setNewWorkerUrl(e.target.value)}
                className="glass-input w-full rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-blue-200 transition-all font-medium"
                placeholder="https://your-worker.workers.dev"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-600 mb-2">{t('daily_quota')}</label>
              <input
                type="number"
                value={newWorkerQuota}
                onChange={(e) => setNewWorkerQuota(e.target.value)}
                className="glass-input w-full rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-blue-200 transition-all font-medium"
                min="1000"
                max="1000000"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all font-bold"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleAddWorker}
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white transition-all shadow-lg font-bold"
            >
              {t('add')}
            </button>
          </div>
        </div>
      )}

      {/* Workers Table */}
      <div className="glass-panel rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-slate-50 to-slate-100">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">{t('status')}</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">{t('worker_url')}</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">{t('quota_usage')}</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">{t('stats')}</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">{t('quota_reset')}</th>
                <th className="px-6 py-4 text-right text-sm font-bold text-slate-700">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    {t('no_workers_hint')}
                  </td>
                </tr>
              ) : (
                workers.map((worker) => (
                  <tr key={worker.id} className="hover:bg-slate-50 transition-colors">
                    {/* 状态 */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(worker)}
                        {getStatusText(worker)}
                      </div>
                      {worker.permanentlyDisabled && worker.disabledReason && (
                        <div className="mt-1 text-xs text-rose-600">
                          {worker.disabledReason}
                        </div>
                      )}
                    </td>

                    {/* Worker URL */}
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800 break-all max-w-xs">
                        {worker.url}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        ID: {worker.id}
                      </div>
                    </td>

                    {/* 配额使用 */}
                    <td className="px-6 py-4">
                      {editingWorker === worker.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={editQuota}
                            onChange={(e) => setEditQuota(e.target.value)}
                            className="w-32 px-3 py-1 rounded-lg border border-slate-300 text-sm"
                            min="1000"
                            max="1000000"
                          />
                          <button
                            onClick={() => handleUpdateQuota(worker.id)}
                            className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700"
                          >
                            {t('save')}
                          </button>
                          <button
                            onClick={() => setEditingWorker(null)}
                            className="px-3 py-1 bg-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-300"
                          >
                            {t('cancel')}
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-slate-700">
                              {worker.dailyUsage.toLocaleString()} / {worker.dailyQuota.toLocaleString()}
                            </span>
                            <button
                              onClick={() => {
                                setEditingWorker(worker.id);
                                setEditQuota(worker.dailyQuota.toString());
                              }}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full transition-all ${getQuotaPercentage(worker.dailyUsage, worker.dailyQuota) >= 90
                                  ? 'bg-rose-500'
                                  : getQuotaPercentage(worker.dailyUsage, worker.dailyQuota) >= 70
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                                }`}
                              style={{ width: `${getQuotaPercentage(worker.dailyUsage, worker.dailyQuota)}%` }}
                            />
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {t('quota_used_percent').replace('{percent}', getQuotaPercentage(worker.dailyUsage, worker.dailyQuota).toFixed(1))}
                          </div>
                        </div>
                      )}
                    </td>

                    {/* 统计 */}
                    <td className="px-6 py-4">
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                          <span className="text-slate-600">{t('success_label')}</span>
                          <span className="font-bold text-emerald-600">{worker.successCount}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <XCircle className="w-4 h-4 text-rose-500" />
                          <span className="text-slate-600">{t('failed_label')}</span>
                          <span className="font-bold text-rose-600">{worker.errorCount}</span>
                        </div>
                      </div>
                    </td>

                    {/* 配额重置 */}
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-600">
                        {getQuotaResetCountdown(worker.quotaResetAt)}
                      </div>
                    </td>

                    {/* 操作 */}
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {/* 启用/禁用切换 */}
                        <button
                          onClick={() => handleToggleEnabled(worker.id, worker.enabled)}
                          disabled={loading || worker.permanentlyDisabled}
                          className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${worker.enabled
                              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                              : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            } ${worker.permanentlyDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title={worker.permanentlyDisabled ? t('permanently_disabled_tooltip') : ''}
                        >
                          {worker.enabled ? t('disable') : t('enable')}
                        </button>

                        {/* 测试 */}
                        <button
                          onClick={() => handleTestWorker(worker.id, worker.url)}
                          disabled={loading}
                          className="px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 text-sm font-bold transition-all"
                          title={t('test_connection')}
                        >
                          <Activity className="w-4 h-4" />
                        </button>

                        {/* 重置配额 */}
                        <button
                          onClick={() => handleResetQuota(worker.id, worker.url)}
                          disabled={loading}
                          className="px-3 py-1.5 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 text-sm font-bold transition-all"
                          title={t('reset_quota_title')}
                        >
                          <Zap className="w-4 h-4" />
                        </button>

                        {/* 删除 */}
                        <button
                          onClick={() => handleDeleteWorker(worker.id, worker.url)}
                          disabled={loading}
                          className="px-3 py-1.5 rounded-lg bg-rose-100 text-rose-700 hover:bg-rose-200 text-sm font-bold transition-all"
                          title={t('delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Stats */}
      {workers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass-panel p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-slate-600">{t('total_workers')}</span>
              <Server className="w-5 h-5 text-slate-400" />
            </div>
            <div className="text-3xl font-bold text-slate-800">{workers.length}</div>
          </div>

          <div className="glass-panel p-6 rounded-2xl border-l-4 border-emerald-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-emerald-600">{t('status_healthy')}</span>
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="text-3xl font-bold text-emerald-600">
              {workers.filter(w => w.healthy && w.enabled && !w.permanentlyDisabled).length}
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl border-l-4 border-amber-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-amber-600">{t('status_disabled')}</span>
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>
            <div className="text-3xl font-bold text-amber-600">
              {workers.filter(w => !w.enabled).length}
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl border-l-4 border-rose-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-rose-600">{t('status_blocked')}</span>
              <XCircle className="w-5 h-5 text-rose-500" />
            </div>
            <div className="text-3xl font-bold text-rose-600">
              {workers.filter(w => w.permanentlyDisabled).length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
