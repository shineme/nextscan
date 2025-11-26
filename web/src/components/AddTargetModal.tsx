'use client';

import React, { useState } from 'react';
import { XCircle, Plus } from 'lucide-react';
import { useTranslation } from '../lib/i18n';

interface AddTargetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const AddTargetModal = ({ isOpen, onClose, onSuccess, showToast }: AddTargetModalProps) => {
  const { t } = useTranslation();
  const [targets, setTargets] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!targets.trim()) {
      showToast(t('enter_at_least_one_target'), 'error');
      return;
    }

    setLoading(true);
    try {
      // 解析目标列表(支持换行、逗号、空格分隔)
      const targetList = targets
        .split(/[\n,\s]+/)
        .map(t => t.trim())
        .filter(t => t.length > 0);

      if (targetList.length === 0) {
        showToast(t('no_valid_targets'), 'error');
        return;
      }

      const res = await fetch('/api/domains/add-targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets: targetList })
      });

      const data = await res.json();

      if (data.success) {
        showToast(t('add_targets_success').replace('{added}', data.data.added).replace('{skipped}', data.data.skipped), 'success');
        onSuccess();
        onClose();
        setTargets('');
      } else {
        showToast(data.message || t('failed_add_targets'), 'error');
      }
    } catch (error) {
      showToast(t('failed_add_targets'), 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 transition-opacity">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white/90 backdrop-blur-xl rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden transform transition-all scale-100 animate-slide-up border border-white/50 m-4">
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-emerald-50/50 to-blue-50/50">
          <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">{t('add_scan_targets')}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-rose-500 transition-colors bg-white p-2 rounded-full shadow-sm hover:shadow hover:rotate-90 duration-300"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">{t('target_domains_label')}</label>
            <textarea
              value={targets}
              onChange={(e) => setTargets(e.target.value)}
              placeholder={t('target_domains_placeholder')}
              rows={8}
              className="w-full glass-input rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200 font-mono text-sm"
            />
            <p className="text-xs text-slate-400 mt-2">
              {t('target_domains_hint')}
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h4 className="font-bold text-blue-800 text-sm mb-2">{t('input_examples')}</h4>
            <div className="text-xs text-blue-600 font-mono space-y-1">
              <div>• example.com</div>
              <div>• www.test.com, api.demo.com</div>
              <div>• sub.domain.org</div>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 bg-slate-50/50 flex justify-end gap-4">
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
            className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 hover:shadow-emerald-300 transform hover:-translate-y-0.5 transition-all hover-scale flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                {t('adding')}
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                {t('add_targets')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
