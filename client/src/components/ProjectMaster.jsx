import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
    Briefcase,
    Plus,
    Search,
    Pencil,
    Trash2,
    X,
    Filter,
    Calendar,
    User,
    CheckCircle2,
    Clock,
    AlertCircle,
    ChevronRight,
    ArrowUpDown,
    MoreHorizontal,
    Layers,
    Activity,
    Building2,
    CheckCircle,
    HelpCircle
} from 'lucide-react';
import { projectsAPI, employeesAPI } from '../api';
import { format, parseISO, isAfter, isBefore, isValid } from 'date-fns';
import { useTheme } from '../context/ThemeContext';

const ProjectMaster = () => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const [projects, setProjects] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // all, 진행예정, 진행중, 종료
    const [typeFilter, setTypeFilter] = useState('all');
    
    // Dropdown state for PD/PM search
    const [activeSearchField, setActiveSearchField] = useState(null); // 'pd' or 'pm' or null
    const [searchQuery, setSearchQuery] = useState('');

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        type: 'Client',
        status: '진행중',
        start_date: '',
        end_date: '',
        pd: '',
        pm: '',
        project_group: '',
        note: '',
        count_in_stats: true
    });

    // Delete confirmation
    const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, projectId: null, projectName: '' });

    useEffect(() => {
        loadProjects();
        loadEmployees();
    }, []);

    const loadProjects = async () => {
        setLoading(true);
        try {
            const res = await projectsAPI.getAll();
            setProjects(res.data);
        } catch (err) {
            console.error('Failed to load projects:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadEmployees = async () => {
        try {
            const res = await employeesAPI.getAll({ status: 'active' });
            // Sort by name
            const sorted = res.data.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
            setEmployees(sorted);
        } catch (err) {
            console.error('Failed to load employees:', err);
        }
    };

    const handleOpenModal = (project = null) => {
        setActiveSearchField(null);
        setSearchQuery('');
        if (project) {
            setEditingProject(project);
            setFormData({
                name: project.name || '',
                type: project.type || 'Client',
                status: project.status || '진행중',
                start_date: project.start_date || '',
                end_date: project.end_date || '',
                pd: project.pd || '',
                pm: project.pm || '',
                project_group: project.project_group || '',
                note: project.note || '',
                count_in_stats: project.count_in_stats !== false
            });
        } else {
            setEditingProject(null);
            setFormData({
                name: '',
                type: 'Client',
                status: '진행중',
                start_date: format(new Date(), 'yyyy-MM-dd'),
                end_date: format(new Date(), 'yyyy-MM-dd'),
                pd: '',
                pm: '',
                project_group: '',
                note: '',
                count_in_stats: true
            });
        }
        setIsModalOpen(true);
    };

    const handleEmployeeSelect = (employee, field) => {
        setFormData({ ...formData, [field]: employee.name });
        setActiveSearchField(null);
        setSearchQuery('');
    };

    const filteredEmployees = useMemo(() => {
        let baseList = employees;
        
        // Filter by job_role based on which field is being searched
        if (activeSearchField === 'pd') {
            baseList = employees.filter(emp => emp.job_role === 'PD');
        } else if (activeSearchField === 'pm') {
            baseList = employees.filter(emp => emp.job_role === 'PM');
        }

        if (!searchQuery) return baseList;
        
        return baseList.filter(emp => 
            emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            emp.position?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            emp.group_name?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [employees, searchQuery, activeSearchField]);

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (editingProject) {
                await projectsAPI.update(editingProject.id, formData);
            } else {
                await projectsAPI.create(formData);
            }
            setIsModalOpen(false);
            loadProjects();
        } catch (err) {
            const errorMsg = err.response?.data?.error || err.message || '알 수 없는 오류';
            alert(`저장에 실패했습니다.\n사유: ${errorMsg}`);
            console.error('Save Project Error:', err);
        }
    };

    const handleDelete = async () => {
        try {
            await projectsAPI.delete(deleteConfirm.projectId);
            setDeleteConfirm({ isOpen: false, projectId: null, projectName: '' });
            loadProjects();
        } catch (err) {
            alert('삭제에 실패했습니다.');
            console.error(err);
        }
    };

    const filteredProjects = useMemo(() => {
        const filtered = projects.filter(p => {
            const matchesSearch = 
                p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.pd?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.pm?.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesStatus = 
                statusFilter === 'all' || 
                p.status === statusFilter;

            const matchesType = 
                typeFilter === 'all' || p.type === typeFilter;

            return matchesSearch && matchesStatus && matchesType;
        });

        // Custom sort order: Client(1) > Internal(2) > Annual(3) > Leave(4)
        const typePriority = {
            'Client': 1,
            'Internal': 2,
            'Annual': 3,
            'Leave': 4
        };

        // Group sort order
        const groupPriority = {
            '구축': 1,
            'ISG1': 2,
            'ISD': 3
        };

        return [...filtered].sort((a, b) => {
            const priorityA = typePriority[a.type] || 5;
            const priorityB = typePriority[b.type] || 5;
            
            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }

            const gA = groupPriority[a.project_group] || 99;
            const gB = groupPriority[b.project_group] || 99;
            
            if (gA !== gB) {
                return gA - gB;
            }
            
            // Name sort within same group
            return (a.name || '').localeCompare(b.name || '', 'ko-KR');
        });
    }, [projects, searchTerm, statusFilter, typeFilter]);

    const getStatusBadge = (status, endDate) => {
        const isExpired = endDate && isBefore(parseISO(endDate), new Date());
        
        if (status === '종료') {
            return <span className="badge badge-secondary">종료됨</span>;
        }

        if (status === '진행예정') {
            return <span className="badge badge-info" style={{ color: '#3b82f6' }}>진행예정</span>;
        }

        if (isExpired) {
            return <span className="badge badge-danger">기한만료</span>;
        }
        
        return <span className="badge badge-success">진행중</span>;
    };

    const formatDateStr = (dateStr) => {
        if (!dateStr) return '-';
        try {
            return format(parseISO(dateStr), 'yyyy.MM.dd');
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="container page animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex justify-between items-end mb-10">
                <div>
                    <h1 className="tracking-tight m-0">프로젝트 마스터 관리</h1>
                </div>
                
                <button 
                    onClick={() => handleOpenModal()} 
                    className="premium-btn premium-btn-primary flex items-center gap-2 px-6 py-3 rounded-xl font-bold shadow-lg shadow-primary/20"
                >
                    <Plus size={18} /> 새 프로젝트 등록
                </button>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-4 gap-md mb-10">
                <div className="stat-card-premium" style={{ '--card-glow': 'rgba(59, 130, 246, 1)', '--accent-color': '#3b82f6' }}>
                    <div className="stat-icon-wrapper" style={{ '--icon-bg': 'rgba(59, 130, 246, 0.1)', '--icon-color': '#3b82f6' }}>
                        <Layers size={22} />
                    </div>
                    <p className="stat-label">전체 프로젝트</p>
                    <h2 className="stat-value">{projects.length}</h2>
                    <div className="stat-accent-bar"></div>
                </div>
                
                <div className="stat-card-premium" style={{ '--card-glow': 'rgba(16, 185, 129, 1)', '--accent-color': '#10b981' }}>
                    <div className="stat-icon-wrapper" style={{ '--icon-bg': 'rgba(16, 185, 129, 0.1)', '--icon-color': '#10b981' }}>
                        <Activity size={22} />
                    </div>
                    <p className="stat-label" style={{ color: '#10b981' }}>활성 프로젝트</p>
                    <h2 className="stat-value">{projects.filter(p => p.status === '진행중').length}</h2>
                    <div className="stat-accent-bar"></div>
                </div>
                
                <div className="stat-card-premium" style={{ '--card-glow': 'rgba(34, 211, 238, 1)', '--accent-color': '#22d3ee' }}>
                    <div className="stat-icon-wrapper" style={{ '--icon-bg': 'rgba(34, 211, 238, 0.1)', '--icon-color': '#22d3ee' }}>
                        <Building2 size={22} />
                    </div>
                    <p className="stat-label" style={{ color: '#22d3ee' }}>고객사 프로젝트</p>
                    <h2 className="stat-value">{projects.filter(p => p.type === 'Client').length}</h2>
                    <div className="stat-accent-bar"></div>
                </div>
                
                <div className="stat-card-premium" style={{ '--card-glow': 'rgba(148, 163, 184, 1)', '--accent-color': '#94a3b8' }}>
                    <div className="stat-icon-wrapper" style={{ '--icon-bg': 'rgba(148, 163, 184, 0.1)', '--icon-color': '#94a3b8' }}>
                        <CheckCircle size={22} />
                    </div>
                    <p className="stat-label">종료된 프로젝트</p>
                    <h2 className="stat-value">{projects.filter(p => p.status === '종료').length}</h2>
                    <div className="stat-accent-bar"></div>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="filter-bar-premium mb-8">
                <div className="search-container-premium">
                    <Search className="absolute left-4 text-gray-500" size={18} />
                    <input 
                        type="text" 
                        placeholder="프로젝트 이름, PD, PM 등으로 검색..." 
                        className="search-input-premium"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--surface-high)', color: 'var(--text-muted)' }}>
                        <Filter size={16} />
                    </div>
                    
                    <select 
                        className="select-premium"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">모든 상태</option>
                        <option value="진행예정">진행예정</option>
                        <option value="진행중">진행중</option>
                        <option value="종료">종료됨</option>
                    </select>

                    <select 
                        className="select-premium"
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                    >
                        <option value="all">모든 유형</option>
                        <option value="Client">고객사(Client)</option>
                        <option value="Internal">내부(Internal)</option>
                        <option value="Annual">연차(Annual)</option>
                        <option value="Leave">기타/휴직(Leave)</option>
                    </select>
                </div>
            </div>

            {/* Project List Table */}
            <div className="premium-glass overflow-hidden">
                <table className="premium-table">
                    <thead>
                        <tr>
                            <th className="w-12 text-center">No</th>
                            <th className="text-left">프로젝트 마스터 정보</th>
                            <th className="text-center">유형</th>
                            <th className="text-center">상태</th>
                            <th className="text-center">PD</th>
                            <th className="text-center">PM</th>
                            <th className="text-center">수행 기간</th>
                            <th className="text-right">관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="8" className="py-20 text-center">
                                    <div className="spinner mx-auto mb-4"></div>
                                    <p className="text-gray-500 font-bold">데이터를 불러오는 중입니다...</p>
                                </td>
                            </tr>
                        ) : filteredProjects.length === 0 ? (
                            <tr>
                                <td colSpan="8" className="py-20 text-center text-gray-500 italic">
                                    조건에 맞는 프로젝트가 없습니다.
                                </td>
                            </tr>
                        ) : (
                            filteredProjects.map((project, index) => (
                                <tr key={project.id} className="transition-colors group" style={{ cursor: 'default' }}>
                                    <td className="text-center text-gray-500 font-mono text-xs">{index + 1}</td>
                                    <td className="py-6 align-middle">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-base group-hover:text-primary transition-colors cursor-pointer" style={{ color: 'var(--text-primary)' }} onClick={() => handleOpenModal(project)}>
                                                {project.name}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="text-center align-middle">
                                        <div className="flex flex-col items-center justify-center gap-1.5">
                                            <span className={`text-[10px] font-black uppercase tracking-tighter ${
                                                project.type === 'Client' ? 'text-blue-500' :
                                                project.type === 'Internal' ? 'text-emerald-500' :
                                                project.type === 'Annual' ? 'text-yellow-500' :
                                                'text-gray-400'
                                            }`}>
                                                {project.type}
                                            </span>
                                            {project.project_group && (
                                                <span className="text-[9px] font-bold tracking-tight" style={{ color: 'var(--text-muted)' }}>
                                                    {project.project_group}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="text-center">
                                        {getStatusBadge(project.status, project.end_date)}
                                    </td>
                                    <td className="text-center">
                                        <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{project.pd || '-'}</span>
                                    </td>
                                    <td className="text-center">
                                        <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{project.pm || '-'}</span>
                                    </td>
                                    <td className="text-center">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center justify-center gap-2 text-xs py-1 px-3 rounded-full" style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--surface-high)', border: '1px solid var(--border)' }}>
                                                <Calendar size={12} style={{ color: 'var(--text-muted)' }} />
                                                <span>{formatDateStr(project.start_date)}</span>
                                                <ChevronRight size={10} style={{ color: 'var(--text-muted)' }} />
                                                <span>{formatDateStr(project.end_date)}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="text-right pr-6">
                                        <div className="flex justify-end gap-2">
                                            <button 
                                                onClick={() => handleOpenModal(project)} 
                                                className="premium-icon-btn"
                                                title="수정"
                                            >
                                                <Pencil size={14} />
                                            </button>
                                            <button 
                                                onClick={() => setDeleteConfirm({ isOpen: true, projectId: project.id, projectName: project.name })} 
                                                className="premium-icon-btn btn-delete"
                                                title="삭제"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add/Edit Modal */}
            {isModalOpen && createPortal((
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    backgroundColor: isDark ? 'rgba(5, 8, 20, 0.9)' : 'rgba(0, 0, 0, 0.4)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 100000,
                    padding: '20px'
                }}>
                    <div
                        className={isDark ? '' : 'light-theme'}
                        style={{
                        width: '100%',
                        maxWidth: '680px',
                        maxHeight: '90vh',
                        display: 'flex',
                        flexDirection: 'column',
                        backgroundColor: isDark ? 'rgba(21, 28, 48, 0.97)' : '#ffffff',
                        borderRadius: '24px',
                        border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid var(--border)',
                        boxShadow: isDark ? '0 40px 100px -20px rgba(0, 0, 0, 0.8)' : '0 40px 100px -20px rgba(0, 0, 0, 0.15)',
                        overflow: 'hidden',
                        position: 'relative',
                        color: 'var(--text-primary)',
                        fontFamily: 'Inter, system-ui, sans-serif'
                    }}>
                        {/* Close Button */}
                        <button 
                            onClick={() => setIsModalOpen(false)} 
                            style={{
                                position: 'absolute',
                                right: '24px',
                                top: '24px',
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                transition: '0.2s',
                                zIndex: 10
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                        >
                            <X size={18} />
                        </button>

                        <div style={{ padding: '40px 32px 24px', flexShrink: 0 }}>
                            {/* Header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
                                <div style={{ 
                                    width: '48px', 
                                    height: '48px', 
                                    borderRadius: '16px', 
                                    backgroundColor: 'rgba(34, 211, 238, 0.1)', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    color: '#22d3ee',
                                    border: '1px solid rgba(34, 211, 238, 0.2)',
                                    boxShadow: '0 0 20px rgba(34, 211, 238, 0.15)'
                                }}>
                                    <Briefcase size={24} />
                                </div>
                                <div className="flex flex-col">
                                    <h4 style={{ color: '#22d3ee', fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.15em', margin: '0 0 4px 0' }}>Project Master Settings</h4>
                                    <h2 style={{ fontSize: '26px', fontWeight: '800', letterSpacing: '-0.02em', margin: 0 }}>
                                        {editingProject ? '프로젝트 정보 수정' : '새 프로젝트 등록'}
                                    </h2>
                                </div>
                            </div>
                        </div>
                        
                        <form onSubmit={handleSave} style={{ padding: '0 32px 40px', overflowY: 'auto', flex: 1 }}>
                            <div className="grid grid-2 gap-x-6 gap-y-5">
                                <div className="form-group col-span-full">
                                    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', paddingLeft: '4px', marginBottom: '8px', display: 'block' }}>프로젝트명</label>
                                    <input 
                                        type="text" 
                                        style={{
                                            width: '100%',
                                            backgroundColor: isDark ? '#0f172a' : 'var(--surface-high)',
                                            border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid var(--border)',
                                            borderRadius: '14px',
                                            padding: '14px 20px',
                                            color: 'var(--text-primary)',
                                            fontSize: '16px',
                                            fontWeight: '700',
                                            outline: 'none',
                                            transition: '0.2s',
                                        }}
                                        placeholder="공식 프로젝트 명칭을 입력하세요" 
                                        required
                                        value={formData.name}
                                        onChange={e => setFormData({...formData, name: e.target.value})}
                                        onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.5)'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(34, 211, 238, 0.1)'; }}
                                        onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'; e.currentTarget.style.boxShadow = 'none'; }}
                                    />
                                </div>

                                <div className="form-group">
                                    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', paddingLeft: '4px', marginBottom: '8px', display: 'block' }}>프로젝트 유형</label>
                                    <select 
                                        style={{
                                            width: '100%',
                                            backgroundColor: isDark ? '#0f172a' : 'var(--surface-high)',
                                            border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid var(--border)',
                                            borderRadius: '14px',
                                            padding: '14px 20px',
                                            color: 'var(--text-primary)',
                                            fontSize: '14px',
                                            outline: 'none',
                                            appearance: 'none',
                                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23${isDark ? '64748b' : '94a3b8'}'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                                            backgroundRepeat: 'no-repeat',
                                            backgroundPosition: 'right 16px center',
                                            backgroundSize: '16px'
                                        }}
                                        value={formData.type}
                                        onChange={e => {
                                            const newType = e.target.value;
                                            setFormData({
                                                ...formData,
                                                type: newType,
                                                // Internal로 변경 시 통계 제외 기본값, 다른 타입은 포함
                                                count_in_stats: newType === 'Internal' ? false : true
                                            });
                                        }}
                                        onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.5)'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(34, 211, 238, 0.1)'; }}
                                        onBlur={(e) => { e.currentTarget.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                                    >
                                        <option value="Client">고객사 프로젝트 (Client)</option>
                                        <option value="Internal">내부 운영 프로젝트 (Internal)</option>
                                        <option value="Annual">연차 프로젝트 (Annual)</option>
                                        <option value="Leave">기타/휴직 (Leave)</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', paddingLeft: '4px', marginBottom: '8px', display: 'block' }}>현재 상태</label>
                                    <select 
                                        style={{
                                            width: '100%',
                                            backgroundColor: isDark ? '#0f172a' : 'var(--surface-high)',
                                            border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid var(--border)',
                                            borderRadius: '14px',
                                            padding: '14px 20px',
                                            color: 'var(--text-primary)',
                                            fontSize: '14px',
                                            outline: 'none',
                                            appearance: 'none',
                                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23${isDark ? '64748b' : '94a3b8'}'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                                            backgroundRepeat: 'no-repeat',
                                            backgroundPosition: 'right 16px center',
                                            backgroundSize: '16px'
                                        }}
                                        value={formData.status}
                                        onChange={e => setFormData({...formData, status: e.target.value})}
                                        onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.5)'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(34, 211, 238, 0.1)'; }}
                                        onBlur={(e) => { e.currentTarget.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                                    >
                                        <option value="진행예정">진행예정 (Upcoming)</option>
                                        <option value="진행중">진행중 (Ongoing)</option>
                                        <option value="종료">프로젝트 종료 (Completed)</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', paddingLeft: '4px', marginBottom: '8px', display: 'block' }}>시작일</label>
                                    <div className="relative flex items-center">
                                        <Calendar style={{ position: 'absolute', left: '16px', color: '#64748b', zIndex: 10 }} size={18} />
                                        <input 
                                            type="date" 
                                            style={{
                                                width: '100%',
                                                backgroundColor: isDark ? '#0f172a' : 'var(--surface-high)',
                                                border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid var(--border)',
                                                borderRadius: '14px',
                                                padding: '14px 16px 14px 48px',
                                                color: 'var(--text-primary)',
                                                fontSize: '14px',
                                                outline: 'none',
                                                transition: '0.2s',
                                                colorScheme: isDark ? 'dark' : 'light'
                                            }}
                                            required
                                            value={formData.start_date}
                                            onChange={e => setFormData({...formData, start_date: e.target.value})}
                                            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.5)'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(34, 211, 238, 0.1)'; }}
                                            onBlur={(e) => { e.currentTarget.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', paddingLeft: '4px', marginBottom: '8px', display: 'block' }}>종료 예정일</label>
                                    <div className="relative flex items-center">
                                        <Clock style={{ position: 'absolute', left: '16px', color: '#64748b', zIndex: 10 }} size={18} />
                                        <input 
                                            type="date" 
                                            style={{
                                                width: '100%',
                                                backgroundColor: isDark ? '#0f172a' : 'var(--surface-high)',
                                                border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid var(--border)',
                                                borderRadius: '14px',
                                                padding: '14px 16px 14px 48px',
                                                color: 'var(--text-primary)',
                                                fontSize: '14px',
                                                outline: 'none',
                                                transition: '0.2s',
                                                colorScheme: isDark ? 'dark' : 'light'
                                            }}
                                            required
                                            value={formData.end_date}
                                            onChange={e => setFormData({...formData, end_date: e.target.value})}
                                            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.5)'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(34, 211, 238, 0.1)'; }}
                                            onBlur={(e) => { e.currentTarget.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                                        />
                                    </div>
                                </div>

                                <div className="form-group relative">
                                    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', paddingLeft: '4px', marginBottom: '8px', display: 'block' }}>PD</label>
                                    <div className="relative">
                                        <User style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', zIndex: 10 }} size={18} />
                                        <input 
                                            type="text" 
                                            style={{
                                                width: '100%',
                                                backgroundColor: isDark ? '#0f172a' : 'var(--surface-high)',
                                                border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid var(--border)',
                                                borderRadius: '14px',
                                                padding: '14px 16px 14px 48px',
                                                color: 'var(--text-primary)',
                                                fontSize: '14px',
                                                outline: 'none',
                                                transition: '0.2s',
                                            }}
                                            placeholder="검색하여 선택하세요"
                                            value={activeSearchField === 'pd' ? searchQuery : formData.pd}
                                            onChange={e => {
                                                if (activeSearchField !== 'pd') setActiveSearchField('pd');
                                                setSearchQuery(e.target.value);
                                                setFormData({ ...formData, pd: e.target.value });
                                            }}
                                            onFocus={(e) => {
                                                setActiveSearchField('pd');
                                                setSearchQuery(formData.pd || '');
                                                e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.5)'; 
                                                e.currentTarget.style.boxShadow = '0 0 0 4px rgba(34, 211, 238, 0.1)';
                                            }}
                                            onBlur={(e) => { 
                                                e.currentTarget.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'var(--border)'; 
                                                e.currentTarget.style.boxShadow = 'none'; 
                                            }}
                                        />
                                        {activeSearchField === 'pd' && (
                                            <div style={{
                                                position: 'absolute',
                                                zIndex: 100,
                                                left: 0,
                                                right: 0,
                                                marginTop: '8px',
                                                maxHeight: '200px',
                                                overflowY: 'auto',
                                                backgroundColor: isDark ? 'rgba(21, 28, 48, 0.98)' : 'var(--surface-highest)',
                                                backdropFilter: 'blur(10px)',
                                                border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid var(--border)',
                                                borderRadius: '16px',
                                                boxShadow: isDark ? '0 20px 40px -10px rgba(0, 0, 0, 0.5)' : '0 20px 40px -10px rgba(0, 0, 0, 0.1)',
                                            }}>
                                                {filteredEmployees.length > 0 ? (
                                                    filteredEmployees.map(emp => (
                                                        <div 
                                                            key={emp.id} 
                                                            style={{
                                                                padding: '12px 16px',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                alignItems: 'center',
                                                                borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid var(--border)',
                                                                transition: '0.2s'
                                                            }}
                                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(34, 211, 238, 0.1)'}
                                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                            onClick={() => handleEmployeeSelect(emp, 'pd')}
                                                        >
                                                            <div className="flex flex-col">
                                                                <span style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '14px' }}>{emp.name}</span>
                                                                <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{emp.group_name} / {emp.position}</span>
                                                            </div>
                                                            <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '13px' }}>
                                                        일치하는 직원이 없습니다.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="form-group relative">
                                    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', paddingLeft: '4px', marginBottom: '8px', display: 'block' }}>PM</label>
                                    <div className="relative">
                                        <User style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', zIndex: 10 }} size={18} />
                                        <input 
                                            type="text" 
                                            style={{
                                                width: '100%',
                                                backgroundColor: isDark ? '#0f172a' : 'var(--surface-high)',
                                                border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid var(--border)',
                                                borderRadius: '14px',
                                                padding: '14px 16px 14px 48px',
                                                color: 'var(--text-primary)',
                                                fontSize: '14px',
                                                outline: 'none',
                                                transition: '0.2s',
                                            }}
                                            placeholder="검색하여 선택하세요"
                                            value={activeSearchField === 'pm' ? searchQuery : formData.pm}
                                            onChange={e => {
                                                if (activeSearchField !== 'pm') setActiveSearchField('pm');
                                                setSearchQuery(e.target.value);
                                                setFormData({ ...formData, pm: e.target.value });
                                            }}
                                            onFocus={(e) => {
                                                setActiveSearchField('pm');
                                                setSearchQuery(formData.pm || '');
                                                e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.5)'; 
                                                e.currentTarget.style.boxShadow = '0 0 0 4px rgba(34, 211, 238, 0.1)';
                                            }}
                                            onBlur={(e) => { 
                                                e.currentTarget.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'var(--border)'; 
                                                e.currentTarget.style.boxShadow = 'none'; 
                                            }}
                                        />
                                        {activeSearchField === 'pm' && (
                                            <div style={{
                                                position: 'absolute',
                                                zIndex: 100,
                                                left: 0,
                                                right: 0,
                                                marginTop: '8px',
                                                maxHeight: '200px',
                                                overflowY: 'auto',
                                                backgroundColor: isDark ? 'rgba(21, 28, 48, 0.98)' : 'var(--surface-highest)',
                                                backdropFilter: 'blur(10px)',
                                                border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid var(--border)',
                                                borderRadius: '16px',
                                                boxShadow: isDark ? '0 20px 40px -10px rgba(0, 0, 0, 0.5)' : '0 20px 40px -10px rgba(0, 0, 0, 0.1)',
                                            }}>
                                                {filteredEmployees.length > 0 ? (
                                                    filteredEmployees.map(emp => (
                                                        <div 
                                                            key={emp.id} 
                                                            style={{
                                                                padding: '12px 16px',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                alignItems: 'center',
                                                                borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid var(--border)',
                                                                transition: '0.2s'
                                                            }}
                                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(34, 211, 238, 0.1)'}
                                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                            onClick={() => handleEmployeeSelect(emp, 'pm')}
                                                        >
                                                            <div className="flex flex-col">
                                                                <span style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '14px' }}>{emp.name}</span>
                                                                <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{emp.group_name} / {emp.position}</span>
                                                            </div>
                                                            <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '13px' }}>
                                                        일치하는 직원이 없습니다.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="form-group col-span-full">
                                    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', paddingLeft: '4px', marginBottom: '8px', display: 'block' }}>프로젝트 그룹</label>
                                    <div className="relative">
                                        <Layers style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} size={18} />
                                        <select
                                            style={{
                                                width: '100%',
                                                backgroundColor: isDark ? '#0f172a' : 'var(--surface-high)',
                                                border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid var(--border)',
                                                borderRadius: '14px',
                                                padding: '14px 16px 14px 48px',
                                                color: 'var(--text-primary)',
                                                fontSize: '14px',
                                                outline: 'none',
                                                transition: '0.2s',
                                                appearance: 'none',
                                                cursor: 'pointer'
                                            }}
                                            value={formData.project_group}
                                            onChange={e => setFormData({...formData, project_group: e.target.value})}
                                            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.5)'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(34, 211, 238, 0.1)'; }}
                                            onBlur={(e) => { e.currentTarget.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                                        >
                                            <option value="">선택 안함</option>
                                            <option value="구축">구축</option>
                                            <option value="ISG1">ISG1</option>
                                            <option value="ISD">ISD</option>
                                        </select>
                                        <ArrowUpDown style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} size={14} />
                                    </div>
                                </div>

                                {formData.type === 'Internal' && (
                                    <div className="form-group col-span-full">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '4px', marginBottom: '8px' }}>
                                            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>투입 통계 설정</span>
                                            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
                                                onMouseEnter={e => e.currentTarget.querySelector('.stat-tooltip').style.opacity = '1'}
                                                onMouseLeave={e => e.currentTarget.querySelector('.stat-tooltip').style.opacity = '0'}
                                            >
                                                <HelpCircle size={13} style={{ color: 'var(--text-muted)', cursor: 'help', opacity: 0.7 }} />
                                                <div className="stat-tooltip" style={{
                                                    opacity: 0,
                                                    pointerEvents: 'none',
                                                    transition: 'opacity 0.15s',
                                                    position: 'absolute',
                                                    bottom: 'calc(100% + 8px)',
                                                    left: '50%',
                                                    transform: 'translateX(-50%)',
                                                    background: isDark ? '#1e293b' : '#1e293b',
                                                    color: '#f1f5f9',
                                                    fontSize: '12px',
                                                    lineHeight: '1.6',
                                                    padding: '10px 14px',
                                                    borderRadius: '10px',
                                                    width: '260px',
                                                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                                                    border: '1px solid rgba(255,255,255,0.08)',
                                                    zIndex: 9999,
                                                    whiteSpace: 'normal'
                                                }}>
                                                    <div style={{ fontWeight: '700', marginBottom: '6px', color: '#5dd6f3' }}>📊 투입 통계란?</div>
                                                    <div>그룹별 보기의 <strong style={{ color: '#4de082' }}>미투입 / 부분투입 / 풀투입</strong> 현황에 이 프로젝트의 배정 인력이 반영됩니다.</div>
                                                    <div style={{ marginTop: '8px', color: '#94a3b8' }}>
                                                        ✅ <strong>포함</strong> — 제안작업에 투입된 인력도 통계에 집계<br/>
                                                        ☑️ <strong>제외</strong> — 제안작업 배정과 무관하게 통계 산정
                                                    </div>
                                                    {/* Tooltip arrow */}
                                                    <div style={{
                                                        position: 'absolute',
                                                        bottom: '-5px',
                                                        left: '50%',
                                                        transform: 'translateX(-50%) rotate(45deg)',
                                                        width: '10px',
                                                        height: '10px',
                                                        background: '#1e293b',
                                                        borderRight: '1px solid rgba(255,255,255,0.08)',
                                                        borderBottom: '1px solid rgba(255,255,255,0.08)'
                                                    }} />
                                                </div>
                                            </div>
                                        </div>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '14px 20px', borderRadius: '14px', background: isDark ? '#0f172a' : 'var(--surface-high)', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid var(--border)' }}>
                                            <input
                                                type="checkbox"
                                                checked={!!formData.count_in_stats}
                                                onChange={e => setFormData({ ...formData, count_in_stats: e.target.checked })}
                                                style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                                            />
                                            <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: '500' }}>
                                                미투입 / 부분투입 / 풀투입 통계에 포함
                                            </span>
                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                                                {formData.count_in_stats ? '포함' : '제외'}
                                            </span>
                                        </label>
                                    </div>
                                )}

                                <div className="form-group col-span-full">
                                    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', paddingLeft: '4px', marginBottom: '8px', display: 'block' }}>비고 (Notes)</label>
                                    <textarea 
                                        style={{
                                            width: '100%',
                                            backgroundColor: isDark ? '#0f172a' : 'var(--surface-high)',
                                            border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid var(--border)',
                                            borderRadius: '14px',
                                            padding: '14px 20px',
                                            color: 'var(--text-primary)',
                                            fontSize: '14px',
                                            outline: 'none',
                                            transition: '0.2s',
                                            resize: 'none',
                                            minHeight: '80px'
                                        }}
                                        placeholder="프로젝트 관련 참고사항을 기록하세요"
                                        value={formData.note}
                                        onChange={e => setFormData({...formData, note: e.target.value})}
                                        onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.5)'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(34, 211, 238, 0.1)'; }}
                                        onBlur={(e) => { e.currentTarget.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                                    ></textarea>
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                                <button 
                                    type="button" 
                                    onClick={() => setIsModalOpen(false)} 
                                    style={{
                                        flex: 1,
                                        padding: '16px',
                                        borderRadius: '14px',
                                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'var(--surface-high)',
                                        border: isDark ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid var(--border)',
                                        color: 'var(--text-muted)',
                                        fontWeight: '700',
                                        fontSize: '15px',
                                        cursor: 'pointer',
                                        transition: '0.2s'
                                    }}
                                    onMouseOver={(e) => { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'var(--surface-highest)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                    onMouseOut={(e) => { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'var(--surface-high)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                                >
                                    취소
                                </button>
                                <button 
                                    type="submit" 
                                    style={{
                                        flex: 2,
                                        padding: '16px',
                                        borderRadius: '14px',
                                        background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
                                        border: 'none',
                                        color: 'white',
                                        fontWeight: '800',
                                        fontSize: '16px',
                                        cursor: 'pointer',
                                        transition: '0.2s',
                                        boxShadow: '0 8px 20px -4px rgba(6, 182, 212, 0.3)',
                                        letterSpacing: '0.01em'
                                    }}
                                    onMouseOver={(e) => { e.currentTarget.style.filter = 'brightness(1.1)'; }}
                                    onMouseOut={(e) => { e.currentTarget.style.filter = 'brightness(1)'; }}
                                >
                                    {editingProject ? '업데이트 완료' : '프로젝트 등록하기'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ), document.body)}

            {/* Delete Confirmation Modal */}
            {deleteConfirm.isOpen && createPortal((
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    backgroundColor: isDark ? 'rgba(5, 8, 20, 0.9)' : 'rgba(0, 0, 0, 0.4)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 100000,
                    padding: '20px'
                }}>
                    <div style={{ 
                        width: '100%', 
                        maxWidth: '420px', 
                        backgroundColor: isDark ? 'rgba(21, 28, 48, 0.97)' : '#ffffff',
                        borderRadius: '24px',
                        border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid var(--border)',
                        boxShadow: isDark ? '0 40px 100px -20px rgba(0, 0, 0, 0.8)' : '0 40px 100px -20px rgba(0, 0, 0, 0.15)',
                        overflow: 'hidden',
                        position: 'relative',
                        color: 'var(--text-primary)'
                    }}>
                        {/* Close Button */}
                        <button 
                            onClick={() => setDeleteConfirm({ isOpen: false, projectId: null, projectName: '' })} 
                            style={{
                                position: 'absolute',
                                right: '24px',
                                top: '24px',
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                transition: '0.2s',
                                zIndex: 10
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                        >
                            <X size={18} />
                        </button>

                        <div style={{ padding: '40px 32px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            {/* Header Icon */}
                            <div style={{ 
                                width: '64px', 
                                height: '64px', 
                                borderRadius: '20px', 
                                backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                color: '#f87171',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                boxShadow: '0 0 30px rgba(239, 68, 68, 0.15)',
                                marginBottom: '24px'
                            }}>
                                <Trash2 size={32} />
                            </div>
                            
                            <h2 style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '-0.02em', margin: '0 0 12px' }}>프로젝트 삭제</h2>
                            
                            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', margin: 0, textAlign: 'center' }}>
                                <span style={{ color: 'var(--text-primary)', fontWeight: '700' }}>"{deleteConfirm.projectName}"</span><br />
                                이 프로젝트를 정말로 삭제하시겠습니까?<br />
                                <span style={{ color: '#ef4444', fontWeight: '600' }}>배정 및 보고서 데이터가 모두 소멸되며 복구가 불가능합니다.</span>
                            </p>
                        </div>

                        <div style={{ padding: '0 32px 40px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <button 
                                onClick={handleDelete} 
                                style={{
                                    width: '100%',
                                    padding: '16px',
                                    borderRadius: '14px',
                                    background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                                    border: 'none',
                                    color: 'white',
                                    fontWeight: '800',
                                    fontSize: '15px',
                                    cursor: 'pointer',
                                    transition: '0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    boxShadow: '0 8px 20px -4px rgba(239, 68, 68, 0.3)',
                                    letterSpacing: '0.01em'
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.filter = 'brightness(1.1)'; }}
                                onMouseOut={(e) => { e.currentTarget.style.filter = 'brightness(1)'; }}
                            >
                                <Trash2 size={18} />
                                영구 삭제하기
                            </button>
                            <button 
                                onClick={() => setDeleteConfirm({ isOpen: false, projectId: null, projectName: '' })} 
                                style={{
                                    width: '100%',
                                    padding: '14px',
                                    borderRadius: '14px',
                                    background: 'transparent',
                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                    color: '#94a3b8',
                                    fontWeight: '600',
                                    fontSize: '14px',
                                    cursor: 'pointer',
                                    transition: '0.2s'
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = '#fff'; }}
                                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
                            >
                                취소
                            </button>
                        </div>
                    </div>
                </div>
            ), document.body)}
        </div>
    );
};

export default ProjectMaster;
