import React, { useState, useEffect } from 'react';
import { Users, ExternalLink, ShieldCheck, UserCog, Plus, Pencil, Trash2, X } from 'lucide-react';
import UserManagement from './UserManagement';
import GroupManager from './GroupManager';
import EmployeeList from './EmployeeList';
import { integrationsAPI } from '../api';

const Settings = () => {
    const [activeTab, setActiveTab] = useState('users');
    const [integrations, setIntegrations] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        url: '',
        icon_emoji: '🔗'
    });

    const commonEmojis = ['🔗', '🛡️', '🎓', '📚', '🛰️', '🌍', '🚀', '🛠️', '📊', '⚙️', '💬', '📧', '📱', '💻', '🌐', '🏢'];

    const sidebarItems = [
        { id: 'users', label: '사용자 관리', subLabel: '계정 및 보안 관리', icon: ShieldCheck },
        { id: 'groups', label: '그룹 관리', subLabel: '그룹 및 팀 구성', icon: Users },
        { id: 'employees', label: '직원 관리', subLabel: '임직원 정보 관리', icon: UserCog },
        { id: 'integrations', label: '연계 관리', subLabel: '외부 시스템 연계', icon: ExternalLink },
    ];

    useEffect(() => {
        if (activeTab === 'integrations') {
            loadIntegrations();
        }
    }, [activeTab]);

    const loadIntegrations = async () => {
        setLoading(true);
        try {
            const res = await integrationsAPI.getAll();
            setIntegrations(res.data);
        } catch (err) {
            console.error('Failed to load integrations:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (item = null) => {
        if (item) {
            setEditingId(item.id);
            setFormData({
                name: item.name,
                description: item.description,
                url: item.url,
                icon_emoji: item.icon_emoji
            });
        } else {
            setEditingId(null);
            setFormData({
                name: '',
                description: '',
                url: '',
                icon_emoji: '🔗'
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (editingId) {
                await integrationsAPI.update(editingId, formData);
            } else {
                await integrationsAPI.create(formData);
            }
            setIsModalOpen(false);
            loadIntegrations();
        } catch (err) {
            alert('저장에 실패했습니다.');
            console.error(err);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        try {
            await integrationsAPI.delete(id);
            loadIntegrations();
        } catch (err) {
            alert('삭제에 실패했습니다.');
            console.error(err);
        }
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'users':
                return (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <UserManagement />
                    </div>
                );
            case 'groups':
                return (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <GroupManager />
                    </div>
                );
            case 'employees':
                return (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <EmployeeList />
                    </div>
                );
            case 'integrations':
                return (
                    <div className="animate-in fade-in duration-700">
                        <div className="flex justify-between items-start mb-10">
                            <div>
                                <h1 className="tracking-tight">연계 관리</h1>
                            </div>
                            <button 
                                onClick={() => handleOpenModal()} 
                                className="premium-icon-btn"
                                title="연계 시스템 추가"
                            >
                                <Plus size={24} />
                            </button>
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-20">
                                <div className="spinner"></div>
                            </div>
                        ) : (
                            <div className="grid grid-3 gap-lg">
                                {integrations.map((item) => (
                                    <div key={item.id} className="premium-glass hover:border-blue-500/40 transition-all group">
                                        <div className="glass-card-header border-0 pb-2">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center text-3xl group-hover:bg-blue-500/20 transition-colors shadow-inner">
                                                        {item.icon_emoji}
                                                    </div>
                                                    <h3 className="text-xl font-bold text-white">{item.name}</h3>
                                                </div>
                                                <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button 
                                                        onClick={() => handleOpenModal(item)} 
                                                        className="premium-icon-btn"
                                                        title="수정"
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(item.id)} 
                                                        className="premium-icon-btn btn-delete"
                                                        title="삭제"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="glass-card-body pt-0">
                                            <p className="text-gray-400 text-sm mb-8 leading-relaxed line-clamp-2 h-10">
                                                {item.description}
                                            </p>
                                            <a 
                                                href={item.url} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className="premium-btn premium-btn-primary w-full py-4 rounded-xl text-md flex items-center justify-center gap-2"
                                            >
                                                🚀 시스템 바로가기
                                            </a>
                                        </div>
                                    </div>
                                ))}
                                {integrations.length === 0 && (
                                    <div className="col-span-full py-20 text-center text-gray-500">
                                        등록된 연계 시스템이 없습니다.
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Integration Modal */}
                        {isModalOpen && (
                            <div className="modal-overlay">
                                <div className="modal-content compact-modal animate-in zoom-in duration-300">
                                    <div className="modal-header">
                                        <h2>{editingId ? '연계 시스템 수정' : '연계 시스템 추가'}</h2>
                                        <button onClick={() => setIsModalOpen(false)} className="close-btn">
                                            <X size={20} />
                                        </button>
                                    </div>
                                    <form onSubmit={handleSave}>
                                        <div className="modal-body space-y-4">
                                            <div className="form-group">
                                                <label className="form-label">아이콘 (이모지)</label>
                                                <div className="flex gap-2 mb-3">
                                                    <input 
                                                        type="text" 
                                                        className="form-control text-center text-xl" 
                                                        style={{ width: '60px' }}
                                                        value={formData.icon_emoji}
                                                        onChange={e => setFormData({...formData, icon_emoji: e.target.value})}
                                                    />
                                                    <div className="text-xs text-gray-400 flex items-center bg-white/5 rounded-lg px-3 border border-white/10 flex-1">
                                                        아래에서 선택하거나 직접 입력하세요
                                                    </div>
                                                </div>
                                                <div className="emoji-grid">
                                                    {commonEmojis.map(emoji => (
                                                        <button
                                                            key={emoji}
                                                            type="button"
                                                            className={`emoji-btn ${formData.icon_emoji === emoji ? 'active' : ''}`}
                                                            onClick={() => setFormData({...formData, icon_emoji: emoji})}
                                                        >
                                                            {emoji}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">시스템 이름</label>
                                                <input 
                                                    type="text" 
                                                    className="form-control" 
                                                    placeholder="시스템 이름을 입력하세요" 
                                                    required
                                                    value={formData.name}
                                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">시스템 설명</label>
                                                <textarea 
                                                    className="form-control" 
                                                    placeholder="시스템에 대한 간단한 설명을 입력하세요" 
                                                    rows="2"
                                                    value={formData.description}
                                                    onChange={e => setFormData({...formData, description: e.target.value})}
                                                ></textarea>
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">바로가기 URL</label>
                                                <input 
                                                    type="url" 
                                                    className="form-control" 
                                                    placeholder="https://..." 
                                                    required
                                                    value={formData.url}
                                                    onChange={e => setFormData({...formData, url: e.target.value})}
                                                />
                                            </div>
                                        </div>
                                        <div className="modal-footer mt-8">
                                            <button type="button" onClick={() => setIsModalOpen(false)} className="premium-btn py-3 px-6 rounded-xl">취소</button>
                                            <button type="submit" className="premium-btn premium-btn-primary py-3 px-8 rounded-xl font-bold">저장하기</button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="container page">
            <div className="settings-grid w-full">
                
                {/* Lateral Sidebar (Left) */}
                <aside className="w-full animate-in fade-in slide-in-from-left duration-700 sticky-top-2">
                    <nav className="flex flex-col gap-2 p-2 glass-panel-deep">
                        {sidebarItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`sidebar-btn group ${
                                    activeTab === item.id ? 'sidebar-btn-active' : 'sidebar-btn-inactive'
                                }`}
                            >
                                <div className="sidebar-icon-container">
                                    <item.icon size={18} strokeWidth={2.5} />
                                </div>
                                <div className="flex-1 text-left">
                                    <div className="font-bold text-sm tracking-tight transition-colors duration-300">
                                        {item.label}
                                    </div>
                                </div>
                                {activeTab === item.id && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_12px_#3b82f6]"></div>
                                )}
                            </button>
                        ))}
                    </nav>
                </aside>

                {/* Main Content Area (Right) */}
                <main className="w-full min-h-700 min-w-0 overflow-x-auto">
                    <div className="max-w-1200 w-full">
                        {renderContent()}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Settings;
