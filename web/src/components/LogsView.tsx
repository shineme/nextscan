/**
 * Real-time System Logs View
 * Waterfall-style scrolling logs with real-time updates
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Filter,
  Pause,
  Play,
  RotateCcw,
  Search,
  Zap,
  Globe,
  Settings,
  Wind,
  Database,
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle,
  Bug
} from 'lucide-react';
import { SystemLog, LogLevel, LogCategory } from '@/lib/logger-service';
import { useTranslation } from '../lib/i18n';

interface LogsViewProps {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const LogsView = ({ showToast }: LogsViewProps) => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<LogCategory | 'all'>('all');
  const [selectedLevel, setSelectedLevel] = useState<LogLevel | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState<any>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastTimestamp = useRef<string>('');

  // Fetch initial logs
  const fetchLogs = async (isInitial = false) => {
    try {
      const url = isInitial || !lastTimestamp.current
        ? '/api/logs?limit=100'
        : `/api/logs?since=${lastTimestamp.current}`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        if (isInitial) {
          // Reverse to show oldest first (waterfall style)
          const reversedData = [...data.data].reverse();
          setLogs(reversedData);
          if (data.data.length > 0) {
            lastTimestamp.current = data.data[0].timestamp;
          }
        } else {
          // Add new logs to the end (waterfall style - newest at bottom)
          if (data.data.length > 0) {
            // Reverse new logs so oldest of the new batch comes first
            const reversedNewLogs = [...data.data].reverse();
            setLogs(prev => [...prev, ...reversedNewLogs]);
            lastTimestamp.current = data.data[0].timestamp;
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch statistics
  const fetchStats = async () => {
    try {
      const res = await fetch('/api/logs/stats');
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Filter logs
  useEffect(() => {
    let filtered = logs;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(log => log.category === selectedCategory);
    }

    if (selectedLevel !== 'all') {
      filtered = filtered.filter(log => log.level === selectedLevel);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(log =>
        log.message.toLowerCase().includes(term) ||
        log.domain?.toLowerCase().includes(term) ||
        log.url?.toLowerCase().includes(term) ||
        log.details?.toLowerCase().includes(term)
      );
    }

    setFilteredLogs(filtered);
  }, [logs, selectedCategory, selectedLevel, searchTerm]);

  // Auto-scroll when new logs arrive
  useEffect(() => {
    scrollToBottom();
  }, [filteredLogs, autoScroll]);

  // Set up real-time updates
  useEffect(() => {
    fetchLogs(true);
    fetchStats();

    if (!isPaused) {
      intervalRef.current = setInterval(() => {
        fetchLogs(false);
        fetchStats();
      }, 2000); // Update every 2 seconds
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPaused]);

  // Toggle pause/resume
  const togglePause = () => {
    setIsPaused(!isPaused);
    showToast(isPaused ? t('logs_resumed') : t('logs_paused'), 'info');
  };

  // Clear logs
  const clearLogs = async () => {
    if (confirm(t('clear_logs_confirm'))) {
      try {
        const res = await fetch('/api/logs', { method: 'DELETE' });
        const data = await res.json();
        
        if (data.success) {
          setLogs([]);
          setFilteredLogs([]);
          lastTimestamp.current = '';
          fetchStats(); // 刷新统计数据
          showToast(t('logs_cleared').replace('{count}', data.deletedCount || '0'), 'success');
        } else {
          showToast(data.message || t('failed_clear_logs'), 'error');
        }
      } catch (error) {
        showToast(t('failed_clear_logs'), 'error');
      }
    }
  };

  // Get icon for log level
  const getLevelIcon = (level: LogLevel) => {
    switch (level) {
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warn': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'debug': return <Bug className="w-4 h-4 text-gray-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  // Get icon for category
  const getCategoryIcon = (category: LogCategory) => {
    switch (category) {
      case 'scanner': return <Search className="w-4 h-4" />;
      case 'automation': return <Zap className="w-4 h-4" />;
      case 'domain': return <Globe className="w-4 h-4" />;
      case 'worker': return <Wind className="w-4 h-4" />;
      case 'api': return <Database className="w-4 h-4" />;
      default: return <Settings className="w-4 h-4" />;
    }
  };

  // Get level color classes
  const getLevelClasses = (level: LogLevel) => {
    switch (level) {
      case 'error': return 'border-l-red-500 bg-red-50/50';
      case 'warn': return 'border-l-yellow-500 bg-yellow-50/50';
      case 'success': return 'border-l-green-500 bg-green-50/50';
      case 'debug': return 'border-l-gray-500 bg-gray-50/50';
      default: return 'border-l-blue-500 bg-blue-50/50';
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header with controls */}
      <div className="glass-panel p-6 rounded-3xl">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Activity className="w-6 h-6 text-indigo-600" />
              {t('system_activity')}
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              {t('system_activity_desc')}
              {stats && (
                <span className="ml-2 text-indigo-600 font-semibold">
                  {t('total_logs_count').replace('{total}', stats.total)}
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={togglePause}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all ${isPaused
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
                }`}
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              {isPaused ? t('resume') : t('pause')}
            </button>

            <button
              onClick={clearLogs}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              {t('clear')}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('search_logs_placeholder')}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-all"
            />
          </div>

          {/* Category filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as LogCategory | 'all')}
            className="px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-all"
          >
            <option value="all">{t('all_categories')}</option>
            <option value="system">{t('category_system')}</option>
            <option value="scanner">{t('category_scanner')}</option>
            <option value="automation">{t('category_automation')}</option>
            <option value="worker">{t('category_worker')}</option>
            <option value="domain">{t('category_domain')}</option>
            <option value="api">{t('category_api')}</option>
          </select>

          {/* Level filter */}
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value as LogLevel | 'all')}
            className="px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-all"
          >
            <option value="all">{t('all_levels')}</option>
            <option value="debug">{t('level_debug')}</option>
            <option value="info">{t('level_info')}</option>
            <option value="success">{t('level_success')}</option>
            <option value="warn">{t('level_warning')}</option>
            <option value="error">{t('level_error')}</option>
          </select>

          {/* Auto-scroll toggle */}
          <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-all">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm font-medium text-slate-700">{t('auto_scroll')}</span>
          </label>
        </div>
      </div>

      {/* Logs container */}
      <div className="glass-panel rounded-3xl overflow-hidden">
        <div className="h-96 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-slate-500">{t('loading_logs')}</div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-slate-500">{t('no_logs_found')}</div>
            </div>
          ) : (
            filteredLogs.map((log, index) => (
              <div
                key={`${log.id}-${index}`}
                className={`p-3 rounded-lg border-l-4 transition-all hover:shadow-sm ${getLevelClasses(log.level)
                  }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {getLevelIcon(log.level)}
                    {getCategoryIcon(log.category)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-slate-500">
                        {new Date(log.timestamp).toLocaleString('zh-CN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: false
                        })}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                        {log.category}
                      </span>
                      {log.domain && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-medium">
                          {log.domain}
                        </span>
                      )}
                      {log.response_code && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${log.response_code >= 200 && log.response_code < 300
                            ? 'bg-green-100 text-green-600'
                            : log.response_code >= 400
                              ? 'bg-red-100 text-red-600'
                              : 'bg-yellow-100 text-yellow-600'
                          }`}>
                          {log.response_code}
                        </span>
                      )}
                      {log.response_time && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-600 font-medium">
                          {log.response_time}ms
                        </span>
                      )}
                    </div>

                    <div className="text-sm text-slate-700 font-medium mb-1">
                      {log.message}
                    </div>

                    {log.url && (
                      <div className="text-xs text-slate-500 font-mono truncate">
                        {log.url}
                      </div>
                    )}

                    {log.details && (
                      <div className="text-xs text-slate-600 mt-1 p-2 bg-slate-50 rounded border">
                        {log.details}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="glass-panel p-6 rounded-3xl">
          <h3 className="text-lg font-bold text-slate-800 mb-4">{t('log_statistics')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(stats.byLevel).map(([level, count]) => (
              <div key={level} className="text-center p-3 bg-white/60 rounded-xl">
                <div className="flex items-center justify-center mb-1">
                  {getLevelIcon(level as LogLevel)}
                </div>
                <div className="text-lg font-bold text-slate-700">{count as number}</div>
                <div className="text-xs text-slate-500 capitalize">{level}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export { LogsView };
export default LogsView;
