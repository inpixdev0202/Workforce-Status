import React, { useState, useEffect } from 'react';
import { projectsAPI, employeesAPI } from '../api';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachWeekOfInterval, addMonths, addWeeks, isSameWeek, isWithinInterval, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns';
import { ko } from 'date-fns/locale';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const ReportGenerator = () => {
    const [loading, setLoading] = useState(false);
    const [reportType, setReportType] = useState('weekly'); // weekly, monthly, quarterly, annual
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [data, setData] = useState({ projects: [], employees: [] });
    const [previewData, setPreviewData] = useState(null);
    const [activeTab, setActiveTab] = useState('projects'); // projects, idle

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [projRes, empRes] = await Promise.all([
                projectsAPI.getMatrix(),
                employeesAPI.getAll()
            ]);
            setData({ projects: projRes.data, employees: empRes.data });
        } catch (error) {
            console.error('Failed to fetch report data:', error);
        }
    };

    const getPeriodInterval = () => {
        let start, end;
        if (reportType === 'weekly') {
            start = startOfWeek(selectedDate, { weekStartsOn: 1 });
            end = endOfWeek(selectedDate, { weekStartsOn: 1 });
        } else if (reportType === 'monthly') {
            start = startOfMonth(selectedDate);
            end = endOfMonth(selectedDate);
        } else if (reportType === 'quarterly') {
            start = startOfQuarter(selectedDate);
            end = endOfQuarter(selectedDate);
        } else {
            start = startOfYear(selectedDate);
            end = endOfYear(selectedDate);
        }
        return { start, end };
    };

    const handlePreview = () => {
        const { start, end } = getPeriodInterval();
        const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });

        // Prepare Project Data
        const projectRows = [];
        data.projects.forEach(project => {
            if (project.members) {
                project.members.forEach(assign => {
                    projectRows.push({
                        group: assign.group_name || '미소속',
                        project: project.name,
                        name: assign.employee_name,
                        type: project.type || 'Client',
                        allocs: weeks.map(w => ({
                            date: format(w, 'yyyy-MM-dd'),
                            val: parseFloat(assign.allocations?.[format(w, 'yyyy-MM-dd')] || 0)
                        }))
                    });
                });
            }
        });

        // Prepare Idle Data
        const regularEmps = data.employees.filter(e => e.type === '정규직');
        const idleRows = regularEmps.map(emp => {
            return {
                name: emp.name,
                type: emp.type,
                stats: weeks.map(week => {
                    const dateStr = format(week, 'yyyy-MM-dd');
                    let totalAlloc = 0;
                    data.projects.forEach(p => {
                        if (p.members) {
                            p.members.forEach(a => {
                                if (a.employee_id === emp.id) {
                                    totalAlloc += parseFloat(a.allocations?.[dateStr] || 0);
                                }
                            });
                        }
                    });
                    return {
                        date: dateStr,
                        rate: Math.max(0, (1 - totalAlloc) * 100)
                    };
                })
            };
        });

        setPreviewData({ weeks, projectRows, idleRows });
    };

    const generateExcel = async () => {
        setLoading(true);
        try {
            const workbook = new ExcelJS.Workbook();
            const { start, end } = getPeriodInterval();
            const weeksInPeriod = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });

            // ... (rest of the excel generation logic - using the same intervals)
            const sheet = workbook.addWorksheet('리소스 투입 현황');
            const headers = ['그룹', '프로젝트', '성명', '유형', ...weeksInPeriod.map(w => format(w, 'MM/dd'))];
            const headerRow = sheet.addRow(headers);
            headerRow.eachCell((cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
                cell.font = { bold: true };
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });

            data.projects.forEach(project => {
                if (project.members) {
                    project.members.forEach(assign => {
                        const rowData = [assign.group_name || '미소속', project.name, assign.employee_name, project.type || 'Client'];
                        weeksInPeriod.forEach(week => {
                            const dateStr = format(week, 'yyyy-MM-dd');
                            rowData.push(parseFloat(assign.allocations?.[dateStr] || 0));
                        });
                        const row = sheet.addRow(rowData);
                        row.eachCell((cell, colNumber) => {
                            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                            if (colNumber > 4) {
                                const val = parseFloat(cell.value);
                                if (val >= 1.0) {
                                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
                                    cell.font = { color: { argb: 'FF1E40AF' }, bold: true };
                                } else if (val > 0) {
                                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
                                    cell.font = { color: { argb: 'FF92400E' } };
                                }
                            }
                        });
                    });
                }
            });

            const statsSheet = workbook.addWorksheet('유휴 현황 및 통계');
            const statsHeaders = ['성명', '유형', ...weeksInPeriod.map(w => format(w, 'MM/dd'))];
            const statsHeaderRow = statsSheet.addRow(statsHeaders);
            statsHeaderRow.eachCell((cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
                cell.font = { bold: true };
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });

            const regularEmps = data.employees.filter(e => e.type === '정규직');
            regularEmps.forEach(emp => {
                const rowData = [emp.name, emp.type];
                weeksInPeriod.forEach(week => {
                    const dateStr = format(week, 'yyyy-MM-dd');
                    let totalAlloc = 0;
                    data.projects.forEach(p => {
                        if (p.members) {
                            p.members.forEach(a => {
                                if (a.employee_id === emp.id) totalAlloc += parseFloat(a.allocations?.[dateStr] || 0);
                            });
                        }
                    });
                    rowData.push(`${Math.max(0, (1 - totalAlloc) * 100).toFixed(1)}%`);
                });

                const row = statsSheet.addRow(rowData);
                row.eachCell((cell, colNumber) => {
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                    if (colNumber > 2) {
                        const rate = parseFloat(cell.value);
                        if (rate >= 20) {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                            cell.font = { color: { argb: 'FF991B1B' }, bold: true };
                        } else if (rate >= 10) {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };
                            cell.font = { color: { argb: 'FF92400E' } };
                        } else {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
                            cell.font = { color: { argb: 'FF166534' } };
                        }
                    }
                });
            });

            sheet.columns.forEach(col => col.width = 15);
            statsSheet.columns.forEach(col => col.width = 15);

            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `인력현황_${reportType}_${format(selectedDate, 'yyyyMMdd')}.xlsx`);

        } catch (error) {
            console.error('Excel generation failed:', error);
            alert('보고서 생성 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="glass-card">
                <div className="card-header border-0">
                    <div className="flex items-center gap-2">
                        <span style={{ fontSize: '1.5rem' }}>📊</span>
                        <h3 className="card-title mb-0">Report Center</h3>
                    </div>
                </div>
                <div className="card-body pt-0">
                    <p className="text-muted text-sm mb-4">
                        정기적인 리소스 운용 현황을 시스템에서 조회하거나 엑셀로 내보냅니다.
                    </p>

                    <div className="grid grid-2 gap-md mb-lg">
                        <div className="form-group">
                            <label className="form-label text-white">보고서 종류</label>
                            <select
                                className="form-control"
                                value={reportType}
                                onChange={(e) => {
                                    setReportType(e.target.value);
                                    setPreviewData(null);
                                }}
                            >
                                <option value="weekly">주간 보고서</option>
                                <option value="monthly">월간 보고서</option>
                                <option value="quarterly">분기 보고서</option>
                                <option value="annual">연간 보고서</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label text-white">기준 날짜</label>
                            <input
                                type="date"
                                className="form-control"
                                value={format(selectedDate, 'yyyy-MM-dd')}
                                onChange={(e) => {
                                    setSelectedDate(new Date(e.target.value));
                                    setPreviewData(null);
                                }}
                            />
                        </div>
                    </div>

                    <div className="flex gap-md">
                        <button
                            className="btn btn-info w-full"
                            onClick={handlePreview}
                        >
                            화면 보고서 보기
                        </button>
                        <button
                            className={`btn btn-primary w-full ${loading ? 'loading' : ''}`}
                            onClick={generateExcel}
                            disabled={loading}
                        >
                            {loading ? '생성 중...' : '엑셀 다운로드 (XLSX)'}
                        </button>
                    </div>
                </div>
            </div>

            {previewData && (
                <div className="glass-card fade-in" style={{ animation: 'fadeIn 0.3s ease' }}>
                    <div className="card-header border-b border-gray-700 flex justify-between items-center bg-black/20">
                        <div className="flex gap-4">
                            <button
                                className={`px-4 py-2 text-sm font-bold transition-all ${activeTab === 'projects' ? 'text-info border-b-2 border-info' : 'text-muted hover:text-white'}`}
                                onClick={() => setActiveTab('projects')}
                            >
                                리소스 투입 현황
                            </button>
                            <button
                                className={`px-4 py-2 text-sm font-bold transition-all ${activeTab === 'idle' ? 'text-info border-b-2 border-info' : 'text-muted hover:text-white'}`}
                                onClick={() => setActiveTab('idle')}
                            >
                                유휴 현황 분석
                            </button>
                        </div>
                    </div>
                    <div className="card-body p-0" style={{ overflowX: 'auto' }}>
                        {activeTab === 'projects' ? (
                            <table className="w-full text-xs text-left" style={{ borderCollapse: 'collapse' }}>
                                <thead className="bg-slate-800 text-slate-300">
                                    <tr>
                                        <th className="p-3 border-r border-slate-700" style={{ minWidth: '100px' }}>그룹</th>
                                        <th className="p-3 border-r border-slate-700" style={{ minWidth: '150px' }}>프로젝트</th>
                                        <th className="p-3 border-r border-slate-700" style={{ minWidth: '80px' }}>성명</th>
                                        {previewData.weeks.map(w => (
                                            <th key={w} className="p-3 text-center border-r border-slate-700">{format(w, 'MM/dd')}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewData.projectRows.map((row, idx) => (
                                        <tr key={idx} className="border-b border-slate-700/50 hover:bg-white/5">
                                            <td className="p-3 border-r border-slate-700/50 text-slate-400">{row.group}</td>
                                            <td className="p-3 border-r border-slate-700/50 font-medium">{row.project}</td>
                                            <td className="p-3 border-r border-slate-700/50">{row.name}</td>
                                            {row.allocs.map((a, i) => (
                                                <td key={i} className="p-3 text-center border-r border-slate-700/50" style={{
                                                    backgroundColor: a.val >= 1.0 ? 'rgba(37, 99, 235, 0.1)' : a.val > 0 ? 'rgba(217, 119, 6, 0.1)' : 'transparent',
                                                    color: a.val >= 1.0 ? '#60a5fa' : a.val > 0 ? '#fbbf24' : 'inherit',
                                                    fontWeight: a.val > 0 ? 'bold' : 'normal'
                                                }}>
                                                    {a.val.toFixed(1)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <table className="w-full text-xs text-left" style={{ borderCollapse: 'collapse' }}>
                                <thead className="bg-slate-800 text-slate-300">
                                    <tr>
                                        <th className="p-3 border-r border-slate-700" style={{ minWidth: '80px' }}>성명</th>
                                        <th className="p-3 border-r border-slate-700" style={{ minWidth: '80px' }}>유형</th>
                                        {previewData.weeks.map(w => (
                                            <th key={w} className="p-3 text-center border-r border-slate-700">{format(w, 'MM/dd')}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewData.idleRows.map((row, idx) => (
                                        <tr key={idx} className="border-b border-slate-700/50 hover:bg-white/5">
                                            <td className="p-3 border-r border-slate-700/50 font-medium">{row.name}</td>
                                            <td className="p-3 border-r border-slate-700/50 text-slate-400">{row.type}</td>
                                            {row.stats.map((s, i) => {
                                                const rate = s.rate;
                                                const config = rate >= 20
                                                    ? { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171' }
                                                    : rate >= 10
                                                        ? { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24' }
                                                        : { bg: 'rgba(34, 197, 94, 0.15)', text: '#4ade80' };
                                                return (
                                                    <td key={i} className="p-3 text-center border-r border-slate-700/50" style={{
                                                        backgroundColor: config.bg,
                                                        color: config.text,
                                                        fontWeight: 'bold'
                                                    }}>
                                                        {rate.toFixed(1)}%
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportGenerator;
