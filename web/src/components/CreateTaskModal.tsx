'use client';

import React, { useState } from 'react';
import { XCircle, Sparkles } from 'lucide-react';
import { useTranslation } from '../lib/i18n';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const CreateTaskModal = ({ isOpen, onClose, onSuccess, showToast }: CreateTaskModalProps) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [target, setTarget] = useState<'incremental' | 'full'>('incremental');
  const [urlTemplate, setUrlTemplate] = useState('/(host)/backup.zip');
  const [concurrency, setConcurrency] = useState(50);
  const [loading, setLoading] = useState(false);
  const [templatePresets, setTemplatePresets] = useState<string[]>([]);
  const [useAllTemplates, setUseAllTemplates] = useState(false);

  // 加载预设模板
  React.useEffect(() => {
    if (isOpen) {
      fetch('/api/templates?enabled=true')
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            const templates = data.data.map((t: any) => t.template);
            setTemplatePresets(templates);
          }
        })
        .catch(err => console.error('Failed to load templates:', err));
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      showToast(t('enter_task_name'), 'error');
      return;
    }

    let finalTemplate = urlTemplate;

    // 如果使用所有模板,将预设模板合并为逗号分隔的字符串
    if (useAllTemplates && templatePresets.length > 0) {
      finalTemplate = templatePresets.join(',');
    } else if (!urlTemplate.trim()) {
      showToast(t('enter_url_template'), 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          target,
          urlTemplate: finalTemplate,
          concurrency
        })
      });

      const data = await res.json();

      if (data.success) {
        const templateCount = finalTemplate.split(',').length;
        showToast(
          t('task_created_success').replace('{count}', templateCount.toString()),
          'success'
        );
        onSuccess();
        onClose();
        // 重置表单
        setName('');
        setUrlTemplate('(host)/backup.zip');
        setTarget('incremental');
        setConcurrency(50);
        setUseAllTemplates(false);
      } else {
        showToast(data.message || t('failed_create_task'), 'error');
      }
    } catch (error) {
      showToast(t('failed_create_task'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const insertPlaceholder = (placeholder: string) => {
    setUrlTemplate(prev => prev + placeholder);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 transition-opacity">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white/90 backdrop-blur-xl rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden transform transition-all scale-100 animate-slide-up border border-white/50 m-4 max-h-[90vh] flex flex-col">
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-indigo-50/50 to-purple-50/50 flex-shrink-0">
          <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">{t('create_new_task')}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-rose-500 transition-colors bg-white p-2 rounded-full shadow-sm hover:shadow hover:rotate-90 duration-300"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 space-y-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">{t('mission_name')}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('mission_name_placeholder')}
                className="w-full glass-input rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">{t('target_type')}</label>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value as 'incremental' | 'full')}
                className="w-full glass-input rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="incremental">{t('target_incremental')}</option>
                <option value="full">{t('target_full')}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">{t('concurrency')}</label>
            <input
              type="number"
              value={concurrency}
              onChange={(e) => setConcurrency(parseInt(e.target.value) || 50)}
              min="1"
              max="1000"
              className="w-full glass-input rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <p className="text-xs text-slate-400 mt-1">{t('concurrency_desc')}</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">{t('url_pattern_builder')}</label>

            {/* 预设模板选择 */}
            {templatePresets.length > 0 && (
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-600 mb-2">
                  {t('preset_templates')} ({templatePresets.length}个)
                </label>
                <div className="flex gap-2 flex-wrap max-h-32 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                  {templatePresets.map((template, idx) => (
                    <button
                      key={idx}
                      onClick={() => setUrlTemplate(template)}
                      className="bg-white hover:bg-indigo-100 border border-indigo-200 text-xs px-3 py-1.5 rounded-lg text-indigo-700 transition-all shadow-sm font-medium active:scale-95"
                      title={template}
                    >
                      {template.length > 30 ? template.substring(0, 30) + '...' : template}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 批量使用所有模板选项 */}
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useAllTemplates}
                  onChange={(e) => setUseAllTemplates(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-200"
                />
                <span className="text-sm font-bold text-amber-800">
                  {t('use_all_templates').replace('{count}', templatePresets.length.toString())}
                </span>
              </label>
              <p className="text-xs text-amber-600 mt-1 ml-6">
                {t('use_all_templates_desc').replace('{count}', templatePresets.length.toString()).replace('{total}', templatePresets.length.toString())}
              </p>
            </div>

            <div className="bg-slate-50/80 p-6 rounded-2xl border border-dashed border-slate-300 hover:border-indigo-400 transition-colors">
              <div className="flex gap-2 mb-4 flex-wrap">
                {['(host)', '(domain)', '(root_domain)', '(subdomain)', '(domain_underline)', '(domain_dash)', '(year)', '(month)', '(day)', '(date)', '(rank)'].map((p) => (
                  <button
                    key={p}
                    onClick={() => insertPlaceholder(p)}
                    disabled={useAllTemplates}
                    className="bg-white hover:bg-indigo-500 hover:text-white border border-slate-200 text-xs px-3 py-1.5 rounded-lg text-slate-600 transition-all shadow-sm font-bold active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={useAllTemplates ? t('using_all_templates') : urlTemplate}
                  onChange={(e) => setUrlTemplate(e.target.value)}
                  disabled={useAllTemplates}
                  placeholder="(host)/backup_(date).zip"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-indigo-600 font-mono font-bold focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all shadow-inner disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {t('multiple_templates_hint')} <code className="bg-white px-2 py-0.5 rounded">(host)/1.zip,(host)/files.zip</code><br />
                {t('auto_https_hint')}<br />
                {t('example')} <code className="bg-white px-2 py-0.5 rounded">(host)/backup.zip</code> → <code className="bg-white px-2 py-0.5 rounded">https://example.com/backup.zip</code>
              </p>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 bg-slate-50/50 flex justify-end gap-4 flex-shrink-0 border-t border-slate-100">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-6 py-3 text-slate-500 hover:text-slate-800 font-bold hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transform hover:-translate-y-0.5 transition-all hover-scale flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                {t('creating')}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {t('launch_mission')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
