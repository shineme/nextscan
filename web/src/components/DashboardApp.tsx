'use client';

import React, { useState, useEffect } from 'react';
import {
    LayoutDashboard,
    List,
    Globe,
    Search,
    Settings,
    Plus,
    FileText,
    XCircle,
    AlertTriangle,
    Download,
    ChevronRight,
    LogOut,
    Database,
    Filter,
    Wind,
    Sparkles,
    Zap,
    Coffee,
    LucideIcon,
    Loader2,
    AlertCircle,
    RefreshCw,
    CheckCircle,
    Info,
    X,
    Play,
    Pause,
    Trash2,
    Activity,
    Languages
} from 'lucide-react';
import { LanguageProvider, useTranslation } from '../lib/i18n';
import SettingsView from './SettingsView';
import { TasksView } from './TasksView';
import { CreateTaskModal } from './CreateTaskModal';
import { ResultsView } from './ResultsView';
import { AddTargetModal } from './AddTargetModal';
import WorkerManagement from './WorkerManagement';
import { DomainsView } from './DomainsView';
import { LogsView } from './LogsView';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';

// --- Global Styles for Custom Animations ---
const GlobalStyles = () => (
    <style jsx global>{`
    @keyframes float {
      0% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
      100% { transform: translateY(0px); }
    }
    @keyframes breathe {
      0%, 100% { opacity: 0.4; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(1.05); }
    }
    @keyframes blob {
      0% { transform: translate(0px, 0px) scale(1); }
      33% { transform: translate(30px, -50px) scale(1.1); }
      66% { transform: translate(-20px, 20px) scale(0.9); }
      100% { transform: translate(0px, 0px) scale(1); }
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes shimmer {
      0% { transform: translateX(-150%) skewX(-15deg); }
      50% { transform: translateX(150%) skewX(-15deg); }
      100% { transform: translateX(150%) skewX(-15deg); }
    }
    @keyframes jelly {
      0% { transform: scale(1, 1); }
      30% { transform: scale(1.25, 0.75); }
      40% { transform: scale(0.75, 1.25); }
      50% { transform: scale(1.15, 0.85); }
      65% { transform: scale(0.95, 1.05); }
      75% { transform: scale(1.05, 0.95); }
      100% { transform: scale(1, 1); }
    }
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
      20%, 40%, 60%, 80% { transform: translateX(4px); }
    }
    .animate-float { animation: float 6s ease-in-out infinite; }
    .animate-blob { animation: blob 7s infinite; }
    .animation-delay-2000 { animation-delay: 2s; }
    .animation-delay-4000 { animation-delay: 4s; }
    .animate-slide-up { animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .animate-shimmer { animation: shimmer 2.5s infinite; }
    .animate-shake { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
    
    .hover-jelly:hover { animation: jelly 0.8s both; }
    
    .glass-panel {
      background: rgba(255, 255, 255, 0.82);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.9);
      box-shadow: 
        0 10px 40px -10px rgba(0,0,0,0.08),
        0 0 0 1px rgba(226, 232, 240, 0.6);
    }
    .glass-input {
      background: rgba(255, 255, 255, 0.6);
      backdrop-filter: blur(4px);
      border: 1px solid rgba(203, 213, 225, 0.6);
      box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.02);
      transition: all 0.2s ease;
    }
    .glass-input:focus {
      background: rgba(255, 255, 255, 0.95);
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
    }
    .stagger-1 { animation-delay: 100ms; }
    .stagger-2 { animation-delay: 200ms; }
    .stagger-3 { animation-delay: 300ms; }
    .hover-lift { transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease; }
    .hover-lift:hover { transform: translateY(-4px) scale(1.01); box-shadow: 0 20px 30px -10px rgba(0, 0, 0, 0.1); }
    .hover-scale:active { transform: scale(0.97); }

    @keyframes droplet-cycle {
      0% { opacity: 0; transform: translateY(-20px) scale(0.5); }
      12% { opacity: 1; transform: translateY(0) scale(1.1); }
      18% { transform: scale(0.95); }
      24% { transform: scale(1); }
      82% { opacity: 1; transform: scale(1); }
      100% { opacity: 0; transform: translateY(-10px) scale(0.8); }
    }
    .animate-droplet {
      animation: droplet-cycle 3.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }
  `}</style>
);

