import React, { useState, useEffect, useRef, useCallback, useMemo, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { projectsAPI } from '../api';
import { ChevronLeft, ChevronRight, Calendar, Settings, Plus, LayoutGrid, LayoutDashboard, Users, Search, X, Check, ChevronDown, Briefcase, Clock, User, AlertCircle, Shield, Key, FileDown, Eye, EyeOff } from 'lucide-react';
import { format, addWeeks, addDays, startOfWeek, endOfWeek, eachWeekOfInterval, parseISO, isWithinInterval, startOfDay, endOfDay, areIntervalsOverlapping, isAfter, isBefore } from 'date-fns';
import { ko } from 'date-fns/locale';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useDataCache } from '../context/DataCacheContext';
import { hasAccess, MENU_ITEMS } from '../constants/menuConfig';
import { useProjectStatus } from '../hooks/useProjectStatus';

// --- Memoized Sub-components for Performance ---

const AllocationInput = React.memo(({
    val,
    assignmentId,
    week,
    isFocused,
    inRange,
    isCurrent,
    columnWidth,
    onFocus,
    onChange,
    onBlur,
    onKeyDown,
    onPaste,
    onDoubleClick,
    inputRef
}) => {
    // Local state for immediate feedback during typing
    const [localValue, setLocalValue] = React.useState(val);

    // Sync with global state when it changes (e.g., from other rows or load)
    React.useEffect(() => {
        setLocalValue(val);
    }, [val]);

    const handleChange = (e) => {
        setLocalValue(e.target.value);
        onChange(assignmentId, week, e.target.value);
    };

    const handleBlur = (e) => {
        onBlur(assignmentId, week, e.target.value);
    };

    const displayValue = isFocused ? localValue : (localValue && !isNaN(parseFloat(localValue)) ? parseFloat(localValue).toFixed(1) : localValue);

    return (
        <input
            ref={inputRef}
            type="text"
            className={`grid-input ${inRange ? 'in-range' : ''} ${isCurrent ? 'current-week' : ''}`}
            style={{
                border: isFocused ? '2px solid var(--primary)' : 'none',
                backgroundColor: 'transparent',
                fontWeight: localValue ? 'bold' : 'normal',
                color: isCurrent ? '#ef4444' : (inRange ? 'var(--text-primary)' : 'var(--text-muted)'),
                width: '100%',
                height: '100%',
                textAlign: 'center'
            }}
            value={displayValue}
            onChange={handleChange}
            onBlur={handleBlur}
            onFocus={onFocus}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            onDoubleClick={() => onDoubleClick && onDoubleClick(assignmentId, week, localValue)}
            title="더블클릭하여 종료일까지 일괄 채우기"
        />
    );
});

const DateInput = React.memo(({
    val,
    placeholder,
    readOnly,
    isFocused,
    assignmentId,
    field,
    autoFormatDate,
    onUpdate,
    onFocus,
    onKeyDown,
    inputRef
}) => {
    const [localValue, setLocalValue] = React.useState(val || '');

    React.useEffect(() => {
        setLocalValue(val || '');
    }, [val]);

    const handleChange = (e) => {
        const formatted = autoFormatDate(e.target.value);
        setLocalValue(formatted);
    };

    const handleBlur = (e) => {
        console.log(`[DateInput] onBlur triggered. val=${val}, e.target.value=${e.target.value}, localValue=${localValue}`);
        if (e.target.value !== val) {
            console.log(`[DateInput] Value changed, firing onUpdate`);
            onUpdate(assignmentId, field, e.target.value);
        } else {
            console.log(`[DateInput] Value didn't change (strict inequality failed), skipping onUpdate.`);
        }
    };

    return (
        <input
            ref={inputRef}
            type="text"
            className="grid-input"
            placeholder={placeholder}
            readOnly={readOnly}
            style={{
                border: isFocused ? '2px solid var(--primary)' : 'none',
                fontSize: '0.85em',
                textAlign: 'center',
                backgroundColor: readOnly ? 'var(--surface-low)' : 'transparent',
                cursor: readOnly ? 'not-allowed' : 'text'
            }}
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            onFocus={onFocus}
            onKeyDown={onKeyDown}
        />
    );
});

const InlineSearchInput = React.memo(({
    projectId,
    initialTerm = '',
    placeholder = "+ 인원 추가",
    isFocused,
    onSelection,
    onFocus,
    onKeyDown,
    getFilteredEmployees,
    inputRef,
    onCancel,
    handleTBDAssign,
    groupFilter
}) => {
    const [searchTerm, setSearchTerm] = useState(initialTerm);
    const [autoCompleteIdx, setAutoCompleteIdx] = useState(-1);
    const [inputRect, setInputRect] = useState(null);
    const [isOpen, setIsOpen] = useState(false);

    const filteredEmployees = useMemo(() => getFilteredEmployees(projectId, searchTerm, groupFilter), [projectId, searchTerm, getFilteredEmployees, groupFilter]);

    const handleSelect = (empId) => {
        onSelection(projectId, empId);
        setSearchTerm('');
        setIsOpen(false);
    };

    const handleChange = (e) => {
        setSearchTerm(e.target.value);
        setAutoCompleteIdx(-1);
        setIsOpen(true);
        setInputRect(e.target.getBoundingClientRect());
    };

    const handleFocus = (e) => {
        setInputRect(e.target.getBoundingClientRect());
        if (handleTBDAssign) setIsOpen(true);
        if (onFocus) onFocus(e);
    };

    const handleInputKeyDown = (e) => {
        if (e.key === 'Enter' && autoCompleteIdx >= 0 && filteredEmployees[autoCompleteIdx]) {
            e.preventDefault();
            handleSelect(filteredEmployees[autoCompleteIdx].id);
            return;
        }
        if (e.key === 'Escape') {
            setIsOpen(false);
            if (onCancel) onCancel();
            return;
        }
        if (onKeyDown) onKeyDown(e);
    };

    const showDropdown = isOpen && inputRect && (searchTerm || handleTBDAssign);

    return (
        <div className="inline-search-wrapper" style={{ height: '100%' }}>
            <input
                ref={inputRef}
                type="text"
                className="grid-input"
                placeholder={placeholder}
                style={{
                    border: isFocused ? '2px solid var(--primary)' : 'none',
                    fontStyle: 'italic',
                    color: 'var(--text-muted)'
                }}
                value={searchTerm}
                onChange={handleChange}
                onFocus={handleFocus}
                onBlur={() => setTimeout(() => setIsOpen(false), 200)}
                onKeyDown={handleInputKeyDown}
            />
            {showDropdown && createPortal(
                <div
                    className="inline-search-results"
                    style={{
                        position: 'fixed',
                        left: `${inputRect.left}px`,
                        top: `${inputRect.bottom + 4 + 250 > window.innerHeight
                            ? inputRect.top - Math.min((filteredEmployees.length + 2) * 52 + 10, 300) - 4
                            : inputRect.bottom + 4}px`,
                        width: `${Math.max(inputRect.width, 300)}px`,
                        zIndex: 9999
                    }}
                >
                    {handleTBDAssign && (
                        <>
                            <div
                                className="inline-search-item"
                                onClick={() => { handleTBDAssign(projectId, 'Regular'); setIsOpen(false); }}
                                style={{ borderLeft: '3px solid #6366f1', cursor: 'pointer' }}
                            >
                                <div className="flex justify-between items-center">
                                    <strong style={{ color: '#6366f1' }}>TBD — 정규직</strong>
                                    <span style={{ background: '#6366f1', color: 'white', borderRadius: '4px', padding: '1px 6px', fontSize: '0.7em' }}>TBD</span>
                                </div>
                                <div className="text-muted" style={{ fontSize: '0.75em' }}>정규직 플레이스홀더 추가</div>
                            </div>
                            <div
                                className="inline-search-item"
                                onClick={() => { handleTBDAssign(projectId, 'Contract'); setIsOpen(false); }}
                                style={{ borderLeft: '3px solid #f59e0b', cursor: 'pointer' }}
                            >
                                <div className="flex justify-between items-center">
                                    <strong style={{ color: '#f59e0b' }}>TBD — 계약직</strong>
                                    <span style={{ background: '#f59e0b', color: 'white', borderRadius: '4px', padding: '1px 6px', fontSize: '0.7em' }}>TBD</span>
                                </div>
                                <div className="text-muted" style={{ fontSize: '0.75em' }}>계약직 플레이스홀더 추가</div>
                            </div>
                            {(filteredEmployees.length > 0 || searchTerm) && (
                                <div style={{ borderTop: '1px solid var(--border)', padding: '4px 8px', fontSize: '0.7em', color: 'var(--text-muted)' }}>직원 검색 결과</div>
                            )}
                        </>
                    )}
                    {filteredEmployees.map((emp, i) => (
                        <div
                            key={emp.id}
                            className={`inline-search-item ${autoCompleteIdx === i ? 'active' : ''}`}
                            onClick={() => handleSelect(emp.id)}
                            onMouseEnter={() => setAutoCompleteIdx(i)}
                        >
                            <div className="flex justify-between">
                                <strong>{emp.name}</strong>
                                <span className="badge" style={{ backgroundColor: emp.group_color, fontSize: '0.6em' }}>{emp.group_name}</span>
                            </div>
                            <div className="text-muted" style={{ fontSize: '0.75em' }}>{emp.position}</div>
                        </div>
                    ))}
                    {!handleTBDAssign && filteredEmployees.length === 0 && <div className="p-sm text-center text-muted">결과 없음</div>}
                    {handleTBDAssign && searchTerm && filteredEmployees.length === 0 && <div className="p-sm text-center text-muted">직원 검색 결과 없음</div>}
                </div>,
                document.body
            )}
        </div>
    );
});

