import { useState, useEffect } from 'react';
import { employeesAPI, groupsAPI } from '../api';
import EmployeeForm from './EmployeeForm';
import { Plus, Pencil, Trash2 } from 'lucide-react';

function EmployeeList() {
    const [allEmployees, setAllEmployees] = useState([]);
    const [filteredEmployees, setFilteredEmployees] = useState([]);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [filters, setFilters] = useState({
        group_id: '',
        status: 'active',
        position: '',
        search: ''
    });

    useEffect(() => {
        loadData();
    }, []); // Only on mount

    useEffect(() => {
        applyFilters();
    }, [allEmployees, filters]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [employeesRes, groupsRes] = await Promise.all([
                employeesAPI.getAll(), // Fetch all without query params for client-side filtering
                groupsAPI.getAll()
            ]);
            setAllEmployees(employeesRes.data);
            setGroups(groupsRes.data);
        } catch (err) {
            console.error('Failed to load data:', err);
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = [...allEmployees];

        // Group Filter
        if (filters.group_id) {
            filtered = filtered.filter(emp => emp.group_id === parseInt(filters.group_id));
        }

        // Status Filter
        if (filters.status) {
            filtered = filtered.filter(emp => emp.status === filters.status);
        }

        // Position (Rank) Filter
        if (filters.position) {
            filtered = filtered.filter(emp => emp.position === filters.position);
        }

        // Search Filter (Name, Position, Email, Phone)
        if (filters.search) {
            const term = filters.search.toLowerCase();
            filtered = filtered.filter(emp =>
                (emp.name && emp.name.toLowerCase().includes(term)) ||
                (emp.position && emp.position.toLowerCase().includes(term)) ||
                (emp.job_role && emp.job_role.toLowerCase().includes(term)) ||
                (emp.contact_email && emp.contact_email.toLowerCase().includes(term)) ||
                (emp.contact_phone && emp.contact_phone.toLowerCase().includes(term))
            );
        }

        setFilteredEmployees(filtered);
    };

    const handleAdd = () => {
        setEditingEmployee(null);
        setShowModal(true);
    };

    const handleEdit = (employee) => {
        setEditingEmployee(employee);
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;

        try {
            await employeesAPI.delete(id);
            loadData();
        } catch (err) {
            alert('삭제에 실패했습니다.');
            console.error(err);
        }
    };

    const handleSave = async () => {
        setShowModal(false);
        loadData();
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in duration-700">
            <div className="flex justify-between items-center mb-lg">
                <div>
                    <h1>직원 관리</h1>
                    <p className="text-muted">총 {filteredEmployees.length}명 / 전체 {allEmployees.length}명</p>
                </div>
                <button 
                    onClick={handleAdd} 
                    className="premium-icon-btn"
                    title="직원 추가"
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)'; e.currentTarget.style.color = '#10b981'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = ''; }}
                >
                    <Plus size={20} />
                </button>
            </div>

            <div className="card mb-lg">
                <div className="grid grid-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                    <div className="form-group">
                        <label className="form-label">그룹</label>
                        <select
                            className="form-control"
                            value={filters.group_id}
                            onChange={(e) => setFilters({ ...filters, group_id: e.target.value })}
                        >
                            <option value="">전체</option>
                            {groups.map((group) => (
                                <option key={group.id} value={group.id}>
                                    {group.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">직급</label>
                        <select
                            className="form-control"
                            value={filters.position}
                            onChange={(e) => setFilters({ ...filters, position: e.target.value })}
                        >
                            <option value="">전체</option>
                            <option value="대표이사">대표이사</option>
                            <option value="이사">이사</option>
                            <option value="상무">상무</option>
                            <option value="부장">부장</option>
                            <option value="팀장">팀장</option>
                            <option value="차장">차장</option>
                            <option value="과장">과장</option>
                            <option value="대리">대리</option>
                            <option value="사원">사원</option>
                            <option value="인턴">인턴</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">상태</label>
                        <select
                            className="form-control"
                            value={filters.status}
                            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                        >
                            <option value="">전체</option>
                            <option value="active">재직</option>
                            <option value="inactive">퇴사</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">검색</label>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="이름, 연락처 검색..."
                            value={filters.search}
                            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                        />
                    </div>
                </div>
            </div>

            {/* Employee Table */}
            <div className="table-container">
                <table className="table">
                    <thead>
                        <tr>
                            <th>그룹</th>
                            <th>이름</th>
                            <th>직무</th>
                            <th>직급</th>
                            <th>기술등급</th>
                            <th>고용</th>
                            <th>입사일</th>
                            <th>연락처</th>
                            <th>상태</th>
                            <th>작업</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredEmployees.length > 0 ? (
                            filteredEmployees.map((employee) => (
                                <tr key={employee.id}>
                                    <td>
                                        <div className="flex items-center gap-sm">
                                            <span
                                                className="group-indicator"
                                                style={{ backgroundColor: employee.group_color }}
                                            ></span>
                                            <span>{employee.group_name || '-'}</span>
                                        </div>
                                    </td>
                                    <td className="font-weight-500">
                                        <div className="flex items-center gap-xs">
                                            {employee.name}
                                            {!!employee.exclude_from_stats && (
                                                <span className="badge badge-secondary" style={{ fontSize: '0.65rem' }} title="유휴인력 통계 제외">
                                                    기타
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        {employee.job_role ? (
                                            <span className="badge badge-primary" style={{ backgroundColor: '#10b981', color: 'white', fontSize: '0.7rem' }}>
                                                {employee.job_role}
                                            </span>
                                        ) : (
                                            <span className="text-muted" style={{ fontSize: '0.7rem' }}>일반</span>
                                        )}
                                    </td>
                                    <td>{employee.position || '-'}</td>
                                    <td>{employee.skill_level || '-'}</td>
                                    <td>{employee.employment_type || '-'}</td>
                                    <td>
                                        {employee.join_date
                                            ? new Date(employee.join_date).toLocaleDateString('ko-KR')
                                            : '-'}
                                    </td>
                                    <td>
                                        <div style={{ fontSize: '0.75rem' }}>
                                            {employee.contact_phone && <div>📞 {employee.contact_phone}</div>}
                                            {employee.contact_email && <div>📧 {employee.contact_email}</div>}
                                            {!employee.contact_phone && !employee.contact_email && '-'}
                                        </div>
                                    </td>
                                    <td>
                                        <span
                                            className={`badge ${employee.status === 'active' ? 'badge-success' : 'badge-danger'
                                                }`}
                                        >
                                            {employee.status === 'active' ? '재직' : '퇴사'}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="flex gap-1.5">
                                            <button
                                                onClick={() => handleEdit(employee)}
                                                className="premium-icon-btn"
                                                title="수정"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(employee.id)}
                                                className="premium-icon-btn btn-delete"
                                                title="삭제"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="9" className="text-center text-muted">
                                    직원이 없습니다.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Employee Form Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1000px', width: '95%' }}>
                        <div className="modal-header">
                            <h2 className="modal-title">
                                {editingEmployee ? '직원 수정' : '직원 추가'}
                            </h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>
                                ✕
                            </button>
                        </div>
                        <EmployeeForm
                            employee={editingEmployee}
                            groups={groups}
                            onSave={handleSave}
                            onCancel={() => setShowModal(false)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default EmployeeList;