// --- Mock Data ---
const MOCK_TASKS = [
    { id: 'T-20251124-01', name: '每日增量探测-1124', type: 'incremental', status: 'running', progress: 45, total: 342, hits: 12, created_at: '09:00:00' },
    { id: 'T-20251123-01', name: '每日增量探测-1123', type: 'incremental', status: 'completed', progress: 100, total: 310, hits: 5, created_at: 'Yesterday' },
    { id: 'T-20251101-01', name: '半年全量复扫-H2', type: 'full', status: 'failed', progress: 88, total: 120000, hits: 450, created_at: 'Nov 01' },
];

const MOCK_RESULTS = [
    { id: 101, domain: 'admin.example.com', url: 'http://admin.example.com/backup.zip', status: 200, size: '45MB', type: 'application/zip', time: '10:05:22' },
    { id: 102, domain: 'dev.test.co.uk', url: 'http://dev.test.co.uk/.git/config', status: 403, size: '1.2KB', type: 'text/html', time: '10:06:11' },
    { id: 103, domain: 'files.company.org', url: 'http://files.company.org/2025.tar.gz', status: 200, size: '120MB', type: 'application/gzip', time: '10:07:45' },
];

const CHART_DATA = [
    { name: 'Mon', domains: 120, hits: 5 },
    { name: 'Tue', domains: 132, hits: 8 },
    { name: 'Wed', domains: 101, hits: 2 },
    { name: 'Thu', domains: 154, hits: 12 },
    { name: 'Fri', domains: 210, hits: 15 },
    { name: 'Sat', domains: 310, hits: 5 },
    { name: 'Sun', domains: 342, hits: 18 },
];

const PIE_DATA = [
    { name: '200 OK', value: 45 },
    { name: '403 Forbidden', value: 300 },
    { name: '404 Not Found', value: 1200 },
    { name: '500 Error', value: 20 },
];

const COLORS = ['#34d399', '#fcd34d', '#94a3b8', '#f87171'];

// --- Components ---

interface ToastProps {
    message: string;
    type: 'success' | 'error' | 'info';
    onClose: () => void;
}

const Toast = ({ message, type, onClose }: ToastProps) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const bgColors = {
        success: 'bg-emerald-500',
        error: 'bg-rose-500',
        info: 'bg-indigo-500'
    };

    return (
        <div className={`fixed top-6 right-6 z-50 ${bgColors[type]} text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-slide-up`}>
            {type === 'success' && <CheckCircle className="w-5 h-5" />}
            {type === 'error' && <AlertCircle className="w-5 h-5" />}
            {type === 'info' && <Info className="w-5 h-5" />}
            <span className="font-bold">{message}</span>
            <button onClick={onClose} className="ml-2 opacity-80 hover:opacity-100"><X className="w-4 h-4" /></button>
        </div>
    );
};

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
        scanned: 'bg-slate-100/50 text-slate-600 ring-1 ring-slate-200',
    };

    const config: Record<string, { label: string; emoji: string; animate: boolean }> = {
        running: { label: t('status_running'), emoji: '⏳', animate: true },
        completed: { label: t('status_done'), emoji: '✅', animate: false },
        failed: { label: t('status_failed'), emoji: '❌', animate: false },
        pending: { label: t('status_waiting'), emoji: '💤', animate: false },
        scanned: { label: t('status_scanned'), emoji: '🔍', animate: false },
    };

    const current = config[status] || config.scanned;

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

interface CardProps {
    title: string;
    value: string;
    subtext?: string;
    icon: LucideIcon;
    trend?: 'up' | 'down';
    colorClass: string;
}

