'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit2, Trash2, Save, X, FileText, Wand2 } from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import { COMMON_CONTENT_TYPES, CONTENT_TYPES_BY_CATEGORY } from '@/lib/content-types';
import { TemplateBatchGenerator, GeneratedTemplate } from './TemplateBatchGenerator';

interface Template {
  id: number;
  name: string;
  template: string;
  description: string | null;
  expected_content_type: string | null;
  min_size: number;
  max_size: number | null;
  enabled: number;
  created_at: string;
  updated_at: string;
}

interface TemplateManagementProps {
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

// 确认对话框组件
interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
  isOpen, title, message, confirmText = '确定', cancelText = '取消', 
  type = 'danger', onConfirm, onCancel 
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const typeStyles = {
    danger: { bg: 'bg-rose-50', icon: 'text-rose-600', btn: 'bg-rose-600 hover:bg-rose-700' },
    warning: { bg: 'bg-amber-50', icon: 'text-amber-600', btn: 'bg-amber-600 hover:bg-amber-700' },
    info: { bg: 'bg-blue-50', icon: 'text-blue-600', btn: 'bg-blue-600 hover:bg-blue-700' }
  };
  const styles = typeStyles[type];

  const modalContent = (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center" style={{ zIndex: 99999 }}>
      <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl mx-4">
        <div className={`w-16 h-16 ${styles.bg} rounded-full flex items-center justify-center mx-auto mb-4`}>
          <Trash2 className={`w-8 h-8 ${styles.icon}`} />
        </div>
        <h3 className="text-xl font-bold text-slate-800 text-center mb-2">{title}</h3>
        <p className="text-slate-600 text-center mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-6 py-3 ${styles.btn} text-white font-bold rounded-xl transition-all`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
};

// 进度条组件
interface ProgressModalProps {
  isOpen: boolean;
  title: string;
  current: number;
  total: number;
  successCount: number;
  failCount: number;
}

const ProgressModal: React.FC<ProgressModalProps> = ({ isOpen, title, current, total, successCount, failCount }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;
  
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  const isComplete = current === total && total > 0;
  
  const modalContent = (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center" style={{ zIndex: 99999 }}>
      <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl mx-4">
        <h3 className="text-xl font-bold text-slate-800 mb-6">{title}</h3>
        <div className="mb-4">
          <div className="flex justify-between text-sm text-slate-600 mb-2">
            <span>进度: {current} / {total}</span>
            <span>{percentage}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-300 ease-out ${
                isComplete ? 'bg-gradient-to-r from-emerald-500 to-green-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
        <div className="flex gap-4 text-sm">
          <div className="flex-1 bg-emerald-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-emerald-600">{successCount}</div>
            <div className="text-emerald-700">成功</div>
          </div>
          <div className="flex-1 bg-rose-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-rose-600">{failCount}</div>
            <div className="text-rose-700">失败</div>
          </div>
        </div>
        <p className="text-center text-slate-400 text-sm mt-4">
          {isComplete ? '处理完成！' : '请勿关闭页面，正在处理中...'}
        </p>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
};

export const TemplateManagement = ({ showToast }: TemplateManagementProps) => {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<'manual' | 'batch'>('manual');
  
  // 进度条状态
  const [progressModal, setProgressModal] = useState<ProgressModalProps>({
    isOpen: false,
    title: '',
    current: 0,
    total: 0,
    successCount: 0,
    failCount: 0
  });

  // 确认对话框状态
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'danger',
    onConfirm: () => {}
  });

  const showConfirm = (title: string, message: string, onConfirm: () => void, type: 'danger' | 'warning' | 'info' = 'danger') => {
    setConfirmModal({ isOpen: true, title, message, type, onConfirm });
  };

  const closeConfirm = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  };

