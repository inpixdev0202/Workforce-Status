import { useState, useEffect } from 'react';
import { groupsAPI } from '../api';

function GroupManager() {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingGroup, setEditingGroup] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        color: '#3B82F6'
    });

    useEffect(() => {
        loadGroups();
    }, []);

    const loadGroups = async () => {
        try {
            setLoading(true);
            const response = await groupsAPI.getAll();
            setGroups(response.data);
        } catch (err) {
            console.error('Failed to load groups:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = () => {
        setEditingGroup(null);
        setFormData({ name: '', color: '#3B82F6' });
        setShowModal(true);
    };

    const handleEdit = (group) => {
        setEditingGroup(group);
        setFormData({ name: group.name, color: group.color });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!confirm('정말 삭제하시겠습니까? 해당 그룹에 직원이 있으면 삭제할 수 없습니다.')) {
            return;
        }

        try {
            await groupsAPI.delete(id);
            loadGroups();
        } catch (err) {
            if (err.response?.data?.error) {
                alert(err.response.data.error);
            } else {
                alert('삭제에 실패했습니다.');
            }
            console.error(err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            alert('그룹 이름을 입력해주세요.');
            return;
        }

        try {
            if (editingGroup) {
                await groupsAPI.update(editingGroup.id, formData);
            } else {
                await groupsAPI.create(formData);
            }
            setShowModal(false);
            loadGroups();
        } catch (err) {
            if (err.response?.data?.error) {
                alert(err.response.data.error);
            } else {
                alert('저장에 실패했습니다.');
            }
            console.error(err);
        }
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div className="container page">
            <div className="flex justify-between items-center mb-lg">
                <div>
                    <h1>그룹 관리</h1>
                    <p className="text-muted">총 {groups.length}개 그룹</p>
                </div>
                <button onClick={handleAdd} className="btn btn-primary">
                    ➕ 그룹 추가
                </button>
            </div>

            <div className="grid grid-3">
                {groups.map((group) => (
                    <div key={group.id} className="card">
                        <div className="flex items-center gap-md mb-md">
                            <div
                                style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '12px',
                                    backgroundColor: group.color,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.5rem'
                                }}
                            >
                                🏢
                            </div>
                            <div style={{ flex: 1 }}>
                                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{group.name}</h3>
                                <p className="text-muted" style={{ margin: 0, fontSize: '0.875rem' }}>
                                    {group.employee_count}명
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-sm mt-md">
                            <button
                                onClick={() => handleEdit(group)}
                                className="btn btn-sm btn-secondary"
                                style={{ flex: 1 }}
                            >
                                수정
                            </button>
                            <button
                                onClick={() => handleDelete(group.id)}
                                className="btn btn-sm btn-danger"
                                style={{ flex: 1 }}
                            >
                                삭제
                            </button>
                        </div>
                    </div>
                ))}

                {groups.length === 0 && (
                    <div className="card" style={{ gridColumn: '1 / -1' }}>
                        <p className="text-center text-muted">그룹이 없습니다. 새 그룹을 추가해보세요.</p>
                    </div>
                )}
            </div>

            {/* Group Form Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">
                                {editingGroup ? '그룹 수정' : '그룹 추가'}
                            </h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">그룹 이름 *</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="예: SCG, CDG, FDG"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">색상</label>
                                <div className="flex gap-md items-center">
                                    <input
                                        type="color"
                                        className="form-control"
                                        value={formData.color}
                                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                        style={{ width: '80px', height: '40px', cursor: 'pointer' }}
                                    />
                                    <span className="text-muted">{formData.color}</span>
                                </div>
                            </div>

                            <div className="flex justify-between mt-lg">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="btn btn-secondary"
                                >
                                    취소
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    저장
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default GroupManager;