const Card = ({ title, value, subtext, icon: Icon, trend, colorClass }: CardProps) => (
    <div className="glass-panel p-6 rounded-3xl transition-all duration-300 hover:shadow-xl hover:-translate-y-2 group relative overflow-hidden">
        {/* Decorative background circle */}
        <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 group-hover:scale-150 transition-transform duration-500 ${colorClass}`}></div>

        <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
                <p className="text-slate-500 text-sm font-medium mb-1 flex items-center gap-1">
                    {title}
                </p>
                <h3 className="text-3xl font-black text-slate-800 tracking-tight">{value}</h3>
            </div>
            <div className={`p-3 rounded-2xl ${colorClass.replace('bg-', 'bg-opacity-20 ')}`}>
                <Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} />
            </div>
        </div>
        {subtext && (
            <div className="flex items-center text-xs relative z-10 font-medium">
                {trend === 'up' ? (
                    <span className="text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-lg flex items-center mr-2">
                        🚀 +12%
                    </span>
                ) : trend === 'down' ? (
                    <span className="text-rose-500 bg-rose-50 px-2 py-0.5 rounded-lg flex items-center mr-2">
                        📉 -5%
                    </span>
                ) : null}
                <span className="text-slate-400">{subtext}</span>
            </div>
        )}
    </div>
);

// --- Main Views ---

interface DashboardViewProps {
    showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const DashboardView = ({ showToast }: DashboardViewProps) => {
    const { t } = useTranslation();
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [automationEnabled, setAutomationEnabled] = useState(true);
    const [automationLoading, setAutomationLoading] = useState(false);

    const loadAutomationStatus = async () => {
        try {
            const res = await fetch('/api/automation');
            const data = await res.json();
            if (data.success) {
                setAutomationEnabled(data.data.enabled);
            }
        } catch (error) {
            console.error('Failed to load automation status', error);
        }
    };

    const handleToggleAutomation = async () => {
        setAutomationLoading(true);
        try {
            const res = await fetch('/api/automation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'toggle' }),
            });
            const data = await res.json();
            if (data.success) {
                setAutomationEnabled(data.data.enabled);
                showToast(
                    data.data.enabled ? t('automation_enabled_success') : t('automation_disabled_success'),
                    'success'
                );
            } else {
                showToast(t('automation_toggle_failed') + ': ' + data.message, 'error');
            }
        } catch (error) {
            showToast(t('automation_toggle_failed'), 'error');
        } finally {
            setAutomationLoading(false);
        }
    };

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api/dashboard/stats');
                const data = await res.json();
                if (data.success) {
                    setStats(data.data);
                }
            } catch (error) {
                console.error('Failed to fetch dashboard stats', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
        loadAutomationStatus();
        // 每30秒刷新一次
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    const formatNumber = (num: number) => {
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
        return num.toString();
    };

    // 准备图表数据
    const trendData = stats?.trend?.map((item: any) => ({
        name: new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' }),
        domains: item.scans,
        hits: item.hits
    })) || [];

    const statusData = stats?.statusDistribution || [];
    const totalResults = statusData.reduce((sum: number, item: any) => sum + item.value, 0);
    const healthPercent = totalResults > 0
        ? Math.round((statusData.find((s: any) => s.name === '404 Not Found')?.value || 0) / totalResults * 100)
        : 0;

    return (
        <div className="space-y-8 animate-slide-up">
            {/* Welcome Section */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 mb-2">{t('good_morning')}</h1>
                    <p className="text-slate-500">{t('coffee_break')}</p>
                </div>
                <div className="hidden md:flex items-center gap-3">
                    <button
                        onClick={handleToggleAutomation}
                        disabled={automationLoading}
                        className={`inline-flex items-center px-5 py-3 rounded-2xl text-sm font-bold border shadow-sm transition-all hover:scale-105 disabled:opacity-70 disabled:cursor-not-allowed ${automationEnabled
                            ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white border-emerald-400 shadow-emerald-200 hover:shadow-lg'
                            : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white border-amber-400 shadow-amber-200 hover:shadow-lg'
                            }`}
                    >
                        {automationLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        ) : automationEnabled ? (
                            <Pause className="w-5 h-5 mr-2" />
                        ) : (
                            <Play className="w-5 h-5 mr-2" />
                        )}
                        {automationEnabled ? t('automation_on') : t('automation_off')}
                    </button>
                    <span className="inline-flex items-center px-4 py-2 rounded-2xl bg-indigo-50 text-indigo-600 text-sm font-bold border border-indigo-100 shadow-sm animate-bounce">
                        {t('system_healthy')}
                    </span>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="stagger-1 animate-slide-up">
                    <Card
                        title={t('total_domains')}
                        value={formatNumber(stats?.summary?.totalDomains || 0)}
                        subtext={t('total_domains_sub')}
                        icon={Database}
                        trend="up"
                        colorClass="bg-indigo-500"
                    />
                </div>
                <div className="stagger-2 animate-slide-up">
                    <Card
                        title={t('daily_intake')}
                        value={`+${stats?.summary?.todayNew || 0}`}
                        subtext={t('daily_intake_sub')}
                        icon={Globe}
                        trend="up"
                        colorClass="bg-emerald-500"
                    />
                </div>
                <div className="stagger-3 animate-slide-up">
                    <Card
                        title={t('active_tasks')}
                        value={stats?.summary?.activeTasks?.toString() || '0'}
                        subtext={t('active_tasks_sub')}
                        icon={Zap}
                        colorClass="bg-amber-500"
                    />
                </div>
                <div className="animation-delay-4000 animate-slide-up">
                    <Card
                        title={t('risk_found')}
                        value={formatNumber(stats?.summary?.totalHits || 0)}
                        subtext={t('risk_found_sub')}
                        icon={AlertTriangle}
                        trend="down"
                        colorClass="bg-rose-500"
                    />
                </div>
            </div>

            {/* Charts Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 glass-panel rounded-3xl p-8 hover-lift">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <span className="text-2xl">📈</span> {t('scan_trend')}
                            </h3>
                            <p className="text-slate-400 text-sm mt-1">{t('scan_trend_sub')}</p>
                        </div>
                        <button className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
                            <Filter className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="h-72">
                        {trendData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={trendData}>
                                    <defs>
                                        <linearGradient id="colorPv" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                    <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} dy={10} />
                                    <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', borderColor: '#e2e8f0', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                                    />
                                    <Line type="monotone" dataKey="domains" stroke="#6366f1" strokeWidth={4} dot={{ r: 0 }} activeDot={{ r: 8, strokeWidth: 0 }} />
                                    <Line type="monotone" dataKey="hits" stroke="#34d399" strokeWidth={4} dot={{ r: 0 }} activeDot={{ r: 8, strokeWidth: 0 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-400">
                                {t('no_data_7_days')}
                            </div>
                        )}
                    </div>
                </div>

                <div className="glass-panel rounded-3xl p-8 hover-lift flex flex-col justify-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <PieChart width={100} height={100}><Pie data={statusData} dataKey="value" innerRadius={0} outerRadius={40} fill="#8884d8" /></PieChart>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2">
                        <span className="text-2xl">🍩</span> {t('status_distribution')}
                    </h3>
                    <p className="text-slate-400 text-sm mb-8">{t('status_distribution_sub')}</p>
                    <div className="h-48 relative">
                        {statusData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={statusData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={8}
                                        dataKey="value"
                                        cornerRadius={8}
                                    >
                                        {statusData.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: '12px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-400">
                                {t('no_results_yet')}
                            </div>
                        )}
                        {/* Center Text */}
                        <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                            <span className="text-3xl font-black text-slate-800">{healthPercent}%</span>
                            <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">{t('health')}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// TasksView moved to separate file
// DomainsView moved to separate file

// ResultsView moved to separate file



// CreateTaskModal moved to separate file

interface SidebarItemProps {
    icon: LucideIcon;
    label: string;
    active: boolean;
    onClick: () => void;
}

const SidebarItem = ({ icon: Icon, label, active, onClick }: SidebarItemProps) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center space-x-3 px-5 py-3.5 rounded-2xl transition-all duration-300 group relative overflow-hidden ${active
            ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-200 scale-105'
            : 'text-slate-500 hover:bg-white/50 hover:text-slate-700 hover:translate-x-1 hover:-translate-y-0.5 hover:shadow-md hover-jelly'
            }`}
    >
        {active && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-shimmer" />
        )}
        <Icon className={`w-5 h-5 transition-transform duration-300 ${active ? 'text-white scale-110' : 'text-slate-400 group-hover:scale-110'}`} />
        <span className={`text-sm font-medium ${active ? 'font-bold' : ''}`}>{label}</span>
        {active && <ChevronRight className="w-4 h-4 absolute right-4 text-white/80" />}
    </button>
);

