import React, { useState, useEffect } from 'react';
import { usersAPI, groupsAPI } from '../api';
import { Edit2, Trash2, UserPlus, Plus, Shield, Users, Mail, Lock, User as UserIcon, Check, X, Search, Briefcase, TrendingUp, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../constants/menuConfig';

export default function UserManagement() {
    const { user } = useAuth();
    const [usersList, setUsersList] = useState([]);
    const [groups, setGroups] = useState([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'GroupLeader', group_id: '', permissions: {} });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (user?.role === 'Admin') {
            fetchData();
        }
    }, [user]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [usersRes, groupsRes] = await Promise.all([
                usersAPI.getAll(),
                groupsAPI.getAll()
            ]);
            setUsersList(usersRes.data);
            setGroups(groupsRes.data);
        } catch (err) {
            console.error(err);
            setError('데이터를 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenForm = (existingUser = null) => {
        if (existingUser) {
            setEditingUser(existingUser);
            setFormData({
                name: existingUser.name,
                email: existingUser.email,
                password: '',
                role: existingUser.role,
                group_id: existingUser.group_id || '',
                permissions: existingUser.permissions || {}
            });
        } else {
            setEditingUser(null);
            setFormData({ name: '', email: '', password: '', role: 'GroupLeader', group_id: '', permissions: {} });
        }
        setError('');
        setSuccess(false);
        setSaving(false);
        setIsFormOpen(true);
        setShowPassword(false);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setEditingUser(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (formData.role === ROLES.GROUP_LEADER && !formData.group_id) {
            return setError('그룹장은 반드시 소속 그룹을 지정해야 합니다.');
        }

        setSaving(true);

        try {
            const payload = {
                ...formData,
                group_id: (formData.role === ROLES.ADMIN || !formData.group_id) ? null : parseInt(formData.group_id)
            };

            if (editingUser) {
                await usersAPI.update(editingUser.id, payload);
            } else {
                await usersAPI.create(payload);
            }

            await fetchData();
            setSuccess(true);
            setTimeout(() => {
                handleCloseForm();
            }, 1000);
        } catch (err) {
            setError(err.response?.data?.error || '저장 중 오류가 발생했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('정말 이 사용자를 삭제하시겠습니까?')) {
            try {
                await usersAPI.delete(id);
                fetchData();
            } catch (err) {
                alert(err.response?.data?.error || '삭제 중 오류가 발생했습니다.');
            }
        }
    };

    const filteredUsers = usersList.filter(u => 
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (user?.role !== 'Admin') return null;

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[400px] animate-in fade-in duration-500">
            <div className="w-12 h-12 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin mb-6 shadow-lg shadow-blue-500/10"></div>
            <span className="text-gray-400 font-bold tracking-wider uppercase text-xs">Synchronizing Access Data...</span>
        </div>
    );

    return (
        <div className="animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-lg">
                <div>
                    <h1 className="tracking-tight">사용자 관리</h1>
                </div>
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="premium-input-wrapper has-icon-left has-icon-right md:w-80">
                        <input 
                            type="text" 
                            placeholder="사용자 이름 또는 이메일 검색..." 
                            className="premium-input"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Search className="premium-input-icon" size={18} />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="premium-input-action"
                                title="검색어 지우기"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                    <button
                        onClick={() => handleOpenForm()}
                        className="premium-icon-btn"
                        title="신규 사용자 등록"
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)'; e.currentTarget.style.color = '#10b981'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = ''; }}
                    >
                        <Plus size={20} />
                    </button>
                </div>
            </div>

            {isFormOpen && (
                <div className="premium-glass p-1 mb-12 animate-in slide-in-from-top-4 duration-500 shadow-2xl shadow-blue-500/10">
                    <div className="glass-card-header flex justify-between items-center py-6 px-10">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                                {editingUser ? <Edit2 size={24} /> : <UserPlus size={24} />}
                            </div>
                            <div>
                                <h3 className="text-2xl font-extrabold text-white tracking-tight">{editingUser ? '사용자 정보 수정' : '신규 사용자 등록'}</h3>
                                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">계정 및 인증 정보 설정</p>
                            </div>
                        </div>
                        <button onClick={handleCloseForm} className="p-3 hover:bg-white/10 rounded-xl transition-colors text-gray-500 hover:text-white">
                            <X size={24} />
                        </button>
                    </div>

                    <div className="glass-card-body p-10">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-6 py-4 rounded-2xl text-md mb-6 flex items-center gap-4 animate-in shake duration-300">
                                <Shield size={20} />
                                <span className="font-semibold">{error}</span>
                            </div>
                        )}

                        {success && (
                            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-6 py-4 rounded-2xl text-md mb-6 flex items-center gap-4 animate-in slide-in-from-top duration-300">
                                <Check size={20} />
                                <span className="font-semibold">저장이 성공적으로 완료되었습니다!</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="premium-input-group">
                                <label className="premium-input-label">사용자 이름 (Full Name)</label>
                                <div className="premium-input-wrapper has-icon-left">
                                    <input
                                        type="text"
                                        className="premium-input"
                                        placeholder="홍길동"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                    <UserIcon className="premium-input-icon" size={18} />
                                </div>
                            </div>

                            <div className="premium-input-group">
                                <label className="premium-input-label">이메일 계정 (Email Address)</label>
                                <div className="premium-input-wrapper has-icon-left">
                                    <input
                                        type="email"
                                        className="premium-input"
                                        placeholder="user@example.com"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        required
                                    />
                                    <Mail className="premium-input-icon" size={18} />
                                </div>
                            </div>

                            <div className="premium-input-group">
                                <label className="premium-input-label">
                                    보안 비밀번호
                                    {editingUser && <span className="text-[10px] text-gray-500 ml-2 font-bold uppercase tracking-wider">(공란 시 기존 비밀번호 유지)</span>}
                                </label>
                                <div className="premium-input-wrapper has-icon-left has-icon-right">
                                    <Lock className="premium-input-icon" size={18} />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        className="premium-input"
                                        placeholder="••••••••"
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        required={!editingUser}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="premium-input-action"
                                        title={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div className="premium-input-group">
                                <label className="premium-input-label">시스템 접근 역할 (Role)</label>
                                <div className="premium-input-wrapper has-icon-left has-icon-right">
                                    <select
                                        className="premium-input appearance-none"
                                        value={formData.role}
                                        onChange={e => setFormData({ ...formData, role: e.target.value })}
                                    >
                                        <option value={ROLES.ADMIN}>전체 관리자 (Administrator)</option>
                                        <option value={ROLES.GROUP_LEADER}>그룹장 (Group Leader)</option>
                                        <option value={ROLES.TEAM_LEADER}>팀장 (Team Leader)</option>
                                        <option value={ROLES.PD}>PD (Project Director)</option>
                                        <option value={ROLES.GM}>GM (General Manager)</option>
                                    </select>
                                    <Shield className="premium-input-icon" size={18} />
                                    <ChevronDown className="premium-input-icon right" size={16} />
                                </div>
                            </div>

                            {formData.role !== ROLES.ADMIN && (
                                <div className="premium-input-group md:col-span-2">
                                    <label className="premium-input-label">배정 그룹 (Group Assignment)</label>
                                    <div className="premium-input-wrapper has-icon-left has-icon-right">
                                        <select
                                            className="premium-input appearance-none"
                                            value={formData.group_id}
                                            onChange={e => setFormData({ ...formData, group_id: e.target.value })}
                                            required={formData.role === ROLES.GROUP_LEADER}
                                        >
                                            <option value="">그룹을 선택해 주세요</option>
                                            {groups.map(g => (
                                                <option key={g.id} value={g.id}>{g.name}</option>
                                            ))}
                                        </select>
                                        <Users className="premium-input-icon" size={18} />
                                        <ChevronDown className="premium-input-icon right" size={16} />
                                    </div>
                                </div>
                            )}

                            {formData.role !== ROLES.ADMIN && (
                                <div className="premium-input-group md:col-span-2">
                                    <label className="premium-input-label">메뉴 접근 권한 설정 (Granular Permissions)</label>
                                    <div className="bg-black/20 rounded-2xl p-6 border border-white/5">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            {[
                                                { key: 'dashboard', label: '대시보드' },
                                                { key: 'sales', label: '영업현황' },
                                                { key: 'projects', label: '프로젝트 배정' },
                                                { key: 'settings', label: '설정' }
                                            ].map(opt => (
                                                <label key={opt.key} className="flex items-center gap-3 cursor-pointer group">
                                                    <div 
                                                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                                                            formData.permissions[opt.key] !== false ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-gray-600'
                                                        }`}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            const current = formData.permissions[opt.key];
                                                            // undefined -> false -> true -> undefined (or simple toggle)
                                                            // We'll use simple toggle for checkboxes: true / false
                                                            const next = current === false ? true : false;
                                                            setFormData({
                                                                ...formData,
                                                                permissions: { ...formData.permissions, [opt.key]: next }
                                                            });
                                                        }}
                                                    >
                                                        {formData.permissions[opt.key] !== false ? <Check size={18} /> : <X size={18} />}
                                                    </div>
                                                    <span className={`text-sm font-semibold transition-colors ${
                                                        formData.permissions[opt.key] !== false ? 'text-white' : 'text-gray-500'
                                                    }`}>
                                                        {opt.label}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-4">
                                            * 관리자의 경우 모든 메뉴에 대한 접근 권한이 자동으로 부여됩니다.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="md:col-span-2 flex justify-end gap-5 mt-4">
                                <button
                                    type="button"
                                    onClick={handleCloseForm}
                                    className="premium-btn premium-btn-secondary px-10 py-4 rounded-2xl"
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className={`premium-btn premium-btn-primary px-12 py-4 rounded-2xl ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {saving ? (
                                        <div className="flex items-center gap-3">
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            <span>저장 중...</span>
                                        </div>
                                    ) : (
                                        <>
                                            <Check size={20} />
                                            <span>{editingUser ? '정보 수정 완료' : '사용자 등록 완료'}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="premium-glass overflow-hidden shadow-2xl">
                <table className="premium-table">
                    <thead>
                        <tr>
                            <th className="pl-10">사용자 프로필</th>
                            <th>이메일 계정</th>
                            <th>역할</th>
                            <th>배정 소속</th>
                            <th className="text-right pr-10">관리 도구</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.map(u => (
                            <tr key={u.id} className="group hover:bg-white/[0.03]">
                                <td className="pl-10">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center text-blue-400 font-extrabold text-lg shadow-inner group-hover:scale-110 transition-transform">
                                            {u.name.substring(0, 1)}
                                        </div>
                                        <div>
                                            <div className="font-extrabold text-white text-md tracking-tight leading-tight">{u.name || 'Unknown'}</div>
                                            <div className="text-gray-400 text-[11px] font-medium flex items-center gap-1.5 mt-0.5 opacity-80">
                                                <Mail size={10} className="text-blue-500/50" />
                                                {u.email}
                                            </div>
                                            <div className="text-[10px] text-gray-500 font-bold uppercase mt-1 tracking-widest leading-none flex items-center gap-2">
                                                <span>ID: {u.id.toString().padStart(4, '0')}</span>
                                                <span className="w-1 h-1 bg-gray-700 rounded-full"></span>
                                                <span className="text-blue-500/60 lowercase">{u.role}</span>
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <div className="flex items-center gap-2 text-gray-400 font-medium">
                                        <Mail size={14} className="opacity-50" />
                                        {u.email}
                                    </div>
                                </td>
                                <td>
                                    <span className={`premium-badge ${
                                        u.role === ROLES.ADMIN ? 'premium-badge-admin' : 
                                        u.role === ROLES.GROUP_LEADER ? 'premium-badge-leader' :
                                        u.role === ROLES.TEAM_LEADER ? 'premium-badge-leader' :
                                        u.role === ROLES.PD ? 'premium-badge-pd' : 'premium-badge-gm'
                                    }`}>
                                        {u.role === ROLES.ADMIN && <><Shield size={12} className="mr-1.5" /> 관리자</>}
                                        {u.role === ROLES.GROUP_LEADER && <><Users size={12} className="mr-1.5" /> 그룹장</>}
                                        {u.role === ROLES.TEAM_LEADER && <><Users size={12} className="mr-1.5" /> 팀장</>}
                                        {u.role === ROLES.PD && <><Briefcase size={12} className="mr-1.5" /> PD</>}
                                        {u.role === ROLES.GM && <><TrendingUp size={12} className="mr-1.5" /> GM</>}
                                    </span>
                                </td>
                                <td>
                                    <div className="flex items-center gap-3 text-gray-400 font-semibold">
                                        {u.role !== ROLES.ADMIN ? (
                                            <div className="px-3 py-1.5 bg-white/5 rounded-xl border border-white/5 flex items-center gap-2 text-xs">
                                                <Users size={12} className="text-blue-500/70" />
                                                <span>{u.group_name || '미배정'}</span>
                                            </div>
                                        ) : (
                                            <span className="text-gray-600 px-3">—</span>
                                        )}
                                    </div>
                                </td>
                                <td className="text-right pr-10">
                                    <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                        <button
                                            onClick={() => handleOpenForm(u)}
                                            className="premium-action-btn edit"
                                            title="프로필 수정"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(u.id)}
                                            disabled={u.id === user.id}
                                            className={`premium-action-btn delete ${u.id === user.id ? 'opacity-20 cursor-not-allowed' : ''}`}
                                            title={u.id === user.id ? "자신은 삭제할 수 없습니다" : "사용자 삭제"}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredUsers.length === 0 && (
                            <tr>
                                <td colSpan="5" className="p-24 text-center">
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center text-gray-600">
                                            <Search size={32} />
                                        </div>
                                        <div className="text-gray-500 font-bold uppercase tracking-widest text-xs">일치하는 사용자를 찾을 수 없습니다.</div>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
