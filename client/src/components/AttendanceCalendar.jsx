import { useState, useEffect } from 'react';
import { employeesAPI, attendanceAPI } from '../api';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth } from 'date-fns';
import { ko } from 'date-fns/locale';

function AttendanceCalendar() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [employees, setEmployees] = useState([]);
    const [attendance, setAttendance] = useState({});
    const [loading, setLoading] = useState(true);
    const [selectedCell, setSelectedCell] = useState(null);

    useEffect(() => {
        loadData();
    }, [currentDate]);

    const loadData = async () => {
        try {
            setLoading(true);
            const monthStr = format(currentDate, 'yyyy-MM');

            const [employeesRes, attendanceRes] = await Promise.all([
                employeesAPI.getAll({ status: 'active' }),
                attendanceAPI.getAll({ month: monthStr })
            ]);

            setEmployees(employeesRes.data);

            // Convert attendance array to map for easy lookup
            const attendanceMap = {};
            attendanceRes.data.forEach((record) => {
                const key = `${record.employee_id}-${record.date}`;
                attendanceMap[key] = record;
            });
            setAttendance(attendanceMap);
        } catch (err) {
            console.error('Failed to load data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (employeeId, date, status) => {
        try {
            await attendanceAPI.create({
                employee_id: employeeId,
                date,
                status
            });
            loadData();
        } catch (err) {
            alert('출퇴근 기록 저장에 실패했습니다.');
            console.error(err);
        }
    };

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const previousMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'present': return '#10B981';
            case 'absent': return '#EF4444';
            case 'leave': return '#F59E0B';
            default: return '#334155';
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
            <div className="mb-lg">
                <h1>출퇴근 관리</h1>
                <p className="text-muted">월별 출퇴근 현황</p>
            </div>

            {/* Month Navigation */}
            <div className="card mb-lg">
                <div className="flex justify-between items-center">
                    <button onClick={previousMonth} className="btn btn-secondary">
                        ← 이전 달
                    </button>
                    <h2 style={{ margin: 0 }}>
                        {format(currentDate, 'yyyy년 M월', { locale: ko })}
                    </h2>
                    <button onClick={nextMonth} className="btn btn-secondary">
                        다음 달 →
                    </button>
                </div>
            </div>

            {/* Legend */}
            <div className="card mb-lg">
                <div className="flex gap-lg">
                    <div className="flex items-center gap-sm">
                        <div style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: '#10B981' }}></div>
                        <span>출근</span>
                    </div>
                    <div className="flex items-center gap-sm">
                        <div style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: '#EF4444' }}></div>
                        <span>결근</span>
                    </div>
                    <div className="flex items-center gap-sm">
                        <div style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: '#F59E0B' }}></div>
                        <span>휴가</span>
                    </div>
                    <div className="flex items-center gap-sm">
                        <div style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: '#334155' }}></div>
                        <span>미기록</span>
                    </div>
                </div>
            </div>

            {/* Attendance Table */}
            <div className="table-container">
                <table className="table" style={{ fontSize: '0.75rem' }}>
                    <thead>
                        <tr>
                            <th style={{ position: 'sticky', left: 0, backgroundColor: 'var(--bg-tertiary)', zIndex: 10 }}>
                                직원
                            </th>
                            {daysInMonth.map((day) => (
                                <th key={day.toString()} style={{ textAlign: 'center', minWidth: '40px' }}>
                                    {format(day, 'd')}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {employees.map((employee) => (
                            <tr key={employee.id}>
                                <td style={{ position: 'sticky', left: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 9 }}>
                                    <div>
                                        <div className="font-weight-500">{employee.name}</div>
                                        <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                                            {employee.group_name}
                                        </div>
                                    </div>
                                </td>
                                {daysInMonth.map((day) => {
                                    const dateStr = format(day, 'yyyy-MM-dd');
                                    const key = `${employee.id}-${dateStr}`;
                                    const record = attendance[key];
                                    const status = record?.status;

                                    return (
                                        <td
                                            key={dateStr}
                                            style={{
                                                textAlign: 'center',
                                                backgroundColor: getStatusColor(status),
                                                cursor: 'pointer',
                                                padding: '8px'
                                            }}
                                            onClick={() => setSelectedCell({ employeeId: employee.id, date: dateStr })}
                                        >
                                            {status === 'present' && '✓'}
                                            {status === 'absent' && '✗'}
                                            {status === 'leave' && '휴'}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                        {employees.length === 0 && (
                            <tr>
                                <td colSpan={daysInMonth.length + 1} className="text-center text-muted">
                                    직원이 없습니다.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Status Selection Modal */}
            {selectedCell && (
                <div className="modal-overlay" onClick={() => setSelectedCell(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h2 className="modal-title">출퇴근 상태 선택</h2>
                            <button className="modal-close" onClick={() => setSelectedCell(null)}>
                                ✕
                            </button>
                        </div>

                        <div className="flex flex-col gap-md">
                            <button
                                onClick={() => {
                                    handleStatusChange(selectedCell.employeeId, selectedCell.date, 'present');
                                    setSelectedCell(null);
                                }}
                                className="btn btn-success btn-lg"
                            >
                                ✓ 출근
                            </button>
                            <button
                                onClick={() => {
                                    handleStatusChange(selectedCell.employeeId, selectedCell.date, 'absent');
                                    setSelectedCell(null);
                                }}
                                className="btn btn-danger btn-lg"
                            >
                                ✗ 결근
                            </button>
                            <button
                                onClick={() => {
                                    handleStatusChange(selectedCell.employeeId, selectedCell.date, 'leave');
                                    setSelectedCell(null);
                                }}
                                className="btn btn-secondary btn-lg"
                                style={{ backgroundColor: '#F59E0B' }}
                            >
                                휴 휴가
                            </button>
                            <button
                                onClick={() => setSelectedCell(null)}
                                className="btn btn-secondary"
                            >
                                취소
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AttendanceCalendar;