interface LoginViewProps {
    onLogin: (user: any) => void;
}

const LoginView = ({ onLogin }: LoginViewProps) => {
    const { t } = useTranslation();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!username || !password) {
            setError(t('enter_username_password'));
            return;
        }

        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                onLogin(data.user);
            } else {
                setError(data.message || t('login_failed'));
            }
        }
        catch (err) {
            setError(t('error_occurred'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F0F4F8] flex items-center justify-center p-6 relative overflow-hidden">
            {/* Dynamic Background Blobs */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-200/40 rounded-full blur-[100px] animate-blob"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-200/40 rounded-full blur-[100px] animate-blob animation-delay-2000"></div>
                <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] bg-emerald-100/40 rounded-full blur-[80px] animate-blob animation-delay-4000"></div>
            </div>

            <div className="glass-panel w-full max-w-md p-10 rounded-[2.5rem] shadow-2xl relative z-10 animate-slide-up border-white/60">
                <div className="flex justify-center mb-8">
                    <div className="bg-gradient-to-tr from-indigo-500 to-purple-500 p-5 rounded-3xl shadow-lg shadow-indigo-300 transform rotate-3 hover:rotate-0 transition-all duration-500">
                        <Globe className="w-10 h-10 text-white animate-pulse" />
                    </div>
                </div>
                <h2 className="text-4xl font-black text-center text-slate-800 mb-2 tracking-tight">{t('welcome_back')}</h2>
                <p className="text-center text-slate-500 mb-10 font-medium text-lg">{t('online_detector_system')}</p>

                {error && (
                    <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 text-sm font-bold animate-shake">
                        <AlertCircle className="w-5 h-5" />
                        {error}
                    </div>
                )}

                <div className="space-y-6">
                    <div className="group">
                        <label className="block text-sm font-bold text-slate-700 mb-2 pl-1 group-focus-within:text-indigo-600 transition-colors">{t('username')}</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full glass-input rounded-2xl px-6 py-4 text-slate-800 focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all outline-none font-medium"
                            placeholder="admin"
                        />
                    </div>
                    <div className="group">
                        <label className="block text-sm font-bold text-slate-700 mb-2 pl-1 group-focus-within:text-indigo-600 transition-colors">{t('password')}</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                            className="w-full glass-input rounded-2xl px-6 py-4 text-slate-800 focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all outline-none font-medium"
                            placeholder="••••••••"
                        />
                    </div>
                    <button
                        onClick={handleLogin}
                        disabled={loading}
                        className="w-full bg-slate-900 hover:bg-black text-white font-bold py-4 rounded-2xl transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 mt-6 flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <span>{t('login_securely')}</span>
                                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                </div>
                <p className="text-center text-xs text-slate-400 mt-8 font-medium">
                    {t('secops_platform')}
                </p>
            </div>
        </div>
    );
};

