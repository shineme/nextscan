'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, Plus, Trash2, Eye, Shield, Zap, Globe, FileCode, FileText } from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import { TemplateManagement } from './TemplateManagement';

interface SettingsData {
  csv_url: string;
  max_concurrency: string;
  request_timeout: string;
  retry_count: string;
  enable_protocol_fallback: string;
  enable_subdomain_discovery: string;
  common_subdomains: string;
  path_templates: string;
  enable_worker_mode: string;
  worker_urls: string;
  worker_batch_size: string;
  worker_timeout: string;
  worker_daily_quota: string;
  automation_incremental_enabled: string;
  automation_rescan_enabled: string;
}

export default function SettingsView() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'general' | 'templates'>('general');
  const [settings, setSettings] = useState<SettingsData>({
    csv_url: '',
    max_concurrency: '100',
    request_timeout: '10',
    retry_count: '2',
    enable_protocol_fallback: 'true',
    enable_subdomain_discovery: 'false',
    common_subdomains: '',
    path_templates: '',
    enable_worker_mode: 'false',
    worker_urls: '[]',
    worker_batch_size: '10',
    worker_timeout: '10000',
    worker_daily_quota: '100000',
    automation_incremental_enabled: 'true',
    automation_rescan_enabled: 'false'
  });

  // const [templates, setTemplates] = useState<string[]>([]);
  const [newTemplate, setNewTemplate] = useState('');
  const [previewTemplate, setPreviewTemplate] = useState('');
  const [previewResult, setPreviewResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' | 'info') => {
    setMessage({ type: type === 'info' ? 'success' : type, text: msg });
  };

  useEffect(() => {
    loadSettings();
    // loadTemplates(); // 已移至TemplateManagement组件
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success) {
        setSettings(data.data);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      const data = await res.json();

      if (data.success) {
        setMessage({ type: 'success', text: t('config_saved') });
      } else {
        setMessage({ type: 'error', text: data.message || t('save_failed') });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || t('save_failed') });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!confirm(t('reset_confirm'))) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/settings/reset', {
        method: 'PUT'
      });

      const data = await res.json();

      if (data.success) {
        setMessage({ type: 'success', text: t('config_reset') });
        await loadSettings();
      } else {
        setMessage({ type: 'error', text: data.message || t('reset_failed') });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || t('reset_failed') });
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    if (!previewTemplate.trim()) {
      return;
    }

    try {
      const res = await fetch('/api/templates/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: previewTemplate, domain: 'example.com' })
      });

      const data = await res.json();

      if (data.success) {
        setPreviewResult(data.data.preview);
      } else {
        setPreviewResult(`${t('error_prefix')}${data.message}`);
      }
    } catch (error: any) {
      setPreviewResult(`${t('error_prefix')}${error.message}`);
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between glass-panel p-4 rounded-2xl">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-200">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">{t('system_settings')}</h2>
            <p className="text-slate-500 text-sm font-medium">{t('system_settings_desc')}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleReset}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-all shadow-sm hover:shadow-md flex items-center gap-2 hover-jelly hover-lift font-bold"
          >
            <RotateCcw className="w-4 h-4" />
            {t('reset')}
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white transition-all shadow-lg shadow-indigo-200 hover:shadow-indigo-300 flex items-center gap-2 hover-jelly hover-lift font-bold"
          >
            <Save className="w-4 h-4" />
            {t('save_config')}
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
            <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${message.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
            <span className="font-bold text-sm tracking-wide">{message.text}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="glass-panel rounded-2xl p-2 flex gap-2">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex-1 px-6 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'general'
            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-200'
            : 'text-slate-600 hover:bg-slate-50'
            }`}
        >
          <Settings className="w-4 h-4 inline mr-2" />
          {t('general_settings')}
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`flex-1 px-6 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'templates'
            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-200'
            : 'text-slate-600 hover:bg-slate-50'
            }`}
        >
          <FileText className="w-4 h-4 inline mr-2" />
          {t('path_templates')}
        </button>
      </div>

      {activeTab === 'templates' ? (
        <TemplateManagement showToast={showToast} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CSV配置 */}
          <div className="glass-panel p-8 rounded-3xl space-y-6 hover-lift border border-white/60">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">{t('csv_source')}</h3>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-600 mb-2 ml-1">{t('remote_url')}</label>
              <input
                type="text"
                value={settings.csv_url}
                onChange={(e) => setSettings({ ...settings, csv_url: e.target.value })}
                className="glass-input w-full rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-indigo-200 transition-all font-medium"
                placeholder="https://example.com/data.csv"
              />
              <p className="text-xs text-slate-400 mt-2 ml-1">{t('csv_source_desc')}</p>
            </div>
          </div>

          {/* 自动化调度器 */}
          <div className="glass-panel p-8 rounded-3xl space-y-6 hover-lift border border-white/60">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">{t('automation_scheduler')}</h3>
            </div>

            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer group p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.automation_incremental_enabled === 'true'}
                    onChange={(e) => setSettings({ ...settings, automation_incremental_enabled: e.target.checked ? 'true' : 'false' })}
                    className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-300 shadow-sm transition-all checked:border-emerald-500 checked:bg-emerald-500 hover:border-emerald-400"
                  />
                  <div className="pointer-events-none absolute top-2/4 left-2/4 -translate-x-2/4 -translate-y-2/4 text-white opacity-0 transition-opacity peer-checked:opacity-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" stroke="currentColor" strokeWidth="1">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                    </svg>
                  </div>
                </div>
                <div className="flex-1">
                  <span className="text-slate-700 font-medium group-hover:text-emerald-700 transition-colors block">{t('enable_incremental_scan')}</span>
                  <span className="text-xs text-slate-400 mt-1 block">{t('enable_incremental_scan_desc')}</span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer group p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.automation_rescan_enabled === 'true'}
                    onChange={(e) => setSettings({ ...settings, automation_rescan_enabled: e.target.checked ? 'true' : 'false' })}
                    className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-300 shadow-sm transition-all checked:border-emerald-500 checked:bg-emerald-500 hover:border-emerald-400"
                  />
                  <div className="pointer-events-none absolute top-2/4 left-2/4 -translate-x-2/4 -translate-y-2/4 text-white opacity-0 transition-opacity peer-checked:opacity-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" stroke="currentColor" strokeWidth="1">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                    </svg>
                  </div>
                </div>
                <div className="flex-1">
                  <span className="text-slate-700 font-medium group-hover:text-emerald-700 transition-colors block">{t('enable_full_rescan')}</span>
                  <span className="text-xs text-slate-400 mt-1 block">{t('enable_full_rescan_desc')}</span>
                </div>
              </label>

              {/* Manual trigger buttons */}
              <div className="pt-4 border-t border-slate-200">
                <p className="text-sm text-slate-600 mb-3">{t('manual_trigger')}</p>
                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      try {
                        setLoading(true);
                        const res = await fetch('/api/automation/scheduler', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'start' })
                        });
                        const data = await res.json();
                        if (data.success) {
                          setMessage({ type: 'success', text: t('scheduler_started') });
                        }
                      } catch (error) {
                        setMessage({ type: 'error', text: t('start_scheduler_failed') });
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors"
                  >
                    {t('start_scheduler')}
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        setLoading(true);
                        const res = await fetch('/api/automation/trigger', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ type: 'incremental' })
                        });
                        const data = await res.json();
                        if (data.success) {
                          setMessage({ type: 'success', text: t('incremental_scan_triggered') });
                        }
                      } catch (error) {
                        setMessage({ type: 'error', text: t('trigger_failed') });
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
                  >
                    {t('trigger_incremental_scan')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 协议和子域名 */}
          <div className="glass-panel p-8 rounded-3xl space-y-6 hover-lift border border-white/60">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                <Globe className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">{t('scan_options')}</h3>
            </div>

            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer group p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.enable_protocol_fallback === 'true'}
                    onChange={(e) => setSettings({ ...settings, enable_protocol_fallback: e.target.checked ? 'true' : 'false' })}
                    className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-300 shadow-sm transition-all checked:border-indigo-500 checked:bg-indigo-500 hover:border-indigo-400"
                  />
                  <div className="pointer-events-none absolute top-2/4 left-2/4 -translate-x-2/4 -translate-y-2/4 text-white opacity-0 transition-opacity peer-checked:opacity-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" stroke="currentColor" strokeWidth="1">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                    </svg>
                  </div>
                </div>
                <span className="text-slate-700 font-medium group-hover:text-indigo-700 transition-colors">{t('enable_protocol_fallback')}</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer group p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.enable_subdomain_discovery === 'true'}
                    onChange={(e) => setSettings({ ...settings, enable_subdomain_discovery: e.target.checked ? 'true' : 'false' })}
                    className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-300 shadow-sm transition-all checked:border-indigo-500 checked:bg-indigo-500 hover:border-indigo-400"
                  />
                  <div className="pointer-events-none absolute top-2/4 left-2/4 -translate-x-2/4 -translate-y-2/4 text-white opacity-0 transition-opacity peer-checked:opacity-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" stroke="currentColor" strokeWidth="1">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                    </svg>
                  </div>
                </div>
                <span className="text-slate-700 font-medium group-hover:text-indigo-700 transition-colors">{t('enable_subdomain_discovery')}</span>
              </label>

              <div>
                <label className="block text-sm font-bold text-slate-600 mb-2 ml-1">{t('common_subdomains')}</label>
                <input
                  type="text"
                  value={settings.common_subdomains}
                  onChange={(e) => setSettings({ ...settings, common_subdomains: e.target.value })}
                  className="glass-input w-full rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-indigo-200 transition-all font-medium"
                  placeholder="www,api,admin,test,dev,staging"
                />
              </div>
            </div>
          </div>

          {/* 并发参数 */}
          <div className="glass-panel p-8 rounded-3xl space-y-6 hover-lift border border-white/60">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">{t('concurrency_params')}</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-2 ml-1">{t('max_concurrency')}</label>
                <input
                  type="number"
                  value={settings.max_concurrency}
                  onChange={(e) => setSettings({ ...settings, max_concurrency: e.target.value })}
                  className="glass-input w-full rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-indigo-200 transition-all font-medium"
                  min="1"
                  max="1000"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-2 ml-1">{t('request_timeout')}</label>
                <input
                  type="number"
                  value={settings.request_timeout}
                  onChange={(e) => setSettings({ ...settings, request_timeout: e.target.value })}
                  className="glass-input w-full rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-indigo-200 transition-all font-medium"
                  min="1"
                  max="60"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-2 ml-1">{t('retry_count')}</label>
                <input
                  type="number"
                  value={settings.retry_count}
                  onChange={(e) => setSettings({ ...settings, retry_count: e.target.value })}
                  className="glass-input w-full rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-indigo-200 transition-all font-medium"
                  min="0"
                  max="5"
                />
              </div>
            </div>
          </div>

          {/* Worker配置 */}
          <div className="glass-panel p-8 rounded-3xl space-y-6 hover-lift border border-white/60 lg:col-span-2">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                <Globe className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">{t('worker_config')}</h3>
            </div>

            <div className="space-y-6">
              {/* Enable Worker Mode */}
              <label className="flex items-center gap-3 cursor-pointer group p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.enable_worker_mode === 'true'}
                    onChange={(e) => setSettings({ ...settings, enable_worker_mode: e.target.checked ? 'true' : 'false' })}
                    className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-300 shadow-sm transition-all checked:border-indigo-500 checked:bg-indigo-500 hover:border-indigo-400"
                  />
                  <div className="pointer-events-none absolute top-2/4 left-2/4 -translate-x-2/4 -translate-y-2/4 text-white opacity-0 transition-opacity peer-checked:opacity-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" stroke="currentColor" strokeWidth="1">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                    </svg>
                  </div>
                </div>
                <span className="text-slate-700 font-medium group-hover:text-indigo-700 transition-colors">{t('enable_worker_mode')}</span>
              </label>

              {/* Worker URLs */}
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-2 ml-1">{t('worker_urls')}</label>
                <textarea
                  value={(() => {
                    try {
                      const urls = JSON.parse(settings.worker_urls);
                      return Array.isArray(urls) ? urls.join('\n') : '';
                    } catch {
                      return '';
                    }
                  })()}
                  onChange={(e) => {
                    const urls = e.target.value.split('\n').map(u => u.trim()).filter(u => u.length > 0);
                    setSettings({ ...settings, worker_urls: JSON.stringify(urls) });
                  }}
                  className="glass-input w-full rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-indigo-200 transition-all font-medium"
                  placeholder="https://worker1.example.com&#10;https://worker2.example.com"
                  rows={4}
                />
                <p className="text-xs text-slate-400 mt-2 ml-1">{t('worker_urls_desc')}</p>
              </div>

              {/* Worker Parameters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2 ml-1">{t('batch_size')}</label>
                  <input
                    type="number"
                    value={settings.worker_batch_size}
                    onChange={(e) => setSettings({ ...settings, worker_batch_size: e.target.value })}
                    className="glass-input w-full rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-indigo-200 transition-all font-medium"
                    min="1"
                    max="100"
                  />
                  <p className="text-xs text-slate-400 mt-2 ml-1">{t('batch_size_desc')}</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2 ml-1">{t('worker_timeout')}</label>
                  <input
                    type="number"
                    value={settings.worker_timeout}
                    onChange={(e) => setSettings({ ...settings, worker_timeout: e.target.value })}
                    className="glass-input w-full rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-indigo-200 transition-all font-medium"
                    min="1000"
                    max="60000"
                  />
                  <p className="text-xs text-slate-400 mt-2 ml-1">{t('worker_timeout_desc')}</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2 ml-1">{t('daily_quota')}</label>
                  <input
                    type="number"
                    value={settings.worker_daily_quota}
                    onChange={(e) => setSettings({ ...settings, worker_daily_quota: e.target.value })}
                    className="glass-input w-full rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-indigo-200 transition-all font-medium"
                    min="1000"
                    max="1000000"
                  />
                  <p className="text-xs text-slate-400 mt-2 ml-1">{t('daily_quota_desc')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 路径模板 */}
          <div className="glass-panel p-8 rounded-3xl space-y-6 hover-lift border border-white/60">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                <FileCode className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">{t('path_template_management')}</h3>
            </div>

            {/* 添加模板 */}
            <div className="flex gap-3">
              <input
                type="text"
                value={newTemplate}
                onChange={(e) => setNewTemplate(e.target.value)}
                className="glass-input flex-1 rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-indigo-200 transition-all font-medium"
                placeholder={t('enter_new_template')}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
