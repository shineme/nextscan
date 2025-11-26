'use client';

import React, { useState, useEffect } from 'react';
import { Server, CheckCircle, XCircle, AlertTriangle, RefreshCw, Activity } from 'lucide-react';
import { useTranslation } from '../lib/i18n';

interface WorkerStatus {
  id: string;
  url: string;
  healthy: boolean;
  dailyUsage: number;
  dailyQuota: number;
  permanentlyDisabled: boolean;
  disabledReason: string | null;
  errorCount: number;
  successCount: number;
  quotaResetAt: string;
}

interface WorkerPoolStats {
  totalWorkers: number;
  healthyWorkers: number;
  unhealthyWorkers: number;
  disabledWorkers: number;
  totalRequests: number;
  totalSuccesses: number;
  totalFailures: number;
}

export default function WorkerStatusDisplay() {
  const { t } = useTranslation();
  const [workers, setWorkers] = useState<WorkerStatus[]>([]);
  const [stats, setStats] = useState<WorkerPoolStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadWorkerStatus();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadWorkerStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadWorkerStatus = async () => {
    try {
      const res = await fetch('/api/workers/status');
      const data = await res.json();

      if (data.success) {
        setWorkers(data.data.workers || []);
        setStats(data.data.stats || null);
      }
    } catch (error) {
      console.error('Failed to load worker status:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadWorkerStatus();
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleEnableWorker = async (workerId: string) => {
    try {
      const res = await fetch('/api/workers/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerId })
      });

      const data = await res.json();

      if (data.success) {
        await loadWorkerStatus();
      }
    } catch (error) {
      console.error('Failed to enable worker:', error);
    }
  };

  const getQuotaPercentage = (usage: number, quota: number): number => {
    return Math.min((usage / quota) * 100, 100);
  };

  const getQuotaResetCountdown = (resetAt: string): string => {
    const now = new Date();
    const reset = new Date(resetAt);
    const diff = reset.getTime() - now.getTime();

    if (diff <= 0) return t('resetting');

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  };

  if (!stats) {
    return (
      <div className="glass-panel p-8 rounded-3xl text-center">
        <p className="text-slate-500">{t('worker_mode_not_enabled')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between glass-panel p-4 rounded-2xl">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-200">
            <Server className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">{t('worker_pool_status')}</h2>
            <p className="text-slate-500 text-sm font-medium">{t('worker_pool_desc')}</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-all shadow-sm hover:shadow-md flex items-center gap-2 hover-jelly hover-lift font-bold"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-panel p-6 rounded-2xl hover-lift">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-slate-600">{t('total_workers')}</span>
            <Server className="w-5 h-5 text-slate-400" />
          </div>
          <div className="text-3xl font-bold text-slate-800">{stats.totalWorkers}</div>
        </div>

        <div className="glass-panel p-6 rounded-2xl hover-lift border-l-4 border-emerald-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-emerald-600">{t('status_healthy')}</span>
            <CheckCircle className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-3xl font-bold text-emerald-600">{stats.healthyWorkers}</div>
        </div>

        <div className="glass-panel p-6 rounded-2xl hover-lift border-l-4 border-amber-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-amber-600">{t('status_unhealthy')}</span>
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-3xl font-bold text-amber-600">{stats.unhealthyWorkers}</div>
        </div>

        <div className="glass-panel p-6 rounded-2xl hover-lift border-l-4 border-rose-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-rose-600">{t('status_disabled')}</span>
            <XCircle className="w-5 h-5 text-rose-500" />
          </div>
          <div className="text-3xl font-bold text-rose-600">{stats.disabledWorkers}</div>
        </div>
      </div>

      {/* Worker List */}
      <div className="glass-panel p-6 rounded-3xl space-y-4">
        <h3 className="text-lg font-bold text-slate-800 mb-4">{t('worker_endpoints')}</h3>

        {workers.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            {t('no_workers_configured')}
          </div>
        ) : (
          <div className="space-y-3">
            {workers.map((worker) => (
              <div
                key={worker.id}
                className={`p-5 rounded-2xl border-2 transition-all hover-lift ${worker.permanentlyDisabled
                  ? 'bg-rose-50 border-rose-200'
                  : worker.healthy
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-amber-50 border-amber-200'
                  }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Worker URL and Status */}
                    <div className="flex items-center gap-3 mb-3">
                      {worker.permanentlyDisabled ? (
                        <XCircle className="w-5 h-5 text-rose-500" />
                      ) : worker.healthy ? (
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                      )}
                      <span className="font-bold text-slate-800">{worker.url}</span>
                      {worker.permanentlyDisabled && (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-200 text-rose-700">
                          {worker.disabledReason || t('status_disabled')}
                        </span>
                      )}
                    </div>

                    {/* Quota Usage */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-600">
                          {t('daily_usage_stat').replace('{usage}', worker.dailyUsage.toLocaleString()).replace('{quota}', worker.dailyQuota.toLocaleString())}
                        </span>
                        <span className="text-xs font-bold text-slate-500">
                          {t('quota_used_percent').replace('{percent}', getQuotaPercentage(worker.dailyUsage, worker.dailyQuota).toFixed(1))}
                        </span>
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
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-600">
                          {t('success_stat')}<span className="font-bold text-emerald-600">{worker.successCount}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-600">
                          {t('errors_stat')}<span className="font-bold text-rose-600">{worker.errorCount}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-600">
                          {t('reset_in')}<span className="font-bold text-indigo-600">{getQuotaResetCountdown(worker.quotaResetAt)}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {worker.permanentlyDisabled && (
                    <button
                      onClick={() => handleEnableWorker(worker.id)}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-all shadow-lg hover:shadow-xl"
                    >
                      {t('re_enable')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
