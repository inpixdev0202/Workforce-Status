import { useState, useEffect } from 'react';
import { employeesAPI, groupsAPI } from '../api';
import EmployeeForm from './EmployeeForm';
import { Plus, Pencil, Trash2, Info, FileDown } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

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
        skill_level: '',
        employment_type: '',
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

        // Skill Level Filter
        if (filters.skill_level) {
            filtered = filtered.filter(emp => emp.skill_level === filters.skill_level);
        }

        // Employment Type Filter
        if (filters.employment_type) {
            filtered = filtered.filter(emp => emp.employment_type === filters.employment_type);
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

    const handleExcelDownload = async () => {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('직원 목록');

        sheet.columns = [
            { header: '그룹', key: 'group_name', width: 16 },
            { header: '이름', key: 'name', width: 12 },
            { header: '직무', key: 'job_role', width: 14 },
            { header: '직급', key: 'position', width: 10 },
            { header: '기술등급', key: 'skill_level', width: 10 },
            { header: '고용형태', key: 'employment_type', width: 10 },
            { header: '입사일', key: 'join_date', width: 14 },
            { header: '연락처', key: 'contact_phone', width: 16 },
            { header: '이메일', key: 'contact_email', width: 26 },
            { header: '상태', key: 'status', width: 8 },
        ];

        // Header style
        const headerRow = sheet.getRow(1);
        headerRow.eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = {
                top: { style: 'thin' }, bottom: { style: 'thin' },
                left: { style: 'thin' }, right: { style: 'thin' }
            };
        });
        headerRow.height = 22;

        filteredEmployees.forEach((emp, i) => {
            const row = sheet.addRow({
                group_name: emp.group_name || '-',
                name: emp.name || '',
                job_role: emp.job_role || '-',
                position: emp.position || '-',
                skill_level: emp.skill_level || '-',
                employment_type: emp.employment_type || '-',
                join_date: emp.join_date ? new Date(emp.join_date).toLocaleDateString('ko-KR') : '-',
                contact_phone: emp.contact_phone || '-',
                contact_email: emp.contact_email || '-',
                status: emp.status === 'active' ? '재직' : '퇴사',
            });

            const bg = i % 2 === 0 ? 'FFFFFFFF' : 'FFF0FDF4';
            row.eachCell(cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                };
            });
            row.height = 18;
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const today = new Date().toISOString().slice(0, 10);
        saveAs(new Blob([buffer], { type: 'application/octet-stream' }), `직원목록_${today}.xlsx`);
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
                    <div className="flex items-center gap-xs text-muted" style={{ fontSize: '0.875rem' }}>
                        <span>총 {filteredEmployees.length}명 / 전체 {allEmployees.length}명</span>
                        <div className="info-tooltip-wrapper">
                            <Info size={14} className="info-icon-trigger" />
                            <div className="info-tooltip-content glass-card">
                                <div className="tooltip-header">인원 구성 상세</div>
                                <div className="tooltip-row">
                                    <span className="label">전체 등록 인원 (DB)</span>
                                    <span className="value">{allEmployees.length}명</span>
                                </div>
                                <div className="tooltip-row">
                                    <span className="label">현재 재직 인력 (Active)</span>
                                    <span className="value">{allEmployees.filter(e => e.status === 'active').length}명</span>
                                </div>
                                <div className="tooltip-row highlight">
                                    <span className="label">실무 통계 대상 (Stats)</span>
                                    <span className="value">{allEmployees.filter(e => e.status === 'active' && (!e.exclude_from_stats || e.exclude_from_stats === 0)).length}명</span>
                                </div>
                                <div className="tooltip-footer">
                                    * 실무 통계 대상은 재직자 중 관리직/지원부서 등 통계 제외 설정된 인원(9명)을 뺀 수치입니다.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex gap-xs">
                    <button
                        onClick={handleExcelDownload}
                        className="premium-icon-btn"
                        title="엑셀 다운로드"
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)'; e.currentTarget.style.color = '#10b981'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = ''; }}
                    >
                        <FileDown size={20} />
                    </button>
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
            </div>

            <div className="card mb-lg pb-lg">
                <div className="grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(6, 1fr)',
                    gap: '1rem'
                }}>
                    <div className="form-group mb-0">
                        <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>그룹</label>
                        <select
                            className="form-control"
                            value={filters.group_id}
                            onChange={(e) => setFilters({ ...filters, group_id: e.target.value })}
                            style={{ height: '42px' }}
                        >
                            <option value="">전체</option>
                            {groups.map((group) => (
                                <option key={group.id} value={group.id}>
                                    {group.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group mb-0">
                        <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>직급</label>
                        <select
                            className="form-control"
                            value={filters.position}
                            onChange={(e) => setFilters({ ...filters, position: e.target.value })}
                            style={{ height: '42px' }}
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

                    <div className="form-group mb-0">
                        <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>기술등급</label>
                        <select
                            className="form-control"
                            value={filters.skill_level}
                            onChange={(e) => setFilters({ ...filters, skill_level: e.target.value })}
                            style={{ height: '42px' }}
                        >
                            <option value="">전체</option>
                            <option value="특급">특급</option>
                            <option value="고급">고급</option>
                            <option value="중급">중급</option>
                            <option value="초급">초급</option>
                        </select>
                    </div>

                    <div className="form-group mb-0">
                        <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>상태</label>
                        <select
                            className="form-control"
                            value={filters.status}
                            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                            style={{ height: '42px' }}
                        >
                            <option value="">전체</option>
                            <option value="active">재직</option>
                            <option value="inactive">퇴사</option>
                        </select>
                    </div>

                    <div className="form-group mb-0">
                        <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>고용</label>
                        <select
                            className="form-control"
                            value={filters.employment_type}
                            onChange={(e) => setFilters({ ...filters, employment_type: e.target.value })}
                            style={{ height: '42px' }}
                        >
                            <option value="">전체</option>
                            <option value="정규직">정규직</option>
                            <option value="계약직">계약직</option>
                        </select>
                    </div>

                    <div className="form-group mb-0">
                        <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>검색</label>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="이름, 연락처 검색..."
                            value={filters.search}
                            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                            style={{ height: '42px' }}
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
