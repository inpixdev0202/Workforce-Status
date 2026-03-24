import { useState, useEffect } from 'react';
import { employeesAPI } from '../api';

function EmployeeForm({ employee, groups, onSave, onCancel }) {
    const [formData, setFormData] = useState({
        group_id: '',
        name: '',
        position: '',
        employment_type: '',
        join_date: '',
        retirement_date: '',
        contact_email: '',
        contact_phone: '',
        status: 'active',
        notes: '',
        exclude_from_stats: 0,
        job_role: ''
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (employee) {
            setFormData({
                group_id: employee.group_id || '',
                name: employee.name || '',
                position: employee.position || '',
                skill_level: employee.skill_level || '',
                employment_type: employee.employment_type || '',
                join_date: employee.join_date || '',
                retirement_date: employee.retirement_date || '',
                contact_email: employee.contact_email || '',
                contact_phone: employee.contact_phone || '',
                status: employee.status || 'active',
                notes: employee.notes || '',
                exclude_from_stats: employee.exclude_from_stats || 0,
                job_role: employee.job_role || ''
            });
        }
    }, [employee]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? (checked ? 1 : 0) : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            alert('이름을 입력해주세요.');
            return;
        }

        try {
            setSaving(true);
            if (employee) {
                await employeesAPI.update(employee.id, formData);
            } else {
                await employeesAPI.create(formData);
            }
            onSave();
        } catch (err) {
            console.error(err);
            const message = err.response?.data?.error || err.message || '저장에 실패했습니다.';
            alert(`저장 실패: ${message}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="grid grid-3">
                <div className="form-group">
                    <label className="form-label">이름 *</label>
                    <input
                        type="text"
                        name="name"
                        className="form-control"
                        value={formData.name}
                        onChange={handleChange}
                        required
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">그룹</label>
                    <select
                        name="group_id"
                        className="form-control"
                        value={formData.group_id}
                        onChange={handleChange}
                    >
                        <option value="">선택 안함</option>
                        {groups.map((group) => (
                            <option key={group.id} value={group.id}>
                                {group.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label className="form-label">상태</label>
                    <select
                        name="status"
                        className="form-control"
                        value={formData.status}
                        onChange={handleChange}
                    >
                        <option value="active">재직</option>
                        <option value="inactive">퇴사</option>
                    </select>
                </div>

                <div className="form-group">
                    <label className="form-label">직급 (Rank)</label>
                    <select
                        name="position"
                        className="form-control"
                        value={formData.position}
                        onChange={handleChange}
                    >
                        <option value="">선택</option>
                        <option value="이사">이사</option>
                        <option value="부장">부장</option>
                        <option value="차장">차장</option>
                        <option value="과장">과장</option>
                        <option value="대리">대리</option>
                        <option value="사원">사원</option>
                        <option value="인턴">인턴</option>
                    </select>
                </div>

                <div className="form-group">
                    <label className="form-label">직무 (Role)</label>
                    <select
                        name="job_role"
                        className="form-control"
                        value={formData.job_role || ''}
                        onChange={handleChange}
                        style={{ borderColor: formData.job_role ? '#10b981' : 'rgba(255,255,255,0.1)' }}
                    >
                        <option value="">일반 (Staff)</option>
                        <option value="PD">PD (Project Director)</option>
                        <option value="PM">PM (Project Manager)</option>
                    </select>
                </div>

                <div className="form-group">
                    <label className="form-label">기술등급</label>
                    <select
                        name="skill_level"
                        className="form-control"
                        value={formData.skill_level || ''}
                        onChange={handleChange}
                    >
                        <option value="">선택</option>
                        <option value="초급">초급</option>
                        <option value="중급">중급</option>
                        <option value="고급">고급</option>
                        <option value="특급">특급</option>
                    </select>
                </div>

                <div className="form-group">
                    <label className="form-label">고용</label>
                    <select
                        name="employment_type"
                        className="form-control"
                        value={formData.employment_type}
                        onChange={handleChange}
                    >
                        <option value="">선택</option>
                        <option value="정규직">정규직</option>
                        <option value="계약직">계약직</option>
                        <option value="파견직">파견직</option>
                        <option value="인턴">인턴</option>
                    </select>
                </div>

                <div className="form-group">
                    <label className="form-label">입사일</label>
                    <input
                        type="date"
                        name="join_date"
                        className="form-control"
                        value={formData.join_date}
                        onChange={handleChange}
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">퇴사일</label>
                    <input
                        type="date"
                        name="retirement_date"
                        className="form-control"
                        value={formData.retirement_date}
                        onChange={handleChange}
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">이메일</label>
                    <input
                        type="email"
                        name="contact_email"
                        className="form-control"
                        value={formData.contact_email}
                        onChange={handleChange}
                        placeholder="example@company.com"
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">전화번호</label>
                    <input
                        type="tel"
                        name="contact_phone"
                        className="form-control"
                        value={formData.contact_phone}
                        onChange={handleChange}
                        placeholder="010-1234-5678"
                    />
                </div>
            </div>

            <div className="form-group">
                <label className="flex items-center gap-sm cursor-pointer py-sm px-md rounded bg-slate-800/50 border border-slate-700/50 hover:bg-slate-700/50 transition-colors">
                    <input
                        type="checkbox"
                        name="exclude_from_stats"
                        checked={!!formData.exclude_from_stats}
                        onChange={handleChange}
                        style={{ width: '1.2rem', height: '1.2rem' }}
                    />
                    <div>
                        <span className="font-weight-600 text-info" style={{ fontSize: '0.9rem' }}>유휴인력 집계 제외 (Bench Exclusion)</span>
                        <p className="text-xs text-muted mb-0">관리직 등 프로젝트 투입 대상이 아닌 경우 체크하세요.</p>
                    </div>
                </label>
            </div>

            <div className="form-group">
                <label className="form-label">비고</label>
                <textarea
                    name="notes"
                    className="form-control"
                    value={formData.notes}
                    onChange={handleChange}
                    rows="3"
                    placeholder="추가 정보를 입력하세요..."
                ></textarea>
            </div>

            <div className="flex justify-between mt-lg">
                <button type="button" onClick={onCancel} className="btn btn-secondary">
                    취소
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? '저장 중...' : '저장'}
                </button>
            </div>
        </form>
    );
}

export default EmployeeForm;
