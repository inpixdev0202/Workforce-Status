import React, { useState, useEffect } from 'react';
import { usersAPI, groupsAPI } from '../api';
import { Edit2, Trash2, UserPlus, Shield, Users, Mail, Lock, User as UserIcon, Check, X, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function UserManagement() {
    const { user } = useAuth();
    const [usersList, setUsersList] = useState([]);
    const [groups, setGroups] = useState([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'GroupLeader', group_id: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

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
                group_id: existingUser.group_id || ''
            });
        } else {
            setEditingUser(null);
            setFormData({ name: '', email: '', password: '', role: 'GroupLeader', group_id: '' });
        }
        setError('');
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setEditingUser(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (formData.role === 'GroupLeader' && !formData.group_id) {
            return setError('그룹장은 소속 그룹을 지정해야 합니다.');
        }

        try {
            const payload = {
                ...formData,
                group_id: formData.role === 'Admin' ? null : parseInt(formData.group_id)
            };

            if (editingUser) {
                await usersAPI.update(editingUser.id, payload);
            } else {
                await usersAPI.create(payload);
            }

            await fetchData();
            handleCloseForm();
        } catch (err) {
            setError(err.response?.data?.error || '저장 중 오류가 발생했습니다.');
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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                <div>
                    <h2 className="text-3xl font-extrabold text-white flex items-center gap-4 tracking-tight">
                        <div className="p-3 bg-blue-500/20 rounded-2xl text-blue-400 shadow-lg shadow-blue-500/10">
                            <Shield size={28} />
                        </div>
                        사용자 권한 관리
                    </h2>
                    <p className="text-gray-400 mt-2 text-lg">시스템 사용자별 접근 권한 및 소속 그룹을 설정합니다.</p>
                </div>
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input 
                            type="text" 
                            placeholder="사용자 이름 또는 이메일 검색..." 
                            className="premium-form-input pl-12 py-3 rounded-2xl"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => handleOpenForm()}
                        className="premium-btn premium-btn-primary px-8 py-3.5 rounded-2xl whitespace-nowrap"
                    >
                        <UserPlus size={20} />
                        <span>신규 사용자 등록</span>
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
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-6 py-4 rounded-2xl text-md mb-10 flex items-center gap-4 animate-in shake duration-300">
                                <Shield size={20} />
                                <span className="font-semibold">{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="premium-form-group">
                                <label className="premium-form-label">사용자 이름 (Full Name)</label>
                                <div className="relative">
                                    <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                                    <input
                                        type="text"
                                        className="premium-form-input pl-14 py-4 rounded-2xl"
                                        placeholder="홍길동"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="premium-form-group">
                                <label className="premium-form-label">이메일 계정 (Email Address)</label>
                                <div className="relative">
                                    <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                                    <input
                                        type="email"
                                        className="premium-form-input pl-14 py-4 rounded-2xl"
                                        placeholder="user@example.com"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="premium-form-group">
                                <label className="premium-form-label">
                                    보안 비밀번호
                                    {editingUser && <span className="text-[10px] text-gray-500 ml-2 font-bold uppercase tracking-wider">(공란 시 기존 비밀번호 유지)</span>}
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                                    <input
                                        type="password"
                                        className="premium-form-input pl-14 py-4 rounded-2xl"
                                        placeholder="••••••••"
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        required={!editingUser}
                                    />
                                </div>
                            </div>

                            <div className="premium-form-group">
                                <label className="premium-form-label">시스템 접근 역할 (Role)</label>
                                <select
                                    className="premium-form-input py-4 rounded-2xl"
                                    value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                                >
                                    <option value="Admin">전체 관리자 (Administrator)</option>
                                    <option value="GroupLeader">영업 그룹장 (Group Leader)</option>
                                </select>
                            </div>

                            {formData.role === 'GroupLeader' && (
                                <div className="premium-form-group md:col-span-2">
                                    <label className="premium-form-label">배정 그룹 (Group Assignment)</label>
                                    <select
                                        className="premium-form-input py-4 rounded-2xl"
                                        value={formData.group_id}
                                        onChange={e => setFormData({ ...formData, group_id: e.target.value })}
                                        required
                                    >
                                        <option value="">그룹을 선택해 주세요</option>
                                        {groups.map(g => (
                                            <option key={g.id} value={g.id}>{g.name}</option>
                                        ))}
                                    </select>
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
                                    className="premium-btn premium-btn-primary px-12 py-4 rounded-2xl"
                                >
                                    <Check size={20} />
                                    <span>{editingUser ? '정보 수정 완료' : '사용자 등록 완료'}</span>
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
                                            <div className="font-extrabold text-white text-md tracking-tight">{u.name}</div>
                                            <div className="text-[10px] text-gray-500 font-bold uppercase mt-1 tracking-widest leading-none">ID: {u.id.toString().padStart(4, '0')}</div>
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
                                    <span className={`premium-badge ${u.role === 'Admin' ? 'premium-badge-admin' : 'premium-badge-leader'}`}>
                                        {u.role === 'Admin' ? (
                                            <><Shield size={12} className="mr-1.5" /> 관리자</>
                                        ) : (
                                            <><Users size={12} className="mr-1.5" /> 그룹장</>
                                        )}
                                    </span>
                                </td>
                                <td>
                                    <div className="flex items-center gap-3 text-gray-400 font-semibold">
                                        {u.role === 'GroupLeader' ? (
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