const DashboardContent = () => {
    const { t, language, setLanguage } = useTranslation();
    const [user, setUser] = useState<any>(null);
    const [currentView, setCurrentView] = useState('dashboard');
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [isAddTargetModalOpen, setIsAddTargetModalOpen] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
    const [checkingAuth, setCheckingAuth] = useState(true);

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ message, type });
    };

    // 检查登录状态
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const res = await fetch('/api/auth/check');
                const data = await res.json();
                if (data.success && data.user) {
                    setUser(data.user);
                }
            } catch (error) {
                console.error('Failed to check auth status', error);
            } finally {
                setCheckingAuth(false);
            }
        };

        checkAuth();
    }, []);

    const handleViewResults = (taskId: number) => {
        setSelectedTaskId(taskId);
        setCurrentView('results');
    };

    // 登出处理
    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            setUser(null);
            showToast(t('logout_success'), 'info');
        } catch (error) {
            console.error('Logout failed', error);
        }
    };

    // Background gradient for main app
    const mainBg = "bg-gradient-to-br from-[#F1F5F9] via-[#F8FAFC] to-[#EEF2FF]";

    // 显示加载状态
    if (checkingAuth) {
        return (
            <>
                <GlobalStyles />
                <div className="flex items-center justify-center h-screen bg-[#F0F4F8]">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
            </>
        );
    }

    if (!user) {
        return (
            <>
                <GlobalStyles />
                <LoginView onLogin={(u) => setUser(u)} />
            </>
        );
    }

    const renderView = () => {
        switch (currentView) {
            case 'dashboard': return <DashboardView showToast={showToast} />;
            case 'tasks': return <TasksView onCreateOpen={() => setIsTaskModalOpen(true)} showToast={showToast} onViewResults={handleViewResults} />;
            case 'domains': return <DomainsView showToast={showToast} />;
            case 'results': return <ResultsView showToast={showToast} selectedTaskId={selectedTaskId} />;
            case 'logs': return <LogsView showToast={showToast} />;
            case 'workers': return <WorkerManagement />;
            case 'settings': return <SettingsView />;
            default: return <DashboardView showToast={showToast} />;
        }
    };

    return (
        <>
            <GlobalStyles />
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <div className={`flex h-screen ${mainBg} text-slate-600 font-sans selection:bg-indigo-100 selection:text-indigo-700 overflow-hidden`}>
                {/* Animated Background Orbs for Main App */}
                <div className="fixed inset-0 pointer-events-none z-0">
                    <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-200/20 rounded-full blur-[100px] animate-float"></div>
                    <div className="absolute top-1/2 right-0 w-[500px] h-[500px] bg-purple-200/10 rounded-full blur-[120px] animate-float animation-delay-4000"></div>
                </div>

                {/* Sidebar */}
                <div className="w-72 relative z-10 flex flex-col hidden md:flex backdrop-blur-sm border-r border-white/50 ml-4 my-4 rounded-3xl glass-panel">
                    <div className="p-8 pb-6 flex items-center space-x-3">
                        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 rounded-xl shadow-lg shadow-indigo-200 text-white animate-[spin_10s_linear_infinite] hover:animate-none">
                            <Globe className="w-6 h-6" />
                        </div>
                        <div>
                            <span className="font-black text-xl text-slate-800 tracking-tight block">InfoDetector</span>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('security_platform')}</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto py-4 px-4 space-y-2">
                        <SidebarItem icon={LayoutDashboard} label={t('dashboard')} active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} />
                        <SidebarItem icon={List} label={t('tasks')} active={currentView === 'tasks'} onClick={() => setCurrentView('tasks')} />
                        <SidebarItem icon={Globe} label={t('domains')} active={currentView === 'domains'} onClick={() => setCurrentView('domains')} />
                        <SidebarItem icon={Search} label={t('results')} active={currentView === 'results'} onClick={() => setCurrentView('results')} />
                        <SidebarItem icon={FileText} label={t('logs')} active={currentView === 'logs'} onClick={() => setCurrentView('logs')} />
                        <SidebarItem icon={Zap} label={t('workers')} active={currentView === 'workers'} onClick={() => setCurrentView('workers')} />
                        <div className="my-4 border-t border-slate-200/60 mx-4"></div>
                        <SidebarItem icon={Settings} label={t('settings')} active={currentView === 'settings'} onClick={() => setCurrentView('settings')} />
                    </div>

                    <div className="p-4 border-t border-slate-200/60">
                        {/* Language Switcher */}
                        <button
                            onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
                            className="w-full flex items-center space-x-3 px-5 py-3 rounded-2xl text-slate-500 hover:bg-white/50 hover:text-indigo-600 transition-all mb-2 group"
                        >
                            <Languages className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
                            <span className="text-sm font-medium">{language === 'zh' ? 'English' : '中文'}</span>
                        </button>

                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center space-x-3 px-5 py-3 rounded-2xl text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-all group"
                        >
                            <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                            <span className="text-sm font-medium">{t('logout')}</span>
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col overflow-hidden relative z-10">
                    {/* Header */}
                    <header className="h-24 flex items-center justify-between px-10">
                        <div className="flex items-center">
                            {/* Dynamic Title based on View */}
                            <div className="text-slate-400 font-medium">
                                {t('console')} <ChevronRight className="w-4 h-4 inline mx-1" /> <span className="text-slate-800 font-bold">{currentView === 'dashboard' ? t('dashboard') : currentView === 'tasks' ? t('tasks') : currentView === 'domains' ? t('domains') : currentView === 'results' ? t('results') : currentView === 'logs' ? t('logs') : currentView === 'workers' ? t('workers') : currentView === 'settings' ? t('settings') : currentView.charAt(0).toUpperCase() + currentView.slice(1)}</span>
                            </div>
                        </div>

                        <div className="flex items-center space-x-6">
                            <button className="bg-white p-3 rounded-full text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5">
                                <Search className="w-5 h-5" />
                            </button>
                            <button className="bg-white p-3 rounded-full text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 relative">
                                <div className="absolute top-2 right-3 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></div>
                                <Coffee className="w-5 h-5" />
                            </button>
                            <div className="flex items-center space-x-3 bg-white pl-2 pr-5 py-2 rounded-full shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-white/50">
                                <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-md ring-4 ring-indigo-50">
                                    AD
                                </div>
                                <div>
                                    <div className="text-sm font-black text-slate-800">{user?.username || 'Admin'}</div>
                                    <div className="text-[10px] font-bold text-emerald-500">{t('online_status')}</div>
                                </div>
                            </div>
                        </div>
                    </header>

                    {/* View Content */}
                    <main className="flex-1 overflow-auto px-10 pb-10 scrollbar-thin scrollbar-thumb-indigo-100 scrollbar-track-transparent">
                        <div className="max-w-7xl mx-auto pb-10">
                            {renderView()}
                        </div>
                    </main>
                </div>

                {/* Modals */}
                <CreateTaskModal
                    isOpen={isTaskModalOpen}
                    onClose={() => setIsTaskModalOpen(false)}
                    onSuccess={() => {
                        // 刷新任务列表
                        if (currentView === 'tasks') {
                            setCurrentView('dashboard');
                            setTimeout(() => setCurrentView('tasks'), 100);
                        }
                    }}
                    showToast={showToast}
                />
                <AddTargetModal
                    isOpen={isAddTargetModalOpen}
                    onClose={() => setIsAddTargetModalOpen(false)}
                    onSuccess={() => {
                        // 刷新域名列表
                        if (currentView === 'domains') {
                            setCurrentView('dashboard');
                            setTimeout(() => setCurrentView('domains'), 100);
                        }
                    }}
                    showToast={showToast}
                />
            </div >
        </>
    );
}

export default function DashboardApp() {
    return (
        <LanguageProvider>
            <DashboardContent />
        </LanguageProvider>
    );
}

