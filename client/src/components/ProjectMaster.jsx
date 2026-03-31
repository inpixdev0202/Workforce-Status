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
    CheckCircle
} from 'lucide-react';
import { projectsAPI, employeesAPI } from '../api';
import { format, parseISO, isAfter, isBefore, isValid } from 'date-fns';

const ProjectMaster = () => {
    const [projects, setProjects] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // all, active, closed
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
        status: 'active',
        start_date: '',
        end_date: '',
        pd: '',
        pm: '',
        note: ''
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
                status: project.status || 'active',
                start_date: project.start_date || '',
                end_date: project.end_date || '',
                pd: project.pd || '',
                pm: project.pm || '',
                note: project.note || ''
            });
        } else {
            setEditingProject(null);
            setFormData({
                name: '',
                type: 'Client',
                status: 'active',
                start_date: format(new Date(), 'yyyy-MM-dd'),
                end_date: format(new Date(), 'yyyy-MM-dd'),
                pd: '',
                pm: '',
                note: ''
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
                (statusFilter === 'active' && p.status === 'active') ||
                (statusFilter === 'closed' && p.status === 'closed');

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

        return [...filtered].sort((a, b) => {
            const priorityA = typePriority[a.type] || 5;
            const priorityB = typePriority[b.type] || 5;
            
            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }
            
            // Name sort within same type
            return (a.name || '').localeCompare(b.name || '', 'ko-KR');
        });
    }, [projects, searchTerm, statusFilter, typeFilter]);

    const getStatusBadge = (status, endDate) => {
        const isExpired = endDate && isBefore(parseISO(endDate), new Date());
        
        if (status === 'closed') {
            return <span className="badge badge-secondary">종료됨</span>;
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
                    <h2 className="stat-value">{projects.filter(p => p.status === 'active').length}</h2>
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
                    <h2 className="stat-value">{projects.filter(p => p.status === 'closed').length}</h2>
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
                    <div className="p-2 bg-white/5 rounded-lg text-gray-400">
                        <Filter size={16} />
                    </div>
                    
                    <select 
                        className="select-premium"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">모든 상태</option>
                        <option value="active">진행중</option>
                        <option value="closed">종료됨</option>
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
                                <tr key={project.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="text-center text-gray-500 font-mono text-xs">{index + 1}</td>
                                    <td className="py-6">
                                        <div className="flex flex-col">
                                            <span className="text-white font-bold text-base group-hover:text-primary transition-colors cursor-pointer" onClick={() => handleOpenModal(project)}>
                                                {project.name}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="text-center">
                                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter ${
                                            project.type === 'Client' ? 'bg-blue-500/20 text-blue-400' :
                                            project.type === 'Internal' ? 'bg-emerald-500/20 text-emerald-400' :
                                            'bg-yellow-500/20 text-yellow-500'
                                        }`}>
                                            {project.type}
                                        </span>
                                    </td>
                                    <td className="text-center">
                                        {getStatusBadge(project.status, project.end_date)}
                                    </td>
                                    <td className="text-center">
                                        <span className="text-white font-medium text-sm">{project.pd || '-'}</span>
                                    </td>
                                    <td className="text-center">
                                        <span className="text-white font-medium text-sm">{project.pm || '-'}</span>
                                    </td>
                                    <td className="text-center">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center justify-center gap-2 text-xs text-white bg-black/20 py-1 px-3 rounded-full border border-white/5">
                                                <Calendar size={12} className="text-gray-500" />
                                                <span>{formatDateStr(project.start_date)}</span>
                                                <ChevronRight size={10} className="text-gray-700" />
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
                    backgroundColor: 'rgba(5, 8, 20, 0.9)',
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
                        maxWidth: '680px', 
                        backgroundColor: 'rgba(21, 28, 48, 0.95)', 
                        borderRadius: '24px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 40px 100px -20px rgba(0, 0, 0, 0.8)',
                        overflow: 'hidden',
                        position: 'relative',
                        color: 'white',
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
                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                border: 'none',
                                color: '#94a3b8',
                                cursor: 'pointer',
                                transition: '0.2s',
                                zIndex: 10
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'; e.currentTarget.style.color = '#fff'; }}
                            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = '#94a3b8'; }}
                        >
                            <X size={18} />
                        </button>

                        <div style={{ padding: '40px 32px 24px' }}>
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
                        
                        <form onSubmit={handleSave} style={{ padding: '0 32px 40px' }}>
                            <div className="grid grid-2 gap-x-6 gap-y-5">
                                <div className="form-group col-span-full">
                                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', paddingLeft: '4px', marginBottom: '8px', display: 'block' }}>프로젝트명</label>
                                    <input 
                                        type="text" 
                                        style={{
                                            width: '100%',
                                            backgroundColor: '#0f172a',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            borderRadius: '14px',
                                            padding: '14px 20px',
                                            color: 'white',
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
                                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', paddingLeft: '4px', marginBottom: '8px', display: 'block' }}>프로젝트 유형</label>
                                    <select 
                                        style={{
                                            width: '100%',
                                            backgroundColor: '#0f172a',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            borderRadius: '14px',
                                            padding: '14px 20px',
                                            color: 'white',
                                            fontSize: '14px',
                                            outline: 'none',
                                            appearance: 'none',
                                            backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")',
                                            backgroundRepeat: 'no-repeat',
                                            backgroundPosition: 'right 16px center',
                                            backgroundSize: '16px'
                                        }}
                                        value={formData.type}
                                        onChange={e => setFormData({...formData, type: e.target.value})}
                                        onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.5)'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(34, 211, 238, 0.1)'; }}
                                        onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'; e.currentTarget.style.boxShadow = 'none'; }}
                                    >
                                        <option value="Client">고객사 프로젝트 (Client)</option>
                                        <option value="Internal">내부 운영 프로젝트 (Internal)</option>
                                        <option value="Annual">연차 프로젝트 (Annual)</option>
                                        <option value="Leave">기타/휴직 (Leave)</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', paddingLeft: '4px', marginBottom: '8px', display: 'block' }}>현재 상태</label>
                                    <select 
                                        style={{
                                            width: '100%',
                                            backgroundColor: '#0f172a',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            borderRadius: '14px',
                                            padding: '14px 20px',
                                            color: 'white',
                                            fontSize: '14px',
                                            outline: 'none',
                                            appearance: 'none',
                                            backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")',
                                            backgroundRepeat: 'no-repeat',
                                            backgroundPosition: 'right 16px center',
                                            backgroundSize: '16px'
                                        }}
                                        value={formData.status}
                                        onChange={e => setFormData({...formData, status: e.target.value})}
                                        onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.5)'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(34, 211, 238, 0.1)'; }}
                                        onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'; e.currentTarget.style.boxShadow = 'none'; }}
                                    >
                                        <option value="active">진행중 (Active)</option>
                                        <option value="closed">프로젝트 종료 (Closed)</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', paddingLeft: '4px', marginBottom: '8px', display: 'block' }}>시작일</label>
                                    <div className="relative flex items-center">
                                        <Calendar style={{ position: 'absolute', left: '16px', color: '#64748b', zIndex: 10 }} size={18} />
                                        <input 
                                            type="date" 
                                            style={{
                                                width: '100%',
                                                backgroundColor: '#0f172a',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                borderRadius: '14px',
                                                padding: '14px 16px 14px 48px',
                                                color: 'white',
                                                fontSize: '14px',
                                                outline: 'none',
                                                transition: '0.2s',
                                                colorScheme: 'dark'
                                            }}
                                            required
                                            value={formData.start_date}
                                            onChange={e => setFormData({...formData, start_date: e.target.value})}
                                            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.5)'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(34, 211, 238, 0.1)'; }}
                                            onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'; e.currentTarget.style.boxShadow = 'none'; }}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', paddingLeft: '4px', marginBottom: '8px', display: 'block' }}>종료 예정일</label>
                                    <div className="relative flex items-center">
                                        <Clock style={{ position: 'absolute', left: '16px', color: '#64748b', zIndex: 10 }} size={18} />
                                        <input 
                                            type="date" 
                                            style={{
                                                width: '100%',
                                                backgroundColor: '#0f172a',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                borderRadius: '14px',
                                                padding: '14px 16px 14px 48px',
                                                color: 'white',
                                                fontSize: '14px',
                                                outline: 'none',
                                                transition: '0.2s',
                                                colorScheme: 'dark'
                                            }}
                                            required
                                            value={formData.end_date}
                                            onChange={e => setFormData({...formData, end_date: e.target.value})}
                                            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.5)'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(34, 211, 238, 0.1)'; }}
                                            onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'; e.currentTarget.style.boxShadow = 'none'; }}
                                        />
                                    </div>
                                </div>

                                <div className="form-group relative">
                                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', paddingLeft: '4px', marginBottom: '8px', display: 'block' }}>PD</label>
                                    <div className="relative">
                                        <User style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', zIndex: 10 }} size={18} />
                                        <input 
                                            type="text" 
                                            style={{
                                                width: '100%',
                                                backgroundColor: '#0f172a',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                borderRadius: '14px',
                                                padding: '14px 16px 14px 48px',
                                                color: 'white',
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
                                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'; 
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
                                                backgroundColor: 'rgba(21, 28, 48, 0.98)',
                                                backdropFilter: 'blur(10px)',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                borderRadius: '16px',
                                                boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.5)',
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
                                                                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                                                                transition: '0.2s'
                                                            }}
                                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(34, 211, 238, 0.1)'}
                                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                            onClick={() => handleEmployeeSelect(emp, 'pd')}
                                                        >
                                                            <div className="flex flex-col">
                                                                <span style={{ color: 'white', fontWeight: '700', fontSize: '14px' }}>{emp.name}</span>
                                                                <span style={{ color: '#64748b', fontSize: '11px' }}>{emp.group_name} / {emp.position}</span>
                                                            </div>
                                                            <ChevronRight size={14} style={{ color: '#475569' }} />
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontStyle: 'italic', fontSize: '13px' }}>
                                                        일치하는 직원이 없습니다.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="form-group relative">
                                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', paddingLeft: '4px', marginBottom: '8px', display: 'block' }}>PM</label>
                                    <div className="relative">
                                        <User style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', zIndex: 10 }} size={18} />
                                        <input 
                                            type="text" 
                                            style={{
                                                width: '100%',
                                                backgroundColor: '#0f172a',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                borderRadius: '14px',
                                                padding: '14px 16px 14px 48px',
                                                color: 'white',
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
                                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'; 
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
                                                backgroundColor: 'rgba(21, 28, 48, 0.98)',
                                                backdropFilter: 'blur(10px)',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                borderRadius: '16px',
                                                boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.5)',
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
                                                                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                                                                transition: '0.2s'
                                                            }}
                                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(34, 211, 238, 0.1)'}
                                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                            onClick={() => handleEmployeeSelect(emp, 'pm')}
                                                        >
                                                            <div className="flex flex-col">
                                                                <span style={{ color: 'white', fontWeight: '700', fontSize: '14px' }}>{emp.name}</span>
                                                                <span style={{ color: '#64748b', fontSize: '11px' }}>{emp.group_name} / {emp.position}</span>
                                                            </div>
                                                            <ChevronRight size={14} style={{ color: '#475569' }} />
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontStyle: 'italic', fontSize: '13px' }}>
                                                        일치하는 직원이 없습니다.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="form-group col-span-full">
                                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', paddingLeft: '4px', marginBottom: '8px', display: 'block' }}>비고 (Notes)</label>
                                    <textarea 
                                        style={{
                                            width: '100%',
                                            backgroundColor: '#0f172a',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            borderRadius: '14px',
                                            padding: '14px 20px',
                                            color: 'white',
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
                                        onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'; e.currentTarget.style.boxShadow = 'none'; }}
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
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 255, 255, 0.05)',
                                        color: '#94a3b8',
                                        fontWeight: '700',
                                        fontSize: '15px',
                                        cursor: 'pointer',
                                        transition: '0.2s'
                                    }}
                                    onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'; e.currentTarget.style.color = '#fff'; }}
                                    onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = '#94a3b8'; }}
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
                    backgroundColor: 'rgba(5, 8, 20, 0.9)',
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
                        backgroundColor: 'rgba(21, 28, 48, 0.95)', 
                        borderRadius: '24px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 40px 100px -20px rgba(0, 0, 0, 0.8)',
                        overflow: 'hidden',
                        position: 'relative',
                        color: 'white'
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
                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                border: 'none',
                                color: '#94a3b8',
                                cursor: 'pointer',
                                transition: '0.2s',
                                zIndex: 10
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'; e.currentTarget.style.color = '#fff'; }}
                            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = '#94a3b8'; }}
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
                            
                            <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.6', margin: 0, textAlign: 'center' }}>
                                <span style={{ color: '#fff', fontWeight: '700' }}>"{deleteConfirm.projectName}"</span><br />
                                이 프로젝트를 정말로 삭제하시겠습니까?<br />
                                <span style={{ color: '#f87171', fontWeight: '600' }}>배정 및 보고서 데이터가 모두 소멸되며 복구가 불가능합니다.</span>
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
