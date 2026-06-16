import { useState, useEffect, useRef, useCallback, useMemo, useTransition } from 'react';
import { 
    format, 
    addWeeks, 
    addDays, 
    startOfWeek, 
    endOfWeek, 
    eachWeekOfInterval, 
    parseISO, 
    isAfter,
    isBefore
} from 'date-fns';
import { projectsAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { useDataCache } from '../context/DataCacheContext';
import { hasAccess, MENU_ITEMS } from '../constants/menuConfig';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// Helper to calculate MM for a specific week based on project duration
// Use string comparison (yyyy-MM-dd) to avoid timezone-related Date object mismatch issues
const calculateWeeklyMM = (weekStart, projectStartStr, projectEndStr) => {
    if (!projectStartStr || !projectEndStr) return "0.0";
    let workingDays = 0;

    // Check Mon(0) to Fri(4) relative to weekStart
    for (let i = 0; i < 5; i++) {
        const day = addDays(weekStart, i);
        const dayStr = format(day, 'yyyy-MM-dd');
        // Check if day is within project range (inclusive) using string comparison
        if (dayStr >= projectStartStr && dayStr <= projectEndStr) {
            workingDays++;
        }
    }

    return (workingDays * 0.2).toFixed(1);
};

const COL_BUFFER = 8;

export const useProjectStatus = (confirmConfig, setConfirmConfig) => {
    const { user } = useAuth();
    const projectsMenu = MENU_ITEMS.find(m => m.id === 'projects');
    const canEdit = hasAccess(user, projectsMenu);
    const dataCache = useDataCache();

    // Cache initialization
    const initialMatrix = dataCache.getMatrixSync() || [];
    const initialEmployees = dataCache.getEmployeesSync({ status: 'active' }) || [];

    const [data, setData] = useState(initialMatrix);
    const dataRef = useRef(data);

    useEffect(() => {
        dataRef.current = data;
        if (data.length > 0) dataCache.setMatrixData(data);
    }, [data, dataCache]);

    const [employees, setEmployees] = useState(initialEmployees);
    useEffect(() => {
        if (employees.length > 0) dataCache.setEmployeesData({ status: 'active' }, employees);
    }, [employees, dataCache]);

    const [weeks, setWeeks] = useState(() => {
        const initialStart = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), -52);
        const start = startOfWeek(initialStart, { weekStartsOn: 1 });
        const end = addWeeks(start, 155);
        return eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
    });

    const [cursor, setCursor] = useState({ memberIndex: null, weekIndex: null });
    const cellRefs = useRef({});
    const [loading, setLoading] = useState(initialMatrix.length === 0);
    const assigningProjects = useRef(new Set());

    const [visibleColRange, setVisibleColRange] = useState(() => {
        const todayIdx = 52;
        const visibleEstimate = 50;
        return {
            start: Math.max(0, todayIdx - COL_BUFFER),
            end: todayIdx + visibleEstimate + COL_BUFFER,
        };
    });

    const [showProjectModal, setShowProjectModal] = useState(false);
    const [showMemberModal, setShowMemberModal] = useState(false);
    const [selectedProject, setSelectedProject] = useState(null);
    const [startDate, setStartDate] = useState(() => addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), -52));
    
    const [viewMode, setViewMode] = useState(() => {
        return localStorage.getItem('wfs_view_mode') || 'project';
    });
    useEffect(() => {
        localStorage.setItem('wfs_view_mode', viewMode);
    }, [viewMode]);

    const [selectedGroup, setSelectedGroup] = useState(() => {
        return localStorage.getItem('wfs_selected_group') || 'ALL';
    });
    useEffect(() => {
        localStorage.setItem('wfs_selected_group', selectedGroup);
    }, [selectedGroup]);

    const [hiddenProjectIds, setHiddenProjectIds] = useState(() => {
        try {
            const saved = localStorage.getItem('wfs_hidden_project_ids');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    });
    useEffect(() => {
        localStorage.setItem('wfs_hidden_project_ids', JSON.stringify(hiddenProjectIds));
    }, [hiddenProjectIds]);

    const [showHideManager, setShowHideManager] = useState(false);
    const hideManagerRef = useRef(null);

    const [isGroupTransitioning, startGroupTransition] = useTransition();

    // Scroll Sync Refs
    const tableContainerRef = useRef(null);
    const sliderRef = useRef(null);
    const visibleDateRef = useRef(null);
    const isScrollingRef = useRef(false);
    const hasAutoScrolled = useRef(false);
    const [modalSearchTerm, setModalSearchTerm] = useState('');
    const [projectSearchTerm, setProjectSearchTerm] = useState('');
    const [inlineInputRect, setInlineInputRect] = useState(null);

    const [allMasterProjects, setAllMasterProjects] = useState([]);
    const [masterDataLoading, setMasterDataLoading] = useState(false);

    // Settings Popover
    const [showSettings, setShowSettings] = useState(false);
    const settingsRef = useRef(null);

    // Group Dropdown
    const [showGroupDropdown, setShowGroupDropdown] = useState(false);
    const groupDropdownRef = useRef(null);

    // Excel Export State
    const [exportStartDate, setExportStartDate] = useState(() => format(addWeeks(new Date(), -4), 'yyyy-MM-dd'));
    const [exportEndDate, setExportEndDate] = useState(() => format(addWeeks(new Date(), 12), 'yyyy-MM-dd'));
    const [isDownloading, setIsDownloading] = useState(false);
    const [showExcelCalPicker, setShowExcelCalPicker] = useState(null);
    const [excelCalRect, setExcelCalRect] = useState(null);
    const [excelCalYear, setExcelCalYear] = useState(() => new Date().getFullYear());
    const [excelCalMonth, setExcelCalMonth] = useState(() => new Date().getMonth());

    // Navigation Calendar State
    const [visibleDate, setVisibleDate] = useState(() => {
        const today = startOfWeek(new Date(), { weekStartsOn: 1 });
        return `${format(today, 'yyyy년 M월 d일')} ~ ${format(addDays(today, 4), 'M월 d일')}`;
    });
    const [showCalendarPicker, setShowCalendarPicker] = useState(false);
    const [calendarPickerRect, setCalendarPickerRect] = useState(null);
    const [calPickerYear, setCalPickerYear] = useState(() => new Date().getFullYear());
    const [calPickerMonth, setCalPickerMonth] = useState(() => new Date().getMonth());
    const [hoveredWeekIdx, setHoveredWeekIdx] = useState(null);

    const [isMobile, setIsMobile] = useState(() => window.innerWidth < 900);
    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 900);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    // Close calendar picker when clicking outside
    useEffect(() => {
        if (!showCalendarPicker) return;
        const handler = (e) => {
            if (!e.target.closest('.inline-search-results') && !e.target.closest('[title="달력으로 날짜 이동"]')) {
                setShowCalendarPicker(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showCalendarPicker]);

    // Close popovers on click outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (settingsRef.current && !settingsRef.current.contains(event.target)) {
                setShowSettings(false);
            }
            if (groupDropdownRef.current && !groupDropdownRef.current.contains(event.target)) {
                setShowGroupDropdown(false);
            }
            if (hideManagerRef.current && !hideManagerRef.current.contains(event.target)) {
                setShowHideManager(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const [showCompleted, setShowCompleted] = useState(false);
    const [expandedCompletedProjects, setExpandedCompletedProjects] = useState([]);
    const [isCompletedSectionExpanded, setIsCompletedSectionExpanded] = useState(false);

    // loadData API Call
    const loadData = useCallback(async (options = {}) => {
        if (options.force) {
            dataCache.invalidateMatrix();
            dataCache.invalidateEmployees();
        }
        if (!options.silent) {
            setLoading(true);
        }
        try {
            const [matrixResult, employeesResult] = await Promise.all([
                dataCache.getMatrix({ force: options.force }),
                dataCache.getEmployees({ status: 'active' }, { force: options.force })
            ]);
            setData(matrixResult);
            if (employeesResult) {
                setEmployees([...employeesResult].sort((a, b) => a.name.localeCompare(b.name, 'ko')));
            }
        } catch (err) {
            console.error('Failed to load project status data:', err);
        } finally {
            if (!options.silent) {
                setLoading(false);
            }
        }
    }, [dataCache]);

    // triggerAutoAllocation
    const triggerAutoAllocation = useCallback(async (assignmentId, startStr, endStr, existingAllocations) => {
        const startD = parseISO(startStr);
        const endD = parseISO(endStr);
        if (isNaN(startD.getTime()) || isNaN(endD.getTime()) || startD > endD) return;

        const start = startOfWeek(startD, { weekStartsOn: 1 });
        const allProjectWeeks = eachWeekOfInterval({ start, end: endD }, { weekStartsOn: 1 });
        const activeWeekStrings = new Set(allProjectWeeks.map(w => format(w, 'yyyy-MM-dd')));

        const localUpdates = [];
        let currentAllocations = existingAllocations;
        if (!currentAllocations) {
            for (const p of dataRef.current) {
                const m = p.members.find(am => am.id == assignmentId);
                if (m) {
                    currentAllocations = m.allocations;
                    break;
                }
            }
        }

        const newAllocations = { ...(currentAllocations || {}) };
        let hasChanges = false;

        Object.keys(newAllocations).forEach(dateStr => {
            if (!activeWeekStrings.has(dateStr) && newAllocations[dateStr] !== '') {
                newAllocations[dateStr] = '';
                localUpdates.push({
                    assignment_id: assignmentId,
                    date: dateStr,
                    value: ''
                });
                hasChanges = true;
            }
        });

        allProjectWeeks.forEach((week, index) => {
            const dateStr = format(week, 'yyyy-MM-dd');
            const currentValue = newAllocations[dateStr];

            const isBoundaryWeek = index === 0 || index === allProjectWeeks.length - 1;
            const isEmpty = currentValue === undefined || currentValue === '' || String(currentValue) === '0' || String(currentValue) === '0.0';

            const calculatedMM = calculateWeeklyMM(week, startStr, endStr);

            if (isEmpty || isBoundaryWeek) {
                const valA = parseFloat(currentValue || 0).toFixed(1);
                const valB = parseFloat(calculatedMM).toFixed(1);

                if (valA !== valB && parseFloat(valB) > 0) {
                    newAllocations[dateStr] = calculatedMM;
                    localUpdates.push({
                        assignment_id: assignmentId,
                        date: dateStr,
                        value: calculatedMM
                    });
                    hasChanges = true;
                }
            }
        });

        if (!hasChanges) return;

        setData(prev => prev.map(p => ({
            ...p,
            members: p.members.map(m =>
                m.id == assignmentId ? { ...m, allocations: newAllocations } : m
            )
        })));

        if (localUpdates.length > 0) {
            try {
                await projectsAPI.updateAllocationBatch(localUpdates);
                console.log(`[triggerAutoAllocation] Successfully triggered batch update for assignment ${assignmentId}, ${localUpdates.length} records.`);
            } catch (err) {
                console.error('[triggerAutoAllocation] Auto-allocation batch update failed', err);
            }
        }
    }, []);

    // handleAssignmentUpdate
    const handleAssignmentUpdate = useCallback(async (assignmentId, field, value) => {
        let currentTarget = null;
        let found = false;

        for (const p of dataRef.current) {
            const m = p.members.find(am => am.id == assignmentId);
            if (m) {
                currentTarget = { ...m };
                found = true;
                break;
            }
        }

        if (!found || !currentTarget) {
            console.error(`[handleAssignmentUpdate] Assignment ID ${assignmentId} not found in state.`);
            return;
        }

        setData(prev => {
            return prev.map(p => ({
                ...p,
                members: p.members.map(m => {
                    if (m.id == assignmentId) {
                        return { ...m, [field]: value };
                    }
                    return m;
                })
            }));
        });

        try {
            const finalStart = field === 'input_start_date' ? value : currentTarget.input_start_date;
            const finalEnd = field === 'input_end_date' ? value : currentTarget.input_end_date;

            const response = await projectsAPI.updateAssignment(assignmentId, {
                role: field === 'role' ? value : currentTarget.role,
                input_start_date: finalStart,
                input_end_date: finalEnd,
                employee_id: field === 'employee_id' ? value : currentTarget.employee_id,
                work_location: field === 'work_location' ? value : currentTarget.work_location
            });

            if (field === 'employee_id') {
                const empInfo = employees.find(e => e.id === value);
                const updated = {
                    ...response.data,
                    employee_name: response.data.employee_name || empInfo?.name,
                    employee_position: response.data.employee_position || empInfo?.position,
                    group_name: response.data.group_name || empInfo?.group_name,
                    group_color: response.data.group_color || empInfo?.group_color
                };

                setData(prev => prev.map(p => ({
                    ...p,
                    members: p.members.map(m => m.id == assignmentId ? { ...m, ...updated } : m)
                })));
            }

            if ((field === 'input_start_date' || field === 'input_end_date') && finalStart && finalEnd) {
                triggerAutoAllocation(assignmentId, finalStart, finalEnd, currentTarget.allocations);
            }
        } catch (err) {
            console.error('Assignment update failed', err);
            alert('정보 업데이트에 실패했습니다. 다시 시도해 주세요.');
            loadData({ force: true });
        }
    }, [employees, triggerAutoAllocation, loadData]);

    const handleUnassignMember = useCallback((assignmentId, memberName) => {
        setConfirmConfig({
            isOpen: true,
            title: '배정 해제 확인',
            message: `${memberName}님을 이 프로젝트에서 배정 해제하시겠습니까? (입력된 MM 정보가 모두 삭제됩니다)`,
            onConfirm: async () => {
                try {
                    await projectsAPI.removeMember(assignmentId);
                    setData(prev => prev.map(p => ({
                        ...p,
                        members: p.members.filter(m => m.id !== assignmentId)
                    })));
                } catch (err) {
                    console.error('Unassign failed:', err);
                    alert('인원 제외에 실패했습니다.');
                }
            },
            type: 'danger'
        });
    }, [setConfirmConfig]);

    const handleAddProject = async (newProjectData) => {
        try {
            const existingProject = data.find(p => p.name === newProjectData.name);
            if (existingProject) {
                if (viewMode === 'group') {
                    setSelectedProject(existingProject);
                    setModalSearchTerm('');
                    setShowMemberModal(true);
                    setShowProjectModal(false);
                    return;
                }
                alert('이미 보드에 추가된 프로젝트입니다.');
                return;
            }

            await projectsAPI.create(newProjectData);
            setShowProjectModal(false);
            dataCache.invalidateProjects();
            loadData({ force: true });
        } catch (err) {
            console.error('Failed to create project:', err);
            alert('프로젝트 추가 중 오류가 발생했습니다.');
        }
    };

    const loadMasterData = useCallback(async () => {
        setMasterDataLoading(true);
        try {
            const [projData, empData] = await Promise.all([
                dataCache.getProjects(),
                dataCache.getEmployees({ status: 'active' }),
            ]);
            setAllMasterProjects(projData);
            setEmployees([...empData].sort((a, b) => a.name.localeCompare(b.name, 'ko')));
        } catch (err) {
            console.error('Failed to load master data:', err);
        } finally {
            setMasterDataLoading(false);
        }
    }, [dataCache]);

    const handleOpenProjectModal = () => {
        setShowProjectModal(true);
        loadMasterData();
    };

    const openExcelCalPicker = (type, e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setExcelCalRect(rect);
        setShowExcelCalPicker(type);
        
        const currentVal = type === 'start' ? exportStartDate : exportEndDate;
        const d = new Date(currentVal);
        if (!isNaN(d.getTime())) {
            setExcelCalYear(d.getFullYear());
            setExcelCalMonth(d.getMonth());
        } else {
            const today = new Date();
            setExcelCalYear(today.getFullYear());
            setExcelCalMonth(today.getMonth());
        }
    };

    const handleDownloadExcel = useCallback(async () => {
        if (isDownloading) return;
        setIsDownloading(true);

        try {
            // Filter weeks within period
            const filteredWeeks = weeks.filter(w => {
                const wStr = format(w, 'yyyy-MM-dd');
                return wStr >= exportStartDate && wStr <= exportEndDate;
            });

            if (filteredWeeks.length === 0) {
                alert('선택한 기간에 해당하는 주차가 없습니다.');
                setIsDownloading(false);
                return;
            }

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('프로젝트 인력 배정 현황');

            // Header row style configuration
            const headerRow = [
                '프로젝트명',
                '부서',
                '이름',
                '투입 시작일',
                '투입 종료일',
                ...filteredWeeks.map(w => format(w, 'yy-MM-dd'))
            ];
            
            worksheet.addRow(headerRow);

            // Style headers
            const headerLine = worksheet.getRow(1);
            headerLine.height = 28;
            headerLine.eachCell((cell, colNumber) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE2E8F0' } // Light slate gray
                };
                cell.font = {
                    name: 'Malgun Gothic',
                    bold: true,
                    size: 10,
                    color: { argb: 'FF1E293B' }
                };
                cell.alignment = {
                    vertical: 'middle',
                    horizontal: 'center'
                };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
                    right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
                };
            });

            // Write project members allocation data
            dataRef.current.forEach(proj => {
                // If hiding completed projects, skip
                if (!showCompleted && proj.status === 'completed') return;
                // If project is hidden by filter, skip
                if (hiddenProjectIds.includes(proj.id)) return;

                proj.members.forEach(member => {
                    const rowData = [
                        proj.name,
                        member.group_name || '',
                        member.name || '',
                        member.input_start_date || '',
                        member.input_end_date || '',
                        ...filteredWeeks.map(w => {
                            const dateKey = format(w, 'yyyy-MM-dd');
                            const val = member.allocations?.[dateKey];
                            return val && !isNaN(parseFloat(val)) ? parseFloat(val) : '';
                        })
                    ];

                    worksheet.addRow(rowData);
                });
            });

            // Style data rows
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; // Skip header

                row.height = 22;
                row.eachCell((cell, colNumber) => {
                    cell.font = {
                        name: 'Malgun Gothic',
                        size: 9,
                        color: { argb: 'FF334155' }
                    };
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                    };

                    if (colNumber <= 5) {
                        cell.alignment = {
                            vertical: 'middle',
                            horizontal: colNumber === 1 ? 'left' : 'center'
                        };
                    } else {
                        // Allocation cells
                        cell.alignment = {
                            vertical: 'middle',
                            horizontal: 'center'
                        };
                        // Color allocation cells if > 0
                        const val = parseFloat(cell.value);
                        if (val > 0) {
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFE0F2FE' } // Very light sky blue
                            };
                            cell.font = {
                                name: 'Malgun Gothic',
                                bold: true,
                                size: 9,
                                color: { argb: 'FF0369A1' } // Ocean blue text
                            };
                        }
                    }
                });
            });

            // Set column widths
            worksheet.columns.forEach((col, idx) => {
                if (idx === 0) col.width = 32; // Project Name
                else if (idx === 1) col.width = 12; // Group
                else if (idx === 2) col.width = 10; // Member Name
                else if (idx === 3 || idx === 4) col.width = 13; // Date columns
                else col.width = 8; // Allocation columns
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `프로젝트배정현황_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`);

        } catch (err) {
            console.error('Failed to export Excel:', err);
            alert('엑셀 추출 중 오류가 발생했습니다.');
        } finally {
            setIsDownloading(false);
        }
    }, [weeks, exportStartDate, exportEndDate, isDownloading, showCompleted, hiddenProjectIds]);

    return {
        user,
        canEdit,
        data, setData, dataRef,
        employees, setEmployees,
        weeks, setWeeks,
        cursor, setCursor,
        cellRefs,
        loading, setLoading,
        assigningProjects,
        visibleColRange, setVisibleColRange,
        showProjectModal, setShowProjectModal,
        showMemberModal, setShowMemberModal,
        selectedProject, setSelectedProject,
        startDate, setStartDate,
        viewMode, setViewMode,
        selectedGroup, setSelectedGroup,
        hiddenProjectIds, setHiddenProjectIds,
        showHideManager, setShowHideManager,
        isGroupTransitioning, startGroupTransition,
        tableContainerRef,
        sliderRef,
        visibleDateRef,
        isScrollingRef,
        hasAutoScrolled,
        modalSearchTerm, setModalSearchTerm,
        projectSearchTerm, setProjectSearchTerm,
        inlineInputRect, setInlineInputRect,
        allMasterProjects, setAllMasterProjects,
        masterDataLoading, setMasterDataLoading,
        showSettings, setShowSettings,
        settingsRef,
        showGroupDropdown, setShowGroupDropdown,
        groupDropdownRef,
        exportStartDate, setExportStartDate,
        exportEndDate, setExportEndDate,
        isDownloading, setIsDownloading,
        showExcelCalPicker, setShowExcelCalPicker,
        excelCalRect, setExcelCalRect,
        excelCalYear, setExcelCalYear,
        excelCalMonth, setExcelCalMonth,
        visibleDate, setVisibleDate,
        showCalendarPicker, setShowCalendarPicker,
        calendarPickerRect, setCalendarPickerRect,
        calPickerYear, setCalPickerYear,
        calPickerMonth, setCalPickerMonth,
        hoveredWeekIdx, setHoveredWeekIdx,
        isMobile,
        showCompleted, setShowCompleted,
        expandedCompletedProjects, setExpandedCompletedProjects,
        isCompletedSectionExpanded, setIsCompletedSectionExpanded,
        hideManagerRef,

        // Actions
        loadData,
        triggerAutoAllocation,
        handleAssignmentUpdate,
        handleUnassignMember,
        handleAddProject,
        loadMasterData,
        handleOpenProjectModal,
        openExcelCalPicker,
        handleDownloadExcel
    };
};