const MemberRow = React.memo(({
    member,
    project,
    weeks,
    weekDateStrs,
    weekEndStrs,
    currentWeekIdx,
    columnWidths,
    cursor,
    currentMemberIndex,
    getStickyLeft,
    autoFormatDate,
    handleAssignmentUpdate,
    handleAllocationChange,
    handleAllocationBlur,
    handleFillForward,
    handleKeyDown,
    handlePaste,
    handleRemoveMember,
    handleReorderMember,
    setCursor,
    getFilteredEmployees,
    cellRefs,
    mIdx,
    isCompleted,
    leftSpacerWidth,
    rightSpacerWidth,
    visibleStartIdx,
    canEdit
}) => {
    const [swapOpen, setSwapOpen] = React.useState(false);
    const [swapTerm, setSwapTerm] = React.useState('');
    const [swapRect, setSwapRect] = React.useState(null);
    const filteredSwapEmps = useMemo(() => {
        if (!getFilteredEmployees) return [];
        return getFilteredEmployees(project.id, swapTerm || '');
    }, [swapTerm, project.id, getFilteredEmployees]);

    const opacity = isCompleted ? 0.5 : 1;
    const bgColor = isCompleted ? 'var(--surface-low)' : 'var(--bg-primary)';


    return (
        <tr key={`mem-${member.id}`} style={{ opacity, borderBottom: '1px solid var(--border)' }}>
            <td style={{ position: 'sticky', left: getStickyLeft('group', 'project'), zIndex: 10, width: columnWidths.group, backgroundColor: bgColor, borderBottom: '1px solid var(--border)' }}>
                {member.employee_id != null && <span className="badge" style={{ backgroundColor: member.group_color, fontSize: '0.7em' }}>{member.group_name}</span>}
            </td>
            <td style={{ position: 'sticky', left: getStickyLeft('position', 'project'), zIndex: 10, width: columnWidths.position, backgroundColor: bgColor, borderBottom: '1px solid var(--border)' }}>{member.employee_id != null ? member.employee_position : '-'}</td>
            <td style={{ position: 'sticky', left: getStickyLeft('grade', 'project'), zIndex: 10, width: columnWidths.grade, backgroundColor: bgColor, fontSize: '0.8em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{member.employee_id != null ? member.employee_grade : '-'}</td>
            <td style={{ position: 'sticky', left: getStickyLeft('employmentType', 'project'), zIndex: 10, width: columnWidths.employmentType, backgroundColor: bgColor, fontSize: '0.8em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{member.employee_id != null ? member.employee_employment_type : '-'}</td>
            <td style={{ position: 'sticky', left: getStickyLeft('name', 'project'), zIndex: 10, width: columnWidths.name, backgroundColor: bgColor, borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between w-full">
                    {/* Name (clickable to swap employee) */}
                    <div
                        ref={(el) => (cellRefs.current[`${currentMemberIndex}-swap`] = el)}
                        tabIndex={canEdit && !isCompleted ? 0 : -1}
                        className="flex items-center gap-xs"
                        style={{ 
                            padding: '2px 4px', 
                            flex: 1, 
                            minWidth: 0, 
                            cursor: canEdit && !isCompleted ? 'pointer' : 'default',
                            outline: cursor.memberIndex === currentMemberIndex && cursor.weekIndex === 'swap' ? '2px solid var(--primary)' : 'none',
                            borderRadius: '4px'
                        }}
                        onFocus={() => {
                            if (canEdit && !isCompleted) {
                                setCursor({ memberIndex: currentMemberIndex, weekIndex: 'swap' });
                            }
                        }}
                        onClick={(e) => {
                            if (!canEdit || isCompleted) return;
                            setSwapRect(e.currentTarget.getBoundingClientRect());
                            setSwapOpen(true);
                            setSwapTerm('');
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                if (!canEdit || isCompleted) return;
                                setSwapRect(e.currentTarget.getBoundingClientRect());
                                setSwapOpen(true);
                                setSwapTerm('');
                            } else if (e.key === 'ArrowRight') {
                                e.preventDefault();
                                setCursor({ memberIndex: currentMemberIndex, weekIndex: 0 });
                            } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                const prevIdx = Math.max(0, currentMemberIndex - 1);
                                setCursor({ memberIndex: prevIdx, weekIndex: 'swap' });
                            } else if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                const nextIdx = currentMemberIndex + 1;
                                setCursor({ memberIndex: nextIdx, weekIndex: 'swap' });
                            }
                        }}
                        title={canEdit && !isCompleted ? '클릭하여 직원 변경' : undefined}
                    >
                        {member.employee_id == null ? (
                            <span style={{
                                background: member.tbd_employment_type === 'Regular' ? '#6366f1' : '#f59e0b',
                                color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75em', whiteSpace: 'nowrap'
                            }}>
                                TBD — {member.tbd_employment_type === 'Regular' ? '정규직' : '계약직'}
                            </span>
                        ) : (
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.employee_name}</span>
                        )}
                    </div>
                    {/* Swap dropdown */}
                    {swapOpen && swapRect && createPortal(
                        <div
                            className="inline-search-results"
                            style={{
                                position: 'fixed',
                                left: `${swapRect.left}px`,
                                top: `${swapRect.bottom + 4}px`,
                                width: `${Math.max(swapRect.width, 280)}px`,
                                zIndex: 9999
                            }}
                        >
                            <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', fontSize: '0.78em', color: 'var(--text-muted)' }}>직원 변경 (검색)</div>
                            <div style={{ padding: '4px 8px' }}>
                                <input
                                    type="text"
                                    autoFocus
                                    className="grid-input"
                                    placeholder="이름 또는 소속 검색..."
                                    style={{ border: '1px solid var(--border)', borderRadius: '4px', width: '100%', padding: '4px 8px', fontSize: '0.85em' }}
                                    value={swapTerm}
                                    onChange={(e) => setSwapTerm(e.target.value)}
                                    onBlur={() => setTimeout(() => setSwapOpen(false), 200)}
                                    onKeyDown={(e) => { if (e.key === 'Escape') setSwapOpen(false); }}
                                />
                            </div>
                            {filteredSwapEmps.map(emp => (
                                <div
                                    key={emp.id}
                                    className="inline-search-item"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        handleAssignmentUpdate(member.id, 'employee_id', emp.id);
                                        setSwapOpen(false);
                                    }}
                                >
                                    <div className="flex justify-between">
                                        <strong>{emp.name}</strong>
                                        <span className="badge" style={{ backgroundColor: emp.group_color, fontSize: '0.6em' }}>{emp.group_name}</span>
                                    </div>
                                    <div className="text-muted" style={{ fontSize: '0.75em' }}>{emp.position}</div>
                                </div>
                            ))}
                            {swapTerm && filteredSwapEmps.length === 0 && <div className="p-sm text-center text-muted" style={{ fontSize: '0.85em' }}>결과 없음</div>}
                        </div>,
                        document.body
                    )}
                    {/* Reorder arrows (after name) + delete */}
                    <div className="flex items-center" style={{ gap: 0 }}>
                        {canEdit && (
                            <div className="flex flex-col" style={{ fontSize: '0.8em', color: 'var(--text-muted)', lineHeight: 1 }}>
                                <button
                                    onClick={() => handleReorderMember(project.id, member.id, 'up')}
                                    disabled={mIdx === 0}
                                    className="reorder-btn"
                                    title="위로 이동"
                                >▲</button>
                                <button
                                    onClick={() => handleReorderMember(project.id, member.id, 'down')}
                                    disabled={mIdx === project.members.length - 1}
                                    className="reorder-btn"
                                    title="아래로 이동"
                                >▼</button>
                            </div>
                        )}
                        {!isCompleted && canEdit && (
                            <button
                                onClick={() => handleRemoveMember(project.id, member.id, member.employee_id == null ? `TBD (${member.tbd_employment_type === 'Regular' ? '정규직' : '계약직'})` : member.employee_name)}
                                className="reorder-btn hover-danger"
                                title="배정 해제"
                                style={{ marginLeft: '2px', opacity: 0.5 }}
                            >🗑️</button>
                        )}
                    </div>
                </div>
            </td>
            <td style={{ position: 'sticky', left: getStickyLeft('workLocation', 'project'), zIndex: 10, width: columnWidths.workLocation, backgroundColor: bgColor, padding: 0, borderBottom: '1px solid var(--border)' }}>
                <select
                    className="grid-input"
                    style={{ fontSize: '0.85em', textAlign: 'center', backgroundColor: isCompleted ? 'transparent' : '', borderBottom: 'none' }}
                    value={member.work_location || ''}
                    onChange={(e) => handleAssignmentUpdate(member.id, 'work_location', e.target.value)}
                    disabled={isCompleted}
                >
                    <option value="">-</option>
                    <option value="Dispatch">파견</option>
                    <option value="In-house">내근</option>
                </select>
            </td>
            <td style={{ position: 'sticky', left: getStickyLeft('startDate', 'project'), zIndex: 10, width: columnWidths.startDate, backgroundColor: bgColor, padding: 0, borderLeft: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                <DateInput
                    inputRef={(el) => (cellRefs.current[`${currentMemberIndex}-0`] = el)}
                    val={member.input_start_date}
                    placeholder={project.type === 'Annual' || isCompleted ? '-' : "YYYY-MM-DD"}
                    readOnly={project.type === 'Annual' || isCompleted}
                    isFocused={cursor.memberIndex === currentMemberIndex && cursor.weekIndex === 0}
                    assignmentId={member.id}
                    field="input_start_date"
                    autoFormatDate={autoFormatDate}
                    onUpdate={handleAssignmentUpdate}
                    onFocus={() => setCursor({ memberIndex: currentMemberIndex, weekIndex: 0 })}
                    onKeyDown={(e) => handleKeyDown(e, currentMemberIndex, 0)}
                />
            </td>
            <td style={{ position: 'sticky', left: getStickyLeft('endDate', 'project'), zIndex: 10, width: columnWidths.endDate, backgroundColor: bgColor, padding: 0, borderBottom: '1px solid var(--border)' }}>
                <DateInput
                    inputRef={(el) => (cellRefs.current[`${currentMemberIndex}-1`] = el)}
                    val={member.input_end_date}
                    placeholder={project.type === 'Annual' || isCompleted ? '-' : "YYYY-MM-DD"}
                    readOnly={project.type === 'Annual' || isCompleted}
                    isFocused={cursor.memberIndex === currentMemberIndex && cursor.weekIndex === 1}
                    assignmentId={member.id}
                    field="input_end_date"
                    autoFormatDate={autoFormatDate}
                    onUpdate={handleAssignmentUpdate}
                    onFocus={() => setCursor({ memberIndex: currentMemberIndex, weekIndex: 1 })}
                    onKeyDown={(e) => handleKeyDown(e, currentMemberIndex, 1)}
                />
            </td>

            {leftSpacerWidth > 0 && <td style={{ minWidth: leftSpacerWidth, width: leftSpacerWidth, borderBottom: '1px solid var(--border)' }} />}
            {
                weeks.map((week, weekIndex) => {
                    const dateStr = weekDateStrs[weekIndex];
                    const wEnd = weekEndStrs[weekIndex];
                    const val = member.allocations?.[dateStr] || '';
                    const globalWeekIdx = (visibleStartIdx + weekIndex) + 2;
                    const isFocused = cursor.memberIndex === currentMemberIndex && cursor.weekIndex === globalWeekIdx;
                    const inRange = project.type === 'Annual'
                        ? true
                        : (!!member.input_start_date && !!member.input_end_date
                            && member.input_start_date <= wEnd && member.input_end_date >= dateStr);
                    const isCurrent = weekIndex === currentWeekIdx;

                    return (
                        <td key={dateStr} style={{
                            padding: '0',
                            minWidth: `${columnWidths.week}px`,
                            maxWidth: `${columnWidths.week}px`,
                            borderLeft: '1px solid var(--border)',
                            backgroundColor: isCurrent ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
                            borderRight: isCurrent ? '2px solid #ef4444' : 'none',
                            borderBottom: '1px solid var(--border)',
                            overflow: 'hidden'
                        }}>
                            <AllocationInput
                                inputRef={(el) => (cellRefs.current[`${currentMemberIndex}-${globalWeekIdx}`] = el)}
                                val={val}
                                assignmentId={member.id}
                                week={week}
                                isFocused={isFocused && !isCompleted}
                                inRange={inRange}
                                isCurrent={isCurrent}
                                columnWidth={columnWidths.week}
                                onFocus={() => !isCompleted && setCursor({ memberIndex: currentMemberIndex, weekIndex: globalWeekIdx })}
                                onChange={(id, wk, v) => !isCompleted && handleAllocationChange(id, wk, v)}
                                onBlur={(id, wk, v) => !isCompleted && handleAllocationBlur(id, wk, v)}
                                onDoubleClick={(id, wk, v) => !isCompleted && handleFillForward(id, wk, v)}
                                onKeyDown={(e) => !isCompleted && handleKeyDown(e, currentMemberIndex, globalWeekIdx)}
                                onPaste={(e) => !isCompleted && handlePaste(e, currentMemberIndex, globalWeekIdx)}
                            />
                        </td>
                    );
                })
            }
            {rightSpacerWidth > 0 && <td style={{ minWidth: rightSpacerWidth, width: rightSpacerWidth, borderBottom: '1px solid var(--border)' }} />}
        </tr>
    );
});


// GroupMemberRow — 그룹별 탭 행 (컬럼 순서: 소속·직급·등급·고용·이름)
const GroupMemberRow = React.memo(({
    assignment,
    weeks,
    weekDateStrs,
    weekEndStrs,
    currentWeekIdx,
    columnWidths,
    cursor,
    currentMemberIndex,
    getStickyLeft,
    autoFormatDate,
    handleAssignmentUpdate,
    handleAllocationChange,
    handleAllocationBlur,
    handleFillForward,
    handleKeyDown,
    handlePaste,
    handleRemoveMember,
    handleReorderMember,
    projectId,
    projectMemberCount,
    mIdx,
    setCursor,
    getFilteredEmployees,
    cellRefs,
    leftSpacerWidth,
    rightSpacerWidth,
    canEdit
}) => {
    // Inline employee swap state
    const [swapOpen, setSwapOpen] = useState(false);
    const [swapTerm, setSwapTerm] = useState('');
    const swapRef = React.useRef(null);
    const [swapRect, setSwapRect] = useState(null);

    const filteredSwapEmps = useMemo(() => {
        if (!getFilteredEmployees) return [];
        return getFilteredEmployees(projectId, swapTerm || '');
    }, [swapTerm, projectId, getFilteredEmployees]);

    const openSwap = (e) => {
        if (!canEdit) return;
        setSwapRect(e.currentTarget.getBoundingClientRect());
        setSwapOpen(true);
        setSwapTerm('');
    };

    return (
        <tr key={assignment.id} style={{ borderBottom: '1px solid var(--border)' }}>
            {/* 소속 */}
            <td style={{ position: 'sticky', left: getStickyLeft('group', 'group'), zIndex: 10, width: columnWidths.group, backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border)' }}>
                {assignment.employee_id != null && <span className="badge" style={{ backgroundColor: assignment.group_color, fontSize: '0.7em' }}>{assignment.group_name}</span>}
            </td>
            {/* 직급 */}
            <td style={{ position: 'sticky', left: getStickyLeft('position', 'group'), zIndex: 10, width: columnWidths.position, backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', padding: assignment.employee_id == null ? 0 : undefined }}>
                {assignment.employee_id == null ? (
                    <select className="grid-input" style={{ fontSize: '0.85em', textAlign: 'center' }}
                        value={assignment.tbd_position || ''}
                        onChange={(e) => handleAssignmentUpdate(assignment.id, 'tbd_position', e.target.value)}>
                        <option value="">-</option>
                        <option value="사원">사원</option>
                        <option value="대리">대리</option>
                        <option value="과장">과장</option>
                        <option value="차장">차장</option>
                        <option value="부장">부장</option>
                        <option value="이사">이사</option>
                        <option value="상무">상무</option>
                        <option value="대표이사">대표이사</option>
                    </select>
                ) : assignment.employee_position}
            </td>
            {/* 등급 */}
            <td style={{ position: 'sticky', left: getStickyLeft('grade', 'group'), zIndex: 10, width: columnWidths.grade, backgroundColor: 'var(--bg-primary)', fontSize: '0.8em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', padding: assignment.employee_id == null ? 0 : undefined }}>
                {assignment.employee_id == null ? (
                    <select className="grid-input" style={{ fontSize: '0.85em', textAlign: 'center' }}
                        value={assignment.tbd_grade || ''}
                        onChange={(e) => handleAssignmentUpdate(assignment.id, 'tbd_grade', e.target.value)}>
                        <option value="">-</option>
                        <option value="초급">초급</option>
                        <option value="중급">중급</option>
                        <option value="고급">고급</option>
                        <option value="특급">특급</option>
                    </select>
                ) : assignment.employee_grade}
            </td>
            {/* 고용 */}
            <td style={{ position: 'sticky', left: getStickyLeft('employmentType', 'group'), zIndex: 10, width: columnWidths.employmentType, backgroundColor: 'var(--bg-primary)', fontSize: '0.8em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                {assignment.employee_id == null ? '-' : assignment.employee_employment_type}
            </td>
            {/* 이름 + 화살표 */}
            <td style={{ position: 'sticky', left: getStickyLeft('name', 'group'), zIndex: 10, width: columnWidths.name, backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between w-full">
                    <div
                        ref={(el) => (cellRefs.current[`${currentMemberIndex}-swap`] = el)}
                        tabIndex={canEdit ? 0 : -1}
                        className="flex items-center gap-xs"
                        style={{ 
                            padding: '2px 4px', 
                            cursor: canEdit ? 'pointer' : 'default', 
                            flex: 1, 
                            minWidth: 0,
                            outline: cursor.memberIndex === currentMemberIndex && cursor.weekIndex === 'swap' ? '2px solid var(--primary)' : 'none',
                            borderRadius: '4px'
                        }}
                        onFocus={() => {
                            if (canEdit) {
                                setCursor({ memberIndex: currentMemberIndex, weekIndex: 'swap' });
                            }
                        }}
                        onClick={openSwap}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                openSwap(e);
                            } else if (e.key === 'ArrowRight') {
                                e.preventDefault();
                                setCursor({ memberIndex: currentMemberIndex, weekIndex: 0 });
                            } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                const prevIdx = Math.max(0, currentMemberIndex - 1);
                                setCursor({ memberIndex: prevIdx, weekIndex: 'swap' });
                            } else if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                const nextIdx = currentMemberIndex + 1;
                                setCursor({ memberIndex: nextIdx, weekIndex: 'swap' });
                            }
                        }}
                        title={canEdit ? '클릭하여 직원 변경' : undefined}
                    >
                        {assignment.employee_id == null ? (
                            <span style={{
                                background: assignment.tbd_employment_type === 'Regular' ? '#6366f1' : '#f59e0b',
                                color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75em', whiteSpace: 'nowrap'
                            }}>
                                TBD — {assignment.tbd_employment_type === 'Regular' ? '정규직' : '계약직'}
                            </span>
                        ) : (
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{assignment.employee_name}</span>
                        )}
                    </div>
                    <div className="flex items-center" style={{ gap: 0 }}>
                        {canEdit && (
                            <div className="flex flex-col" style={{ fontSize: '0.8em', color: 'var(--text-muted)', lineHeight: 1 }}>
                                <button
                                    onClick={() => handleReorderMember(projectId, assignment.id, 'up')}
                                    disabled={mIdx === 0}
                                    className="reorder-btn"
                                    title="위로 이동"
                                >▲</button>
                                <button
                                    onClick={() => handleReorderMember(projectId, assignment.id, 'down')}
                                    disabled={mIdx === projectMemberCount - 1}
                                    className="reorder-btn"
                                    title="아래로 이동"
                                >▼</button>
                            </div>
                        )}
                        {canEdit && (
                            <button
                                onClick={() => handleRemoveMember(projectId, assignment.id, assignment.employee_id == null ? `TBD (${assignment.tbd_employment_type === 'Regular' ? '정규직' : '계약직'})` : assignment.employee_name)}
                                className="reorder-btn hover-danger"
                                title="배정 해제"
                                style={{ marginLeft: '2px', opacity: 0.5 }}
                            >🗑️</button>
                        )}
                    </div>
                </div>
                {/* Employee swap dropdown */}
                {swapOpen && swapRect && createPortal(
                    <div
                        className="inline-search-results"
                        style={{
                            position: 'fixed',
                            left: `${swapRect.left}px`,
                            top: `${swapRect.bottom + 4}px`,
                            width: `${Math.max(swapRect.width, 280)}px`,
                            zIndex: 9999
                        }}
                    >
                        <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', fontSize: '0.78em', color: 'var(--text-muted)' }}>
                            직원 변경 (검색)
                        </div>
                        <div style={{ padding: '4px 8px' }}>
                            <input
                                type="text"
                                autoFocus
                                className="grid-input"
                                placeholder="이름 또는 소속 검색..."
                                style={{ border: '1px solid var(--border)', borderRadius: '4px', width: '100%', padding: '4px 8px', fontSize: '0.85em' }}
                                value={swapTerm}
                                onChange={(e) => setSwapTerm(e.target.value)}
                                onBlur={() => setTimeout(() => setSwapOpen(false), 200)}
                                onKeyDown={(e) => { if (e.key === 'Escape') setSwapOpen(false); }}
                            />
                        </div>
                        {filteredSwapEmps.map(emp => (
                            <div
                                key={emp.id}
                                className="inline-search-item"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleAssignmentUpdate(assignment.id, 'employee_id', emp.id);
                                    setSwapOpen(false);
                                }}
                            >
                                <div className="flex justify-between">
                                    <strong>{emp.name}</strong>
                                    <span className="badge" style={{ backgroundColor: emp.group_color, fontSize: '0.6em' }}>{emp.group_name}</span>
                                </div>
                                <div className="text-muted" style={{ fontSize: '0.75em' }}>{emp.position}</div>
                            </div>
                        ))}
                        {swapTerm && filteredSwapEmps.length === 0 && <div className="p-sm text-center text-muted" style={{ fontSize: '0.85em' }}>결과 없음</div>}
                    </div>,
                    document.body
                )}
            </td>
            {/* 근무 */}
            <td style={{ position: 'sticky', left: getStickyLeft('workLocation', 'group'), zIndex: 10, width: columnWidths.workLocation, backgroundColor: 'var(--bg-primary)', padding: 0, borderBottom: '1px solid var(--border)' }}>
                <select
                    className="grid-input"
                    style={{ fontSize: '0.85em', textAlign: 'center' }}
                    value={assignment.work_location || ''}
                    onChange={(e) => handleAssignmentUpdate(assignment.id, 'work_location', e.target.value)}
                >
                    <option value="">-</option>
                    <option value="Dispatch">파견</option>
                    <option value="In-house">내근</option>
                </select>
            </td>
            {/* 투입일 */}
            <td style={{ position: 'sticky', left: getStickyLeft('startDate', 'group'), zIndex: 10, width: columnWidths.startDate, backgroundColor: 'var(--bg-primary)', padding: 0, borderLeft: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                <DateInput
                    inputRef={(el) => (cellRefs.current[`${currentMemberIndex}-0`] = el)}
                    val={assignment.input_start_date}
                    placeholder={assignment.project_type === 'Annual' ? '-' : "YYYY-MM-DD"}
                    readOnly={assignment.project_type === 'Annual'}
                    isFocused={cursor.memberIndex === currentMemberIndex && cursor.weekIndex === 0}
                    assignmentId={assignment.id}
                    field="input_start_date"
                    autoFormatDate={autoFormatDate}
                    onUpdate={handleAssignmentUpdate}
                    onFocus={() => setCursor({ memberIndex: currentMemberIndex, weekIndex: 0 })}
                    onKeyDown={(e) => handleKeyDown(e, currentMemberIndex, 0)}
                />
            </td>
            {/* 종료일 */}
            <td style={{ position: 'sticky', left: getStickyLeft('endDate', 'group'), zIndex: 10, width: columnWidths.endDate, backgroundColor: 'var(--bg-primary)', padding: 0, borderBottom: '1px solid var(--border)' }}>
                <DateInput
                    inputRef={(el) => (cellRefs.current[`${currentMemberIndex}-1`] = el)}
                    val={assignment.input_end_date}
                    placeholder={assignment.project_type === 'Annual' ? '-' : "YYYY-MM-DD"}
                    readOnly={assignment.project_type === 'Annual'}
                    isFocused={cursor.memberIndex === currentMemberIndex && cursor.weekIndex === 1}
                    assignmentId={assignment.id}
                    field="input_end_date"
                    autoFormatDate={autoFormatDate}
                    onUpdate={handleAssignmentUpdate}
                    onFocus={() => setCursor({ memberIndex: currentMemberIndex, weekIndex: 1 })}
                    onKeyDown={(e) => handleKeyDown(e, currentMemberIndex, 1)}
                />
            </td>

            {leftSpacerWidth > 0 && <td style={{ width: leftSpacerWidth, backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border)' }} />}
            {weeks.map((week, weekIndex) => {
                const dateStr = weekDateStrs[weekIndex];
                const wEnd = weekEndStrs[weekIndex];
                const val = assignment.allocations?.[dateStr] || '';
                const globalWeekIdx = weekIndex + 2;
                const isFocused = cursor.memberIndex === currentMemberIndex && cursor.weekIndex === globalWeekIdx;
                const inRange = assignment.project_type === 'Annual'
                    ? true
                    : (!!assignment.input_start_date && !!assignment.input_end_date
                        && assignment.input_start_date <= wEnd && assignment.input_end_date >= dateStr);
                const isCurrent = weekIndex === currentWeekIdx;

                return (
                    <td key={dateStr} style={{
                        padding: '0',
                        minWidth: `${columnWidths.week}px`,
                        maxWidth: `${columnWidths.week}px`,
                        borderLeft: '1px solid var(--border)',
                        backgroundColor: isCurrent ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
                        borderRight: isCurrent ? '2px solid #ef4444' : 'none',
                        borderBottom: '1px solid var(--border)',
                        overflow: 'hidden'
                    }}>
                        <AllocationInput
                            inputRef={(el) => (cellRefs.current[`${currentMemberIndex}-${globalWeekIdx}`] = el)}
                            val={val}
                            assignmentId={assignment.id}
                            week={week}
                            isFocused={isFocused}
                            inRange={inRange}
                            isCurrent={isCurrent}
                            columnWidth={columnWidths.week}
                            onFocus={() => setCursor({ memberIndex: currentMemberIndex, weekIndex: globalWeekIdx })}
                            onChange={handleAllocationChange}
                            onBlur={handleAllocationBlur}
                            onDoubleClick={handleFillForward}
                            onKeyDown={(e) => handleKeyDown(e, currentMemberIndex, globalWeekIdx)}
                            onPaste={(e) => handlePaste(e, currentMemberIndex, globalWeekIdx)}
                        />
                    </td>
                );
            })}
            {rightSpacerWidth > 0 && <td style={{ width: rightSpacerWidth, backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border)' }} />}
        </tr>
    );
});


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

const InlineAddRow = React.memo(({
    project,
    weeks,
    columnWidths,
    viewMode,
    getStickyLeft,
    isCurrentWeek,
    cursor,
    addRowIndex,
    handleInlineAssign,
    handleTBDAssign,
    getFilteredEmployees,
    setCursor,
    cellRefs,
    leftSpacerWidth,
    rightSpacerWidth,
    groupFilter
}) => {
    return (
        <tr style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
            <td colSpan={4} style={{ position: 'sticky', left: 0, zIndex: 10, backgroundColor: 'var(--bg-primary)', height: '28px', borderBottom: '1px solid var(--border)' }}></td>
            <td style={{ position: 'sticky', left: getStickyLeft('name', viewMode), zIndex: 100, width: columnWidths.name, backgroundColor: 'var(--bg-primary)', padding: 0, height: '28px', borderBottom: '1px solid var(--border)' }}>
                <InlineSearchInput
                    inputRef={(el) => (cellRefs.current[`${addRowIndex}-0`] = el)}
                    projectId={project.id}
                    isFocused={cursor.memberIndex === addRowIndex && cursor.weekIndex === 0}
                    onSelection={handleInlineAssign}
                    onFocus={() => {
                        setCursor({ memberIndex: addRowIndex, weekIndex: 0 });
                    }}
                    getFilteredEmployees={getFilteredEmployees}
                    handleTBDAssign={handleTBDAssign}
                    groupFilter={groupFilter}
                />
            </td>
            <td colSpan={3} style={{ position: 'sticky', left: getStickyLeft('workLocation', viewMode), zIndex: 10, backgroundColor: 'var(--bg-primary)', height: '28px', borderBottom: '1px solid var(--border)' }}></td>
            {leftSpacerWidth > 0 && <td style={{ width: leftSpacerWidth, backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border)' }} />}
            {weeks.map(week => (
                <td key={format(week, 'yyyy-MM-dd')} style={{
                    minWidth: `${columnWidths.week}px`,
                    maxWidth: `${columnWidths.week}px`,
                    height: '28px',
                    borderLeft: '1px solid var(--border)',
                    borderBottom: '1px solid var(--border)',
                    backgroundColor: isCurrentWeek(week) ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
                    borderRight: isCurrentWeek(week) ? '2px solid #ef4444' : 'none'
                }}></td>
            ))}
            {(rightSpacerWidth || 0) > 0 && <td style={{ width: rightSpacerWidth, height: '28px', borderBottom: '1px solid var(--border)' }} />}
        </tr>
    );
});


// Intersection Observer를 활용한 세로축(행) 지연 렌더링 wrapper
const LazyProjectRowWrapper = React.memo(({ children, estimatedHeight = 100 }) => {
    const [isIntersecting, setIsIntersecting] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsIntersecting(entry.isIntersecting);
            },
            {
                root: null, // Viewport 기준
                rootMargin: '400px 0px 400px 0px', // 상하 버퍼 400px을 주어 스크롤 시 이질감 최소화
                threshold: 0.01
            }
        );

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => {
            if (containerRef.current) {
                observer.unobserve(containerRef.current);
            }
        };
    }, []);

    return (
        <tbody ref={containerRef}>
            {isIntersecting ? (
                children
            ) : (
                // 화면 밖일 때는 뼈대(최소 높이를 가진 행)만 렌더링하여 DOM 트리 노드 수 최소화
                <tr>
                    <td colSpan={150} style={{ height: `${estimatedHeight}px`, border: 'none', background: 'transparent' }} />
                </tr>
            )}
        </tbody>
    );
});


// Sub-components for better organization and section management
const ProjectItem = React.memo(({
    project,
    pIdx,
    dataLength,
    isCompleted,
    isExpanded,
    onToggleExpand,
    weeks,
    weekDateStrs,
    weekEndStrs,
    currentWeekIdx,
    columnWidths,
    cursor,
    setCursor,
    cellRefs,
    highlightMatch,
    projectSearchTerm,
    isCurrentWeek,
    handleReorderProject,
    handleDeleteProject,
    handleHideProject,
    getStickyLeft,
    memberStartIndex,
    isDateInRange,
    autoFormatDate,
    handleAssignmentUpdate,
    handleAllocationChange,
    handleAllocationBlur,
    handleFillForward,
    handleKeyDown,
    handlePaste,
    handleRemoveMember,
    handleReorderMember,
    getFilteredEmployees,
    handleInlineAssign,
    handleTBDAssign,
    leftSpacerWidth,
    rightSpacerWidth,
    visibleStartIdx,
    canEdit,
    onToggleCountInStats,
    isAdmin
}) => {
    // If it's a completed project and not expanded, we only show the header
    const showMembers = !isCompleted || isExpanded;
    const opacity = isCompleted ? 0.6 : 1;
    const bgColor = isCompleted ? 'var(--surface-low)' : 'var(--surface-high)';

    return (
        <React.Fragment key={project.id}>
            {/* Project Header Row */}
            <tr key={`proj-h-${project.id}`} style={{ backgroundColor: bgColor, opacity }}>
                <td
                    style={{ position: 'sticky', left: 0, zIndex: 10, backgroundColor: bgColor, fontWeight: 'bold', borderBottom: '1px solid var(--border)' }}
                    colSpan={8}
                >
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-sm">
                            {isCompleted && (
                                <button
                                    onClick={onToggleExpand}
                                    className="reorder-btn"
                                    style={{ transition: 'transform 0.2s', transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                                >▼</button>
                            )}
                            {!isCompleted && canEdit && (
                                <div className="flex flex-col" style={{ fontSize: '0.9em', color: 'var(--text-muted)', lineHeight: 1 }}>
                                    <button
                                        onClick={() => handleReorderProject(project.id, 'up')}
                                        disabled={pIdx === 0}
                                        className="reorder-btn"
                                        title="위로 이동"
                                    >▲</button>
                                    <button
                                        onClick={() => handleReorderProject(project.id, 'down')}
                                        disabled={pIdx === dataLength - 1}
                                        className="reorder-btn"
                                        title="아래로 이동"
                                    >▼</button>
                                </div>
                            )}
                            <div className="flex items-center gap-xs">
                                <strong>{highlightMatch(project.name, projectSearchTerm)}</strong>
                                <span className={`badge ${project.type === 'Internal' ? 'badge-primary' : (project.type === 'Leave' || project.type === 'Annual' ? 'badge-neutral' : 'badge-success')}`} style={{ fontSize: '0.7em', opacity: 0.8 }}>
                                    {project.type || 'Client'}
                                </span>
                                {project.status && (
                                    <span className="badge" style={{
                                        backgroundColor: project.status === '진행중' ? '#16a34a' : project.status === '진행예정' ? '#2563eb' : '#6b7280',
                                        fontSize: '0.7em', opacity: 0.8, color: 'white'
                                    }}>{project.status}</span>
                                )}
                                {project.type === 'Internal' && isAdmin && (
                                    <button
                                        onClick={() => onToggleCountInStats(project.id, project.count_in_stats)}
                                        title={project.count_in_stats ? '통계 포함 중 (클릭 시 제외)' : '통계 제외 중 (클릭 시 포함)'}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center', color: project.count_in_stats ? 'var(--primary)' : 'var(--text-muted)', opacity: project.count_in_stats ? 1 : 0.5 }}
                                    >
                                        {project.count_in_stats ? <Eye size={13} /> : <EyeOff size={13} />}
                                    </button>
                                )}
                            </div>
                        </div>
                        {!isCompleted && canEdit && (
                            <div className="flex items-center gap-xs" style={{ marginRight: '8px' }}>
                                <button
                                    onClick={() => handleHideProject(project.id, project.name)}
                                    className="reorder-btn"
                                    title="프로젝트 숨기기"
                                    style={{ opacity: 0.5 }}
                                >👁️‍🗨️</button>
                                <button
                                    onClick={() => handleDeleteProject(project.id, project.name)}
                                    className="reorder-btn hover-danger"
                                    title="프로젝트 삭제"
                                    style={{ opacity: 0.5 }}
                                >🗑️</button>
                            </div>
                        )}
                    </div>
                </td>
                {leftSpacerWidth > 0 && <td style={{ width: leftSpacerWidth, backgroundColor: bgColor, borderBottom: '1px solid var(--border)' }} />}
                {weeks.map((week, wIdx) => (
                    <td key={wIdx} style={{
                        backgroundColor: bgColor,
                        borderRight: isCurrentWeek(week) ? '2px solid #ef4444' : 'none',
                        borderBottom: '1px solid var(--border)',
                        minWidth: `${columnWidths.week}px`,
                        maxWidth: `${columnWidths.week}px`
                    }}></td>
                ))}
                {rightSpacerWidth > 0 && <td style={{ width: rightSpacerWidth, backgroundColor: bgColor, borderBottom: '1px solid var(--border)' }} />}
            </tr>

            {showMembers && project.members.map((member, mIdx) => {
                const rowIndex = memberStartIndex + mIdx;
                return (
                    <MemberRow
                        key={`mem-${member.id}`}
                        member={member}
                        project={project}
                        isCompleted={isCompleted}
                        currentMemberIndex={rowIndex}
                        mIdx={mIdx}
                        weeks={weeks}
                        weekDateStrs={weekDateStrs}
                        weekEndStrs={weekEndStrs}
                        currentWeekIdx={currentWeekIdx}
                        columnWidths={columnWidths}
                        cursor={cursor}
                        getStickyLeft={getStickyLeft}
                        autoFormatDate={autoFormatDate}
                        handleAssignmentUpdate={handleAssignmentUpdate}
                        handleAllocationChange={handleAllocationChange}
                        handleAllocationBlur={handleAllocationBlur}
                        handleFillForward={handleFillForward}
                        handleKeyDown={handleKeyDown}
                        handlePaste={handlePaste}
                        handleRemoveMember={handleRemoveMember}
                        handleReorderMember={handleReorderMember}
                        setCursor={setCursor}
                        getFilteredEmployees={getFilteredEmployees}
                        cellRefs={cellRefs}
                        handleInlineAssign={handleInlineAssign}
                        leftSpacerWidth={leftSpacerWidth}
                        rightSpacerWidth={rightSpacerWidth}
                        visibleStartIdx={visibleStartIdx}
                        canEdit={canEdit}
                    />
                );
            })}

            {showMembers && !isCompleted && canEdit && (
                <InlineAddRow
                    project={project}
                    addRowIndex={memberStartIndex + project.members.length}
                    weeks={weeks}
                    columnWidths={columnWidths}
                    viewMode="project"
                    getStickyLeft={getStickyLeft}
                    isCurrentWeek={isCurrentWeek}
                    cursor={cursor}
                    handleInlineAssign={handleInlineAssign}
                    handleTBDAssign={handleTBDAssign}
                    getFilteredEmployees={getFilteredEmployees}
                    setCursor={setCursor}
                    cellRefs={cellRefs}
                    leftSpacerWidth={leftSpacerWidth}
                    rightSpacerWidth={rightSpacerWidth}
                />
            )}

            {/* Project Total Row */}
            {showMembers && (
                <tr style={{ height: '32px', borderBottom: '2px solid var(--border)', opacity }}>
                    <td
                        colSpan={8}
                        style={{
                            position: 'sticky',
                            left: 0,
                            zIndex: 10,
                            backgroundColor: 'var(--bg-tertiary)',
                            fontSize: '0.75em',
                            color: 'var(--text-muted)',
                            textAlign: 'right',
                            paddingRight: '12px',
                            fontWeight: 'bold',
                            borderBottom: '2px solid var(--border)'
                        }}
                    >
                        Total MM
                    </td>
                    {leftSpacerWidth > 0 && <td style={{ width: leftSpacerWidth, backgroundColor: 'var(--bg-tertiary)', borderBottom: '2px solid var(--border)' }} />}
                    {weeks.map((week, idx) => {
                        const inRangeMembers = project.members.filter(m =>
                            project.type === 'Annual' ? true : isDateInRange(week, m.input_start_date, m.input_end_date)
                        );
                        const total = inRangeMembers.reduce((sum, m) => sum + parseFloat(m.allocations?.[format(week, 'yyyy-MM-dd')] || 0), 0);
                        const activeCount = inRangeMembers.filter(m => m.allocations?.[format(week, 'yyyy-MM-dd')]).length;
                        return (
                            <td
                                key={idx}
                                style={{
                                    backgroundColor: 'var(--bg-tertiary)',
                                    textAlign: 'center',
                                    fontSize: '0.8em',
                                    fontWeight: 'bold',
                                    color: total > activeCount ? 'var(--danger)' : 'var(--text-primary)',
                                    borderRight: isCurrentWeek(week) ? '2px solid #ef4444' : 'none',
                                    borderBottom: '2px solid var(--border)',
                                    minWidth: `${columnWidths.week}px`,
                                    maxWidth: `${columnWidths.week}px`
                                }}
                            >
                                {total > 0 ? total.toFixed(1) : ''}
                            </td>
                        );
                    })}
                    {rightSpacerWidth > 0 && <td style={{ width: rightSpacerWidth, backgroundColor: 'var(--bg-tertiary)', borderBottom: '2px solid var(--border)' }} />}
                </tr>
            )}
        </React.Fragment>
    );
});

const COL_BUFFER = 8;

const ProjectStatus = () => {
    const [confirmConfig, setConfirmConfig] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null,
        type: 'primary'
    });

    const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false);

    const {
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
    } = useProjectStatus(confirmConfig, setConfirmConfig);

    const mobileDate = useMemo(() => {
        const m = visibleDate.match(/(\d+)월\s*(\d+)일\s*~\s*(?:\d+월\s*)?(\d+)일/);
        if (m) return `${m[1]}/${m[2]}~${m[3]}`;
        return visibleDate;
    }, [visibleDate]);

    const groupOptions = useMemo(() => {
        const uniqueGroups = [...new Set(employees.map(e => e.group_name).filter(Boolean))].sort();
        return [
            ...uniqueGroups.map(g => ({
                id: g,
                name: g,
                color: employees.find(e => e.group_name === g)?.group_color || '#64748b'
            })),
            { id: 'ALL', name: '전체 보기', color: 'var(--primary)' },
        ];
    }, [employees]);

    const currentGroupOpt = useMemo(() => 
        groupOptions.find(opt => opt.id === selectedGroup) || groupOptions[0],
    [groupOptions, selectedGroup]);

    // Close popovers when clicking outside
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

    // Transform data for group-based view
    // Returns: [ { name, color, memberCount, projects: [ { id, name, type, assignments: [...] } ] } ]
    const transformDataByGroup = useCallback(() => {
        const groupMap = {};

        // Initialize groups from employees (captures color, id, and count)
        employees.forEach(emp => {
            const gName = emp.group_name || '미지정';
            if (!groupMap[gName]) {
                groupMap[gName] = {
                    name: gName,
                    color: emp.group_color || '#6b7280',
                    id: emp.group_id || null,
                    projects: {},
                    _employeeIds: new Set()
                };
            }
            groupMap[gName]._employeeIds.add(emp.id);
        });

        // Map project members to groups
        data.forEach(project => {
            if (hiddenProjectIds.includes(project.id)) return;
            project.members.forEach(member => {
                const groupName = member.group_name || '미지정';
                if (!groupMap[groupName]) {
                    groupMap[groupName] = {
                        name: groupName,
                        color: member.group_color || '#6b7280',
                        projects: {},
                        _employeeIds: new Set()
                    };
                }
                // Update color if not set
                if (!groupMap[groupName].color && member.group_color) {
                    groupMap[groupName].color = member.group_color;
                }

                if (!groupMap[groupName].projects[project.id]) {
                    groupMap[groupName].projects[project.id] = {
                        id: project.id,
                        name: project.name,
                        type: project.type,
                        status: project.status,
                        assignments: []
                    };
                }

                groupMap[groupName].projects[project.id].assignments.push({
                    ...member,
                    project_name: project.name,
                    project_id: project.id,
                    project_type: project.type
                });
            });
        });

        const term = projectSearchTerm.trim().toLowerCase();

        // Convert to array, convert inner projects maps to arrays
        const result = Object.values(groupMap).map(g => {
            let filteredProjects = Object.values(g.projects);

            if (term) {
                filteredProjects = filteredProjects.filter(p => {
                    const matchesProject = p.name.toLowerCase().includes(term);
                    const matchesMember = p.assignments.some(a => a.employee_name?.toLowerCase().includes(term));
                    return matchesProject || matchesMember;
                }).map(p => {
                    // If project itself doesn't match, only show matching members
                    if (!p.name.toLowerCase().includes(term)) {
                        return {
                            ...p,
                            assignments: p.assignments.filter(a => a.employee_name?.toLowerCase().includes(term))
                        };
                    }
                    return p;
                });
            }

            const typePriority = { 'Client': 1, 'Internal': 2, 'Annual': 3, 'Leave': 4 };
            filteredProjects.sort((a, b) => {
                const pA = typePriority[a.type] || 99;
                const pB = typePriority[b.type] || 99;
                if (pA !== pB) return pA - pB;
                
                // For Client projects in Assignment menu, Ongoing > Upcoming
                if (a.type === 'Client') {
                    const statusWeights = { '진행중': 1, '진행예정': 2, '종료': 3 };
                    const sA = statusWeights[a.status] || 99;
                    const sB = statusWeights[b.status] || 99;
                    if (sA !== sB) return sA - sB;
                }
                
                return (a.name || '').localeCompare(b.name || '', 'ko');
            });

            return {
                name: g.name,
                color: g.color,
                id: g.id,
                memberCount: g._employeeIds.size,
                projects: filteredProjects
            };
        }).filter(g => g.projects.length > 0);

        return result.sort((a, b) => a.name.localeCompare(b.name));
    }, [data, employees, hiddenProjectIds]);

    const filteredData = useMemo(() => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');

        let processedData = data.filter(p => !hiddenProjectIds.includes(p.id));
        const term = projectSearchTerm.trim().toLowerCase();

        if (term) {
            processedData = data.filter(p => {
                const matchesProject = p.name.toLowerCase().includes(term);
                const matchesMember = p.members.some(m => m.employee_name?.toLowerCase().includes(term));
                return matchesProject || matchesMember;
            }).map(p => {
                // If project name doesn't match, only show matching members
                if (!p.name.toLowerCase().includes(term)) {
                    return {
                        ...p,
                        members: p.members.filter(m => m.employee_name?.toLowerCase().includes(term))
                    };
                }
                return p;
            });
        }

        const active = [];
        const completed = [];

        processedData.forEach(p => {
            // Logic for "Completed": 
            // 1. end_date is in the past
            // 2. No future or current MM allocations (sum of all allocations is 0 or all are in the past)
            // For simplicity: if end_date < today and all members have no future allocations
            const isFinished = p.end_date && p.end_date < todayStr;

            // Further refinement: check if there's any allocation value in the currently visible weeks or future
            let hasCurrentOrFutureAllocation = false;
            p.members.forEach(m => {
                Object.entries(m.allocations || {}).forEach(([dateStr, val]) => {
                    if (dateStr >= todayStr && parseFloat(val) > 0) {
                        hasCurrentOrFutureAllocation = true;
                    }
                });
            });

            if (isFinished && !hasCurrentOrFutureAllocation) {
                completed.push(p);
            } else {
                active.push(p);
            }
        });

        const typePriority = { 'Client': 1, 'Internal': 2, 'Annual': 3, 'Leave': 4 };
        const sortFn = (a, b) => {
            const pA = typePriority[a.type] || 99;
            const pB = typePriority[b.type] || 99;
            if (pA !== pB) return pA - pB;
            
            // For Client projects in Assignment menu, Ongoing > Upcoming
            if (a.type === 'Client') {
                const statusWeights = { '진행중': 1, '진행예정': 2, '종료': 3 };
                const sA = statusWeights[a.status] || 99;
                const sB = statusWeights[b.status] || 99;
                if (sA !== sB) return sA - sB;
            }
            
            return (a.name || '').localeCompare(b.name || '', 'ko');
        };

        active.sort(sortFn);
        completed.sort(sortFn);

        return { active, completed };
    }, [data, projectSearchTerm, hiddenProjectIds]);

    const groupStats = useMemo(() => transformDataByGroup(), [transformDataByGroup]);

    // Calculate aggregate stats for a group across weeks
    const calculateGroupStats = useCallback((group, weeksArr) => {
        // Pre-compute date strings once — avoids repeated format() calls inside loops
        const weekDateStrs = weeksArr.map(w => format(w, 'yyyy-MM-dd'));
        const weekEndStrs = weeksArr.map(w => format(addDays(w, 6), 'yyyy-MM-dd'));

        // Weekly MM totals array (one per week) — only count in-range allocations
        const statsArr = weekDateStrs.map((dateStr, i) => {
            const wEnd = weekEndStrs[i];
            let total = 0;
            group.projects.forEach(p => {
                p.assignments.forEach(a => {
                    const inRange = p.type === 'Annual'
                        ? true
                        : (a.input_start_date && a.input_end_date && a.input_start_date <= wEnd && a.input_end_date >= dateStr);
                    if (inRange) total += parseFloat(a.allocations?.[dateStr] || 0);
                });
            });
            return total;
        });

        // All assignments in this group (exclude Internal projects not counted in stats)
        const allAssignments = [];
        group.projects.forEach(p => {
            if (p.type === 'Internal' && !p.count_in_stats) return;
            p.assignments.forEach(a => allAssignments.push({ ...a, project_type: p.type }));
        });

        // Pre-fetch groupEmployees for weekly status (needed before weeklyStatus loop)
        const groupEmployees = employees.filter(e => (e.group_name || '미지정') === group.name);

        // Weekly status breakdown — covers all weeks so the per-week
        // 미투입 / 부분투입 / 풀투입 rows show names everywhere users scroll.
        const weeklyStatus = {};
        weeksArr.forEach((week, i) => {
            const dateStr = weekDateStrs[i];
            const empTotals = {};
            const empLeaveTotals = {};

            // Seed all group employees first so unassigned members show up in zero list
            groupEmployees.forEach(e => {
                empTotals[e.id] = { name: e.name, total: 0, empType: e.employment_type, retirement_date: e.retirement_date, exclude_from_stats: e.exclude_from_stats };
            });

            allAssignments.forEach(a => {
                if (!a.employee_id) return; // TBD 슬롯은 통계 제외
                const empId = a.employee_id;
                if (!empTotals[empId]) empTotals[empId] = { name: a.employee_name, total: 0, empType: a.employee_employment_type, retirement_date: a.retirement_date, exclude_from_stats: a.employee_exclude_from_stats };
                empTotals[empId].total += parseFloat(a.allocations?.[dateStr] || 0);

                if (a.project_type === 'Leave') {
                    if (!empLeaveTotals[empId]) empLeaveTotals[empId] = 0;
                    empLeaveTotals[empId] += parseFloat(a.allocations?.[dateStr] || 0);
                }
            });
            const zero = [], under50 = [], over100 = [];
            let activeRegularCount = 0;

            Object.keys(empTotals).forEach(empId => {
                const info = empTotals[empId];
                const { name, total, empType, retirement_date: retirementDate, exclude_from_stats: excludeFromStats } = info;

                if (empType === '정규직') {
                    if (excludeFromStats) return;
                    if (retirementDate && dateStr > retirementDate) return;
                    const leaveTotal = empLeaveTotals[empId] || 0;
                    if (leaveTotal >= 0.1) return;
                    activeRegularCount++;
                    if (total === 0) zero.push(name);
                    if (total < 1.0) under50.push(name);
                    if (total >= 1.1) over100.push(name);
                }
            });
            weeklyStatus[dateStr] = { zero, under50, over100, activeRegularCount };
        });

        const activeClientProjects = group.projects.filter(p => p.type === 'Client').length;

        // Calculate work location (Dispatch vs In-house) based on ACTIVE assignments today
        const now = new Date();
        const todayStr = format(now, 'yyyy-MM-dd');
        const dispatchEmpIds = new Set();

        allAssignments.forEach(a => {
            // Check if assignment is active today
            const start = a.input_start_date;
            const end = a.input_end_date;
            let isActive = true;
            if (start && start > todayStr) isActive = false;
            if (end && end < todayStr) isActive = false;

            if (isActive && a.work_location === 'Dispatch') {
                dispatchEmpIds.add(a.employee_id);
            }
        });

        const dispatchCount = dispatchEmpIds.size;
        // Anyone not dispatched is considered In-house (including those with no assignment or In-house assignment)
        const inHouseCount = groupEmployees.length - dispatchCount;

        const headcount = {
            total: groupEmployees.length,
            regular: groupEmployees.filter(e => e.employment_type === '\uc815\uaddc\uc9c1').length,
            contract: groupEmployees.filter(e => e.employment_type === '\uacc4\uc57d\uc9c1').length,
            dispatch: dispatchCount,
            inHouse: inHouseCount,
        };
        const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
        const getWeekStats = (targetWeek) => {
            const dateStr = format(startOfWeek(targetWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd');
            const ws = weeklyStatus[dateStr] || { zero: [], activeRegularCount: headcount.regular || 1 };
            const idleCount = ws.zero.length;
            const regularCount = ws.activeRegularCount || (headcount.regular || 1);
            return { count: idleCount, rate: ((idleCount / regularCount) * 100).toFixed(0) };
        };
        const monthWeeks = (offset) => {
            const start = addWeeks(thisWeekStart, offset);
            const end = addWeeks(start, 3);
            const mWs = weeksArr.filter(w => w >= start && w <= end);
            if (mWs.length === 0) return { count: 0, rate: '0' };

            const sumIdleCount = mWs.reduce((sum, w) => sum + (weeklyStatus[format(w, 'yyyy-MM-dd')]?.zero?.length || 0), 0);
            const sumRegularCount = mWs.reduce((sum, w) => sum + (weeklyStatus[format(w, 'yyyy-MM-dd')]?.activeRegularCount || (headcount.regular || 1)), 0);

            const avgIdleCount = sumIdleCount / mWs.length;
            const avgRegularCount = sumRegularCount / mWs.length;
            return { count: Math.round(avgIdleCount), rate: avgRegularCount > 0 ? ((avgIdleCount / avgRegularCount) * 100).toFixed(0) : '0' };
        };
        const idle = {
            thisWeek: getWeekStats(now),
            nextWeek: getWeekStats(addWeeks(now, 1)),
            monthAvg: monthWeeks(0),
            month1: monthWeeks(4),
            month2: monthWeeks(8),
            month3: monthWeeks(12),
        };

        return { stats: statsArr, weeklyStatus, activeClientProjects, headcount, idle };
    }, [employees]);

    // Persistent cache: computed once per group, invalidated only when source data changes
    const groupCalcCache = useRef({ groupStats: null, weeks: null, map: new Map() });

    const groupCalcMap = useMemo(() => {
        if (viewMode !== 'group') return {};

        // Invalidate cache when groupStats or weeks reference changes (data/employees updated)
        if (groupCalcCache.current.groupStats !== groupStats || groupCalcCache.current.weeks !== weeks) {
            groupCalcCache.current = { groupStats, weeks, map: new Map() };
        }

        const cache = groupCalcCache.current.map;
        const targets = selectedGroup === 'ALL'
            ? groupStats
            : groupStats.filter(g => g.name === selectedGroup);
        const result = {};
        targets.forEach(g => {
            if (!cache.has(g.name)) {
                cache.set(g.name, calculateGroupStats(g, weeks));
            }
            result[g.name] = cache.get(g.name);
        });
        return result;
    }, [viewMode, selectedGroup, groupStats, weeks, calculateGroupStats]);

    // Column Resizing State
    const [isResizeMode, setIsResizeMode] = useState(false);
    const [columnWidths, setColumnWidths] = useState(() => {
        const defaults = {
            projectName: 200,
            group: 70,
            position: 70,
            grade: 70,
            employmentType: 70,
            name: 120,
            workLocation: 70,
            startDate: 110,
            endDate: 110,
            week: 25
        };

        const saved = localStorage.getItem('projectStatus_columnWidths');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return { ...defaults, ...parsed };
            } catch (e) {
                console.error('Failed to parse saved column widths', e);
            }
        }
        return defaults;
    });

    useEffect(() => {
        localStorage.setItem('projectStatus_columnWidths', JSON.stringify(columnWidths));
    }, [columnWidths]);

    const resizingRef = useRef({ isResizing: false, column: null, startX: 0, startWidth: 0 });

    const handleHideProject = useCallback((projectId, projectName) => {
        setConfirmConfig({
            isOpen: true,
            title: '프로젝트 숨기기',
            message: `"${projectName}" 프로젝트를 화면에서 숨기시겠습니까? 언제든 우상단 숨김 관리 메뉴에서 복구할 수 있습니다.`,
            type: 'info',
            onConfirm: () => {
                setHiddenProjectIds(prev => {
                    if (prev.includes(projectId)) return prev;
                    return [...prev, projectId];
                });
                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
            }
        });
    }, [setConfirmConfig]);



    // Grid State


    // Resize Logic
    const startResizing = useCallback((column, e) => {
        resizingRef.current = {
            isResizing: true,
            column,
            startX: e.clientX,
            startWidth: columnWidths[column]
        };
        document.addEventListener('mousemove', handleResizing);
        document.addEventListener('mouseup', stopResizing);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, [columnWidths]);

    const handleResizing = useCallback((e) => {
        if (!resizingRef.current.isResizing) return;
        const { column, startX, startWidth } = resizingRef.current;
        const delta = e.clientX - startX;
        const newWidth = Math.max(50, startWidth + delta); // Min width 50px
        setColumnWidths(prev => ({ ...prev, [column]: newWidth }));
    }, []);

    const stopResizing = useCallback(() => {
        resizingRef.current.isResizing = false;
        document.removeEventListener('mousemove', handleResizing);
        document.removeEventListener('mouseup', stopResizing);
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
    }, [handleResizing]);

    const handleWidthInputChange = (column, value) => {
        const num = parseInt(value) || 0;
        setColumnWidths(prev => ({ ...prev, [column]: num }));
    };

    const getStickyLeft = useCallback((column, currentView) => {
        if (currentView === 'project') {
            const order = ['group', 'position', 'grade', 'employmentType', 'name', 'workLocation', 'startDate', 'endDate'];
            const idx = order.indexOf(column);
            if (idx <= 0) return idx === 0 ? 0 : -1;
            return order.slice(0, idx).reduce((acc, col) => acc + columnWidths[col], 0);
        } else {
            // Group View order: group, position, grade, employmentType, name, workLocation, startDate, endDate
            const order = ['group', 'position', 'grade', 'employmentType', 'name', 'workLocation', 'startDate', 'endDate'];
            const idx = order.indexOf(column);
            if (idx <= 0) return idx === 0 ? 0 : -1;
            return order.slice(0, idx).reduce((acc, col) => acc + columnWidths[col], 0);
        }
    }, [columnWidths]);



    // Skip the first run — the initial value was already computed in useState
    // from this same startDate. Re-running here would only create a new array
    // reference and force an extra full re-render of all cells.
    const startDateInitRef = useRef(true);
    useEffect(() => {
        if (startDateInitRef.current) {
            startDateInitRef.current = false;
            return;
        }
        const start = startOfWeek(startDate, { weekStartsOn: 1 });
        const end = addWeeks(start, 155);
        const intervals = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
        setWeeks(intervals);
    }, [startDate]);

    useEffect(() => {
        loadData(); // Load data on mount
    }, []);

    // Focus management effect
    useEffect(() => {
        if (cursor.memberIndex !== null && cursor.weekIndex !== null) {
            const key = `${cursor.memberIndex}-${cursor.weekIndex}`;
            const el = cellRefs.current[key];
            if (el) {
                el.focus();
            }
        }
    }, [cursor]);

    const findEarliestDate = (projects) => {
        let earliest = null;
        projects.forEach(p => {
            p.members.forEach(m => {
                if (m.input_start_date) {
                    const d = new Date(m.input_start_date);
                    if (!isNaN(d.getTime())) {
                        if (!earliest || d < earliest) earliest = d;
                    }
                }
            });
        });
        return earliest;
    };



    const autoFormatDate = useCallback((value) => {
        const digits = value.replace(/\D/g, '').slice(0, 8);
        if (digits.length <= 4) return digits;
        if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
        return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
    }, []);



    // Debugging render
    console.log('ProjectStatus: Render', {
        loading,
        dataLength: data.length,
        employeesLength: employees.length,
        viewMode,
        weeksLength: weeks.length
    });


    // Helper to get flattened list of members for navigation
    // Now includes "Add" rows at the end of each project
    const getFlatRows = useCallback(() => {
        const flat = [];
        if (viewMode === 'project') {
            data.forEach(p => {
                p.members.forEach(m => {
                    flat.push({ type: 'member', member: m, projectId: p.id });
                });
                flat.push({ type: 'add', projectId: p.id, projectName: p.name });
            });
        } else {
            // Group view flat rows for navigation
            groupStats.forEach(g => {
                g.projects.forEach(p => {
                    p.assignments.forEach(a => {
                        flat.push({ type: 'group_assignment', member: a, assignment: a, groupName: g.name });
                    });
                    flat.push({ type: 'group_add', projectId: p.id, groupName: g.name });
                });
            });
        }
        return flat;
    }, [data, viewMode, groupStats]);


    // Scroll Synchronization Logic
    const handleTableScroll = useCallback(() => {
        if (isScrollingRef.current) return; // Prevent loop triggered by slider
        if (!tableContainerRef.current || !sliderRef.current) return;

        isScrollingRef.current = true;
        requestAnimationFrame(() => {
            const container = tableContainerRef.current;
            const slider = sliderRef.current;

            // Calculate the actual scrollable area for weeks only
            const scrollLeft = container.scrollLeft;

            // Map scroll pixel position back to a week offset
            const offsetWeeks = Math.round(scrollLeft / columnWidths.week);
            slider.value = offsetWeeks;

            // Update visible column range for virtualization
            const visibleWeeks = Math.ceil(container.clientWidth / columnWidths.week);
            const newStart = Math.max(0, offsetWeeks - COL_BUFFER);
            const newEnd = Math.min(weeks.length - 1, offsetWeeks + visibleWeeks + COL_BUFFER);
            setVisibleColRange(prev => {
                if (prev.start === newStart && prev.end === newEnd) return prev;
                return { start: newStart, end: newEnd };
            });

            isScrollingRef.current = false;
        });
    }, [columnWidths, weeks, COL_BUFFER]);

    const handleSliderChange = useCallback((e) => {
        if (!tableContainerRef.current) return;

        isScrollingRef.current = true;
        const targetWeekOffset = parseInt(e.target.value);

        requestAnimationFrame(() => {
            // Instantly change the physical scroll position
            tableContainerRef.current.scrollLeft = targetWeekOffset * columnWidths.week;
            setTimeout(() => { isScrollingRef.current = false; }, 50); // Release lock
        });
    }, [columnWidths.week]);

    const handleToday = useCallback((e, smooth = true) => {
        if (e && e.preventDefault) e.preventDefault(); // For button clicks

        const today = startOfWeek(new Date(), { weekStartsOn: 1 });
        const todayStr = format(today, 'yyyy-MM-dd');

        // Update date label to today
        setVisibleDate(`${format(today, 'yyyy년 M월 d일')} ~ ${format(addDays(today, 4), 'M월 d일')}`);

        // Check if today is in current weeks
        const weekIdx = weeks.findIndex(w => format(w, 'yyyy-MM-dd') === todayStr);

        if (weekIdx !== -1 && tableContainerRef.current) {
            tableContainerRef.current.scrollTo({
                left: weekIdx * columnWidths.week,
                behavior: smooth === true ? 'smooth' : 'auto'
            });
        } else {
            // Re-center around today (fallback if far in future/past)
            setStartDate(addWeeks(today, -52));
        }
    }, [weeks, columnWidths.week]);

    // Auto-scroll to "Today" when weeks load initially
    useEffect(() => {
        if (weeks.length > 0 && !loading && !hasAutoScrolled.current && tableContainerRef.current) {
            handleToday(null, false); // Instant scroll on load
            hasAutoScrolled.current = true;

            // Set the date label to today immediately
            const today = startOfWeek(new Date(), { weekStartsOn: 1 });
            setVisibleDate(`${format(today, 'yyyy년 M월 d일')} ~ ${format(addDays(today, 4), 'M월 d일')}`);

            // Initialize visible col range centered around today
            const container = tableContainerRef.current;
            const todayIdx = weeks.findIndex(w => format(w, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd'));
            if (todayIdx !== -1) {
                const visibleWeeks = Math.ceil(container.clientWidth / columnWidths.week);
                const newStart = Math.max(0, todayIdx - COL_BUFFER);
                const newEnd = Math.min(weeks.length - 1, todayIdx + visibleWeeks + COL_BUFFER);
                // Bail out if the initial state (set in useState) already matches —
                // otherwise we'd trigger an extra full re-render of all cells just
                // to land on the same range.
                setVisibleColRange(prev =>
                    prev.start === newStart && prev.end === newEnd ? prev : { start: newStart, end: newEnd }
                );
            }
        }
    }, [weeks, loading, handleToday, columnWidths.week, COL_BUFFER]);


    const handleAllocationChange = useCallback((assignmentId, date, value) => {
        // Validation: 0 to 1, up to 1 decimal place
        let cleanValue = value.replace(/[^0-9.]/g, ''); // Allow only numbers and dot

        // Handle multiple dots
        const parts = cleanValue.split('.');
        if (parts.length > 2) cleanValue = parts[0] + '.' + parts.slice(1).join('');

        // Limit to 1 decimal place
        if (parts.length === 2 && parts[1].length > 1) {
            cleanValue = parts[0] + '.' + parts[1].substring(0, 1);
        }

        const num = parseFloat(cleanValue);
        if (!isNaN(num)) {
            if (num > 1) cleanValue = '1';
            if (num < 0) cleanValue = '0';
        }

        // Immutable local update for UI responsiveness
        const dateKey = format(date, 'yyyy-MM-dd');
        setData(prev => prev.map(p => ({
            ...p,
            members: p.members.map(m => m.id === assignmentId ? {
                ...m,
                allocations: { ...(m.allocations || {}), [dateKey]: cleanValue }
            } : m)
        })));
    }, [setData]);

    const handleAllocationBlur = useCallback(async (assignmentId, date, value) => {
        if (!value || value === '0') return;

        const num = parseFloat(value);
        const formattedValue = isNaN(num) ? '' : num.toFixed(1);

        // Update local state to show the formatted value (e.g., 1 -> 1.0)
        const dateKey = format(date, 'yyyy-MM-dd');
        setData(prev => prev.map(p => ({
            ...p,
            members: p.members.map(m => m.id === assignmentId ? {
                ...m,
                allocations: { ...(m.allocations || {}), [dateKey]: formattedValue }
            } : m)
        })));

        try {
            await projectsAPI.updateAllocation({
                assignment_id: assignmentId,
                date: dateKey,
                value: formattedValue
            });
        } catch (err) {
            console.error('Update failed', err);
            // Revert by reloading
            // loadData(); 
        }
    }, [setData]); // Removed loadData from dependencies to stabilize

    const handleFillForward = useCallback(async (assignmentId, startDate, value) => {
        if (!value || value === '0') return;

        let assignment = null;
        setData(prev => {
            prev.forEach(p => {
                const m = p.members.find(am => am.id === assignmentId);
                if (m) assignment = m;
            });
            return prev;
        });

        if (!assignment || !assignment.input_end_date) {
            alert('종료일이 설정되어 있지 않습니다.');
            return;
        }

        const endDate = parseISO(assignment.input_end_date);
        const start = startOfWeek(startDate, { weekStartsOn: 1 });

        if (start > endDate) return;

        const weeksToUpdate = eachWeekOfInterval({
            start: start,
            end: endDate
        }, { weekStartsOn: 1 });

        if (weeksToUpdate.length <= 1) return;

        const confirmFill = window.confirm(`${format(endDate, 'yyyy-MM-dd')}까지 ${weeksToUpdate.length}개 주차를 ${value}로 채우시겠습니까?`);
        if (!confirmFill) return;

        const updatesDict = {};
        weeksToUpdate.forEach(w => {
            const dStr = format(w, 'yyyy-MM-dd');
            updatesDict[dStr] = value;
        });

        setData(prev => prev.map(p => ({
            ...p,
            members: p.members.map(m => m.id === assignmentId ? {
                ...m,
                allocations: { ...(m.allocations || {}), ...updatesDict }
            } : m)
        })));

        try {
            const batch = weeksToUpdate.map(w => ({
                assignment_id: assignmentId,
                date: format(w, 'yyyy-MM-dd'),
                value: value
            }));
            await projectsAPI.updateAllocationBatch(batch);
        } catch (err) {
            console.error('Batch update failed', err);
            alert('일괄 업데이트 중 오류가 발생했습니다.');
        }
    }, [setData]);

    const getFilteredEmployees = useCallback((projectId, term, groupFilter) => {
        const lowerTerm = term.toLowerCase();

        return employees.filter(emp => {
            if (groupFilter && emp.group_name !== groupFilter) {
                return false;
            }
            if (!lowerTerm) return true;
            return (emp.name?.toLowerCase().includes(lowerTerm) ||
                emp.group_name?.toLowerCase().includes(lowerTerm))
        });
    }, [employees]);



    const handleInlineAssign = useCallback(async (projectId, employeeId) => {
        const key = `${projectId}-${employeeId}-${Date.now()}`;
        assigningProjects.current.add(key);

        // Optimistic update: add temporary member immediately for instant feedback
        const empInfo = employees.find(e => e.id === employeeId);
        const tempId = `temp-${key}`;
        const tempMember = {
            id: tempId,
            project_id: projectId,
            employee_id: employeeId,
            employee_name: empInfo?.name || '',
            employee_position: empInfo?.position || '',
            employee_grade: empInfo?.skill_level || '',
            employee_employment_type: empInfo?.employment_type || '',
            group_name: empInfo?.group_name || '',
            group_color: empInfo?.group_color || '',
            allocations: {}
        };

        // Calculate newMemberIndex in the flatRows list BEFORE setting state
        let newMemberIndex = -1;
        let flatIdx = 0;

        if (viewMode === 'project') {
            for (const p of data) {
                if (p.id === projectId) {
                    let insertAfter = -1;
                    p.members.forEach((m, idx) => {
                        if (m.employee_id === employeeId) insertAfter = idx;
                    });

                    const insertPos = insertAfter >= 0 ? insertAfter + 1 : p.members.length;
                    newMemberIndex = flatIdx + insertPos;
                    break;
                } else {
                    flatIdx += p.members.length + 1; // members count + 1 (for 'add' row)
                }
            }
        } else {
            // Group view
            for (const g of groupStats) {
                for (const p of g.projects) {
                    if (p.id === projectId) {
                        let insertAfter = -1;
                        p.assignments.forEach((a, idx) => {
                            if (a.employee_id === employeeId) insertAfter = idx;
                        });

                        const insertPos = insertAfter >= 0 ? insertAfter + 1 : p.assignments.length;
                        newMemberIndex = flatIdx + insertPos;
                        break;
                    } else {
                        flatIdx += p.assignments.length + 1; // assignments count + 1 (for 'group_add' row)
                    }
                }
                if (newMemberIndex !== -1) break;
            }
        }

        // Insert right after the last occurrence of the same employee in this project
        setData(prev => prev.map(p => {
            if (p.id !== projectId) return p;
            const members = [...p.members];
            // Find the last index of same employee
            let insertAfter = -1;
            members.forEach((m, idx) => {
                if (m.employee_id === employeeId) insertAfter = idx;
            });
            if (insertAfter >= 0) {
                members.splice(insertAfter + 1, 0, tempMember);
            } else {
                members.push(tempMember);
            }
            return { ...p, members };
        }));

        // Focus the newly added member's name (swap) on next render
        if (newMemberIndex !== -1) {
            setTimeout(() => {
                setCursor({ memberIndex: newMemberIndex, weekIndex: 'swap' });
            }, 50);
        }

        try {
            const response = await projectsAPI.assignMember(projectId, { employee_id: employeeId });
            const newMember = {
                ...response.data,
                employee_name: response.data.employee_name || empInfo?.name,
                employee_position: response.data.employee_position || empInfo?.position,
                employee_grade: response.data.employee_grade || empInfo?.skill_level,
                employee_employment_type: response.data.employee_employment_type || empInfo?.employment_type,
                group_name: response.data.group_name || empInfo?.group_name,
                group_color: response.data.group_color || empInfo?.group_color,
                allocations: {}
            };

            // Calculate the updated members list and their IDs synchronously
            let updatedOrderIds = [];
            const currentProject = data.find(p => p.id === projectId);
            if (currentProject) {
                // Filter out any tempMember and insert newMember right after the last same employee
                const cleanMembers = currentProject.members.filter(m => m.id !== tempId);
                let insertAfter = -1;
                cleanMembers.forEach((m, idx) => {
                    if (m.employee_id === employeeId) insertAfter = idx;
                });
                if (insertAfter >= 0) {
                    cleanMembers.splice(insertAfter + 1, 0, newMember);
                } else {
                    cleanMembers.push(newMember);
                }
                updatedOrderIds = cleanMembers.map(m => m.id);
            }

            // Replace temp member with real server data
            setData(prev => prev.map(p => {
                if (p.id === projectId) {
                    const cleanMembers = p.members.filter(m => m.id !== tempId);
                    let insertAfter = -1;
                    cleanMembers.forEach((m, idx) => {
                        if (m.employee_id === employeeId) insertAfter = idx;
                    });
                    if (insertAfter >= 0) {
                        cleanMembers.splice(insertAfter + 1, 0, newMember);
                    } else {
                        cleanMembers.push(newMember);
                    }
                    return { ...p, members: cleanMembers };
                }
                return p;
            }));

            // Persist the order to DB
            if (updatedOrderIds.length > 0) {
                await projectsAPI.reorderMembers(updatedOrderIds);
            }
        } catch (err) {
            // Rollback optimistic update
            setData(prev => prev.map(p =>
                p.id === projectId ? { ...p, members: p.members.filter(m => m.id !== tempId) } : p
            ));
            console.error('Failed to assign member:', err);
            const errorMsg = err.response?.data?.error;
            alert(errorMsg || '인원 배정에 실패했습니다. (서버 연결을 확인하세요)');
        } finally {
            assigningProjects.current.delete(key);
        }
    }, [employees, setData, loadData, viewMode, groupStats, data]);

    const handleKeyDown = useCallback((e, rowIndex, weekIndex, isAddCell = false) => {
        const flatRows = getFlatRows();
        const totalRows = flatRows.length;
        const totalWeeks = weeks.length;

        // Navigation range:
        // Member Row: [0: StartDate, 1: EndDate, 2..W+1: Weeks]
        // Add Row: [0: Name]
        const maxColIndex = isAddCell ? 0 : totalWeeks + 1;

        let nextRowIndex = rowIndex;
        let nextWeekIndex = weekIndex;

        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                nextRowIndex = Math.max(0, rowIndex - 1);
                break;
            case 'ArrowDown':
            case 'Enter':
                e.preventDefault();
                nextRowIndex = Math.min(totalRows - 1, rowIndex + 1);
                break;
            case 'ArrowLeft':
                if (e.target.selectionStart === 0 && e.target.selectionEnd === 0) {
                    e.preventDefault();
                    nextWeekIndex = Math.max(0, weekIndex - 1);
                }
                break;
            case 'ArrowRight':
                if (e.target.selectionStart === e.target.value.length) {
                    e.preventDefault();
                    nextWeekIndex = Math.min(maxColIndex, weekIndex + 1);
                }
                break;
            case 'Tab':
                e.preventDefault();
                if (e.shiftKey) {
                    nextWeekIndex = weekIndex - 1;
                    if (nextWeekIndex < 0 && rowIndex > 0) {
                        nextRowIndex = rowIndex - 1;
                        const prevIsAdd = flatRows[nextRowIndex].type === 'add';
                        nextWeekIndex = prevIsAdd ? 0 : totalWeeks + 1;
                    } else {
                        nextWeekIndex = Math.max(0, nextWeekIndex);
                    }
                } else {
                    nextWeekIndex = weekIndex + 1;
                    // If we've reached the end of visible weeks, load next 4 weeks
                    if (nextWeekIndex > maxColIndex && !isAddCell) {
                        // Auto-advance the view by 4 weeks
                        setStartDate(addWeeks(startDate, 4));
                        // Stay on the same row but move to first week column (index 2)
                        setTimeout(() => {
                            setCursor({ memberIndex: rowIndex, weekIndex: 2 });
                        }, 50);
                        return;
                    }
                    // Just cap at max, don't move to next row
                    nextWeekIndex = Math.min(maxColIndex, nextWeekIndex);
                }
                break;
            default:
                return;
        }

        // Clamp week indicator for target row
        const targetIsAdd = flatRows[nextRowIndex].type === 'add';
        if (targetIsAdd) {
            nextWeekIndex = 0;
        }

        setCursor({ memberIndex: nextRowIndex, weekIndex: nextWeekIndex });
    }, [getFlatRows, weeks, setStartDate, setCursor, startDate]);

    const handlePaste = useCallback(async (e, startRowIndex, startWeekIndex) => {
        e.preventDefault();
        const clipboardData = e.clipboardData.getData('text');
        if (!clipboardData) return;

        const rows = clipboardData.split(/\r\n|\n|\r/).filter(row => row.trim() !== '');
        if (rows.length === 0) return;

        const flatRows = getFlatRows();
        const filteredProjects = filteredData;
        const newData = JSON.parse(JSON.stringify(data));
        const updates = [];

        const assignmentMap = {};
        newData.forEach(p => {
            p.members.forEach(m => {
                assignmentMap[m.id] = m;
            });
        });

        rows.forEach((row, rIdx) => {
            const cells = row.split('\t');
            const targetRowIndex = startRowIndex + rIdx;

            if (targetRowIndex >= flatRows.length) return;
            const targetRow = flatRows[targetRowIndex];
            if (targetRow.type !== 'member') return; // Can't paste into add row for now

            const memberId = targetRow.member.id;

            cells.forEach((value, cIdx) => {
                const absoluteColIdx = startWeekIndex + cIdx;
                if (absoluteColIdx < 2) return; // Skip Start/End Date columns for now

                const weekIdxInArray = absoluteColIdx - 2;
                if (weekIdxInArray >= weeks.length) return;

                const date = weeks[weekIdxInArray];
                const dateStr = format(date, 'yyyy-MM-dd');
                const cleanValue = value.trim();

                if (assignmentMap[memberId]) {
                    if (!assignmentMap[memberId].allocations) assignmentMap[memberId].allocations = {};
                    assignmentMap[memberId].allocations[dateStr] = cleanValue;
                }

                updates.push({
                    assignment_id: memberId,
                    date: dateStr,
                    value: cleanValue
                });
            });
        });

        setData(newData);

        if (updates.length > 0) {
            try {
                await projectsAPI.updateAllocationBatch(updates);
            } catch (err) {
                console.error('Batch update failed', err);
                alert('저장 중 오류가 발생했습니다.');
                loadData({ force: true });
            }
        }
    }, [data, getFlatRows, weeks, loadData, setData]);


    const handleAssignMember = async (employeeId) => {
        if (!selectedProject) return;
        const key = `${selectedProject.id}-${employeeId}`;
        if (assigningProjects.current.has(key)) return;
        assigningProjects.current.add(key);

        // Close modal immediately for instant feedback
        const projectId = selectedProject.id;
        setShowMemberModal(false);
        setModalSearchTerm('');

        // Optimistic update: add temporary member immediately
        const empInfo = employees.find(e => e.id === employeeId);
        const tempId = `temp-${key}`;
        const tempMember = {
            id: tempId,
            project_id: projectId,
            employee_id: employeeId,
            employee_name: empInfo?.name || '',
            employee_position: empInfo?.position || '',
            group_name: empInfo?.group_name || '',
            group_color: empInfo?.group_color || '',
            allocations: {}
        };
        setData(prev => prev.map(p =>
            p.id === projectId ? { ...p, members: [...p.members, tempMember] } : p
        ));

        try {
            const response = await projectsAPI.assignMember(projectId, { employee_id: employeeId });
            console.log('Assignment response:', response.data);
            const newMember = {
                ...response.data,
                employee_name: response.data.employee_name || empInfo?.name,
                employee_position: response.data.employee_position || empInfo?.position,
                group_name: response.data.group_name || empInfo?.group_name,
                group_color: response.data.group_color || empInfo?.group_color,
                allocations: {}
            };
            // Replace temp member with real server data
            setData(prev => prev.map(p =>
                p.id === projectId
                    ? { ...p, members: p.members.map(m => m.id === tempId ? newMember : m) }
                    : p
            ));
        } catch (err) {
            // Rollback optimistic update
            setData(prev => prev.map(p =>
                p.id === projectId ? { ...p, members: p.members.filter(m => m.id !== tempId) } : p
            ));
            console.error('Failed to assign member:', err);
            const errorMsg = err.response?.data?.error;

            if (errorMsg === 'Employee already assigned to this project') {
                alert('이미 배정된 인원입니다.');
            } else {
                alert(errorMsg || '인원 배정에 실패했습니다. (서버 연결을 확인하세요)');
            }
        } finally {
            assigningProjects.current.delete(key);
        }
    };

    const handleAssignTBD = useCallback(async (projectId, tbdType, groupName = null, groupColor = null, groupId = null) => {
        setShowMemberModal(false);

        const tempId = `temp-tbd-${Date.now()}`;
        const tempMember = {
            id: tempId,
            project_id: projectId,
            employee_id: null,
            employee_name: null,
            tbd_employment_type: tbdType,
            group_name: groupName,
            group_color: groupColor,
            allocations: {}
        };
        setData(prev => prev.map(p =>
            p.id === projectId ? { ...p, members: [...p.members, tempMember] } : p
        ));

        try {
            const response = await projectsAPI.assignMember(projectId, { tbd_employment_type: tbdType, group_id: groupId });
            const newMember = {
                ...response.data,
                group_name: groupName || response.data.group_name,
                group_color: groupColor || response.data.group_color,
                allocations: {}
            };
            setData(prev => prev.map(p =>
                p.id === projectId
                    ? { ...p, members: p.members.map(m => m.id === tempId ? newMember : m) }
                    : p
            ));
        } catch (err) {
            setData(prev => prev.map(p =>
                p.id === projectId ? { ...p, members: p.members.filter(m => m.id !== tempId) } : p
            ));
            alert('TBD 배정에 실패했습니다: ' + (err.response?.data?.error || err.message));
        }
    }, [setData]);

    const handleReorderProject = async (projectId, direction) => {
        const index = data.findIndex(p => p.id === projectId);
        if (index === -1) return;

        const newData = [...data];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= data.length) return;

        // Swap in local state
        [newData[index], newData[newIndex]] = [newData[newIndex], newData[index]];
        setData(newData);

        try {
            const newDataIds = newData.map(p => p.id);
            await projectsAPI.reorderProjects(newDataIds);
        } catch (err) {
            console.error('Reorder failed', err);
            loadData({ force: true }); // Revert on error
        }
    };

    const handleReorderMember = useCallback(async (projectId, assignmentId, direction) => {
        const project = data.find(p => p.id === projectId);
        if (!project) return;

        const newMembers = [...project.members];
        const idx = newMembers.findIndex(m => m.id === assignmentId);
        if (idx === -1) return;

        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= newMembers.length) return;

        // Swap
        [newMembers[idx], newMembers[targetIdx]] = [newMembers[targetIdx], newMembers[idx]];

        // Update local state
        setData(prev => prev.map(p => p.id === projectId ? { ...p, members: newMembers } : p));

        // Persist to backend (requires endpoint for bulk update or specific reorder)
        try {
            await projectsAPI.reorderMembers(newMembers.map(m => m.id));
        } catch (err) {
            console.error('Failed to update member order:', err);
            loadData({ force: true }); // Revert on error
        }
    }, [data, setData, loadData]);

    const handleRemoveMember = useCallback(async (projectId, assignmentId, memberName) => {
        setConfirmConfig({
            isOpen: true,
            title: '배정 해제',
            message: `${memberName}님을 이 프로젝트에서 제외하시겠습니까?`,
            type: 'danger',
            onConfirm: async () => {
                // Optimistic update
                const newData = [...data];
                const projectIndex = newData.findIndex(p => p.id === projectId);
                if (projectIndex !== -1) {
                    newData[projectIndex] = {
                        ...newData[projectIndex],
                        members: newData[projectIndex].members.filter(m => m.id !== assignmentId)
                    };
                    setData(newData);
                }

                try {
                    await projectsAPI.removeMember(assignmentId);
                } catch (err) {
                    console.error('Remove member failed', err);
                    loadData({ force: true });
                }
                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
            }
        });
    }, [data, loadData]);

    const handleDeleteProject = async (projectId, projectName) => {
        setConfirmConfig({
            isOpen: true,
            title: '프로젝트 삭제',
            message: `프로젝트 "${projectName}" 및 모든 투입 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`,
            type: 'danger',
            onConfirm: async () => {
                // Optimistic update
                setData(data.filter(p => p.id !== projectId));

                try {
                    await projectsAPI.delete(projectId);
                    dataCache.invalidateProjects();
                } catch (err) {
                    console.error('Delete project failed', err);
                    loadData({ force: true });
                }
                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    const handleToggleCountInStats = useCallback(async (projectId, currentValue) => {
        const newValue = !currentValue;
        // Optimistic update
        setData(prev => prev.map(p => p.id === projectId ? { ...p, count_in_stats: newValue } : p));
        try {
            await projectsAPI.update(projectId, { count_in_stats: newValue });
        } catch (err) {
            console.error('Failed to toggle count_in_stats', err);
            // Revert on error
            setData(prev => prev.map(p => p.id === projectId ? { ...p, count_in_stats: currentValue } : p));
        }
    }, [setData]);

    // Helper to highlight matched text
    const highlightMatch = useCallback((text, term) => {
        if (!term.trim()) return text;
        const parts = text.split(new RegExp(`(${term})`, 'gi'));
        return (
            <span>
                {parts.map((part, i) =>
                    part.toLowerCase() === term.toLowerCase() ?
                        <mark key={i} style={{ backgroundColor: '#FDE047', color: '#000', borderRadius: '2px', padding: '0 2px' }}>{part}</mark> :
                        part
                )}
            </span>
        );
    }, []);

    // Calculate row index for focus management
    let globalRowIndex = 0;

    // Group weeks by month for the header
    // Virtualized week columns: only render visible range + buffer
    const visibleWeeks = useMemo(() => {
        if (weeks.length === 0) return [];
        return weeks.slice(visibleColRange.start, visibleColRange.end + 1);
    }, [weeks, visibleColRange]);

    // Pre-compute date strings and current-week index for visible weeks once per scroll/range change.
    // This avoids running format() 5x per cell (~5-10만 회/그룹전환) inside MemberRow/GroupMemberRow.
    const visibleWeekDateStrs = useMemo(
        () => visibleWeeks.map(w => format(w, 'yyyy-MM-dd')),
        [visibleWeeks]
    );
    const visibleWeekEndStrs = useMemo(
        () => visibleWeeks.map(w => format(addDays(w, 6), 'yyyy-MM-dd')),
        [visibleWeeks]
    );
    const visibleCurrentWeekIdx = useMemo(() => {
        const today = format(new Date(), 'yyyy-MM-dd');
        for (let i = 0; i < visibleWeekDateStrs.length; i++) {
            if (visibleWeekDateStrs[i] <= today && today <= visibleWeekEndStrs[i]) return i;
        }
        return -1;
    }, [visibleWeekDateStrs, visibleWeekEndStrs]);

    // Spacer widths for columns before and after visible range
    const leftSpacerWidth = visibleColRange.start * columnWidths.week;
    const rightSpacerWidth = Math.max(0, (weeks.length - 1 - visibleColRange.end)) * columnWidths.week;

    const monthGroups = [];
    if (weeks.length > 0) {
        let currentMonth = format(weeks[0], 'M월');
        let count = 0;
        let startIndex = 0;
        weeks.forEach((w, i) => {
            const m = format(w, 'M월');
            if (m === currentMonth) {
                count++;
            } else {
                monthGroups.push({ month: currentMonth, weekCount: count, startIndex: startIndex });
                currentMonth = m;
                count = 1;
                startIndex = i;
            }
            if (i === weeks.length - 1) {
                monthGroups.push({ month: currentMonth, weekCount: count, startIndex: startIndex });
            }
        });
    }

    const handleMonthClick = (startIndex) => {
        const container = tableContainerRef.current;
        if (container) {
            container.scrollTo({ left: startIndex * columnWidths.week, behavior: 'smooth' });
        }
    };

    const isDateInRange = useCallback((date, startStr, endStr) => {
        if (!startStr || !endStr) return false;
        try {
            // Use simple string comparison for date ranges (YYY-MM-DD)
            // A week [wStart, wEnd] overlaps with project [startStr, endStr] if:
            // startStr <= wEnd AND endStr >= wStart
            const wStart = format(date, 'yyyy-MM-dd');
            const wEnd = format(addDays(new Date(date), 6), 'yyyy-MM-dd');
            return startStr <= wEnd && endStr >= wStart;
        } catch {
            return false;
        }
    }, []);

    // Check if a week contains today
    const isCurrentWeek = useCallback((weekStart) => {
        try {
            const today = format(new Date(), 'yyyy-MM-dd');
            const wStart = format(weekStart, 'yyyy-MM-dd');
            const wEnd = format(addDays(new Date(weekStart), 6), 'yyyy-MM-dd');
            return today >= wStart && today <= wEnd;
        } catch {
            return false;
        }
    }, []);    // Scroll to Today


    if (loading) return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '16px' }}>
            <div style={{
                width: '44px', height: '44px',
                border: '4px solid var(--border)',
                borderTopColor: 'var(--primary)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
            }} />
            <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>데이터를 불러오는 중...</span>
        </div>
    );

    // Portrait mode warning overlay for mobile
    const PortraitWarning = () => {
        const [isPortrait, setIsPortrait] = useState(
            () => window.innerWidth <= 768 && window.innerHeight > window.innerWidth
        );
        useEffect(() => {
            const update = () => setIsPortrait(window.innerWidth <= 768 && window.innerHeight > window.innerWidth);
            window.addEventListener('resize', update);
            window.addEventListener('orientationchange', update);
            return () => { window.removeEventListener('resize', update); window.removeEventListener('orientationchange', update); };
        }, []);
        if (!isPortrait) return null;
        return (
            <div style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(0,0,0,0.92)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '20px'
            }}>
                <div style={{ fontSize: '56px', display: 'inline-block', transform: 'rotate(90deg)' }}>📱</div>
                <p style={{ color: '#fff', fontSize: '18px', fontWeight: 700, margin: 0 }}>기기를 가로로 돌려주세요</p>
                <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0, textAlign: 'center', lineHeight: 1.6 }}>
                    프로젝트 배정 화면은<br />가로 모드에서 잘 보입니다
                </p>
            </div>
        );
    };

    return (
        <div className="container page" style={{ maxWidth: '100%', overflowX: 'hidden' }}>
            <PortraitWarning />
            {/* New Toolbar Layout */}
            <div className={`flex flex-col gap-sm border-b transition-all duration-300 ${isToolbarCollapsed ? 'pb-xs' : 'pb-sm'} ${isMobile ? 'mb-sm' : 'mb-md'}`}>
                {/* Row 1: Title, Date Nav, Primary Actions */}
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-md">
                        <h1 className="text-xl font-bold m-0 flex items-center gap-sm">
                            <LayoutDashboard className="text-primary" size={24} />
                        </h1>

                        <button
                            onClick={() => setIsToolbarCollapsed(!isToolbarCollapsed)}
                            className={`p-xs rounded-full transition-all duration-300 ${isToolbarCollapsed ? 'bg-tertiary text-muted rotate-0' : 'hover-bg-secondary text-muted -rotate-180'}`}
                            title={isToolbarCollapsed ? "툴바 펼치기" : "툴바 접기"}
                            style={{ border: 'none', background: isToolbarCollapsed ? 'var(--bg-tertiary)' : 'transparent', cursor: 'pointer' }}
                        >
                            <ChevronDown size={20} />
                        </button>

                        {!isToolbarCollapsed && (
                            <div className="flex items-center gap-sm">
                                {/* View Mode Toggle */}
                                <div className="flex bg-tertiary p-0 rounded-lg border border-border overflow-hidden">
                                    <button
                                        onClick={() => setViewMode('project')}
                                        className={`btn flex items-center gap-xs px-md py-1.5 text-xs font-semibold transition-all cursor-pointer ${viewMode === 'project' ? 'bg-primary text-white shadow-sm' : 'text-muted hover-text-primary'}`}
                                        style={{ border: 'none', background: viewMode === 'project' ? 'var(--primary)' : 'transparent', color: viewMode === 'project' ? 'white' : 'var(--text-muted)', borderRadius: '0' }}
                                    >
                                        <LayoutGrid size={14} />{!isMobile && ' 프로젝트'}
                                    </button>
                                    <button
                                        onClick={() => { setViewMode('group'); if (selectedGroup === 'ALL') setSelectedGroup(groupOptions[0]?.id || 'ALL'); }}
                                        className={`btn flex items-center gap-xs px-md py-1.5 text-xs font-semibold transition-all cursor-pointer ${viewMode === 'group' ? 'bg-primary text-white shadow-sm' : 'text-muted hover-text-primary'}`}
                                        style={{ border: 'none', background: viewMode === 'group' ? 'var(--primary)' : 'transparent', color: viewMode === 'group' ? 'white' : 'var(--text-muted)', borderRadius: '0' }}
                                    >
                                        <Users size={14} />{!isMobile && ' 그룹별'}
                                    </button>
                                </div>

                                {/* Group Selector Dropdown — only rendered in group mode */}
                                {viewMode === 'group' && (
                                <div
                                    ref={groupDropdownRef}
                                    style={{
                                        position: 'relative',
                                        display: 'flex',
                                        alignItems: 'center',
                                        marginLeft: '8px',
                                    }}
                                >
                                    <button
                                        onClick={() => setShowGroupDropdown(!showGroupDropdown)}
                                        className={`premium-select-trigger ${showGroupDropdown ? 'active' : ''}`}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '6px 12px',
                                            background: 'var(--bg-tertiary)',
                                            border: '1px solid var(--border)',
                                            borderRadius: '8px',
                                            color: 'var(--text-primary)',
                                            fontSize: '12px',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            width: '100%',
                                            justifyContent: 'space-between'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {isGroupTransitioning
                                                ? <div style={{ width: '8px', height: '8px', borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: currentGroupOpt.color, animation: 'spin 0.6s linear infinite' }} />
                                                : <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: currentGroupOpt.color, boxShadow: `0 0 8px ${currentGroupOpt.color}80` }} />
                                            }
                                            <span>{currentGroupOpt.name}</span>
                                        </div>
                                        <ChevronDown size={14} style={{ transform: showGroupDropdown ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
                                    </button>

                                    {showGroupDropdown && (
                                        <div className="premium-dropdown-list">
                                            {groupOptions.map((opt) => (
                                                <div
                                                    key={opt.id}
                                                    className={`premium-dropdown-item ${selectedGroup === opt.id ? 'active' : ''}`}
                                                    onClick={() => {
                                                        setShowGroupDropdown(false);
                                                        startGroupTransition(() => {
                                                            setSelectedGroup(opt.id);
                                                        });
                                                    }}
                                                >
                                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: opt.color }} />
                                                    <span>{opt.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Centered Date Navigation */}
                    <div className={`flex items-center gap-sm bg-tertiary ${isMobile ? 'px-xs' : 'px-sm'} py-xs rounded-full shadow-sm border border-border scale-95 origin-center`}>
                        <button
                            onClick={() => {
                                if (tableContainerRef.current) {
                                    const newScrollLeft = tableContainerRef.current.scrollLeft - (4 * columnWidths.week);
                                    tableContainerRef.current.scrollBy({ left: -(4 * columnWidths.week), behavior: 'smooth' });
                                    const offsetWeeks = Math.max(0, Math.round(newScrollLeft / columnWidths.week));
                                    if (weeks[offsetWeeks]) {
                                        const w = weeks[offsetWeeks];
                                        setVisibleDate(`${format(w, 'yyyy년 M월 d일')} ~ ${format(addDays(w, 4), 'M월 d일')}`);
                                    }
                                }
                            }}
                            className="p-xs hover-bg-secondary rounded-full transition-colors cursor-pointer"
                            title="4주 전"
                            style={{ border: 'none', background: 'transparent', color: 'var(--text-primary)' }}
                        >
                            <ChevronLeft size={18} />
                        </button>

                        <div className="flex items-center gap-xs px-sm border-l border-r border-border mx-xs" style={{ position: 'relative' }}>
                            {!isMobile && (
                                <button
                                    onClick={(e) => {
                                        setCalendarPickerRect(e.currentTarget.getBoundingClientRect());
                                        let initialDate = new Date();
                                        if (tableContainerRef.current && weeks && weeks.length > 0) {
                                            const offsetWeeks = Math.max(0, Math.round(tableContainerRef.current.scrollLeft / columnWidths.week));
                                            if (weeks[offsetWeeks]) {
                                                initialDate = weeks[offsetWeeks];
                                            }
                                        }
                                        setCalPickerYear(initialDate.getFullYear());
                                        setCalPickerMonth(initialDate.getMonth());
                                        setShowCalendarPicker(v => !v);
                                    }}
                                    title="달력으로 날짜 이동"
                                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-muted)', padding: '2px' }}
                                >
                                    <Calendar size={15} />
                                </button>
                            )}
                            <span
                                style={{ fontWeight: 600, fontSize: isMobile ? '0.75em' : '0.85em', minWidth: isMobile ? '70px' : '160px', textAlign: 'center' }}
                            >
                                {isMobile ? mobileDate : visibleDate}
                            </span>
                            {/* Calendar Picker Portal */}
                            {showCalendarPicker && calendarPickerRect && (() => {
                                // Calculate start and end days for the month grid
                                const startMonth = new Date(calPickerYear, calPickerMonth, 1);
                                const endMonth = new Date(calPickerYear, calPickerMonth + 1, 0);

                                const calStart = startOfWeek(startMonth, { weekStartsOn: 1 });
                                const calEnd = endOfWeek(endMonth, { weekStartsOn: 1 });

                                const eachDay = [];
                                let curr = new Date(calStart);
                                while (curr <= calEnd) {
                                    eachDay.push(new Date(curr));
                                    curr.setDate(curr.getDate() + 1);
                                }

                                const calendarWeeks = [];
                                for (let i = 0; i < eachDay.length; i += 7) {
                                    calendarWeeks.push(eachDay.slice(i, i + 7));
                                }

                                const handlePrevMonth = () => {
                                    if (calPickerMonth === 0) {
                                        setCalPickerYear(y => y - 1);
                                        setCalPickerMonth(11);
                                    } else {
                                        setCalPickerMonth(m => m - 1);
                                    }
                                };

                                const handleNextMonth = () => {
                                    if (calPickerMonth === 11) {
                                        setCalPickerYear(y => y + 1);
                                        setCalPickerMonth(0);
                                    } else {
                                        setCalPickerMonth(m => m + 1);
                                    }
                                };

                                return createPortal(
                                    <div
                                        className="inline-search-results"
                                        style={{
                                            position: 'fixed',
                                            left: `${calendarPickerRect.left - 60}px`,
                                            top: `${calendarPickerRect.bottom + 6}px`,
                                            width: '280px',
                                            zIndex: 9999,
                                            padding: '12px',
                                            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                                            borderRadius: '12px',
                                            userSelect: 'none'
                                        }}
                                        onMouseDown={(e) => e.stopPropagation()}
                                    >
                                        {/* Year & Month nav */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                            <button style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '1.2em', padding: '2px 10px', fontWeight: 'bold' }}
                                                onClick={handlePrevMonth}>‹</button>
                                            <strong style={{ fontSize: '0.95em' }}>{calPickerYear}년 {calPickerMonth + 1}월</strong>
                                            <button style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '1.2em', padding: '2px 10px', fontWeight: 'bold' }}
                                                onClick={handleNextMonth}>›</button>
                                        </div>

                                        {/* Weekday headers */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', fontSize: '0.78em', fontWeight: 'bold', borderBottom: '1px solid var(--border)', paddingBottom: '6px', marginBottom: '6px', color: 'var(--text-muted)' }}>
                                            <div>월</div><div>화</div><div>수</div><div>목</div><div>금</div>
                                            <div style={{ color: '#3b82f6' }}>토</div><div style={{ color: '#ef4444' }}>일</div>
                                        </div>

                                        {/* Weekly Calendar rows */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                            {calendarWeeks.map((week, wIdx) => {
                                                const monday = week[0];
                                                const isHovered = hoveredWeekIdx === wIdx;

                                                return (
                                                    <div
                                                        key={wIdx}
                                                        onMouseEnter={() => setHoveredWeekIdx(wIdx)}
                                                        onMouseLeave={() => setHoveredWeekIdx(null)}
                                                        onClick={() => {
                                                            const weeksFromStart = Math.round((monday - weeks[0]) / (7 * 24 * 3600 * 1000));
                                                            const clampedWeeks = Math.max(0, Math.min(weeks.length - 1, weeksFromStart));
                                                            if (tableContainerRef.current) {
                                                                const scrollLeft = clampedWeeks * columnWidths.week;
                                                                tableContainerRef.current.scrollTo({ left: scrollLeft, behavior: 'smooth' });
                                                            }
                                                            const targetWeek = weeks[clampedWeeks] || monday;
                                                            setVisibleDate(`${format(targetWeek, 'yyyy년 M월 d일')} ~ ${format(addDays(targetWeek, 4), 'M월 d일')}`);
                                                            setShowCalendarPicker(false);
                                                        }}
                                                        style={{
                                                            display: 'grid',
                                                            gridTemplateColumns: 'repeat(7, 1fr)',
                                                            gap: '4px',
                                                            padding: '4px 0',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            backgroundColor: isHovered ? 'var(--primary-muted, rgba(99, 102, 241, 0.08))' : 'transparent',
                                                            transition: 'background-color 0.15s'
                                                        }}
                                                    >
                                                        {week.map((day, dIdx) => {
                                                            const isCurrentMonth = day.getMonth() === calPickerMonth;
                                                            const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                                                            
                                                            let dayColor = 'var(--text-primary)';
                                                            if (!isCurrentMonth) {
                                                                dayColor = 'var(--text-muted)';
                                                            } else if (dIdx === 5) {
                                                                dayColor = '#3b82f6'; // Sat
                                                            } else if (dIdx === 6) {
                                                                dayColor = '#ef4444'; // Sun
                                                            }

                                                            return (
                                                                <div
                                                                    key={dIdx}
                                                                    style={{
                                                                        textAlign: 'center',
                                                                        padding: '4px 0',
                                                                        fontSize: '0.8em',
                                                                        color: dayColor,
                                                                        opacity: isCurrentMonth ? 1 : 0.4,
                                                                        fontWeight: isToday ? 'bold' : 'normal',
                                                                        border: isToday ? '1px solid var(--color-primary, #6366f1)' : 'none',
                                                                        borderRadius: '4px',
                                                                        backgroundColor: isToday ? 'var(--primary-muted, rgba(99, 102, 241, 0.05))' : 'transparent'
                                                                    }}
                                                                >
                                                                    {day.getDate()}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div style={{ marginTop: '10px', textAlign: 'center', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                                            <button
                                                style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 16px', fontSize: '0.8em', cursor: 'pointer', background: 'transparent', color: 'var(--text-primary)' }}
                                                onClick={() => setShowCalendarPicker(false)}
                                            >닫기</button>
                                        </div>
                                    </div>,
                                    document.body
                                );
                            })()}
                        </div>

                        <button
                            onClick={() => {
                                if (tableContainerRef.current) {
                                    const newScrollLeft = tableContainerRef.current.scrollLeft + (4 * columnWidths.week);
                                    tableContainerRef.current.scrollBy({ left: 4 * columnWidths.week, behavior: 'smooth' });
                                    const offsetWeeks = Math.min(weeks.length - 1, Math.round(newScrollLeft / columnWidths.week));
                                    if (weeks[offsetWeeks]) {
                                        const w = weeks[offsetWeeks];
                                        setVisibleDate(`${format(w, 'yyyy년 M월 d일')} ~ ${format(addDays(w, 4), 'M월 d일')}`);
                                    }
                                }
                            }}
                            className="p-xs hover-bg-secondary rounded-full transition-colors cursor-pointer"
                            title="4주 후"
                            style={{ border: 'none', background: 'transparent', color: 'var(--text-primary)' }}
                        >
                            <ChevronRight size={18} />
                        </button>

                        <button
                            onClick={handleToday}
                            className="text-xs font-bold text-primary hover-bg-primary-light-10 px-md py-1.5 rounded-lg ml-xs uppercase tracking-wide cursor-pointer"
                            style={{ border: 'none', background: 'transparent' }}
                        >
                            Today
                        </button>
                    </div>

                    {/* Right: Search & Settings */}
                    <div className="flex items-center gap-xs relative">
                        {!isToolbarCollapsed && !isMobile && (
                            <div className="search-input-wrapper">
                                <input
                                    type="text"
                                    placeholder="프로젝트 또는 이름 찾기..."
                                    className="premium-search-input"
                                    value={projectSearchTerm}
                                    onChange={(e) => setProjectSearchTerm(e.target.value)}
                                />
                                <Search size={14} className="search-icon-glass" />
                                {projectSearchTerm && (
                                    <button
                                        onClick={() => setProjectSearchTerm('')}
                                        className="search-clear-btn"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Premium Excel Export Widget */}
                        {!isToolbarCollapsed && !isMobile && (
                            <div className="premium-export-widget">
                                <div className="flex items-center gap-xs">
                                    <div className="p-1 rounded-md bg-primary-muted text-primary flex items-center justify-center">
                                        <FileDown size={14} />
                                    </div>
                                    <span className="export-period-label hidden xl:block">Excel Period</span>
                                </div>
                                
                                <div className="flex items-center gap-xs px-xs">
                                    <button
                                        type="button"
                                        className={`premium-date-input-display ${showExcelCalPicker === 'start' ? 'active' : ''}`}
                                        onClick={(e) => openExcelCalPicker('start', e)}
                                        title="엑셀 추출 시작일 선택"
                                    >
                                        <Calendar size={11} style={{ opacity: 0.7 }} />
                                        <span>{exportStartDate}</span>
                                    </button>
                                    <span className="text-muted text-[10px]">~</span>
                                    <button
                                        type="button"
                                        className={`premium-date-input-display ${showExcelCalPicker === 'end' ? 'active' : ''}`}
                                        onClick={(e) => openExcelCalPicker('end', e)}
                                        title="엑셀 추출 종료일 선택"
                                    >
                                        <Calendar size={11} style={{ opacity: 0.7 }} />
                                        <span>{exportEndDate}</span>
                                    </button>
                                </div>

                                <button
                                    onClick={handleDownloadExcel}
                                    disabled={isDownloading}
                                    className="btn-export-premium"
                                    title="엑셀 다운로드"
                                >
                                    {isDownloading ? (
                                        <div className="export-loading-spinner"></div>
                                    ) : (
                                        <>
                                            <Check size={14} />
                                            <span>엑셀 추출</span>
                                        </>
                                    )}
                                </button>

                                {/* Excel Date Picker Dropdown Portal */}
                                {showExcelCalPicker && excelCalRect && (() => {
                                    const startMonth = new Date(excelCalYear, excelCalMonth, 1);
                                    const endMonth = new Date(excelCalYear, excelCalMonth + 1, 0);

                                    const calStart = startOfWeek(startMonth, { weekStartsOn: 1 });
                                    const calEnd = endOfWeek(endMonth, { weekStartsOn: 1 });

                                    const eachDay = [];
                                    let curr = new Date(calStart);
                                    while (curr <= calEnd) {
                                        eachDay.push(new Date(curr));
                                        curr.setDate(curr.getDate() + 1);
                                    }

                                    const calendarWeeks = [];
                                    for (let i = 0; i < eachDay.length; i += 7) {
                                        calendarWeeks.push(eachDay.slice(i, i + 7));
                                    }

                                    const handlePrevMonth = () => {
                                        if (excelCalMonth === 0) {
                                            setExcelCalYear(y => y - 1);
                                            setExcelCalMonth(11);
                                        } else {
                                            setExcelCalMonth(m => m - 1);
                                        }
                                    };

                                    const handleNextMonth = () => {
                                        if (excelCalMonth === 11) {
                                            setExcelCalYear(y => y + 1);
                                            setExcelCalMonth(0);
                                        } else {
                                            setExcelCalMonth(m => m + 1);
                                        }
                                    };

                                    const selectedDateVal = showExcelCalPicker === 'start' ? exportStartDate : exportEndDate;

                                    return createPortal(
                                        <div
                                            className="inline-search-results"
                                            style={{
                                                position: 'fixed',
                                                left: `${excelCalRect.left}px`,
                                                top: `${excelCalRect.bottom + 6}px`,
                                                width: '260px',
                                                zIndex: 9999,
                                                padding: '12px',
                                                boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                                                borderRadius: '12px',
                                                userSelect: 'none'
                                            }}
                                            onMouseDown={(e) => e.stopPropagation()}
                                        >
                                            {/* Year & Month nav */}
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                                <button style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '1.2em', padding: '2px 10px', fontWeight: 'bold' }}
                                                    onClick={handlePrevMonth}>‹</button>
                                                <strong style={{ fontSize: '0.95em' }}>{excelCalYear}년 {excelCalMonth + 1}월</strong>
                                                <button style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '1.2em', padding: '2px 10px', fontWeight: 'bold' }}
                                                    onClick={handleNextMonth}>›</button>
                                            </div>

                                            {/* Weekday headers */}
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', fontSize: '0.78em', fontWeight: 'bold', borderBottom: '1px solid var(--border)', paddingBottom: '6px', marginBottom: '6px', color: 'var(--text-muted)' }}>
                                                <div>월</div><div>화</div><div>수</div><div>목</div><div>금</div>
                                                <div style={{ color: '#3b82f6' }}>토</div><div style={{ color: '#ef4444' }}>일</div>
                                            </div>

                                            {/* Days grid */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                {calendarWeeks.map((week, wIdx) => (
                                                    <div
                                                        key={wIdx}
                                                        style={{
                                                            display: 'grid',
                                                            gridTemplateColumns: 'repeat(7, 1fr)',
                                                            gap: '4px'
                                                        }}
                                                    >
                                                        {week.map((day, dIdx) => {
                                                            const isCurrentMonth = day.getMonth() === excelCalMonth;
                                                            const dateStr = format(day, 'yyyy-MM-dd');
                                                            const isSelected = dateStr === selectedDateVal;
                                                            const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');

                                                            let dayColor = 'var(--text-primary)';
                                                            if (!isCurrentMonth) {
                                                                dayColor = 'var(--text-muted)';
                                                            } else if (dIdx === 5) {
                                                                dayColor = '#3b82f6'; // Sat
                                                            } else if (dIdx === 6) {
                                                                dayColor = '#ef4444'; // Sun
                                                            }

                                                            return (
                                                                <div
                                                                    key={dIdx}
                                                                    onClick={() => {
                                                                        if (showExcelCalPicker === 'start') {
                                                                            setExportStartDate(dateStr);
                                                                        } else {
                                                                            setExportEndDate(dateStr);
                                                                        }
                                                                        setShowExcelCalPicker(null);
                                                                    }}
                                                                    style={{
                                                                        textAlign: 'center',
                                                                        padding: '5px 0',
                                                                        fontSize: '0.8em',
                                                                        color: dayColor,
                                                                        opacity: isCurrentMonth ? 1 : 0.3,
                                                                        fontWeight: isSelected || isToday ? 'bold' : 'normal',
                                                                        border: isSelected ? '1px solid var(--color-primary, #6366f1)' : isToday ? '1px solid rgba(99, 102, 241, 0.4)' : 'none',
                                                                        borderRadius: '4px',
                                                                        backgroundColor: isSelected ? 'var(--primary-muted, rgba(99, 102, 241, 0.15))' : isToday ? 'var(--primary-muted, rgba(99, 102, 241, 0.05))' : 'transparent',
                                                                        cursor: 'pointer',
                                                                        transition: 'all 0.15s'
                                                                    }}
                                                                    onMouseEnter={(e) => {
                                                                        if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--primary-muted, rgba(99, 102, 241, 0.08))';
                                                                    }}
                                                                    onMouseLeave={(e) => {
                                                                        if (!isSelected) e.currentTarget.style.backgroundColor = isToday ? 'var(--primary-muted, rgba(99, 102, 241, 0.05))' : 'transparent';
                                                                    }}
                                                                >
                                                                    {day.getDate()}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ))}
                                            </div>

                                            <div style={{ marginTop: '10px', textAlign: 'center', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                                                <button
                                                    style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 16px', fontSize: '0.8em', cursor: 'pointer', background: 'transparent', color: 'var(--text-primary)' }}
                                                    onClick={() => setShowExcelCalPicker(null)}
                                                >닫기</button>
                                            </div>
                                        </div>,
                                        document.body
                                    );
                                })()}
                            </div>
                        )}

                        {!isToolbarCollapsed && canEdit && (
                            <button
                                onClick={handleOpenProjectModal}
                                className="btn btn-primary flex items-center gap-xs px-md py-1.5 rounded-lg text-xs font-semibold"
                            >
                                <Plus size={14} /> 프로젝트 추가
                            </button>
                        )}

                        {/* 숨김 프로젝트 관리 위젯 */}
                        {!isToolbarCollapsed && (
                            <div className="relative" ref={hideManagerRef} style={{ zIndex: 1000 }}>
                                <button
                                    onClick={() => setShowHideManager(!showHideManager)}
                                    className={`btn flex items-center gap-xs px-md py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${showHideManager ? 'bg-secondary text-white' : 'btn-outline'}`}
                                    title="숨긴 프로젝트 목록"
                                    style={{ border: '1px solid var(--border)', background: showHideManager ? 'var(--surface-high)' : 'transparent', color: 'var(--text-primary)' }}
                                >
                                    <EyeOff size={14} />
                                    <span>숨김 관리 ({hiddenProjectIds.length})</span>
                                </button>

                                {showHideManager && (
                                    <div
                                        className="absolute right-0 top-full mt-xs border-2 border-border rounded-lg z-[2000] p-md animate-in fade-in slide-in-from-top-2 duration-200"
                                        style={{
                                            backgroundColor: '#000000',
                                            width: '280px',
                                            boxShadow: 'var(--shadow-xl)',
                                            maxHeight: '300px',
                                            overflowY: 'auto'
                                        }}
                                    >
                                        <div style={{ fontWeight: 'bold', fontSize: '0.85em', borderBottom: '1px solid var(--border)', paddingBottom: '6px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#ffffff' }}>
                                            <span>숨겨진 프로젝트 목록</span>
                                            {hiddenProjectIds.length > 0 && (
                                                <button
                                                    onClick={() => setHiddenProjectIds([])}
                                                    style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8em', fontWeight: 'bold' }}
                                                >
                                                    전체 해제
                                                </button>
                                            )}
                                        </div>
                                        {hiddenProjectIds.length === 0 ? (
                                            <div className="text-center text-muted py-md" style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>
                                                숨겨진 프로젝트가 없습니다.
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-xs" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                {hiddenProjectIds.map(id => {
                                                    const proj = allMasterProjects.find(p => p.id === id) || data.find(p => p.id === id);
                                                    if (!proj) return null;
                                                    return (
                                                        <div key={id} className="flex justify-between items-center py-xs" style={{ borderBottom: '1px dotted var(--border)', gap: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <span style={{ fontSize: '0.8em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, color: '#ffffff', textAlign: 'left' }} title={proj.name}>
                                                                {proj.name}
                                                            </span>
                                                            <button
                                                                onClick={() => {
                                                                    setHiddenProjectIds(prev => prev.filter(hid => hid !== id));
                                                                }}
                                                                className="btn btn-outline"
                                                                style={{ padding: '2px 8px', fontSize: '0.75em', minHeight: 'auto', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--border)', color: '#ffffff', background: 'transparent' }}
                                                            >
                                                                표시
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="relative z-1000" ref={settingsRef}>
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className={`p-1.5 rounded-full transition-all cursor-pointer ${showSettings ? 'bg-primary text-white rotate-90' : 'hover-bg-secondary text-muted'}`}
                                title="설정"
                                style={{ border: 'none' }}
                            >
                                <Settings size={20} />
                            </button>

                            {/* Settings Popover */}
                            {showSettings && (
                                <div
                                    className="absolute right-0 bottom-full mb-xs border-2 border-border rounded-lg z-1000 p-md animate-in fade-in slide-in-from-bottom-2 duration-200 popover-enter"
                                    style={{
                                        backgroundColor: '#000000',
                                        width: '260px',
                                        boxShadow: '0 -10px 50px rgba(0, 0, 0, 0.9)'
                                    }}
                                >
                                    <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-sm pb-xs border-b border-border">화면 설정</h3>

                                    <div className="flex flex-col gap-md">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-semibold text-white">열 너비 조정</span>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="toggle-checkbox"
                                                    checked={isResizeMode}
                                                    onChange={() => setIsResizeMode(!isResizeMode)}
                                                />
                                            </label>
                                        </div>

                                        {isResizeMode && (
                                            <div className="flex flex-col gap-xs bg-tertiary p-sm rounded-md border border-border mt-xs">
                                                <div className="flex justify-between items-center mb-xs">
                                                    <span className="text-white text-xs font-semibold">주차 너비 (px)</span>
                                                    <span className="bg-primary text-white px-1.5 rounded text-xs font-bold">{columnWidths.week}</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="50"
                                                    max="200"
                                                    step="5"
                                                    value={columnWidths.week}
                                                    onChange={(e) => handleWidthInputChange('week', e.target.value)}
                                                    className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                                                />
                                                <div className="flex justify-between text-[10px] text-white opacity-60 mt-xs">
                                                    <span>좁게</span>
                                                    <span>넓게</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>

            {/* Top-Integrated Period Slider (Scrollbar Style - Scroll Sync Mode) */}
            <div className="period-slider-container">
                <input
                    ref={sliderRef}
                    type="range"
                    min="0"
                    max={weeks.length - 1} // Limit to total generated weeks
                    defaultValue="0"
                    onChange={handleSliderChange}
                    className="period-slider-input"
                    title="기간 이동 (좌우 스크롤)"
                />
            </div>

            <div
                ref={tableContainerRef}
                onScroll={handleTableScroll}
                className="table-container"
                style={{ overflowX: 'auto', maxHeight: '80vh' }}
            >
                <table
                    className="table project-grid"
                    style={{
                        borderCollapse: 'collapse',
                        borderSpacing: 0,
                        tableLayout: 'fixed',
                        width: `${(columnWidths.group + columnWidths.position + columnWidths.grade + columnWidths.employmentType + columnWidths.name + columnWidths.workLocation + columnWidths.startDate + columnWidths.endDate) + (weeks.length * columnWidths.week)}px`
                    }}
                >
                    <colgroup>
                        <col style={{ width: columnWidths.group }} />
                        <col style={{ width: columnWidths.position }} />
                        <col style={{ width: columnWidths.grade }} />
                        <col style={{ width: columnWidths.employmentType }} />
                        <col style={{ width: columnWidths.name }} />
                        <col style={{ width: columnWidths.workLocation }} />
                        <col style={{ width: columnWidths.startDate }} />
                        <col style={{ width: columnWidths.endDate }} />
                        {leftSpacerWidth > 0 && <col style={{ width: leftSpacerWidth }} />}
                        {visibleWeeks.map(w => (
                            <col key={w.toString()} style={{ width: columnWidths.week }} />
                        ))}
                        {rightSpacerWidth > 0 && <col style={{ width: rightSpacerWidth }} />}
                    </colgroup>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 200, backgroundColor: 'var(--surface-high)' }}>
                        {/* Month Group Header Row */}
                        <tr>
                            <th colSpan={8} style={{ position: 'sticky', left: 0, zIndex: 201, backgroundColor: 'var(--surface-high)', borderBottom: '1px solid var(--border)' }}></th>
                            {leftSpacerWidth > 0 && <th style={{ width: leftSpacerWidth, minWidth: leftSpacerWidth, backgroundColor: 'var(--surface-high)' }} />}
                            {(() => {
                                // Only render month groups that overlap with visible range
                                const visibleMonthGroups = [];
                                let acc = 0;
                                for (const group of monthGroups) {
                                    const gStart = acc;
                                    const gEnd = acc + group.weekCount - 1;
                                    acc += group.weekCount;
                                    if (gEnd < visibleColRange.start || gStart > visibleColRange.end) continue;
                                    const clippedStart = Math.max(gStart, visibleColRange.start);
                                    const clippedEnd = Math.min(gEnd, visibleColRange.end);
                                    visibleMonthGroups.push({ ...group, weekCount: clippedEnd - clippedStart + 1 });
                                }
                                return visibleMonthGroups.map((group, idx) => (
                                    <th
                                        key={`month-${idx}`}
                                        colSpan={group.weekCount}
                                        onClick={() => handleMonthClick(group.startIndex)}
                                        style={{
                                            textAlign: 'center',
                                            borderLeft: '1px solid var(--border)',
                                            backgroundColor: 'var(--surface-high)',
                                            fontSize: '0.85em',
                                            padding: '4px 0',
                                            width: `${columnWidths.week * group.weekCount}px`,
                                            overflow: 'hidden',
                                            whiteSpace: 'nowrap',
                                            cursor: 'pointer'
                                        }}
                                        title={`${group.month}로 이동`}
                                    >
                                        {group.month}
                                    </th>
                                ));
                            })()}
                            {rightSpacerWidth > 0 && <th style={{ width: rightSpacerWidth, minWidth: rightSpacerWidth, backgroundColor: 'var(--surface-high)' }} />}
                        </tr>
                        {/* Weekly Range Header Row */}
                        <tr>
                            {viewMode === 'project' ? (
                                <>
                                    <th style={{ position: 'sticky', left: getStickyLeft('group', 'project'), zIndex: 201, minWidth: columnWidths.group, width: columnWidths.group, backgroundColor: 'var(--surface-high)' }}>
                                        <div className="flex items-center justify-between">
                                            <span>소속</span>
                                            {isResizeMode && <input type="number" className="width-input" value={columnWidths.group} onChange={(e) => handleWidthInputChange('group', e.target.value)} />}
                                            <div className="resize-handle" onMouseDown={(e) => startResizing('group', e)}></div>
                                        </div>
                                    </th>
                                    <th style={{ position: 'sticky', left: getStickyLeft('position', 'project'), zIndex: 201, minWidth: columnWidths.position, width: columnWidths.position, backgroundColor: 'var(--surface-high)' }}>
                                        <div className="flex items-center justify-between">
                                            <span>직급</span>
                                            {isResizeMode && <input type="number" className="width-input" value={columnWidths.position} onChange={(e) => handleWidthInputChange('position', e.target.value)} />}
                                            <div className="resize-handle" onMouseDown={(e) => startResizing('position', e)}></div>
                                        </div>
                                    </th>
                                    <th style={{ position: 'sticky', left: getStickyLeft('grade', 'project'), zIndex: 201, minWidth: columnWidths.grade, width: columnWidths.grade, backgroundColor: 'var(--surface-high)' }}>
                                        <div className="flex items-center justify-between">
                                            <span>등급</span>
                                            {isResizeMode && <input type="number" className="width-input" value={columnWidths.grade} onChange={(e) => handleWidthInputChange('grade', e.target.value)} />}
                                            <div className="resize-handle" onMouseDown={(e) => startResizing('grade', e)}></div>
                                        </div>
                                    </th>
                                    <th style={{ position: 'sticky', left: getStickyLeft('employmentType', 'project'), zIndex: 201, minWidth: columnWidths.employmentType, width: columnWidths.employmentType, backgroundColor: 'var(--surface-high)' }}>
                                        <div className="flex items-center justify-between">
                                            <span>고용</span>
                                            {isResizeMode && <input type="number" className="width-input" value={columnWidths.employmentType} onChange={(e) => handleWidthInputChange('employmentType', e.target.value)} />}
                                            <div className="resize-handle" onMouseDown={(e) => startResizing('employmentType', e)}></div>
                                        </div>
                                    </th>
                                    <th style={{ position: 'sticky', left: getStickyLeft('name', 'project'), zIndex: 201, minWidth: columnWidths.name, width: columnWidths.name, backgroundColor: 'var(--surface-high)' }}>
                                        <div className="flex items-center justify-between">
                                            <span>이름</span>
                                            {isResizeMode && <input type="number" className="width-input" value={columnWidths.name} onChange={(e) => handleWidthInputChange('name', e.target.value)} />}
                                            <div className="resize-handle" onMouseDown={(e) => startResizing('name', e)}></div>
                                        </div>
                                    </th>
                                    <th style={{ position: 'sticky', left: getStickyLeft('workLocation', 'project'), zIndex: 201, minWidth: columnWidths.workLocation, width: columnWidths.workLocation, backgroundColor: 'var(--surface-high)' }}>
                                        <div className="flex items-center justify-between">
                                            <span>근무</span>
                                            {isResizeMode && <input type="number" className="width-input" value={columnWidths.workLocation} onChange={(e) => handleWidthInputChange('workLocation', e.target.value)} />}
                                            <div className="resize-handle" onMouseDown={(e) => startResizing('workLocation', e)}></div>
                                        </div>
                                    </th>
                                    <th style={{ position: 'sticky', left: getStickyLeft('startDate', 'project'), zIndex: 201, minWidth: columnWidths.startDate, width: columnWidths.startDate, backgroundColor: 'var(--surface-high)', fontSize: '0.8em', borderLeft: '1px solid var(--border)' }}>
                                        <div className="flex items-center justify-between">
                                            <span>투입일</span>
                                            {isResizeMode && <input type="number" className="width-input" value={columnWidths.startDate} onChange={(e) => handleWidthInputChange('startDate', e.target.value)} />}
                                            <div className="resize-handle" onMouseDown={(e) => startResizing('startDate', e)}></div>
                                        </div>
                                    </th>
                                    <th style={{ position: 'sticky', left: getStickyLeft('endDate', 'project'), zIndex: 201, minWidth: columnWidths.endDate, width: columnWidths.endDate, backgroundColor: 'var(--surface-high)', fontSize: '0.8em' }}>
                                        <div className="flex items-center justify-between">
                                            <span>종료일</span>
                                            {isResizeMode && <input type="number" className="width-input" value={columnWidths.endDate} onChange={(e) => handleWidthInputChange('endDate', e.target.value)} />}
                                            <div className="resize-handle" onMouseDown={(e) => startResizing('endDate', e)}></div>
                                        </div>
                                    </th>
                                </>
                            ) : (
                                <>
                                    <th style={{ position: 'sticky', left: getStickyLeft('group', 'group'), zIndex: 201, minWidth: columnWidths.group, width: columnWidths.group, backgroundColor: 'var(--bg-tertiary)' }}>
                                        <div className="flex items-center justify-between">
                                            <span>소속</span>
                                            {isResizeMode && <input type="number" className="width-input" value={columnWidths.group} onChange={(e) => handleWidthInputChange('group', e.target.value)} />}
                                            <div className="resize-handle" onMouseDown={(e) => startResizing('group', e)}></div>
                                        </div>
                                    </th>
                                    <th style={{ position: 'sticky', left: getStickyLeft('position', 'group'), zIndex: 201, minWidth: columnWidths.position, width: columnWidths.position, backgroundColor: 'var(--bg-tertiary)' }}>
                                        <div className="flex items-center justify-between">
                                            <span>직급</span>
                                            {isResizeMode && <input type="number" className="width-input" value={columnWidths.position} onChange={(e) => handleWidthInputChange('position', e.target.value)} />}
                                            <div className="resize-handle" onMouseDown={(e) => startResizing('position', e)}></div>
                                        </div>
                                    </th>
                                    <th style={{ position: 'sticky', left: getStickyLeft('grade', 'group'), zIndex: 201, minWidth: columnWidths.grade, width: columnWidths.grade, backgroundColor: 'var(--bg-tertiary)' }}>
                                        <div className="flex items-center justify-between">
                                            <span>등급</span>
                                            {isResizeMode && <input type="number" className="width-input" value={columnWidths.grade} onChange={(e) => handleWidthInputChange('grade', e.target.value)} />}
                                            <div className="resize-handle" onMouseDown={(e) => startResizing('grade', e)}></div>
                                        </div>
                                    </th>
                                    <th style={{ position: 'sticky', left: getStickyLeft('employmentType', 'group'), zIndex: 201, minWidth: columnWidths.employmentType, width: columnWidths.employmentType, backgroundColor: 'var(--bg-tertiary)' }}>
                                        <div className="flex items-center justify-between">
                                            <span>고용</span>
                                            {isResizeMode && <input type="number" className="width-input" value={columnWidths.employmentType} onChange={(e) => handleWidthInputChange('employmentType', e.target.value)} />}
                                            <div className="resize-handle" onMouseDown={(e) => startResizing('employmentType', e)}></div>
                                        </div>
                                    </th>
                                    <th style={{ position: 'sticky', left: getStickyLeft('name', 'group'), zIndex: 201, minWidth: columnWidths.name, width: columnWidths.name, backgroundColor: 'var(--bg-tertiary)' }}>
                                        <div className="flex items-center justify-between">
                                            <span>이름</span>
                                            {isResizeMode && <input type="number" className="width-input" value={columnWidths.name} onChange={(e) => handleWidthInputChange('name', e.target.value)} />}
                                            <div className="resize-handle" onMouseDown={(e) => startResizing('name', e)}></div>
                                        </div>
                                    </th>
                                    <th style={{ position: 'sticky', left: getStickyLeft('workLocation', 'group'), zIndex: 201, minWidth: columnWidths.workLocation, width: columnWidths.workLocation, backgroundColor: 'var(--bg-tertiary)' }}>
                                        <div className="flex items-center justify-between">
                                            <span>근무</span>
                                            {isResizeMode && <input type="number" className="width-input" value={columnWidths.workLocation} onChange={(e) => handleWidthInputChange('workLocation', e.target.value)} />}
                                            <div className="resize-handle" onMouseDown={(e) => startResizing('workLocation', e)}></div>
                                        </div>
                                    </th>
                                    <th style={{ position: 'sticky', left: getStickyLeft('startDate', 'group'), zIndex: 201, minWidth: columnWidths.startDate, width: columnWidths.startDate, backgroundColor: 'var(--bg-tertiary)', fontSize: '0.8em', borderLeft: '1px solid var(--border)' }}>
                                        <div className="flex items-center justify-between">
                                            <span>투입일</span>
                                            {isResizeMode && <input type="number" className="width-input" value={columnWidths.startDate} onChange={(e) => handleWidthInputChange('startDate', e.target.value)} />}
                                            <div className="resize-handle" onMouseDown={(e) => startResizing('startDate', e)}></div>
                                        </div>
                                    </th>
                                    <th style={{ position: 'sticky', left: getStickyLeft('endDate', 'group'), zIndex: 201, minWidth: columnWidths.endDate, width: columnWidths.endDate, backgroundColor: 'var(--bg-tertiary)', fontSize: '0.8em' }}>
                                        <div className="flex items-center justify-between">
                                            <span>종료일</span>
                                            {isResizeMode && <input type="number" className="width-input" value={columnWidths.endDate} onChange={(e) => handleWidthInputChange('endDate', e.target.value)} />}
                                            <div className="resize-handle" onMouseDown={(e) => startResizing('endDate', e)}></div>
                                        </div>
                                    </th>
                                </>
                            )}

                            {leftSpacerWidth > 0 && <th style={{ width: leftSpacerWidth, minWidth: leftSpacerWidth, backgroundColor: 'var(--surface-high)' }} />}
                            {visibleWeeks.map((week, wIdx) => {
                                const isCurrent = wIdx === visibleCurrentWeekIdx;
                                return (
                                    <th key={week.toString()} style={{
                                        width: `${columnWidths.week}px`,
                                        textAlign: 'center',
                                        borderLeft: '1px solid var(--border)',
                                        padding: '2px 0',
                                        backgroundColor: isCurrent ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            fontSize: '10px',
                                            color: isCurrent ? '#ef4444' : 'var(--text-muted)',
                                            lineHeight: 1,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            fontWeight: isCurrent ? 'bold' : 'normal',
                                            visibility: columnWidths.week < 25 ? 'hidden' : 'visible'
                                        }}>
                                            <span>{format(week, 'd')}</span>
                                            <span style={{ fontSize: '8px', opacity: 0.7 }}>~</span>
                                            <span>{format(addDays(week, 4), 'd')}</span>
                                        </div>
                                    </th>
                                );
                            })}
                            {rightSpacerWidth > 0 && <th style={{ width: rightSpacerWidth, minWidth: rightSpacerWidth, backgroundColor: 'var(--surface-high)' }} />}
                        </tr>
                    </thead>
                    {viewMode === 'project' ? (
                        (() => {
                            let currentGlobalRowIndex = 0;
                            return (
                                <>
                                    {/* Active Projects */}
                                    {filteredData.active.map((project, pIdx) => {
                                        const memberStartIndex = currentGlobalRowIndex;
                                        currentGlobalRowIndex += project.members.length;
                                        if (!project.isCompleted) currentGlobalRowIndex += 1;

                                        return (
                                            <LazyProjectRowWrapper key={project.id} estimatedHeight={60 + (project.members.length * 40)}>
                                                <ProjectItem
                                                    key={project.id}
                                                    project={project}
                                                    pIdx={pIdx}
                                                    dataLength={filteredData.active.length}
                                                    isCompleted={false}
                                                    weeks={visibleWeeks}
                                                    weekDateStrs={visibleWeekDateStrs}
                                                    weekEndStrs={visibleWeekEndStrs}
                                                    currentWeekIdx={visibleCurrentWeekIdx}
                                                    columnWidths={columnWidths}
                                                    cursor={cursor}
                                                    setCursor={setCursor}
                                                    cellRefs={cellRefs}
                                                    highlightMatch={highlightMatch}
                                                    projectSearchTerm={projectSearchTerm}
                                                    isCurrentWeek={isCurrentWeek}
                                                    handleReorderProject={handleReorderProject}
                                                    handleDeleteProject={handleDeleteProject}
                                                    handleHideProject={handleHideProject}
                                                    getStickyLeft={getStickyLeft}
                                                    memberStartIndex={memberStartIndex}
                                                    isDateInRange={isDateInRange}
                                                    autoFormatDate={autoFormatDate}
                                                    handleAssignmentUpdate={handleAssignmentUpdate}
                                                    handleAllocationChange={handleAllocationChange}
                                                    handleAllocationBlur={handleAllocationBlur}
                                                    handleFillForward={handleFillForward}
                                                    handleKeyDown={handleKeyDown}
                                                    handlePaste={handlePaste}
                                                    handleRemoveMember={handleRemoveMember}
                                                    handleReorderMember={handleReorderMember}
                                                    getFilteredEmployees={getFilteredEmployees}
                                                    handleInlineAssign={handleInlineAssign}
                                                    handleTBDAssign={handleAssignTBD}
                                                    leftSpacerWidth={leftSpacerWidth}
                                                    rightSpacerWidth={rightSpacerWidth}
                                                    visibleStartIdx={visibleColRange.start}
                                                    canEdit={canEdit}
                                                    onToggleCountInStats={handleToggleCountInStats}
                                                    isAdmin={user?.role === 'Admin'}
                                                />
                                            </LazyProjectRowWrapper>
                                        );
                                    })}

                                    {/* Completed Projects Section */}
                                    {filteredData.completed.length > 0 && showCompleted && (
                                        <>
                                            <tbody key="completed-sec-header">
                                                <tr className="completed-section-header" onClick={() => setIsCompletedSectionExpanded(!isCompletedSectionExpanded)}>
                                                    <td colSpan={8 + weeks.length} style={{
                                                        backgroundColor: 'var(--surface-high)',
                                                        padding: '10px 16px',
                                                        cursor: 'pointer',
                                                        borderTop: '2px solid var(--border)',
                                                        borderBottom: '1px solid var(--border)'
                                                    }}>
                                                        <div className="flex items-center gap-sm">
                                                            <span style={{
                                                                transform: isCompletedSectionExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                                                                transition: 'transform 0.2s',
                                                                display: 'inline-block'
                                                            }}>▼</span>
                                                            <span style={{ fontWeight: 'bold', color: 'var(--text-muted)' }}>
                                                                지난 프로젝트 (Completed Projects: {filteredData.completed.length}건)
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            </tbody>
                                            {isCompletedSectionExpanded && filteredData.completed.map((project, pIdx) => {
                                                const isExpanded = expandedCompletedProjects.includes(project.id);
                                                const memberStartIndex = currentGlobalRowIndex;
                                                if (isExpanded) {
                                                    currentGlobalRowIndex += project.members.length;
                                                }

                                                return (
                                                    <LazyProjectRowWrapper key={project.id} estimatedHeight={isExpanded ? 60 + (project.members.length * 40) : 60}>
                                                        <ProjectItem
                                                            key={project.id}
                                                            project={project}
                                                            pIdx={pIdx}
                                                            dataLength={filteredData.completed.length}
                                                            isCompleted={true}
                                                            isExpanded={isExpanded}
                                                            onToggleExpand={() => {
                                                                setExpandedCompletedProjects(prev =>
                                                                    prev.includes(project.id)
                                                                        ? prev.filter(id => id !== project.id)
                                                                        : [...prev, project.id]
                                                                )
                                                            }}
                                                            weeks={visibleWeeks}
                                                            columnWidths={columnWidths}
                                                            cursor={cursor}
                                                            setCursor={setCursor}
                                                            cellRefs={cellRefs}
                                                            highlightMatch={highlightMatch}
                                                            projectSearchTerm={projectSearchTerm}
                                                            isCurrentWeek={isCurrentWeek}
                                                            handleReorderProject={handleReorderProject}
                                                            handleDeleteProject={handleDeleteProject}
                                                            handleHideProject={handleHideProject}
                                                            getStickyLeft={getStickyLeft}
                                                            memberStartIndex={memberStartIndex}
                                                            isDateInRange={isDateInRange}
                                                            autoFormatDate={autoFormatDate}
                                                            handleAssignmentUpdate={handleAssignmentUpdate}
                                                            handleAllocationChange={handleAllocationChange}
                                                            handleAllocationBlur={handleAllocationBlur}
                                                            handleFillForward={handleFillForward}
                                                            handleKeyDown={handleKeyDown}
                                                            handlePaste={handlePaste}
                                                            handleRemoveMember={handleRemoveMember}
                                                            handleReorderMember={handleReorderMember}
                                                            getFilteredEmployees={getFilteredEmployees}
                                                            handleInlineAssign={handleInlineAssign}
                                                            handleTBDAssign={handleAssignTBD}
                                                            leftSpacerWidth={leftSpacerWidth}
                                                            rightSpacerWidth={rightSpacerWidth}
                                                            visibleStartIdx={visibleColRange.start}
                                                            canEdit={canEdit}
                                                            onToggleCountInStats={handleToggleCountInStats}
                                                        />
                                                    </LazyProjectRowWrapper>
                                                );
                                            })}
                                        </>
                                    )}
                                </>
                            );
                        })()
                    ) : (
                        (() => {
                            let globalRowIndex = 0;
                            return groupStats.filter(g => selectedGroup === 'ALL' || g.name === selectedGroup).map((group) => {
                                const groupCalc = groupCalcMap[group.name];
                                return (
                                    <React.Fragment key={group.name}>
                                        {/* Group Header Row 전용 tbody */}
                                        <tbody key={`g-tbody-${group.name}`}>
                                            <tr key={`group-h-${group.name}`} style={{ backgroundColor: 'var(--surface-high)' }}>
                                                <td
                                                    style={{ position: 'sticky', left: 0, zIndex: 12, backgroundColor: 'var(--surface-high)', fontWeight: 'bold' }}
                                                    colSpan={8}
                                                >
                                                    <div className="flex items-center gap-md">
                                                        <span className="badge" style={{ backgroundColor: group.color }}>{group.name}</span>
                                                        <span>(인원: {group.memberCount}명)</span>
                                                    </div>
                                                </td>
                                                {leftSpacerWidth > 0 && <td style={{ width: leftSpacerWidth, backgroundColor: 'var(--surface-high)' }} />}
                                                {visibleWeeks.map((week, wIdx) => {
                                                    const total = groupCalc.stats[visibleColRange.start + wIdx] || 0;
                                                    const isCurrent = wIdx === visibleCurrentWeekIdx;
                                                    return (
                                                        <td key={wIdx} style={{
                                                            textAlign: 'center',
                                                            fontWeight: 'bold',
                                                            backgroundColor: 'var(--surface-high)',
                                                            color: total > group.memberCount ? '#ef4444' : (total > 0 ? 'var(--primary)' : 'var(--text-muted)'),
                                                            borderRight: isCurrent ? '2px solid #ef4444' : 'none',
                                                            minWidth: `${columnWidths.week}px`,
                                                            maxWidth: `${columnWidths.week}px`
                                                        }}>
                                                            {total > 0 ? total.toFixed(1) : '-'}
                                                        </td>
                                                    );
                                                })}
                                                {rightSpacerWidth > 0 && <td style={{ width: rightSpacerWidth, backgroundColor: 'var(--surface-high)' }} />}
                                            </tr>
                                        </tbody>

                                        {group.projects.map((p) => (
                                            <LazyProjectRowWrapper key={p.id} estimatedHeight={60 + (p.assignments.length * 40)}>
                                                <tr className="sub-header">
                                                    <td colSpan={8} style={{ position: 'sticky', left: 0, zIndex: 11, backgroundColor: 'var(--primary-glow)', paddingLeft: '2rem', fontSize: '0.9em' }}>
                                                        <div className="flex items-center justify-between w-full">
                                                            <div className="flex items-center gap-xs">
                                                                <span>📁 {p.name}</span>
                                                                <span className={`badge ${p.type === 'Internal' ? 'badge-primary' : (p.type === 'Leave' || p.type === 'Annual' ? 'badge-neutral' : 'badge-success')}`} style={{ fontSize: '0.7em', opacity: 0.8 }}>
                                                                    {p.type || 'Client'}
                                                                </span>
                                                                {p.status && (
                                                                    <span className="badge" style={{
                                                                        backgroundColor: p.status === '진행중' ? '#16a34a' : p.status === '진행예정' ? '#2563eb' : '#6b7280',
                                                                        fontSize: '0.7em', opacity: 0.8, color: 'white'
                                                                    }}>{p.status}</span>
                                                                )}
                                                            </div>
                                                            {canEdit && (
                                                                <div className="flex items-center gap-xs" style={{ marginRight: '8px' }}>
                                                                    <button
                                                                        onClick={() => handleHideProject(p.id, p.name)}
                                                                        className="reorder-btn"
                                                                        title="프로젝트 숨기기"
                                                                        style={{ opacity: 0.5 }}
                                                                    >👁️‍🗨️</button>
                                                                    <button
                                                                        onClick={() => handleDeleteProject(p.id, p.name)}
                                                                        className="reorder-btn hover-danger"
                                                                        title="프로젝트 삭제"
                                                                        style={{ opacity: 0.5 }}
                                                                    >🗑️</button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    {leftSpacerWidth > 0 && <td style={{ width: leftSpacerWidth, backgroundColor: 'rgba(59, 130, 246, 0.02)' }} />}
                                                    {visibleWeeks.map((week, wIdx) => (
                                                        <td key={wIdx} style={{
                                                            backgroundColor: 'rgba(59, 130, 246, 0.02)',
                                                            borderRight: wIdx === visibleCurrentWeekIdx ? '2px solid #ef4444' : 'none',
                                                            minWidth: `${columnWidths.week}px`,
                                                            maxWidth: `${columnWidths.week}px`
                                                        }}></td>
                                                    ))}
                                                    {rightSpacerWidth > 0 && <td style={{ width: rightSpacerWidth, backgroundColor: 'rgba(59, 130, 246, 0.02)' }} />}
                                                </tr>
                                                {p.assignments.map((assignment, aIdx) => {
                                                    const currentMemberIndex = globalRowIndex++;
                                                    return (
                                                        <GroupMemberRow
                                                            key={`gmem-${assignment.id}`}
                                                            assignment={assignment}
                                                            weeks={visibleWeeks}
                                                            weekDateStrs={visibleWeekDateStrs}
                                                            weekEndStrs={visibleWeekEndStrs}
                                                            currentWeekIdx={visibleCurrentWeekIdx}
                                                            columnWidths={columnWidths}
                                                            cursor={cursor}
                                                            currentMemberIndex={currentMemberIndex}
                                                            getStickyLeft={getStickyLeft}
                                                            autoFormatDate={autoFormatDate}
                                                            handleAssignmentUpdate={handleAssignmentUpdate}
                                                            handleAllocationChange={handleAllocationChange}
                                                            handleAllocationBlur={handleAllocationBlur}
                                                            handleFillForward={handleFillForward}
                                                            handleKeyDown={handleKeyDown}
                                                            handlePaste={handlePaste}
                                                            handleRemoveMember={handleRemoveMember}
                                                            handleReorderMember={handleReorderMember}
                                                            projectId={p.id}
                                                            projectMemberCount={p.assignments.length}
                                                            mIdx={aIdx}
                                                            setCursor={setCursor}
                                                            getFilteredEmployees={getFilteredEmployees}
                                                            cellRefs={cellRefs}
                                                            leftSpacerWidth={leftSpacerWidth}
                                                            rightSpacerWidth={rightSpacerWidth}
                                                            canEdit={canEdit}
                                                        />
                                                    );
                                                })}

                                                {/* Group View Inline Add Row per Project */}
                                                {canEdit && (() => {
                                                    const addRowIndex = globalRowIndex++;
                                                    return (
                                                        <InlineAddRow
                                                            key={`gadd-${p.id}`}
                                                            project={p}
                                                            weeks={visibleWeeks}
                                                            columnWidths={columnWidths}
                                                            viewMode={viewMode}
                                                            getStickyLeft={getStickyLeft}
                                                            isCurrentWeek={isCurrentWeek}
                                                            cursor={cursor}
                                                            addRowIndex={addRowIndex}
                                                            handleInlineAssign={handleInlineAssign}
                                                            handleTBDAssign={(projectId, tbdType) => handleAssignTBD(projectId, tbdType, group.name, group.color, group.id)}
                                                            getFilteredEmployees={getFilteredEmployees}
                                                            setCursor={setCursor}
                                                            cellRefs={cellRefs}
                                                            leftSpacerWidth={leftSpacerWidth}
                                                            rightSpacerWidth={rightSpacerWidth}
                                                            groupFilter={group.name}
                                                        />
                                                    );
                                                })()}
                                            </LazyProjectRowWrapper>
                                        ))}

                                        {/* Group Summary Row 및 통계 데이터 전용 tbody */}
                                        <tbody key={`g-sum-tbody-${group.name}`}>
                                            {(() => {
                                                const { stats, weeklyStatus, activeClientProjects, headcount, idle } = groupCalc;
                                                const monthName = (d) => format(d, 'M월');

                                                return (
                                                    <>
                                                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                                                            <td colSpan={8 + weeks.length} style={{ padding: 0 }}>
                                                                <div style={{ position: 'sticky', left: 0, padding: '8px 16px', backgroundColor: '#f8fafc', zIndex: 11, width: 'max-content' }}>
                                                                    <div style={{ display: 'flex', gap: '24px', fontSize: '0.85em', color: '#334155', flexWrap: 'wrap' }}>
                                                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                                            <strong>수행중인 프로젝트(Client):</strong> {activeClientProjects}개
                                                                        </div>
                                                                        <div style={{ width: '1px', height: '16px', backgroundColor: '#cbd5e1' }}></div>
                                                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                                            <strong>인원 현황:</strong>
                                                                            <span>총 {headcount.total}명</span>
                                                                            <span style={{ color: '#64748b' }}>(정규직 {headcount.regular}, 계약직 {headcount.contract}, 파견 {headcount.dispatch}, 내근 {headcount.inHouse})</span>
                                                                        </div>
                                                                        <div style={{ width: '1px', height: '16px', backgroundColor: '#cbd5e1' }}></div>
                                                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                                            <strong>유휴 현황 (정규직):</strong>
                                                                            {(() => {
                                                                                const renderBadge = (data, label) => {
                                                                                    const rate = parseFloat(data.rate) || 0;
                                                                                    let config = { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0', label: '평온' };
                                                                                    if (rate >= 20) config = { bg: '#fef2f2', text: '#991b1b', border: '#fecaca', label: '위험' };
                                                                                    else if (rate >= 10) config = { bg: '#fffbeb', text: '#92400e', border: '#fde68a', label: '경계' };

                                                                                    return (
                                                                                        <div key={label} style={{
                                                                                            display: 'flex',
                                                                                            alignItems: 'center',
                                                                                            gap: '6px',
                                                                                            padding: '2px 8px',
                                                                                            backgroundColor: config.bg,
                                                                                            border: `1px solid ${config.border}`,
                                                                                            borderRadius: '6px',
                                                                                            fontSize: '0.9em'
                                                                                        }}>
                                                                                            <span style={{ color: '#64748b', fontSize: '0.85em' }}>{label}:</span>
                                                                                            <span style={{ fontWeight: 700, color: config.text }}>{data.count}명 ({data.rate}%)</span>
                                                                                            <span style={{
                                                                                                fontSize: '0.8em',
                                                                                                fontWeight: 800,
                                                                                                padding: '1px 4px',
                                                                                                borderRadius: '4px',
                                                                                                backgroundColor: config.text,
                                                                                                color: '#fff'
                                                                                            }}>{config.label}</span>
                                                                                        </div>
                                                                                    );
                                                                                };

                                                                                return (
                                                                                    <React.Fragment key="badges">
                                                                                        {renderBadge(idle.thisWeek, '이번주')}
                                                                                        {renderBadge(idle.nextWeek, '다음주')}
                                                                                        {renderBadge(idle.monthAvg, '이번달 평균')}
                                                                                        {renderBadge(idle.month1, monthName(addWeeks(new Date(), 4)))}
                                                                                        {renderBadge(idle.month2, monthName(addWeeks(new Date(), 8)))}
                                                                                        {renderBadge(idle.month3, monthName(addWeeks(new Date(), 12)))}
                                                                                    </React.Fragment>
                                                                                );
                                                                            })()}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                        {/* Weekly Personnel Status Rows */}
                                                        <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                                                            <td style={{ position: 'sticky', left: 0, zIndex: 10, backgroundColor: '#f1f5f9', padding: '4px 8px', fontSize: '0.75em', fontWeight: 'bold', color: '#475569', textAlign: 'right', borderRight: '1px solid #cbd5e1' }} colSpan={8}>
                                                                미투입 (0 MM)
                                                            </td>
                                                            {leftSpacerWidth > 0 && <td style={{ width: leftSpacerWidth, backgroundColor: '#f1f5f9' }} />}
                                                            {visibleWeeks.map((week, wIdx) => {
                                                                const dateStr = visibleWeekDateStrs[wIdx];
                                                                const members = weeklyStatus[dateStr]?.zero || [];
                                                                const isCurrent = wIdx === visibleCurrentWeekIdx;
                                                                return (
                                                                    <td key={`zero-${dateStr}`} style={{
                                                                        minWidth: `${columnWidths.week}px`,
                                                                        maxWidth: `${columnWidths.week}px`,
                                                                        padding: '4px 2px',
                                                                        fontSize: '0.7em',
                                                                        textAlign: 'center',
                                                                        verticalAlign: 'top',
                                                                        color: '#475569',
                                                                        borderLeft: '1px solid #e2e8f0',
                                                                        borderRight: isCurrent ? '2px solid #ef4444' : 'none',
                                                                        lineHeight: '1.2',
                                                                        overflow: 'hidden',
                                                                        whiteSpace: 'pre-wrap'
                                                                    }}>
                                                                        {members.join('\n')}
                                                                    </td>
                                                                );
                                                            })}
                                                            {rightSpacerWidth > 0 && <td style={{ width: rightSpacerWidth, backgroundColor: '#f1f5f9' }} />}
                                                        </tr>
                                                        <tr style={{ backgroundColor: '#fffbeb', borderBottom: '1px solid #fcd34d' }}>
                                                            <td style={{ position: 'sticky', left: 0, zIndex: 10, backgroundColor: '#fffbeb', padding: '4px 8px', fontSize: '0.75em', fontWeight: 'bold', color: '#d97706', textAlign: 'right', borderRight: '1px solid #fcd34d' }} colSpan={8}>
                                                                부분 투입 (1.0 MM 미만)
                                                            </td>
                                                            {leftSpacerWidth > 0 && <td style={{ width: leftSpacerWidth, backgroundColor: '#fffbeb' }} />}
                                                            {visibleWeeks.map((week, wIdx) => {
                                                                const dateStr = visibleWeekDateStrs[wIdx];
                                                                const members = weeklyStatus[dateStr]?.under50 || [];
                                                                const isCurrent = wIdx === visibleCurrentWeekIdx;
                                                                return (
                                                                    <td key={`under50-${dateStr}`} style={{
                                                                        minWidth: `${columnWidths.week}px`,
                                                                        maxWidth: `${columnWidths.week}px`,
                                                                        padding: '4px 2px',
                                                                        fontSize: '0.7em',
                                                                        textAlign: 'center',
                                                                        verticalAlign: 'top',
                                                                        color: '#d97706',
                                                                        borderLeft: '1px solid #fef3c7',
                                                                        borderRight: isCurrent ? '2px solid #ef4444' : 'none',
                                                                        lineHeight: '1.2',
                                                                        overflow: 'hidden',
                                                                        whiteSpace: 'pre-wrap'
                                                                    }}>
                                                                        {members.join('\n')}
                                                                    </td>
                                                                );
                                                            })}
                                                            {rightSpacerWidth > 0 && <td style={{ width: rightSpacerWidth, backgroundColor: '#fffbeb' }} />}
                                                        </tr>
                                                        <tr style={{ backgroundColor: '#eff6ff', borderBottom: '2px solid var(--border)' }}>
                                                            <td style={{ position: 'sticky', left: 0, zIndex: 10, backgroundColor: '#eff6ff', padding: '4px 8px', fontSize: '0.75em', fontWeight: 'bold', color: '#2563eb', textAlign: 'right', borderRight: '1px solid #bfdbfe' }} colSpan={8}>
                                                                풀투입 (1.1 MM 이상)
                                                            </td>
                                                            {leftSpacerWidth > 0 && <td style={{ width: leftSpacerWidth, backgroundColor: '#eff6ff' }} />}
                                                            {visibleWeeks.map((week, wIdx) => {
                                                                const dateStr = visibleWeekDateStrs[wIdx];
                                                                const members = weeklyStatus[dateStr]?.over100 || [];
                                                                const isCurrent = wIdx === visibleCurrentWeekIdx;
                                                                return (
                                                                    <td key={`over100-${dateStr}`} style={{
                                                                        minWidth: `${columnWidths.week}px`,
                                                                        maxWidth: `${columnWidths.week}px`,
                                                                        padding: '4px 2px',
                                                                        fontSize: '0.7em',
                                                                        textAlign: 'center',
                                                                        verticalAlign: 'top',
                                                                        color: '#2563eb',
                                                                        borderLeft: '1px solid #dbeafe',
                                                                        borderRight: isCurrent ? '2px solid #ef4444' : 'none',
                                                                        lineHeight: '1.2',
                                                                        overflow: 'hidden',
                                                                        whiteSpace: 'pre-wrap'
                                                                    }}>
                                                                        {members.join('\n')}
                                                                    </td>
                                                                );
                                                            })}
                                                            {rightSpacerWidth > 0 && <td style={{ width: rightSpacerWidth, backgroundColor: '#eff6ff' }} />}
                                                        </tr>
                                                    </>
                                                );
                                            })()}
                                        </tbody>
                                    </React.Fragment>
                                );
                            });
                        })()
                    )}
                </table>
            </div>



            {/* Add Project Modal (Optimized) */}
            <AddProjectModal
                isOpen={showProjectModal}
                onClose={() => setShowProjectModal(false)}
                onAdd={handleAddProject}
                allMasterProjects={allMasterProjects}
                employees={employees}
                currentProjects={data}
                viewMode={viewMode}
                selectedGroup={selectedGroup}
                isLoading={masterDataLoading}
            />

            {/* Member Assignment Modal */}
            {
                showMemberModal && createPortal((
                    <div className="modal-overlay" onClick={() => setShowMemberModal(false)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                            <div className="modal-header">
                                <h2 className="modal-title">인원 배정 - {selectedProject?.name}</h2>
                                <button className="modal-close" onClick={() => setShowMemberModal(false)}>✕</button>
                            </div>

                            <div className="p-md">
                                <div className="mb-md" style={{ padding: '12px', background: 'var(--surface-high)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                    <div style={{ fontSize: '0.8em', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>TBD 플레이스홀더 추가</div>
                                    <div className="flex gap-sm">
                                        <button
                                            className="btn btn-sm"
                                            style={{ background: '#6366f1', color: 'white', border: 'none', borderRadius: '6px', padding: '5px 14px', cursor: 'pointer', fontSize: '0.85em' }}
                                            onClick={() => handleAssignTBD(selectedProject?.id, 'Regular')}
                                        >정규직 TBD 추가</button>
                                        <button
                                            className="btn btn-sm"
                                            style={{ background: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', padding: '5px 14px', cursor: 'pointer', fontSize: '0.85em' }}
                                            onClick={() => handleAssignTBD(selectedProject?.id, 'Contract')}
                                        >계약직 TBD 추가</button>
                                    </div>
                                </div>

                                <div className="form-group mb-md">
                                    <label className="form-label">이름으로 검색</label>
                                    <input
                                        autoFocus
                                        type="text"
                                        className="form-controlSearch"
                                        placeholder="이름을 입력하세요 (예: 홍길동)"
                                        onChange={(e) => {
                                            const term = e.target.value.toLowerCase();
                                            setModalSearchTerm(term);
                                        }}
                                    />
                                </div>

                                <div className="search-results" style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                                    {employees
                                        .filter(emp => {
                                            if (!modalSearchTerm) return false;
                                            const isAlreadyAssigned = selectedProject?.members?.some(m => m.employee_id === emp.id);
                                            return !isAlreadyAssigned && (
                                                emp.name.toLowerCase().includes(modalSearchTerm) ||
                                                emp.group_name?.toLowerCase().includes(modalSearchTerm) ||
                                                emp.position?.toLowerCase().includes(modalSearchTerm)
                                            );
                                        })
                                        .map(emp => (
                                            <div
                                                key={emp.id}
                                                className="search-item"
                                                onClick={() => handleAssignMember(emp.id)}
                                            >
                                                <div className="flex justify-between items-center w-full">
                                                    <div className="flex items-center gap-md">
                                                        <span className="badge" style={{ backgroundColor: emp.group_color }}>{emp.group_name}</span>
                                                        <div>
                                                            <strong>{emp.name}</strong>
                                                            <span className="text-muted ml-sm" style={{ fontSize: '0.85em' }}>{emp.position}</span>
                                                        </div>
                                                    </div>
                                                    <button className="btn btn-xs btn-primary">배정</button>
                                                </div>
                                            </div>
                                        ))
                                    }
                                    {modalSearchTerm && employees.filter(emp => {
                                        const isAlreadyAssigned = selectedProject?.members?.some(m => m.employee_id === emp.id);
                                        return !isAlreadyAssigned && (
                                            emp.name.toLowerCase().includes(modalSearchTerm) ||
                                            emp.group_name?.toLowerCase().includes(modalSearchTerm) ||
                                            emp.position?.toLowerCase().includes(modalSearchTerm)
                                        );
                                    }).length === 0 && (
                                            <div className="p-lg text-center text-muted">검색 결과가 없습니다.</div>
                                        )}
                                    {!modalSearchTerm && (
                                        <div className="p-lg text-center text-muted">이름을 입력하여 직원을 검색하세요.</div>
                                    )}
                                </div>
                            </div>

                            <div className="modal-footer flex justify-end p-md">
                                <button onClick={() => setShowMemberModal(false)} className="btn btn-secondary">닫기</button>
                            </div>
                        </div>
                    </div>
                ), document.body)
            }
            {/* Custom Confirm Modal */}
            {
                confirmConfig.isOpen && createPortal((
                    <div className="confirm-overlay" onClick={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}>
                        <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
                            <div className={`confirm-header ${confirmConfig.type}`}>
                                {confirmConfig.title}
                            </div>
                            <div className="confirm-body">
                                {confirmConfig.message.split('\n').map((line, i) => (
                                    <p key={i}>{line}</p>
                                ))}
                            </div>
                            <div className="confirm-footer">
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                                >취소</button>
                                <button
                                    className={`btn ${confirmConfig.type === 'danger' ? 'btn-danger' : 'btn-primary'}`}
                                    onClick={confirmConfig.onConfirm}
                                >확인</button>
                            </div>
                        </div>
                    </div>
                ), document.body)
            }
        </div >
    );
};

/**
 * AddProjectModal Component
 * Extracted to prevent main ProjectStatus table re-renders on every keystroke.
 */
const AddProjectModal = React.memo(({ isOpen, onClose, onAdd, allMasterProjects, employees, currentProjects, viewMode, selectedGroup, isLoading }) => {
    const [searchQuery, setSearchQuery] = useState('');

    if (!isOpen) return null;

    const currentProjectNames = new Set(currentProjects.map(p => p.name));
    
    // In Group View, we want to see which projects already have members from the selected group
    const projectsWithGroupMembers = new Set();
    if (viewMode === 'group' && selectedGroup && selectedGroup !== 'ALL') {
        currentProjects.forEach(p => {
            if (p.members.some(m => m.group_name === selectedGroup)) {
                projectsWithGroupMembers.add(p.name);
            }
        });
    }

    const typePriority = { 'Client': 1, 'Internal': 2, 'Annual': 3, 'Leave': 4 };

    const filteredProjects = allMasterProjects.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.pd && p.pd.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (p.pm && p.pm.toLowerCase().includes(searchQuery.toLowerCase()));
        
        const isAlreadyOnBoard = currentProjectNames.has(p.name);
        const hasGroupMembers = projectsWithGroupMembers.has(p.name);

        if (viewMode === 'group' && selectedGroup && selectedGroup !== 'ALL') {
            // In group view, hide only if it ALREADY has members from this specific group
            return matchesSearch && !hasGroupMembers;
        }

        // In project view or global group view, hide if already on board
        return matchesSearch && !isAlreadyOnBoard;
    }).sort((a, b) => {
        const pA = typePriority[a.type] || 99;
        const pB = typePriority[b.type] || 99;
        if (pA !== pB) return pA - pB;
        return a.name.localeCompare(b.name, 'ko');
    });

    const handleSelect = (project) => {
        onAdd(project);
    };

    return createPortal((
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(5, 8, 20, 0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100000,
            padding: '20px'
        }} onClick={onClose}>
            <div style={{ 
                width: '100%', 
                maxWidth: '600px', 
                maxHeight: '85vh',
                backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                borderRadius: '28px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 50px 100px -20px rgba(0, 0, 0, 0.9)',
                overflow: 'hidden',
                position: 'relative',
                color: 'white',
                fontFamily: 'Inter, system-ui, sans-serif',
                display: 'flex',
                flexDirection: 'column'
            }} onClick={(e) => e.stopPropagation()}>
                
                {/* Header */}
                <div style={{ padding: '32px 32px 24px', position: 'relative', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <button 
                        onClick={onClose} 
                        style={{
                            position: 'absolute',
                            right: '24px',
                            top: '24px',
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            transition: '0.2s',
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = '#ef4444'; }}
                        onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = '#94a3b8'; }}
                    >
                        <X size={20} />
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
                        <div style={{ 
                            width: '44px', 
                            height: '44px', 
                            borderRadius: '14px', 
                            backgroundColor: 'rgba(34, 211, 238, 0.1)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            color: '#22d3ee',
                            border: '1px solid rgba(34, 211, 238, 0.2)',
                            boxShadow: '0 0 20px rgba(34, 211, 238, 0.1)'
                        }}>
                            <Search size={24} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '-0.02em', margin: 0 }}>프로젝트 선택</h2>
                            <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0' }}>마스터 리스트에서 추가할 프로젝트를 선택하세요.</p>
                        </div>
                    </div>

                    <div style={{ position: 'relative', marginTop: '24px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                        <input 
                            type="text" 
                            placeholder="프로젝트명, PD 또는 PM으로 검색..."
                            style={{
                                width: '100%',
                                backgroundColor: 'rgba(5, 8, 20, 0.5)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '16px',
                                padding: '16px 20px 16px 48px',
                                color: 'white',
                                fontSize: '15px',
                                fontWeight: '500',
                                outline: 'none',
                                transition: '0.2s',
                            }}
                            autoFocus
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.4)'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(34, 211, 238, 0.05)'; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'; e.currentTarget.style.boxShadow = 'none'; }}
                        />
                    </div>
                </div>

                {/* List Container */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '16px 32px 32px',
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'rgba(255,255,255,0.1) transparent'
                }}>
                    {isLoading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '16px' }}>
                            <div style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#22d3ee', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                            <span style={{ color: '#64748b', fontSize: '14px' }}>프로젝트 목록을 불러오는 중...</span>
                        </div>
                    ) : (
                    <div style={{ display: 'grid', gap: '10px' }}>
                        {filteredProjects.length > 0 ? (
                            filteredProjects.map((p, idx) => (
                                <div 
                                    key={p.id}
                                    onClick={() => handleSelect(p)}
                                    style={{
                                        padding: '16px 20px',
                                        backgroundColor: 'rgba(30, 41, 59, 0.3)',
                                        border: '1px solid rgba(255, 255, 255, 0.05)',
                                        borderRadius: '18px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        animation: `fadeInUp 0.3s ease-out forwards ${idx * 0.03}s`,
                                        opacity: 0,
                                        transform: 'translateY(10px)'
                                    }}
                                    onMouseOver={(e) => {
                                        e.currentTarget.style.backgroundColor = 'rgba(34, 211, 238, 0.08)';
                                        e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.3)';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 10px 25px -10px rgba(0, 0, 0, 0.5)';
                                    }}
                                    onMouseOut={(e) => {
                                        e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.3)';
                                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                >
                                    <div style={{ flex: 1, paddingRight: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                            <span style={{ 
                                                fontSize: '10px', 
                                                fontWeight: '800', 
                                                padding: '2px 8px', 
                                                borderRadius: '6px', 
                                                backgroundColor: p.type === 'Client' ? 'rgba(34, 211, 238, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                                                color: p.type === 'Client' ? '#22d3ee' : '#94a3b8',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.02em'
                                            }}>
                                                {p.type}
                                            </span>
                                            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#f8fafc' }}>{p.name}</h4>
                                        </div>
                                        <div style={{ display: 'flex', gap: '16px' }}>
                                            {p.pd && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b' }}>
                                                    <User size={12} style={{ opacity: 0.6 }} />
                                                    <span>PD: <span style={{ color: '#94a3b8', fontWeight: '600' }}>{p.pd}</span></span>
                                                </div>
                                            )}
                                            {p.pm && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b' }}>
                                                    <Briefcase size={12} style={{ opacity: 0.6 }} />
                                                    <span>PM: <span style={{ color: '#94a3b8', fontWeight: '600' }}>{p.pm}</span></span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ 
                                        width: '32px', 
                                        height: '32px', 
                                        borderRadius: '10px', 
                                        backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center',
                                        color: '#64748b',
                                        transition: '0.2s'
                                    }} className="arrow-box">
                                        <Plus size={18} />
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div style={{ textAlign: 'center', padding: '60px 0', color: '#475569' }}>
                                <AlertCircle size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
                                <p style={{ fontSize: '15px', fontWeight: '500' }}>해당하는 프로젝트가 없습니다.</p>
                                <p style={{ fontSize: '13px', opacity: 0.7, marginTop: '4px' }}>다른 검색어를 입력해 보세요.</p>
                            </div>
                        )}
                    </div>
                    )}
                </div>

                <style>{`
                    @keyframes fadeInUp {
                        from { opacity: 0; transform: translateY(10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    div::-webkit-scrollbar {
                        width: 6px;
                    }
                    div::-webkit-scrollbar-thumb {
                        background: rgba(255, 255, 255, 0.1);
                        border-radius: 10px;
                    }
                    div::-webkit-scrollbar-track {
                        background: transparent;
                    }
                `}</style>
            </div>
        </div>
    ), document.body);
});

export default ProjectStatus;
