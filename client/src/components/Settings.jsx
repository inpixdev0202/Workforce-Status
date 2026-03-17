import React, { useState } from 'react';
import { LayoutDashboard, Users, ExternalLink, Settings as SettingsIcon, ChevronRight, LayoutGrid, ShieldCheck } from 'lucide-react';
import UserManagement from './UserManagement';

const Settings = () => {
    const [activeTab, setActiveTab] = useState('dashboard');

    const sidebarItems = [
        { id: 'dashboard', label: '설정 대시보드', subLabel: '시스템 개요 및 상태', icon: LayoutGrid },
        { id: 'users', label: '사용자 및 권한', subLabel: '계정 및 보안 관리', icon: ShieldCheck },
        { id: 'integrations', label: '외부 연동', subLabel: '외부 시스템 링크', icon: ExternalLink },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard':
                return (
                    <div className="animate-in fade-in duration-700">
                        <div className="flex items-center justify-between mb-10">
                            <div>
                                <h2 className="text-4xl font-black text-white tracking-tighter mb-2">설정 대시보드</h2>
                                <p className="text-gray-400 font-medium">관리자 전용 시스템 제어 센터입니다.</p>
                            </div>
                            <div className="flex gap-3">
                                <div className="p-4 glass-panel-deep flex flex-col items-end min-w-[120px]">
                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">System Status</span>
                                    <span className="text-blue-400 font-black text-lg">OPTIMAL</span>
                                </div>
                            </div>
                        </div>

                        {/* Top Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                            <div className="glass-panel-deep p-6 glow-border group">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                                        <Users size={24} />
                                    </div>
                                    <span className="text-gray-400 font-bold text-xs uppercase tracking-widest">Active Users</span>
                                </div>
                                <div className="text-3xl font-black text-white">1,284</div>
                                <div className="text-[10px] text-emerald-400 font-bold mt-2 flex items-center gap-1">
                                    <span>↑ 12.5%</span>
                                    <span className="text-gray-600 font-medium">vs last month</span>
                                </div>
                            </div>
                            <div className="glass-panel-deep p-6 glow-border group">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="p-3 bg-purple-500/10 rounded-2xl text-purple-400 group-hover:bg-purple-500/20 transition-colors">
                                        <ExternalLink size={24} />
                                    </div>
                                    <span className="text-gray-400 font-bold text-xs uppercase tracking-widest">Integrations</span>
                                </div>
                                <div className="text-3xl font-black text-white">08</div>
                                <div className="text-[10px] text-blue-400 font-bold mt-2 flex items-center gap-1">
                                    <span>CONNECTED</span>
                                </div>
                            </div>
                            <div className="glass-panel-deep p-6 glow-border group">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-400 group-hover:bg-amber-500/20 transition-colors">
                                        <ShieldCheck size={24} />
                                    </div>
                                    <span className="text-gray-400 font-bold text-xs uppercase tracking-widest">Security Level</span>
                                </div>
                                <div className="text-3xl font-black text-white">HIGH</div>
                                <div className="text-[10px] text-amber-400 font-bold mt-2 flex items-center gap-1">
                                    <span>ENCRYPTED</span>
                                </div>
                            </div>
                        </div>

                        <div className="glass-panel-deep overflow-hidden glow-border">
                            <div className="p-12 text-center relative overflow-hidden">
                                <div className="absolute top-[-100px] left-[-100px] w-[300px] h-[300px] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none"></div>
                                
                                <div className="w-24 h-24 glass-panel-deep rounded-3xl flex items-center justify-center mx-auto mb-8 text-blue-400 shadow-2xl shadow-blue-500/20 relative z-10">
                                    <SettingsIcon size={48} />
                                </div>
                                <h2 className="text-4xl font-black mb-4 text-white tracking-tighter relative z-10">시스템 아키텍처 설정</h2>
                                <p className="text-gray-400 mb-10 mx-auto leading-relaxed text-lg font-medium relative z-10" style={{ maxWidth: '650px' }}>
                                    워크포스 시스템의 핵심 엔진을 구성하고 최적화합니다. <br />
                                    모든 모듈은 프리미엄 인프라 위에서 실시간으로 동기화됩니다.
                                </p>
                                <div className="flex justify-center gap-6 relative z-10">
                                    <div className="px-10 py-5 glass-panel-deep border-white/5 text-sm">
                                        <span className="text-gray-500 font-bold mr-2">ENVIRONMENT:</span>
                                        <span className="text-blue-400 font-black">PRODUCTION</span>
                                    </div>
                                    <div className="px-10 py-5 glass-panel-deep border-white/5 text-sm">
                                        <span className="text-gray-500 font-bold mr-2">LAST UPDATE:</span>
                                        <span className="text-white font-black">2026.03.12</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'users':
                return (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <UserManagement />
                    </div>
                );
            case 'integrations':
                return (
                    <div className="animate-in fade-in duration-700">
                        <div className="flex items-center gap-4 mb-10">
                            <div className="p-3 bg-orange-500/20 rounded-2xl text-orange-400">
                                <ExternalLink size={32} />
                            </div>
                            <div>
                                <h2 className="text-3xl font-extrabold text-white tracking-tight">외부 시스템 연동</h2>
                                <p className="text-gray-400 font-medium">Workforce Ecosystem의 외부 솔루션 연동을 관리합니다.</p>
                            </div>
                        </div>

                        <div className="grid grid-3 gap-lg">
                            <div className="premium-glass hover:border-blue-500/40 transition-all group">
                                <div className="glass-card-header border-0 pb-2">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center text-3xl group-hover:bg-blue-500/20 transition-colors shadow-inner">
                                            🎓
                                        </div>
                                        <h3 className="text-xl font-bold text-white">Career System</h3>
                                    </div>
                                </div>
                                <div className="glass-card-body pt-0">
                                    <p className="text-gray-400 text-sm mb-8 leading-relaxed">
                                        직원들의 경력 산정, 자격증 관리 및 각종 증명서 발급을 위한 외부 특화 시스템으로 연결됩니다.
                                    </p>
                                    <a 
                                        href="https://service-6113430460.us-west1.run.app/" 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="premium-btn premium-btn-primary w-full py-4 rounded-xl text-md"
                                    >
                                        🚀 시스템 바로가기
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="container page">
            <div className="mb-12 animate-in fade-in duration-700">
                <h1 className="text-gradient" style={{ fontSize: '3rem', fontWeight: 900, marginBottom: '0.75rem', letterSpacing: '-0.05em' }}>
                    설정
                </h1>
            </div>

            <div className="flex flex-col lg:flex-row-reverse gap-12 items-start">
                {/* Lateral Sidebar (Now on the Right) */}
                <aside className="w-full lg:w-64 flex-shrink-0 animate-in fade-in slide-in-from-right duration-700">
                    <nav className="flex flex-col gap-1.5 p-2 glass-panel-deep border-white/5 shadow-2xl">
                        {sidebarItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`sidebar-btn group ${
                                    activeTab === item.id ? 'sidebar-btn-active' : 'sidebar-btn-inactive'
                                }`}
                                style={{ padding: '0.75rem 1rem', borderRadius: '0.75rem' }}
                            >
                                <div className={`sidebar-icon-container ${activeTab === item.id ? 'scale-110' : 'group-hover:scale-110'}`} style={{ padding: '0.5rem' }}>
                                    <item.icon size={16} strokeWidth={2.5} />
                                </div>
                                <div className="flex-1 text-left ml-1">
                                    <div className={`font-black text-xs tracking-tight ${activeTab === item.id ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}`}>
                                        {item.label}
                                    </div>
                                </div>
                                <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                                    activeTab === item.id ? 'bg-blue-500 shadow-[0_0_8px_#3b82f6]' : 'bg-transparent'
                                }`}></div>
                            </button>
                        ))}
                    </nav>
                </aside>

                {/* Main Content Area (Now on the Left) */}
                <main className="flex-1 w-full min-h-[700px] lg:pr-4 transition-all duration-500">
                    <div className="max-w-[1200px] w-full">
                        {renderContent()}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Settings;