  const [formData, setFormData] = useState({
    name: '',
    template: '',
    description: '',
    expected_content_type: '',
    exclude_content_type: 0,
    min_size: 0,
    max_size: '',
    enabled: 1
  });

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      if (data.success) {
        setTemplates(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch templates', error);
      showToast(t('failed_load_templates'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleEdit = (template: Template) => {
    setEditingId(template.id);
    setFormData({
      name: template.name,
      template: template.template,
      description: template.description || '',
      expected_content_type: template.expected_content_type || '',
      exclude_content_type: (template as any).exclude_content_type || 0,
      min_size: template.min_size,
      max_size: template.max_size?.toString() || '',
      enabled: template.enabled
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsCreating(false);
    setFormData({
      name: '',
      template: '',
      description: '',
      expected_content_type: '',
      exclude_content_type: 0,
      min_size: 0,
      max_size: '',
      enabled: 1
    });
  };

  // 智能生成URL模板
  const handleNameChange = (name: string) => {
    setFormData(prev => {
      // 如果template为空或者是默认格式，则自动生成
      const shouldAutoGenerate = !prev.template || prev.template === 'https://(domain)/' || prev.template.startsWith('https://(domain)/');

      if (shouldAutoGenerate && name.trim()) {
        // 从name中提取文件名部分
        // 例如: "Backup ZIP Files" -> "backup.zip"
        // 例如: "upload.zip" -> "upload.zip"
        let filename = name.toLowerCase().trim();

        // 如果已经包含文件扩展名，直接使用
        if (filename.includes('.')) {
          // 移除多余的空格和特殊字符
          filename = filename.replace(/[^a-z0-9.-]/g, '');
        } else {
          // 如果没有扩展名，尝试从名称推断
          filename = filename.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        }

        return {
          ...prev,
          name,
          template: `https://(domain)/${filename}`
        };
      }

      return { ...prev, name };
    });
  };

  const handleSave = async () => {
    if (!formData.name || !formData.template) {
      showToast(t('name_template_required'), 'error');
      return;
    }

    try {
      const payload = {
        ...formData,
        max_size: formData.max_size ? parseInt(formData.max_size) : null
      };

      let res;
      if (isCreating) {
        res = await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else if (editingId) {
        res = await fetch(`/api/templates/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const data = await res?.json();
      if (data?.success) {
        showToast(isCreating ? t('template_created') : t('template_updated'), 'success');
        fetchTemplates();
        handleCancel();
      } else {
        showToast(data?.message || t('template_save_failed'), 'error');
      }
    } catch (error) {
      showToast(t('template_save_failed'), 'error');
    }
  };

  const handleDelete = (id: number) => {
    showConfirm(
      '删除模板',
      '确定要删除这个模板吗？此操作不可恢复。',
      async () => {
        closeConfirm();
        try {
          const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
          const data = await res.json();
          if (data.success) {
            showToast(t('template_deleted_success'), 'success');
            fetchTemplates();
          } else {
            showToast(data.message || t('template_delete_failed'), 'error');
          }
        } catch (error) {
          showToast(t('template_delete_failed'), 'error');
        }
      }
    );
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // 解析文件大小字符串为字节数
  const parseSizeToBytes = (sizeStr: string): number | null => {
    if (!sizeStr) return null;
    const str = sizeStr.trim().toUpperCase();
    const match = str.match(/^(\d+(?:\.\d+)?)\s*(KB|MB|GB|B)?$/);
    if (!match) {
      const num = parseInt(str);
      return isNaN(num) ? null : num;
    }
    const value = parseFloat(match[1]);
    const unit = match[2] || 'B';
    switch (unit) {
      case 'KB': return Math.round(value * 1024);
      case 'MB': return Math.round(value * 1024 * 1024);
      case 'GB': return Math.round(value * 1024 * 1024 * 1024);
      default: return Math.round(value);
    }
  };

  // 批量生成处理（支持 Content-Type 和文件大小，带进度条）
  const handleBatchGenerate = async (templatesToCreate: GeneratedTemplate[]) => {
    const total = templatesToCreate.length;
    let successCount = 0;
    let failCount = 0;

    // 显示进度条
    setProgressModal({
      isOpen: true,
      title: '正在批量创建模板...',
      current: 0,
      total,
      successCount: 0,
      failCount: 0
    });

    for (let i = 0; i < templatesToCreate.length; i++) {
      const tpl = templatesToCreate[i];
      try {
        const res = await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: tpl.url.substring(tpl.url.lastIndexOf('/') + 1).substring(0, 50),
            template: tpl.url,
            description: '批量生成',
            expected_content_type: tpl.contentType || '',
            min_size: parseSizeToBytes(tpl.minSize) || 0,
            max_size: parseSizeToBytes(tpl.maxSize),
            enabled: 1
          })
        });

        const data = await res.json();
        if (data.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }

      // 更新进度
      setProgressModal(prev => ({
        ...prev,
        current: i + 1,
        successCount,
        failCount
      }));
    }

    // 关闭进度条并刷新数据
    showToast(`批量创建完成：成功 ${successCount} 个，失败 ${failCount} 个`, 'success');
    
    // 先刷新数据
    await fetchTemplates();
    
    // 延迟关闭进度条
    setTimeout(() => {
      setProgressModal(prev => ({ ...prev, isOpen: false }));
      setActiveTab('manual');
    }, 800);
  };

  // 批量删除所有模板（带进度条）
  const handleDeleteAllTemplates = () => {
    showConfirm(
      '清空全部模板',
      `确定要删除所有 ${templates.length} 个模板吗？此操作不可恢复！`,
      async () => {
        closeConfirm();
        await executeDeleteAllTemplates();
      }
    );
  };

  const executeDeleteAllTemplates = async () => {
    try {
      // 使用批量清空API，一次性删除所有模板
      const res = await fetch('/api/templates/clear-all', { method: 'DELETE' });
      const data = await res.json();

      if (data.success) {
        showToast(`成功清空 ${data.deletedCount} 个模板`, 'success');
        // 清空选中状态
        setSelectedTemplateIds([]);
        // 刷新数据
        await fetchTemplates();
      } else {
        showToast(data.message || '清空模板失败', 'error');
      }
    } catch (error) {
      showToast('清空模板失败', 'error');
    }
  };

  // 批量删除选中的模板
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<number[]>([]);

  const toggleTemplateSelection = (id: number) => {
    if (selectedTemplateIds.includes(id)) {
      setSelectedTemplateIds(selectedTemplateIds.filter(i => i !== id));
    } else {
      setSelectedTemplateIds([...selectedTemplateIds, id]);
    }
  };

  const selectAllTemplates = () => {
    setSelectedTemplateIds(templates.map(t => t.id));
  };

  const selectNoneTemplates = () => {
    setSelectedTemplateIds([]);
  };

  const handleDeleteSelectedTemplates = () => {
    if (selectedTemplateIds.length === 0) {
      showToast('请先选择要删除的模板', 'info');
      return;
    }
    showConfirm(
      '删除选中模板',
      `确定要删除选中的 ${selectedTemplateIds.length} 个模板吗？`,
      async () => {
        closeConfirm();
        await executeDeleteSelectedTemplates();
      }
    );
  };

  const executeDeleteSelectedTemplates = async () => {
    const total = selectedTemplateIds.length;
    let successCount = 0;
    let failCount = 0;

    // 显示进度条
    setProgressModal({
      isOpen: true,
      title: '正在删除选中的模板...',
      current: 0,
      total,
      successCount: 0,
      failCount: 0
    });

    for (let i = 0; i < selectedTemplateIds.length; i++) {
      const id = selectedTemplateIds[i];
      try {
        const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }

      // 更新进度
      setProgressModal(prev => ({
        ...prev,
        current: i + 1,
        successCount,
        failCount
      }));
    }

    // 关闭进度条并刷新数据
    showToast(`批量删除完成：成功 ${successCount} 个，失败 ${failCount} 个`, 'success');
    
    // 清空选中状态
    setSelectedTemplateIds([]);
    
    // 先刷新数据
    await fetchTemplates();
    
    // 延迟关闭进度条
    setTimeout(() => {
      setProgressModal(prev => ({ ...prev, isOpen: false }));
    }, 800);
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {/* 确认对话框 */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirm}
      />

      {/* 进度条弹窗 */}
      <ProgressModal {...progressModal} />

      <div className="flex justify-between items-center glass-panel p-4 rounded-2xl">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="w-6 h-6" />
            {t('path_template_management')}
          </h2>
          <p className="text-slate-500 text-sm mt-1 ml-9">
            {t('configure_url_templates')}
          </p>
        </div>
        {!editingId && !isCreating && (
          <button
            onClick={() => {
              setIsCreating(true);
              setFormData({
                name: '',
                template: 'https://(domain)/',
                description: '',
                expected_content_type: '',
                exclude_content_type: 0,
                min_size: 0,
                max_size: '',
                enabled: 1
              });
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl flex items-center text-sm font-bold transition-all shadow-lg shadow-indigo-300 hover:shadow-indigo-400 hover:-translate-y-1"
          >
            <Plus className="w-5 h-5 mr-2" />
            {t('new_template')}
          </button>
        )}
      </div>

      {/* 标签页切换 */}
      {!editingId && !isCreating && (
        <div className="glass-panel rounded-2xl p-2 flex gap-2">
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'manual'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-200'
                : 'text-slate-600 hover:bg-slate-50'
              }`}
          >
            <Plus className="w-4 h-4" />
            手动创建
          </button>
          <button
            onClick={() => setActiveTab('batch')}
            className={`flex-1 px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'batch'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-200'
                : 'text-slate-600 hover:bg-slate-50'
              }`}
          >
            <Wand2 className="w-4 h-4" />
            批量生成
          </button>
        </div>
      )}

      {/* 批量生成器 */}
      {activeTab === 'batch' && !editingId && !isCreating && (
        <TemplateBatchGenerator
          onGenerate={handleBatchGenerate}
          showToast={showToast}
        />
      )}

      {(isCreating || editingId) && (
        <div className="glass-panel rounded-3xl p-8 space-y-6">
          <h3 className="text-xl font-bold text-slate-800">
            {isCreating ? t('create_new_template') : t('edit_template')}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                {t('template_name')} *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder={t('template_name_placeholder')}
                className="w-full glass-input rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <p className="text-xs text-slate-400 mt-1">
                {t('template_name_hint')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                {t('url_template')} *
              </label>
              <input
                type="text"
                value={formData.template}
                onChange={(e) => setFormData({ ...formData, template: e.target.value })}
                placeholder="https://(domain)/backup.zip"
                className="w-full glass-input rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 font-mono text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                {t('description')}
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('description_placeholder')}
                rows={2}
                className="w-full glass-input rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                {t('expected_content_type')}
              </label>
              <select
                value={formData.expected_content_type}
                onChange={(e) => setFormData({ ...formData, expected_content_type: e.target.value })}
                className="w-full glass-input rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="">{t('select_or_type_custom')}</option>
                {Object.entries(CONTENT_TYPES_BY_CATEGORY).map(([category, types]) => (
                  <optgroup key={category} label={category}>
                    {types.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label} ({type.value})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <input
                type="text"
                value={formData.expected_content_type}
                onChange={(e) => setFormData({ ...formData, expected_content_type: e.target.value })}
                placeholder={t('enter_custom_content_type')}
                className="w-full glass-input rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 mt-2 text-sm"
              />
              {/* Content-Type 过滤模式 */}
              <div className="mt-3 flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="content_type_mode"
                    checked={formData.exclude_content_type === 0}
                    onChange={() => setFormData({ ...formData, exclude_content_type: 0 })}
                    className="w-4 h-4 text-indigo-600"
                  />
                  <span className="text-sm text-slate-600">{t('content_type_include')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="content_type_mode"
                    checked={formData.exclude_content_type === 1}
                    onChange={() => setFormData({ ...formData, exclude_content_type: 1 })}
                    className="w-4 h-4 text-rose-600"
                  />
                  <span className="text-sm text-slate-600">{t('content_type_exclude')}</span>
                </label>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {formData.exclude_content_type === 1 ? t('content_type_exclude_hint') : t('content_type_include_hint')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                {t('enabled')}
              </label>
              <select
                value={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: parseInt(e.target.value) })}
                className="w-full glass-input rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value={1}>{t('enabled_option')}</option>
                <option value={0}>{t('disabled_option')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                {t('min_file_size')}
              </label>
              <input
                type="number"
                value={formData.min_size}
                onChange={(e) => setFormData({ ...formData, min_size: parseInt(e.target.value) || 0 })}
                placeholder="0"
                className="w-full glass-input rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <p className="text-xs text-slate-400 mt-1">
                {t('min_file_size_hint')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                {t('max_file_size')}
              </label>
              <input
                type="number"
                value={formData.max_size}
                onChange={(e) => setFormData({ ...formData, max_size: e.target.value })}
                placeholder={t('no_limit')}
                className="w-full glass-input rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <p className="text-xs text-slate-400 mt-1">
                {t('max_file_size_hint')}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t border-slate-200">
            <button
              onClick={handleCancel}
              className="px-6 py-3 text-slate-500 hover:text-slate-800 font-bold hover:bg-slate-100 rounded-xl transition-colors"
            >
              <X className="w-4 h-4 inline mr-2" />
              {t('cancel')}
            </button>
            <button
              onClick={handleSave}
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transform hover:-translate-y-0.5 transition-all flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {t('save_template')}
            </button>
          </div>
        </div>
      )}

      {/* 批量操作栏 */}
      {templates.length > 0 && (
        <div className="glass-panel rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">
              已选择 <span className="font-bold text-indigo-600">{selectedTemplateIds.length}</span> / {templates.length} 个模板
            </span>
            <button
              onClick={selectAllTemplates}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-all"
            >
              全选
            </button>
            <button
              onClick={selectNoneTemplates}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all"
            >
              取消全选
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDeleteSelectedTemplates}
              disabled={selectedTemplateIds.length === 0}
              className="px-4 py-2 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-xl text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
              删除选中 ({selectedTemplateIds.length})
            </button>
            <button
              onClick={handleDeleteAllTemplates}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              清空全部
            </button>
          </div>
        </div>
      )}

      <div className="glass-panel rounded-3xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50/80 text-slate-500">
            <tr>
              <th className="px-4 py-5 font-semibold w-12">
                <input
                  type="checkbox"
                  checked={templates.length > 0 && selectedTemplateIds.length === templates.length}
                  onChange={(e) => e.target.checked ? selectAllTemplates() : selectNoneTemplates()}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
              </th>
              <th className="px-4 py-5 font-semibold">{t('template_name')}</th>
              <th className="px-6 py-5 font-semibold">{t('url_template')}</th>
              <th className="px-6 py-5 font-semibold">{t('expected_content_type')}</th>
              <th className="px-6 py-5 font-semibold">{t('size_range')}</th>
              <th className="px-6 py-5 font-semibold">{t('status')}</th>
              <th className="px-8 py-5 font-semibold text-right">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-slate-400">
                  {t('loading_templates')}
                </td>
              </tr>
            ) : templates.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-slate-400">
                  {t('template_list_empty')}
                </td>
              </tr>
            ) : (
              templates.map((tpl, idx) => (
                <tr
                  key={tpl.id}
                  className={`hover:bg-indigo-50/30 transition-colors group animate-slide-up ${selectedTemplateIds.includes(tpl.id) ? 'bg-indigo-50/50' : ''}`}
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <td className="px-4 py-5">
                    <input
                      type="checkbox"
                      checked={selectedTemplateIds.includes(tpl.id)}
                      onChange={() => toggleTemplateSelection(tpl.id)}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                  </td>
                  <td className="px-4 py-5">
                    <div className="font-bold text-slate-800">{tpl.name}</div>
                    {tpl.description && (
                      <div className="text-xs text-slate-400 mt-1">{tpl.description}</div>
                    )}
                  </td>
                  <td className="px-6 py-5 font-mono text-xs text-slate-600 max-w-xs truncate">
                    {tpl.template}
                  </td>
                  <td className="px-6 py-5 text-xs">
                    {tpl.expected_content_type ? (
                      <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-lg font-mono">
                        {tpl.expected_content_type}
                      </span>
                    ) : (
                      <span className="text-slate-400">{t('any')}</span>
                    )}
                  </td>
                  <td className="px-6 py-5 text-xs text-slate-600">
                    <div>Min: {formatSize(tpl.min_size)}</div>
                    <div>Max: {tpl.max_size ? formatSize(tpl.max_size) : t('no_limit')}</div>
                  </td>
                  <td className="px-6 py-5">
                    {tpl.enabled ? (
                      <span className="bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full text-xs font-bold">
                        {t('enabled_option')}
                      </span>
                    ) : (
                      <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">
                        {t('disabled_option')}
                      </span>
                    )}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEdit(tpl)}
                        className="text-indigo-600 hover:text-indigo-800 p-2 hover:bg-indigo-50 rounded-lg transition-all"
                        title={t('edit')}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(tpl.id)}
                        className="text-rose-600 hover:text-rose-800 p-2 hover:bg-rose-50 rounded-lg transition-all"
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
  );
};
