'use client';

import React, { useState, useEffect } from 'react';
import { Wand2, AlertTriangle, CheckSquare, Square, Trash2, Settings, FileType, HardDrive, Edit3 } from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import { PRESET_PREFIXES, PRESET_SUFFIX_CONFIGS, TEMPLATE_VARIABLES, getContentTypeForSuffix, SuffixConfig } from '../lib/template-presets';
import { expandAllDateRanges } from '../lib/date-range-expander';

interface TemplateBatchGeneratorProps {
    onGenerate: (templates: GeneratedTemplate[]) => void;
    showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

// 生成的模板结构（包含 Content-Type 和过滤模式）
export interface GeneratedTemplate {
    url: string;
    contentType: string;
    excludeContentType: number; // 0=包含匹配, 1=排除匹配
    minSize: string;
    maxSize: string;
}

// 后缀选择状态（包含自定义 Content-Type、过滤模式和大小限制）
interface SuffixSelection {
    suffix: string;
    contentType: string;
    excludeContentType: number; // 0=包含匹配, 1=排除匹配
    customContentType: boolean; // 是否使用自定义 Content-Type
    minSize: string;
    maxSize: string;
}

// 常用 Content-Type 预设
const CONTENT_TYPE_PRESETS = [
    { value: '', label: '不限制' },
    { value: 'text/html', label: 'HTML' },
    { value: 'application/json', label: 'JSON' },
    { value: 'application/xml', label: 'XML' },
    { value: 'text/plain', label: '纯文本' },
    { value: 'application/zip', label: 'ZIP压缩包' },
    { value: 'application/x-rar-compressed', label: 'RAR压缩包' },
    { value: 'application/gzip', label: 'GZIP压缩' },
    { value: 'application/x-7z-compressed', label: '7Z压缩包' },
    { value: 'application/pdf', label: 'PDF文档' },
    { value: 'application/octet-stream', label: '二进制文件' },
];

export const TemplateBatchGenerator: React.FC<TemplateBatchGeneratorProps> = ({ onGenerate, showToast }) => {
    const { t } = useTranslation();

    // 选中的预设
    const [selectedPrefixes, setSelectedPrefixes] = useState<string[]>([]);
    const [selectedSuffixes, setSelectedSuffixes] = useState<SuffixSelection[]>([]);
    const [selectedVariables, setSelectedVariables] = useState<string[]>([]);

    // 自定义输入
    const [customPrefixes, setCustomPrefixes] = useState('');
    const [customSuffixes, setCustomSuffixes] = useState('');
    const [dateRange, setDateRange] = useState('');

    // 预览
    const [previewCount, setPreviewCount] = useState(0);
    const [previewSamples, setPreviewSamples] = useState<GeneratedTemplate[]>([]);
    const [showWarning, setShowWarning] = useState(false);

    // 批量属性设置（全局默认）
    const [globalContentType, setGlobalContentType] = useState('');
    const [globalMinSize, setGlobalMinSize] = useState('');
    const [globalMaxSize, setGlobalMaxSize] = useState('');
    const [showBatchSettings, setShowBatchSettings] = useState(false);

    // 后缀编辑状态
    const [editingSuffix, setEditingSuffix] = useState<string | null>(null);
    const [editingContentType, setEditingContentType] = useState('');
    const [editingExcludeContentType, setEditingExcludeContentType] = useState(0);
    const [editingMinSize, setEditingMinSize] = useState('');
    const [editingMaxSize, setEditingMaxSize] = useState('');

    // 切换前缀选中状态
    const togglePrefix = (prefix: string) => {
        if (selectedPrefixes.includes(prefix)) {
            setSelectedPrefixes(selectedPrefixes.filter(p => p !== prefix));
        } else {
            setSelectedPrefixes([...selectedPrefixes, prefix]);
        }
    };

    // 切换后缀选中状态（带 Content-Type）
    const toggleSuffix = (suffixConfig: SuffixConfig) => {
        const existing = selectedSuffixes.find(s => s.suffix === suffixConfig.suffix);
        if (existing) {
            setSelectedSuffixes(selectedSuffixes.filter(s => s.suffix !== suffixConfig.suffix));
        } else {
            setSelectedSuffixes([...selectedSuffixes, {
                suffix: suffixConfig.suffix,
                contentType: suffixConfig.contentType,
                excludeContentType: 0,
                customContentType: false,
                minSize: '',
                maxSize: ''
            }]);
        }
    };

    // 切换变量选中状态
    const toggleVariable = (value: string) => {
        if (selectedVariables.includes(value)) {
            setSelectedVariables(selectedVariables.filter(v => v !== value));
        } else {
            setSelectedVariables([...selectedVariables, value]);
        }
    };

    // 更新后缀的 Content-Type
    const updateSuffixContentType = (suffix: string, contentType: string) => {
        setSelectedSuffixes(selectedSuffixes.map(s => 
            s.suffix === suffix 
                ? { ...s, contentType, customContentType: true }
                : s
        ));
    };

    // 开始编辑后缀设置
    const startEditSuffix = (suffix: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const selection = selectedSuffixes.find(s => s.suffix === suffix);
        setEditingSuffix(suffix);
        setEditingContentType(selection?.contentType || getContentTypeForSuffix(suffix));
        setEditingExcludeContentType(selection?.excludeContentType || 0);
        setEditingMinSize(selection?.minSize || '');
        setEditingMaxSize(selection?.maxSize || '');
    };

    // 保存后缀编辑
    const saveEditSuffix = () => {
        if (editingSuffix) {
            setSelectedSuffixes(selectedSuffixes.map(s => 
                s.suffix === editingSuffix 
                    ? { 
                        ...s, 
                        contentType: editingContentType,
                        excludeContentType: editingExcludeContentType,
                        customContentType: true,
                        minSize: editingMinSize,
                        maxSize: editingMaxSize
                    }
                    : s
            ));
            setEditingSuffix(null);
            setEditingContentType('');
            setEditingExcludeContentType(0);
            setEditingMinSize('');
            setEditingMaxSize('');
        }
    };

    // 全选
    const selectAllPrefixes = () => setSelectedPrefixes([...PRESET_PREFIXES]);
    const selectAllSuffixes = () => setSelectedSuffixes(
        PRESET_SUFFIX_CONFIGS.map(c => ({
            suffix: c.suffix,
            contentType: c.contentType,
            excludeContentType: 0,
            customContentType: false,
            minSize: '',
            maxSize: ''
        }))
    );
    const selectAllVariables = () => setSelectedVariables(TEMPLATE_VARIABLES.map(v => v.value));

    // 全不选
    const selectNonePrefixes = () => setSelectedPrefixes([]);
    const selectNoneSuffixes = () => setSelectedSuffixes([]);
    const selectNoneVariables = () => setSelectedVariables([]);

    // 批量清空
    const clearAllSelections = () => {
        setSelectedPrefixes([]);
        setSelectedSuffixes([]);
        setSelectedVariables([]);
        setCustomPrefixes('');
        setCustomSuffixes('');
        setDateRange('');
        setGlobalContentType('');
        setGlobalMinSize('');
        setGlobalMaxSize('');
        setPreviewCount(0);
        setPreviewSamples([]);
        setShowWarning(false);
        showToast('已清空所有选择', 'info');
    };

    // 根据后缀获取 Content-Type 和大小限制
    const getTemplateSettings = (template: string): { contentType: string; excludeContentType: number; minSize: string; maxSize: string } => {
        // 先检查选中的后缀是否有自定义设置
        for (const sel of selectedSuffixes) {
            if (template.endsWith(sel.suffix)) {
                return {
                    contentType: sel.contentType,
                    excludeContentType: sel.excludeContentType || 0,
                    minSize: sel.minSize || globalMinSize,
                    maxSize: sel.maxSize || globalMaxSize
                };
            }
        }
        // 检查自定义后缀 - 使用全局设置
        const customSuffixList = customSuffixes.split('\n').map(s => s.trim()).filter(s => s);
        for (const suffix of customSuffixList) {
            if (template.endsWith(suffix)) {
                return {
                    contentType: globalContentType,
                    excludeContentType: 0,
                    minSize: globalMinSize,
                    maxSize: globalMaxSize
                };
            }
        }
        return {
            contentType: globalContentType,
            excludeContentType: 0,
            minSize: globalMinSize,
            maxSize: globalMaxSize
        };
    };

    // 生成模板
    const generateTemplates = (): GeneratedTemplate[] => {
        // 合并前缀
        const prefixes = [
            ...selectedPrefixes,
            ...customPrefixes.split('\n').map(p => p.trim()).filter(p => p)
        ];

        // 合并后缀
        const suffixes = [
            ...selectedSuffixes.map(s => s.suffix),
            ...customSuffixes.split('\n').map(s => s.trim()).filter(s => s)
        ];

        // 复制变量数组
        const variables = [...selectedVariables];

        // 生成基础组合 - 分别生成前缀+后缀 和 变量+后缀
        const baseTemplates: string[] = [];
        
        // 如果有后缀
        if (suffixes.length > 0) {
            // 前缀 + 后缀 组合（如果有前缀）
            for (const prefix of prefixes) {
                for (const suffix of suffixes) {
                    if (prefix) {
                        baseTemplates.push(`${prefix}${suffix}`);
                    }
                }
            }
            
            // 变量 + 后缀 组合（如果有变量）
            for (const variable of variables) {
                for (const suffix of suffixes) {
                    if (variable) {
                        baseTemplates.push(`${variable}${suffix}`);
                    }
                }
            }
            
            // 如果既没有前缀也没有变量，只生成后缀
            if (prefixes.length === 0 && variables.length === 0) {
                for (const suffix of suffixes) {
                    baseTemplates.push(suffix);
                }
            }
        } else {
            // 没有后缀时，只生成前缀和变量
            for (const prefix of prefixes) {
                if (prefix) {
                    baseTemplates.push(prefix);
                }
            }
            for (const variable of variables) {
                if (variable) {
                    baseTemplates.push(variable);
                }
            }
        }

        // 如果有日期范围，展开
        let expandedTemplates: string[];
        if (dateRange.trim()) {
            expandedTemplates = [];
            for (const template of baseTemplates) {
                const withDateRange = template.replace(/\$DATE_RANGE\$/g, dateRange);
                const expanded = expandAllDateRanges(withDateRange);
                expandedTemplates.push(...expanded);
            }
        } else {
            expandedTemplates = baseTemplates;
        }

        // 转换为带属性的模板
        return expandedTemplates.map(template => {
            const settings = getTemplateSettings(template);
            return {
                url: template.startsWith('http') ? template : `https://(domain)/${template}`,
                contentType: settings.contentType,
                excludeContentType: settings.excludeContentType,
                minSize: settings.minSize,
                maxSize: settings.maxSize
            };
        });
    };

    // 更新预览
    const updatePreview = () => {
        const templates = generateTemplates();
        setPreviewCount(templates.length);
        setPreviewSamples(templates.slice(0, 10));
        setShowWarning(templates.length > 1000);
    };

    // 自动更新预览
    useEffect(() => {
        const timer = setTimeout(() => {
            updatePreview();
        }, 300);
        return () => clearTimeout(timer);
    }, [selectedPrefixes, selectedSuffixes, selectedVariables, customPrefixes, customSuffixes, dateRange, globalContentType, globalMinSize, globalMaxSize]);

    // 批量创建
    const handleBatchCreate = () => {
        const templates = generateTemplates();

        if (templates.length === 0) {
            showToast('请至少配置一个组合', 'error');
            return;
        }

        if (templates.length > 10000) {
            showToast('生成数量过多，已限制为10000个', 'error');
            return;
        }

        // 去重
        const seen = new Set<string>();
        const uniqueTemplates = templates.filter(t => {
            if (seen.has(t.url)) return false;
            seen.add(t.url);
            return true;
        });

        onGenerate(uniqueTemplates);
        showToast(`成功生成 ${uniqueTemplates.length} 个模板`, 'success');
    };

    return (
        <div className="space-y-6">
            {/* 标题和批量清空 */}
            <div className="glass-panel p-6 rounded-3xl">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-50 rounded-lg">
                            <Wand2 className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">批量模板生成器</h3>
                            <p className="text-sm text-slate-500">通过前缀、变量、日期范围和后缀的组合快速生成大量模板</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowBatchSettings(!showBatchSettings)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                                showBatchSettings 
                                    ? 'bg-indigo-600 text-white' 
                                    : 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700'
                            }`}
                        >
                            <Settings className="w-4 h-4" />
                            全局属性
                        </button>
                        <button
                            onClick={clearAllSelections}
                            className="px-4 py-2 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                        >
                            <Trash2 className="w-4 h-4" />
                            批量清空
                        </button>
                    </div>
                </div>

                {showWarning && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                        <div>
                            <div className="font-bold text-amber-800">生成数量较大</div>
                            <div className="text-sm text-amber-700">
                                当前配置将生成 {previewCount} 个模板，这可能影响性能。建议缩小范围或分批处理。
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 全局属性设置面板 */}
            {showBatchSettings && (
                <div className="glass-panel p-6 rounded-3xl space-y-4 border-2 border-indigo-200">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-indigo-50 rounded-lg">
                            <Settings className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-800">全局默认属性</h4>
                            <p className="text-sm text-slate-500">为没有独立设置的模板使用这些默认值</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                <FileType className="w-4 h-4 text-indigo-500" />
                                默认 Content-Type
                            </label>
                            <select
                                value={globalContentType}
                                onChange={(e) => setGlobalContentType(e.target.value)}
                                className="w-full glass-input rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            >
                                {CONTENT_TYPE_PRESETS.map(preset => (
                                    <option key={preset.value} value={preset.value}>{preset.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                <HardDrive className="w-4 h-4 text-emerald-500" />
                                最小文件大小
                            </label>
                            <input
                                type="text"
                                value={globalMinSize}
                                onChange={(e) => setGlobalMinSize(e.target.value)}
                                placeholder="例: 1024 或 1KB"
                                className="w-full glass-input rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                <HardDrive className="w-4 h-4 text-rose-500" />
                                最大文件大小
                            </label>
                            <input
                                type="text"
                                value={globalMaxSize}
                                onChange={(e) => setGlobalMaxSize(e.target.value)}
                                placeholder="例: 10MB"
                                className="w-full glass-input rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-200"
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 前缀选择 */}
                <div className="glass-panel p-6 rounded-3xl space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-800 flex items-center gap-2">
                            <span className="text-emerald-600">1.</span> 选择前缀
                            <span className="text-xs text-slate-400 font-normal">
                                ({selectedPrefixes.length}/{PRESET_PREFIXES.length})
                            </span>
                        </h4>
                        <div className="flex gap-2">
                            <button onClick={selectAllPrefixes} className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1">
                                <CheckSquare className="w-3 h-3" />全选
                            </button>
                            <button onClick={selectNonePrefixes} className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1">
                                <Square className="w-3 h-3" />全不选
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto">
                        {PRESET_PREFIXES.map(prefix => (
                            <button
                                key={prefix}
                                onClick={() => togglePrefix(prefix)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                    selectedPrefixes.includes(prefix)
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {prefix || '(空)'}
                            </button>
                        ))}
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">自定义前缀（每行一个）</label>
                        <textarea
                            value={customPrefixes}
                            onChange={(e) => setCustomPrefixes(e.target.value)}
                            placeholder="database&#10;wwwroot&#10;config"
                            rows={3}
                            className="w-full glass-input rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200 font-mono text-sm"
                        />
                    </div>
                </div>

                {/* 后缀选择（带 Content-Type） */}
                <div className="glass-panel p-6 rounded-3xl space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-800 flex items-center gap-2">
                            <span className="text-blue-600">2.</span> 选择后缀
                            <span className="text-xs text-slate-400 font-normal">
                                ({selectedSuffixes.length}/{PRESET_SUFFIX_CONFIGS.length})
                            </span>
                        </h4>
                        <div className="flex gap-2">
                            <button onClick={selectAllSuffixes} className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1">
                                <CheckSquare className="w-3 h-3" />全选
                            </button>
                            <button onClick={selectNoneSuffixes} className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1">
                                <Square className="w-3 h-3" />全不选
                            </button>
                        </div>
                    </div>

                    <p className="text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
                        💡 点击已选后缀右侧的编辑图标可单独设置 Content-Type
                    </p>

                    <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto">
                        {PRESET_SUFFIX_CONFIGS.map(config => {
                            const isSelected = selectedSuffixes.some(s => s.suffix === config.suffix);
                            const selection = selectedSuffixes.find(s => s.suffix === config.suffix);
                            
                            return (
                                <div key={config.suffix} className="relative group">
                                    <button
                                        onClick={() => toggleSuffix(config)}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                            isSelected
                                                ? 'bg-blue-600 text-white shadow-sm pr-8'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        {config.suffix}
                                    </button>
                                    {isSelected && (
                                        <button
                                            onClick={(e) => startEditSuffix(config.suffix, e)}
                                            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 hover:bg-blue-700 rounded transition-colors"
                                            title={`编辑 Content-Type: ${selection?.contentType || '未设置'}`}
                                        >
                                            <Edit3 className="w-3 h-3 text-white" />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* 后缀设置编辑弹窗 */}
                    {editingSuffix && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-4">
                            <div className="font-bold text-blue-800">编辑 {editingSuffix} 的过滤设置</div>
                            
                            {/* Content-Type */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700">Content-Type</label>
                                <select
                                    value={editingContentType}
                                    onChange={(e) => setEditingContentType(e.target.value)}
                                    className="w-full glass-input rounded-xl px-4 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                >
                                    {CONTENT_TYPE_PRESETS.map(preset => (
                                        <option key={preset.value} value={preset.value}>{preset.label}</option>
                                    ))}
                                </select>
                                <input
                                    type="text"
                                    value={editingContentType}
                                    onChange={(e) => setEditingContentType(e.target.value)}
                                    placeholder="或输入自定义类型"
                                    className="w-full glass-input rounded-xl px-4 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm"
                                />
                            </div>
                            
                            {/* 匹配模式 */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700">匹配模式</label>
                                <div className="flex gap-4">
                                    <label className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-all ${
                                        editingExcludeContentType === 0 
                                            ? 'bg-emerald-100 border-2 border-emerald-400 text-emerald-700' 
                                            : 'bg-slate-100 border-2 border-transparent text-slate-600 hover:bg-slate-200'
                                    }`}>
                                        <input
                                            type="radio"
                                            name="excludeContentType"
                                            checked={editingExcludeContentType === 0}
                                            onChange={() => setEditingExcludeContentType(0)}
                                            className="w-4 h-4 text-emerald-600"
                                        />
                                        <span className="text-sm font-medium">包含匹配</span>
                                    </label>
                                    <label className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-all ${
                                        editingExcludeContentType === 1 
                                            ? 'bg-rose-100 border-2 border-rose-400 text-rose-700' 
                                            : 'bg-slate-100 border-2 border-transparent text-slate-600 hover:bg-slate-200'
                                    }`}>
                                        <input
                                            type="radio"
                                            name="excludeContentType"
                                            checked={editingExcludeContentType === 1}
                                            onChange={() => setEditingExcludeContentType(1)}
                                            className="w-4 h-4 text-rose-600"
                                        />
                                        <span className="text-sm font-medium">排除匹配</span>
                                    </label>
                                </div>
                                <p className="text-xs text-slate-500">
                                    包含匹配：只保留匹配的结果 | 排除匹配：过滤掉匹配的结果
                                </p>
                            </div>
                            
                            {/* 大小限制 */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">最小大小</label>
                                    <input
                                        type="text"
                                        value={editingMinSize}
                                        onChange={(e) => setEditingMinSize(e.target.value)}
                                        placeholder="例: 1KB"
                                        className="w-full glass-input rounded-xl px-4 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200 text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">最大大小</label>
                                    <input
                                        type="text"
                                        value={editingMaxSize}
                                        onChange={(e) => setEditingMaxSize(e.target.value)}
                                        placeholder="例: 10MB"
                                        className="w-full glass-input rounded-xl px-4 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-200 text-sm"
                                    />
                                </div>
                            </div>
                            
                            <div className="flex gap-2">
                                <button onClick={saveEditSuffix} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold">保存</button>
                                <button onClick={() => { setEditingSuffix(null); setEditingMinSize(''); setEditingMaxSize(''); }} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-bold">取消</button>
                            </div>
                        </div>
                    )}

                    {/* 已选后缀的设置预览 */}
                    {selectedSuffixes.length > 0 && (
                        <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                            <div className="text-xs font-bold text-slate-600 mb-2">已选后缀的过滤设置:</div>
                            {selectedSuffixes.map(s => (
                                <div key={s.suffix} className="flex items-center justify-between text-xs gap-2">
                                    <span className="font-mono text-slate-700 font-bold">{s.suffix}</span>
                                    <div className="flex items-center gap-2 text-slate-500">
                                        <span className={s.excludeContentType === 1 ? 'text-rose-600' : 'text-emerald-600'}>
                                            {s.excludeContentType === 1 ? '排除' : '包含'}
                                        </span>
                                        <span className={s.customContentType ? 'text-blue-600' : ''}>
                                            {s.contentType || '(全局)'}
                                        </span>
                                        {(s.minSize || s.maxSize) && (
                                            <span className="text-emerald-600">
                                                [{s.minSize || '0'} - {s.maxSize || '∞'}]
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">自定义后缀（每行一个）</label>
                        <textarea
                            value={customSuffixes}
                            onChange={(e) => setCustomSuffixes(e.target.value)}
                            placeholder=".bak&#10;.old&#10;.tmp"
                            rows={3}
                            className="w-full glass-input rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 font-mono text-sm"
                        />
                    </div>
                </div>

                {/* 变量选择 */}
                <div className="glass-panel p-6 rounded-3xl space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-800 flex items-center gap-2">
                            <span className="text-purple-600">3.</span> 选择变量
                            <span className="text-xs text-slate-400 font-normal">
                                ({selectedVariables.length}/{TEMPLATE_VARIABLES.length})
                            </span>
                        </h4>
                        <div className="flex gap-2">
                            <button onClick={selectAllVariables} className="px-3 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1">
                                <CheckSquare className="w-3 h-3" />全选
                            </button>
                            <button onClick={selectNoneVariables} className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1">
                                <Square className="w-3 h-3" />全不选
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {TEMPLATE_VARIABLES.map(variable => (
                            <label
                                key={variable.value}
                                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                                    selectedVariables.includes(variable.value)
                                        ? 'bg-purple-50 border border-purple-200'
                                        : 'hover:bg-slate-50'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedVariables.includes(variable.value)}
                                    onChange={() => toggleVariable(variable.value)}
                                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                                />
                                <div className="flex-1">
                                    <div className="font-medium text-slate-800">{variable.value}</div>
                                    <div className="text-xs text-slate-500">{variable.label} - 例: {variable.example}</div>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* 日期范围 */}
                <div className="glass-panel p-6 rounded-3xl space-y-4">
                    <h4 className="font-bold text-slate-800 flex items-center gap-2">
                        <span className="text-indigo-600">4.</span> 日期范围（可选）
                    </h4>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            日期范围模式 - 在模板中使用 $DATE_RANGE$
                        </label>
                        <input
                            type="text"
                            value={dateRange}
                            onChange={(e) => setDateRange(e.target.value)}
                            placeholder="{20240101..20240131} 或 {202401..202412}"
                            className="w-full glass-input rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 font-mono text-sm"
                        />
                        <p className="text-xs text-slate-400 mt-2">
                            💡 格式: &#123;起始..结束&#125; 例如 &#123;20240101..20240103&#125;
                        </p>
                    </div>

                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                        <div className="font-bold text-indigo-800 text-sm mb-2">使用示例:</div>
                        <div className="text-xs text-indigo-600 space-y-1 font-mono">
                            <div>backup_$DATE_RANGE$.sql → backup_20240101.sql, backup_20240102.sql...</div>
                            <div>log_&#123;202401..202403&#125;.txt → log_202401.txt, log_202402.txt, log_202403.txt</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 预览和生成 */}
            <div className="glass-panel p-6 rounded-3xl space-y-4">
                <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-800 flex items-center gap-2">
                        <span className="text-orange-600">5.</span> 预览和生成
                    </h4>
                    <button
                        onClick={updatePreview}
                        className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-xl text-sm font-bold transition-all"
                    >
                        刷新预览
                    </button>
                </div>

                {previewCount > 0 ? (
                    <div>
                        <div className="mb-3 text-sm text-slate-600">
                            将生成 <span className="font-bold text-indigo-600">{previewCount}</span> 个模板
                            {previewCount > 10 && ' (显示前10个)'}
                        </div>
                        <div className="bg-slate-50 rounded-xl p-4 font-mono text-xs space-y-2 max-h-64 overflow-y-auto">
                            {previewSamples.map((sample, idx) => (
                                <div key={idx} className="flex flex-col gap-1 pb-2 border-b border-slate-200 last:border-0">
                                    <div className="text-slate-700">{idx + 1}. {sample.url}</div>
                                    <div className="flex gap-3 ml-4">
                                        {sample.contentType && (
                                            <span className="text-blue-600">Content-Type: {sample.contentType}</span>
                                        )}
                                        {sample.contentType && (
                                            <span className={sample.excludeContentType === 1 ? 'text-rose-600' : 'text-emerald-600'}>
                                                ({sample.excludeContentType === 1 ? '排除匹配' : '包含匹配'})
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {previewCount > 10 && (
                                <div className="text-slate-400 italic">... 还有 {previewCount - 10} 个</div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8 text-slate-400">
                        <Wand2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>请选择前缀、后缀或变量来生成模板</p>
                    </div>
                )}

                <div className="flex gap-4 pt-4">
                    <button
                        onClick={handleBatchCreate}
                        disabled={previewCount === 0}
                        className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-purple-200 hover:shadow-purple-300 transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                        <Wand2 className="w-5 h-5" />
                        批量生成 {previewCount > 0 && `(${previewCount}个)`} 模板
                    </button>
                </div>
            </div>
        </div>
    );
};
