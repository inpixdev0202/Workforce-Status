import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { projectsAPI, employeesAPI } from '../api';
import { ChevronLeft, ChevronRight, Calendar, Settings, Plus, LayoutGrid, LayoutDashboard, Users, Search, X, Check, ChevronDown, Briefcase, Clock, User, AlertCircle, Shield, Key, FileDown } from 'lucide-react';
import { format, addWeeks, addDays, startOfWeek, endOfWeek, eachWeekOfInterval, parseISO, isWithinInterval, startOfDay, endOfDay, areIntervalsOverlapping, isAfter, isBefore } from 'date-fns';
import { ko } from 'date-fns/locale';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { hasAccess, MENU_ITEMS } from '../constants/menuConfig';

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
    onCancel
}) => {
    const [searchTerm, setSearchTerm] = useState(initialTerm);
    const [autoCompleteIdx, setAutoCompleteIdx] = useState(-1);
    const [inputRect, setInputRect] = useState(null);
    const [isOpen, setIsOpen] = useState(false);

    const filteredEmployees = useMemo(() => getFilteredEmployees(projectId, searchTerm), [projectId, searchTerm, getFilteredEmployees]);

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
            {isOpen && searchTerm && inputRect && createPortal(
                <div
                    className="inline-search-results"
                    style={{
                        position: 'fixed',
                        left: `${inputRect.left}px`,
                        top: `${inputRect.bottom + 4 + 250 > window.innerHeight
                            ? inputRect.top - Math.min(filteredEmployees.length * 52 + 10, 250) - 4
                            : inputRect.bottom + 4}px`,
                        width: `${Math.max(inputRect.width, 300)}px`,
                        zIndex: 9999
                    }}
                >
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
                    {filteredEmployees.length === 0 && <div className="p-sm text-center text-muted">결과 없음</div>}
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
    columnWidths,
    cursor,
    currentMemberIndex,
    getStickyLeft,
    isCurrentWeek,
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
    const opacity = isCompleted ? 0.5 : 1;
    const bgColor = isCompleted ? 'var(--surface-low)' : 'var(--bg-primary)';

    return (
        <tr key={`mem-${member.id}`} style={{ opacity, borderBottom: '1px solid var(--border)' }}>
            <td style={{ position: 'sticky', left: getStickyLeft('group', 'project'), zIndex: 10, width: columnWidths.group, backgroundColor: bgColor, borderBottom: '1px solid var(--border)' }}>
                <span className="badge" style={{ backgroundColor: member.group_color, fontSize: '0.7em' }}>{member.group_name}</span>
            </td>
            <td style={{ position: 'sticky', left: getStickyLeft('position', 'project'), zIndex: 10, width: columnWidths.position, backgroundColor: bgColor, borderBottom: '1px solid var(--border)' }}>{member.employee_position}</td>
            <td style={{ position: 'sticky', left: getStickyLeft('grade', 'project'), zIndex: 10, width: columnWidths.grade, backgroundColor: bgColor, fontSize: '0.8em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{member.employee_grade}</td>
            <td style={{ position: 'sticky', left: getStickyLeft('employmentType', 'project'), zIndex: 10, width: columnWidths.employmentType, backgroundColor: bgColor, fontSize: '0.8em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{member.employee_employment_type}</td>
            <td style={{ position: 'sticky', left: getStickyLeft('name', 'project'), zIndex: 10, width: columnWidths.name, backgroundColor: bgColor, borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-sm">
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
                        <div
                            ref={(el) => (cellRefs.current[`${currentMemberIndex}-swap`] = el)}
                            className="flex items-center gap-xs"
                            style={{ padding: '2px 4px' }}
                        >
                            <span>{member.employee_name}</span>
                        </div>
                    </div>
                    {!isCompleted && canEdit && (
                        <button
                            onClick={() => handleRemoveMember(member.id, member.employee_name)}
                            className="reorder-btn hover-danger"
                            title="배정 해제"
                            style={{ marginLeft: '4px', opacity: 0.5 }}
                        >🗑️</button>
                    )}
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
                    const dateStr = format(week, 'yyyy-MM-dd');
                    const val = member.allocations?.[dateStr] || '';
                    const globalWeekIdx = (visibleStartIdx + weekIndex) + 2;
                    const isFocused = cursor.memberIndex === currentMemberIndex && cursor.weekIndex === globalWeekIdx;
                    const inRange = project.type === 'Annual' ? true : isDateInRange(week, member.input_start_date, member.input_end_date);
                    const isCurrent = isCurrentWeek(week);

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

const GroupMemberRow = React.memo(({
    assignment,
    weeks,
    columnWidths,
    cursor,
    currentMemberIndex,
    getStickyLeft,
    isCurrentWeek,
    isDateInRange,
    autoFormatDate,
    handleAssignmentUpdate,
    handleAllocationChange,
    handleAllocationBlur,
    handleFillForward,
    handleKeyDown,
    handlePaste,
    handleRemoveMember,
    projectId,
    setCursor,
    cellRefs,
    leftSpacerWidth,
    rightSpacerWidth,
    canEdit
}) => {
    return (
        <tr key={assignment.id} style={{ borderBottom: '1px solid var(--border)' }}>
            <td style={{ position: 'sticky', left: getStickyLeft('name', 'group'), zIndex: 10, width: columnWidths.name, backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between w-full">
                    <span>{assignment.employee_name}</span>
                    {canEdit && (
                        <button
                            onClick={() => handleRemoveMember(projectId, assignment.id, assignment.employee_name)}
                            className="reorder-btn hover-danger"
                            title="배정 해제"
                            style={{ marginLeft: '4px', opacity: 0.5 }}
                        >🗑️</button>
                    )}
                </div>
            </td>
            <td style={{ position: 'sticky', left: getStickyLeft('position', 'group'), zIndex: 10, width: columnWidths.position, backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border)' }}>{assignment.employee_position}</td>
            <td style={{ position: 'sticky', left: getStickyLeft('grade', 'group'), zIndex: 10, width: columnWidths.grade, backgroundColor: 'var(--bg-primary)', fontSize: '0.8em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{assignment.employee_grade}</td>
            <td style={{ position: 'sticky', left: getStickyLeft('employmentType', 'group'), zIndex: 10, width: columnWidths.employmentType, backgroundColor: 'var(--bg-primary)', fontSize: '0.8em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{assignment.employee_employment_type}</td>
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
                const dateStr = format(week, 'yyyy-MM-dd');
                const val = assignment.allocations?.[dateStr] || '';
                const globalWeekIdx = weekIndex + 2;
                const isFocused = cursor.memberIndex === currentMemberIndex && cursor.weekIndex === globalWeekIdx;
                const inRange = assignment.project_type === 'Annual' ? true : isDateInRange(week, assignment.input_start_date, assignment.input_end_date);
                const isCurrent = isCurrentWeek(week);

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
    getFilteredEmployees,
    setCursor,
    cellRefs,
    rightSpacerWidth
}) => {
    return (
        <tr style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
            {viewMode === 'project' && (
                <td colSpan={4} style={{ position: 'sticky', left: 0, zIndex: 10, backgroundColor: 'var(--bg-primary)', height: '28px', borderBottom: '1px solid var(--border)' }}></td>
            )}
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
                />
            </td>
            <td colSpan={viewMode === 'project' ? 3 : 6} style={{ position: 'sticky', left: getStickyLeft(viewMode === 'project' ? 'workLocation' : 'position', viewMode), zIndex: 10, backgroundColor: 'var(--bg-primary)', height: '28px', borderBottom: '1px solid var(--border)' }}></td>
            {weeks.map(week => (
                <td key={format(week, 'yyyy-MM-dd')} style={{
                    minWidth: `${columnWidths.week}px`,
                    maxWidth: `${columnWidths.week}px`,
                    height: '28px',
                    borderLeft: '1px solid var(--border)',
                    borderBottom: '1px solid var(--border)',
                    backgroundColor: isCurrentWeek(week) ? 'rgba(239, 68, 68, 0.05)' : 'transparent'
                }}></td>
            ))}
            {(rightSpacerWidth || 0) > 0 && <td style={{ width: rightSpacerWidth, height: '28px', borderBottom: '1px solid var(--border)' }} />}
        </tr>
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
    columnWidths,
    cursor,
    setCursor,
    cellRefs,
    highlightMatch,
    projectSearchTerm,
    isCurrentWeek,
    handleReorderProject,
    handleDeleteProject,
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
    leftSpacerWidth,
    rightSpacerWidth,
    visibleStartIdx,
    canEdit
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
                            </div>
                        </div>
                        {!isCompleted && canEdit && (
                            <button
                                onClick={() => handleDeleteProject(project.id, project.name)}
                                className="reorder-btn hover-danger"
                                title="프로젝트 삭제"
                                style={{ marginRight: '8px' }}
                            >🗑️</button>
                        )}
                    </div>
                </td>
                {leftSpacerWidth > 0 && <td style={{ width: leftSpacerWidth, backgroundColor: bgColor, borderBottom: '1px solid var(--border)' }} />}
                {weeks.map((week, wIdx) => (
                    <td key={wIdx} style={{ backgroundColor: bgColor, borderRight: isCurrentWeek(week) ? '2px solid #ef4444' : 'none', borderBottom: '1px solid var(--border)' }}></td>
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
                        columnWidths={columnWidths}
                        cursor={cursor}
                        getStickyLeft={getStickyLeft}
                        isCurrentWeek={isCurrentWeek}
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
                    getFilteredEmployees={getFilteredEmployees}
                    setCursor={setCursor}
                    cellRefs={cellRefs}
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
                                    borderBottom: '2px solid var(--border)'
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

const ProjectStatus = () => {
    const { user } = useAuth();
    const projectsMenu = MENU_ITEMS.find(m => m.id === 'projects');
    const canEdit = hasAccess(user, projectsMenu);
    const [data, setData] = useState([]);
    const dataRef = useRef(data);
    useEffect(() => {
        dataRef.current = data;
    }, [data]);
    const [employees, setEmployees] = useState([]);
    const [weeks, setWeeks] = useState([]); // Moved up
    const [cursor, setCursor] = useState({ memberIndex: null, weekIndex: null });
    const cellRefs = useRef({});
    const [loading, setLoading] = useState(true);
    const assigningProjects = useRef(new Set()); // tracks in-flight assignment requests by projectId
    // Column virtualization: track visible week range
    const [visibleColRange, setVisibleColRange] = useState({ start: 0, end: 50 });
    const COL_BUFFER = 52; // extra weeks to render beyond visible area
    const [showProjectModal, setShowProjectModal] = useState(false);
    const [showMemberModal, setShowMemberModal] = useState(false);
    const [selectedProject, setSelectedProject] = useState(null);
    // Start 52 weeks (1 year) ago so we can scroll back smoothly without re-rendering
    const [startDate, setStartDate] = useState(() => addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), -52));
    const [viewMode, setViewMode] = useState('project'); // 'project' or 'group'
    const [selectedGroup, setSelectedGroup] = useState('ALL'); // 'ALL' or specific group name
    // Scroll Sync Refs
    const tableContainerRef = useRef(null);
    const sliderRef = useRef(null);
    const visibleDateRef = useRef(null);
    const isScrollingRef = useRef(false); // To prevent infinite loop between slider and container sync
    const hasAutoScrolled = useRef(false); // To scroll to "Today" on mount
    const [modalSearchTerm, setModalSearchTerm] = useState('');
    const [projectSearchTerm, setProjectSearchTerm] = useState('');
    const [inlineInputRect, setInlineInputRect] = useState(null);

    const [allMasterProjects, setAllMasterProjects] = useState([]);

    const handleAddProject = async (newProjectData) => {
        try {
            // Before adding, ensure the project name is unique in the current list
            const existingProject = data.find(p => p.name === newProjectData.name);
            if (existingProject) {
                if (viewMode === 'group') {
                    // In Group View, if it exists, just open member modal for it
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
            loadData();
        } catch (err) {
            console.error('Failed to create project:', err);
            alert('프로젝트 추가 중 오류가 발생했습니다.');
        }
    };

    const loadMasterData = useCallback(async () => {
        try {
            const [projRes, empRes] = await Promise.all([
                projectsAPI.getAll(),
                employeesAPI.getAll({ status: 'active' })
            ]);
            setAllMasterProjects(projRes.data);
            setEmployees(empRes.data.sort((a, b) => a.name.localeCompare(b.name, 'ko')));
        } catch (err) {
            console.error('Failed to load master data:', err);
        }
    }, []);

    const handleOpenProjectModal = () => {
        setShowProjectModal(true);
        loadMasterData();
    };

    const [showCompleted, setShowCompleted] = useState(false);
    const [expandedCompletedProjects, setExpandedCompletedProjects] = useState([]);
    const [isCompletedSectionExpanded, setIsCompletedSectionExpanded] = useState(false);

    // State for Settings Popover
    const [showSettings, setShowSettings] = useState(false);

    // State for Excel Export Period
    const [exportStartDate, setExportStartDate] = useState(() => format(addWeeks(new Date(), -4), 'yyyy-MM-dd'));
    const [exportEndDate, setExportEndDate] = useState(() => format(addWeeks(new Date(), 12), 'yyyy-MM-dd'));
    const [isDownloading, setIsDownloading] = useState(false);
    const settingsRef = useRef(null);
    const groupDropdownRef = useRef(null);
    const [showGroupDropdown, setShowGroupDropdown] = useState(false);
    const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false);
    // Initialize visible date to today to avoid '로딩 중...' flicker
    const [visibleDate, setVisibleDate] = useState(() => {
        const today = startOfWeek(new Date(), { weekStartsOn: 1 });
        return `${format(today, 'yyyy년 M월 d일')} ~ ${format(addDays(today, 4), 'M월 d일')}`;
    });
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < 900);
    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 900);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

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

        // Initialize groups from employees (captures color and count)
        employees.forEach(emp => {
            const gName = emp.group_name || '미지정';
            if (!groupMap[gName]) {
                groupMap[gName] = {
                    name: gName,
                    color: emp.group_color || '#6b7280',
                    projects: {},
                    _employeeIds: new Set()
                };
            }
            groupMap[gName]._employeeIds.add(emp.id);
        });

        // Map project members to groups
        data.forEach(project => {
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
                memberCount: g._employeeIds.size,
                projects: filteredProjects
            };
        }).filter(g => g.projects.length > 0);

        // Filter by selected group if any
        const filtered = (selectedGroup && selectedGroup !== 'ALL')
            ? result.filter(g => g.name === selectedGroup)
            : result;

        return filtered.sort((a, b) => a.name.localeCompare(b.name));
    }, [data, employees, selectedGroup]);

    const filteredData = useMemo(() => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');

        let processedData = data;
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
    }, [data, projectSearchTerm]);

    const groupStats = useMemo(() => transformDataByGroup(), [transformDataByGroup]);

    // Calculate aggregate stats for a group across weeks
    const calculateGroupStats = useCallback((group, weeksArr) => {
        // Weekly MM totals array (one per week) — only count in-range allocations
        const statsArr = weeksArr.map(week => {
            const dateStr = format(week, 'yyyy-MM-dd');
            const wEnd = format(addDays(new Date(week), 6), 'yyyy-MM-dd');
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

        // All assignments in this group
        const allAssignments = [];
        group.projects.forEach(p => p.assignments.forEach(a => allAssignments.push({ ...a, project_type: p.type })));

        // Pre-fetch groupEmployees for weekly status (needed before weeklyStatus loop)
        const groupEmployees = employees.filter(e => (e.group_name || '미지정') === group.name);

        // Weekly status breakdown
        const weeklyStatus = {};
        weeksArr.forEach(week => {
            const dateStr = format(week, 'yyyy-MM-dd');
            const empTotals = {};
            const empLeaveTotals = {};

            // Seed all group employees first so unassigned members show up in zero list
            groupEmployees.forEach(e => {
                empTotals[e.id] = { name: e.name, total: 0, empType: e.employment_type, retirement_date: e.retirement_date };
            });

            allAssignments.forEach(a => {
                const empId = a.employee_id;
                if (!empTotals[empId]) empTotals[empId] = { name: a.employee_name, total: 0, empType: a.employee_employment_type };
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
                const { name, total, empType, retirement_date: retirementDate } = info;

                if (empType === '정규직') {
                    // Check if retired as of this week
                    if (retirementDate && dateStr > retirementDate) {
                        return; // Exclude retired employees
                    }

                    const leaveTotal = empLeaveTotals[empId] || 0;
                    if (leaveTotal >= 0.1) {
                        return; // Exclude entirely if on leave
                    }

                    activeRegularCount++;

                    if (total === 0) zero.push(name);
                    if (total <= 0.5) under50.push(name); // 미투입(0) 포함
                    if (total >= 1.0) over100.push(name);
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

    // Custom Confirm Modal State
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null, type: 'danger' });



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
            // Group View order: name, position, grade, employmentType, workLocation, startDate, endDate
            const order = ['name', 'position', 'grade', 'employmentType', 'workLocation', 'startDate', 'endDate'];
            const idx = order.indexOf(column);
            if (idx <= 0) return 0;
            return order.slice(0, idx).reduce((acc, col) => acc + columnWidths[col], 0);
        }
    }, [columnWidths]);

    const loadData = useCallback(async () => {
        console.log('ProjectStatus: loadData called');
        try {
            setLoading(true);
            const [matrixRes, empRes] = await Promise.all([
                projectsAPI.getMatrix(),
                employeesAPI.getAll({ status: 'active' })
            ]);

            console.log('ProjectStatus: Data fetched', {
                matrixData: matrixRes.data?.length,
                empData: empRes.data?.length
            });

            if (matrixRes.data) {
                setData(matrixRes.data);
            }
            if (empRes.data) {
                setEmployees(empRes.data);
            }
        } catch (err) {
            console.error('Failed to load project status data:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Restore to 156 weeks (3 years) for flawless UI
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
        if (weeks.length > 0 && !hasAutoScrolled.current && tableContainerRef.current) {
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
                setVisibleColRange({
                    start: Math.max(0, todayIdx - COL_BUFFER),
                    end: Math.min(weeks.length - 1, todayIdx + visibleWeeks + COL_BUFFER)
                });
            }
        }
    }, [weeks, handleToday, columnWidths.week, COL_BUFFER]);



    const triggerAutoAllocation = useCallback(async (assignmentId, startStr, endStr, existingAllocations) => {
        // Validate dates before proceeding
        const startD = parseISO(startStr);
        const endD = parseISO(endStr);
        if (isNaN(startD.getTime()) || isNaN(endD.getTime()) || startD > endD) return;

        const start = startOfWeek(startD, { weekStartsOn: 1 });
        const allProjectWeeks = eachWeekOfInterval({ start, end: endD }, { weekStartsOn: 1 });
        const activeWeekStrings = new Set(allProjectWeeks.map(w => format(w, 'yyyy-MM-dd')));

        const localUpdates = [];
        
        // Find current allocations from provided arg or from reliable dataRef
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

        // 1. Identify and clear allocations outside the new range
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

        // 2. Auto-allocate calculated MM for new weeks in the range
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

        // 3. Update local state
        setData(prev => prev.map(p => ({
            ...p,
            members: p.members.map(m =>
                m.id == assignmentId ? { ...m, allocations: newAllocations } : m
            )
        })));

        // 4. Batch update backend
        if (localUpdates.length > 0) {
            try {
                await projectsAPI.updateAllocationBatch(localUpdates);
                console.log(`[triggerAutoAllocation] Successfully triggered batch update for assignment ${assignmentId}, ${localUpdates.length} records.`);
            } catch (err) {
                console.error('[triggerAutoAllocation] Auto-allocation batch update failed', err);
            }
        }
    }, [setData]);

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

    const getFilteredEmployees = useCallback((projectId, term) => {
        const lowerTerm = term.toLowerCase();

        return employees.filter(emp => {
            // Expensive lookup inside filter: try to optimize if data is huge
            // For now, it's okay but ideally we'd have a pre-calculated set of assigned IDs per project
            return (emp.name?.toLowerCase().includes(lowerTerm) ||
                emp.group_name?.toLowerCase().includes(lowerTerm))
        }).slice(0, 10);
    }, [employees]);

    const handleAssignmentUpdate = useCallback(async (assignmentId, field, value) => {
        console.log(`[handleAssignmentUpdate] Updating ${field} to ${value} for assignment ${assignmentId}`);
        let currentTarget = null;
        let found = false;

        // Synchronously extract currentTarget from the reliable dataRef
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
                    if (m.id == assignmentId) { // Use loose equality to handle string/number mismatch
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
                // Trigger auto-allocation logic
                triggerAutoAllocation(assignmentId, finalStart, finalEnd, currentTarget.allocations);
            }
        } catch (err) {
            console.error('Assignment update failed', err);
            alert('정보 업데이트에 실패했습니다. 다시 시도해 주세요.');
            loadData(); // Revert to server state
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
    }, [setConfirmConfig, setData]);

    const handleInlineAssign = useCallback(async (projectId, employeeId) => {
        const key = `${projectId}-${employeeId}`;
        if (assigningProjects.current.has(key)) return;
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
            group_name: empInfo?.group_name || '',
            group_color: empInfo?.group_color || '',
            allocations: {}
        };
        setData(prev => prev.map(p =>
            p.id === projectId ? { ...p, members: [...p.members, tempMember] } : p
        ));

        try {
            const response = await projectsAPI.assignMember(projectId, { employee_id: employeeId });
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
    }, [employees, setData, loadData]);

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
                loadData();
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
            loadData(); // Revert on error
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
            loadData(); // Revert on error
        }
    }, [data, setData, loadData]);

    const handleRemoveMember = async (projectId, assignmentId, memberName) => {
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
                    loadData();
                }
                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

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
                } catch (err) {
                    console.error('Delete project failed', err);
                    loadData();
                }
                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

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

    // Excel Download Handler
    const handleDownloadExcel = async () => {
        if (!exportStartDate || !exportEndDate) {
            alert('시작일과 종료일을 선택해 주세요.');
            return;
        }

        setIsDownloading(true);
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('프로젝트 배정 현황', {
                views: [{ state: 'frozen', xSplit: viewMode === 'project' ? 7 : 7, ySplit: 1 }]
            });

            // 1. Calculate weeks to show in Excel
            const start = startOfWeek(new Date(exportStartDate), { weekStartsOn: 1 });
            const end = startOfWeek(new Date(exportEndDate), { weekStartsOn: 1 });
            
            if (isAfter(start, end)) {
                alert('시작일이 종료일보다 늦을 수 없습니다.');
                setIsDownloading(false);
                return;
            }

            const exportWeeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });

            // 2. Define Columns
            const columns = [];
            if (viewMode === 'project') {
                columns.push(
                    { header: '소속', key: 'group', width: 12 },
                    { header: '직급', key: 'position', width: 10 },
                    { header: '등급', key: 'grade', width: 8 },
                    { header: '성명', key: 'name', width: 12 },
                    { header: '근무', key: 'workLocation', width: 10 },
                    { header: '투입일', key: 'startDate', width: 12 },
                    { header: '종료일', key: 'endDate', width: 12 }
                );
            } else {
                columns.push(
                    { header: '성명', key: 'name', width: 12 },
                    { header: '직급', key: 'position', width: 10 },
                    { header: '등급', key: 'grade', width: 8 },
                    { header: '고용', key: 'employmentType', width: 10 },
                    { header: '프로젝트', key: 'projectName', width: 25 },
                    { header: '투입일', key: 'startDate', width: 12 },
                    { header: '종료일', key: 'endDate', width: 12 }
                );
            }

            // Add weekly columns
            exportWeeks.forEach(w => {
                columns.push({
                    header: format(w, 'MM/dd'),
                    key: format(w, 'yyyy-MM-dd'),
                    width: 7
                });
            });

            worksheet.columns = columns;

            // 3. Styling Header
            const headerRow = worksheet.getRow(1);
            headerRow.height = 30;
            headerRow.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF1E293B' } // Slate-800
                };
                cell.font = {
                    bold: true,
                    color: { argb: 'FFFFFFFF' },
                    size: 9
                };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });

            // 4. Data Population
            if (viewMode === 'project') {
                data.forEach(project => {
                    // Project Header Row
                    const projHeaderRow = worksheet.addRow({
                        group: project.name,
                        position: `[${project.type || 'Client'}]`
                    });
                    
                    // Merge and Style Project Header
                    worksheet.mergeCells(projHeaderRow.number, 1, projHeaderRow.number, 7);
                    const groupCell = projHeaderRow.getCell(1);
                    groupCell.font = { bold: true, color: { argb: 'FF3B82F6' }, size: 10 };
                    groupCell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF8FAFC' }
                    };
                    projHeaderRow.eachCell({ includeEmpty: true }, (cell) => {
                        cell.border = { bottom: { style: 'thin' } };
                    });

                    // Members Rows
                    project.members.forEach(member => {
                        const rowData = {
                            group: member.group_name,
                            position: member.employee_position,
                            grade: member.employee_grade,
                            name: member.employee_name,
                            workLocation: member.work_location === 'Dispatch' ? '파견' : (member.work_location === 'In-house' ? '내근' : '-'),
                            startDate: member.input_start_date || '-',
                            endDate: member.input_end_date || '-'
                        };

                        // Fill weekly allocations
                        exportWeeks.forEach(w => {
                            const dateStr = format(w, 'yyyy-MM-dd');
                            rowData[dateStr] = member.allocations?.[dateStr] ? (parseFloat(member.allocations[dateStr]) || 0) : '';
                        });

                        const row = worksheet.addRow(rowData);
                        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                            cell.font = { size: 9 };
                            cell.alignment = { vertical: 'middle', horizontal: 'center' };
                            cell.border = {
                                bottom: { style: 'hair', color: { argb: 'FFCBD5E1' } },
                                right: { style: 'hair', color: { argb: 'FFCBD5E1' } }
                            };
                            
                            // Highlight allocations
                            if (colNumber > 7 && cell.value !== '') {
                                cell.font = { bold: true, size: 9 };
                            }
                        });
                    });

                    // Total Row
                    const totalRowData = { group: 'Total MM' };
                    exportWeeks.forEach(w => {
                        const dateStr = format(w, 'yyyy-MM-dd');
                        const total = project.members.reduce((sum, m) => sum + (parseFloat(m.allocations?.[dateStr]) || 0), 0);
                        totalRowData[dateStr] = total > 0 ? total : '';
                    });
                    const totalRow = worksheet.addRow(totalRowData);
                    worksheet.mergeCells(totalRow.number, 1, totalRow.number, 7);
                    totalRow.getCell(1).alignment = { horizontal: 'right' };
                    totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                        cell.font = { bold: true, size: 8, color: { argb: 'FF64748B' } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                        if (colNumber > 7 && cell.value > 1.0) {
                            cell.font = { bold: true, size: 9, color: { argb: 'FFEF4444' } };
                        }
                    });
                });
            } else {
                // Group View
                groupStats.filter(g => selectedGroup === 'ALL' || g.name === selectedGroup).forEach(group => {
                    // Group Title Row
                    const groupTitleRow = worksheet.addRow({ name: `${group.name} 그룹 (인원: ${group.memberCount}명)` });
                    worksheet.mergeCells(groupTitleRow.number, 1, groupTitleRow.number, worksheet.columns.length);
                    groupTitleRow.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    
                    // Robust color handling
                    let groupArgb = 'FF3B82F6';
                    if (group.color && group.color.startsWith('#')) {
                        groupArgb = 'FF' + group.color.substring(1).toUpperCase();
                    }

                    groupTitleRow.getCell(1).fill = { 
                        type: 'pattern', 
                        pattern: 'solid', 
                        fgColor: { argb: groupArgb } 
                    };

                    group.projects.forEach(p => {
                        // Project Subheader in Group View
                        const pSubRow = worksheet.addRow({ name: `📁 ${p.name} [${p.type || 'Client'}]` });
                        worksheet.mergeCells(pSubRow.number, 1, pSubRow.number, 7);
                        pSubRow.getCell(1).font = { bold: true, size: 9, color: { argb: 'FF3B82F6' } };
                        pSubRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F7FF' } };

                        p.assignments.forEach(assignment => {
                            const rowData = {
                                name: assignment.employee_name,
                                position: assignment.employee_position,
                                grade: assignment.employee_grade,
                                employmentType: assignment.employment_type || '-',
                                projectName: p.name,
                                startDate: assignment.input_start_date || '-',
                                endDate: assignment.input_end_date || '-'
                            };

                            exportWeeks.forEach(w => {
                                const dateStr = format(w, 'yyyy-MM-dd');
                                rowData[dateStr] = assignment.allocations?.[dateStr] ? (parseFloat(assignment.allocations[dateStr]) || 0) : '';
                            });

                            const row = worksheet.addRow(rowData);
                            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                                cell.font = { size: 9 };
                                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                                cell.border = { bottom: { style: 'thin', color: { argb: 'FFF1F5F9' } } };
                                if (colNumber === 5) cell.alignment = { vertical: 'middle', horizontal: 'left' };
                                if (colNumber > 7 && cell.value !== '') cell.font = { bold: true, size: 9 };
                            });
                        });
                    });

                    // Group Total Row 
                    const groupCalc = calculateGroupStats(group, exportWeeks);
                    const gTotalRowData = { name: `${group.name} 합계 (Total MM)` };
                    exportWeeks.forEach((w, wIdx) => {
                        const dateStr = format(w, 'yyyy-MM-dd');
                        const total = groupCalc.stats[wIdx] || 0;
                        gTotalRowData[dateStr] = total > 0 ? total : '';
                    });
                    const gTotalRow = worksheet.addRow(gTotalRowData);
                    worksheet.mergeCells(gTotalRow.number, 1, gTotalRow.number, 7);
                    gTotalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                        cell.font = { bold: true, size: 8, color: { argb: 'FF475569' } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                        cell.alignment = { vertical: 'middle', horizontal: colNumber <= 7 ? 'right' : 'center' };
                        if (colNumber > 7 && cell.value > group.memberCount) {
                            cell.font = { bold: true, size: 9, color: { argb: 'FFEF4444' } };
                        }
                    });
                });
            }

            // 5. Finalize and Save
            const buffer = await workbook.xlsx.writeBuffer();
            const fileName = `프로젝트배정현황_${viewMode === 'project' ? '프로젝트별' : '그룹별'}_${format(new Date(), 'yyyyMMdd')}.xlsx`;
            saveAs(new Blob([buffer]), fileName);

        } catch (error) {
            console.error('Excel Download Error:', error);
            alert(`엑셀 다운로드 중 오류가 발생했습니다: ${error.message}`);
        } finally {
            setIsDownloading(false);
        }
    };

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
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: currentGroupOpt.color, boxShadow: `0 0 8px ${currentGroupOpt.color}80` }} />
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
                                                        setSelectedGroup(opt.id);
                                                        setShowGroupDropdown(false);
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

                        <div className="flex items-center gap-xs px-sm border-l border-r border-border mx-xs">
                            {!isMobile && <Calendar size={14} className="text-muted" />}
                            <span
                                style={{ fontWeight: 600, fontSize: isMobile ? '0.75em' : '0.85em', minWidth: isMobile ? '70px' : '160px', textAlign: 'center' }}
                            >
                                {isMobile ? mobileDate : visibleDate}
                            </span>
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
                                    <input
                                        type="date"
                                        className="premium-date-input"
                                        value={exportStartDate}
                                        onChange={(e) => setExportStartDate(e.target.value)}
                                        title="엑셀 추출 시작일"
                                        style={{ colorScheme: 'dark' }}
                                    />
                                    <span className="text-muted text-[10px]">~</span>
                                    <input
                                        type="date"
                                        className="premium-date-input"
                                        value={exportEndDate}
                                        onChange={(e) => setExportEndDate(e.target.value)}
                                        title="엑셀 추출 종료일"
                                        style={{ colorScheme: 'dark' }}
                                    />
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
                        width: `${(viewMode === 'project' ?
                            (columnWidths.group + columnWidths.position + columnWidths.grade + columnWidths.employmentType + columnWidths.name + columnWidths.workLocation + columnWidths.startDate + columnWidths.endDate) :
                            (columnWidths.name + columnWidths.position + columnWidths.grade + columnWidths.employmentType + columnWidths.workLocation + columnWidths.startDate + columnWidths.endDate)
                        ) + (weeks.length * columnWidths.week)}px`
                    }}
                >
                    <colgroup>
                        {viewMode === 'project' ? (
                            <>
                                <col style={{ width: columnWidths.group }} />
                                <col style={{ width: columnWidths.position }} />
                                <col style={{ width: columnWidths.grade }} />
                                <col style={{ width: columnWidths.employmentType }} />
                                <col style={{ width: columnWidths.name }} />
                                <col style={{ width: columnWidths.workLocation }} />
                                <col style={{ width: columnWidths.startDate }} />
                                <col style={{ width: columnWidths.endDate }} />
                            </>
                        ) : (
                            <>
                                <col style={{ width: columnWidths.name }} />
                                <col style={{ width: columnWidths.position }} />
                                <col style={{ width: columnWidths.grade }} />
                                <col style={{ width: columnWidths.employmentType }} />
                                <col style={{ width: columnWidths.workLocation }} />
                                <col style={{ width: columnWidths.startDate }} />
                                <col style={{ width: columnWidths.endDate }} />
                            </>
                        )}
                        {leftSpacerWidth > 0 && <col style={{ width: leftSpacerWidth }} />}
                        {visibleWeeks.map(w => (
                            <col key={w.toString()} style={{ width: columnWidths.week }} />
                        ))}
                        {rightSpacerWidth > 0 && <col style={{ width: rightSpacerWidth }} />}
                    </colgroup>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 200, backgroundColor: 'var(--surface-high)' }}>
                        {/* Month Group Header Row */}
                        <tr>
                            <th colSpan={viewMode === 'project' ? 8 : 7} style={{ position: 'sticky', left: 0, zIndex: 201, backgroundColor: 'var(--surface-high)', borderBottom: '1px solid var(--border)' }}></th>
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
                                    <th style={{ position: 'sticky', left: getStickyLeft('name', 'group'), zIndex: 201, minWidth: columnWidths.name, width: columnWidths.name, backgroundColor: 'var(--bg-tertiary)' }}>
                                        <div className="flex items-center justify-between">
                                            <span>이름</span>
                                            {isResizeMode && <input type="number" className="width-input" value={columnWidths.name} onChange={(e) => handleWidthInputChange('name', e.target.value)} />}
                                            <div className="resize-handle" onMouseDown={(e) => startResizing('name', e)}></div>
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
                            {visibleWeeks.map((week) => {
                                const isCurrent = isCurrentWeek(week);
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
                    <tbody>
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
                                                <ProjectItem
                                                    key={project.id}
                                                    project={project}
                                                    pIdx={pIdx}
                                                    dataLength={filteredData.active.length}
                                                    isCompleted={false}
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
                                                    leftSpacerWidth={leftSpacerWidth}
                                                    rightSpacerWidth={rightSpacerWidth}
                                                    visibleStartIdx={visibleColRange.start}
                                                    canEdit={canEdit}
                                                />
                                            );
                                        })}

                                        {/* Completed Projects Section */}
                                        {filteredData.completed.length > 0 && showCompleted && (
                                            <>
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
                                                {isCompletedSectionExpanded && filteredData.completed.map((project, pIdx) => {
                                                    const isExpanded = expandedCompletedProjects.includes(project.id);
                                                    const memberStartIndex = currentGlobalRowIndex;
                                                    if (isExpanded) {
                                                        currentGlobalRowIndex += project.members.length;
                                                    }

                                                    return (
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
                                                            leftSpacerWidth={leftSpacerWidth}
                                                            rightSpacerWidth={rightSpacerWidth}
                                                            visibleStartIdx={visibleColRange.start}
                                                            canEdit={canEdit}
                                                        />
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
                                    const groupCalc = calculateGroupStats(group, weeks);
                                    return (
                                        <React.Fragment key={group.name}>
                                            {/* Group Header Row */}
                                            <tr key={`group-h-${group.name}`} style={{ backgroundColor: 'var(--surface-high)' }}>
                                                <td
                                                    style={{ position: 'sticky', left: 0, zIndex: 12, backgroundColor: 'var(--surface-high)', fontWeight: 'bold' }}
                                                    colSpan={7}
                                                >
                                                    <div className="flex items-center gap-md">
                                                        <span className="badge" style={{ backgroundColor: group.color }}>{group.name}</span>
                                                        <span>(인원: {group.memberCount}명)</span>
                                                    </div>
                                                </td>
                                                {leftSpacerWidth > 0 && <td style={{ width: leftSpacerWidth, backgroundColor: 'var(--surface-high)' }} />}
                                                {visibleWeeks.map((week, wIdx) => {
                                                    const total = groupCalc.stats[visibleColRange.start + wIdx] || 0;
                                                    const isCurrent = isCurrentWeek(week);
                                                    return (
                                                        <td key={wIdx} style={{
                                                            textAlign: 'center',
                                                            fontWeight: 'bold',
                                                            backgroundColor: 'var(--surface-high)',
                                                            color: total > group.memberCount ? '#ef4444' : (total > 0 ? 'var(--primary)' : 'var(--text-muted)'),
                                                            borderRight: isCurrent ? '2px solid #ef4444' : 'none'
                                                        }}>
                                                            {total > 0 ? total.toFixed(1) : '-'}
                                                        </td>
                                                    );
                                                })}
                                                {rightSpacerWidth > 0 && <td style={{ width: rightSpacerWidth, backgroundColor: 'var(--surface-high)' }} />}
                                            </tr>

                                            {group.projects.map((p) => (
                                                <React.Fragment key={p.id}>
                                                    <tr className="sub-header">
                                                        <td colSpan={7} style={{ position: 'sticky', left: 0, zIndex: 11, backgroundColor: 'var(--primary-glow)', paddingLeft: '2rem', fontSize: '0.9em' }}>
                                                            <div className="flex items-center gap-xs">
                                                                <span>📁 {p.name}</span>
                                                                <span className={`badge ${p.type === 'Internal' ? 'badge-primary' : (p.type === 'Leave' || p.type === 'Annual' ? 'badge-neutral' : 'badge-success')}`} style={{ fontSize: '0.7em', opacity: 0.8 }}>
                                                                    {p.type || 'Client'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        {leftSpacerWidth > 0 && <td style={{ width: leftSpacerWidth, backgroundColor: 'rgba(59, 130, 246, 0.02)' }} />}
                                                        {visibleWeeks.map((week, wIdx) => (
                                                            <td key={wIdx} style={{ backgroundColor: 'rgba(59, 130, 246, 0.02)', borderRight: isCurrentWeek(week) ? '2px solid #ef4444' : 'none' }}></td>
                                                        ))}
                                                        {rightSpacerWidth > 0 && <td style={{ width: rightSpacerWidth, backgroundColor: 'rgba(59, 130, 246, 0.02)' }} />}
                                                    </tr>
                                                    {p.assignments.map((assignment) => {
                                                        const currentMemberIndex = globalRowIndex++;
                                                        return (
                                                            <GroupMemberRow
                                                                key={`gmem-${assignment.id}`}
                                                                assignment={assignment}
                                                                weeks={visibleWeeks}
                                                                columnWidths={columnWidths}
                                                                cursor={cursor}
                                                                currentMemberIndex={currentMemberIndex}
                                                                getStickyLeft={getStickyLeft}
                                                                isCurrentWeek={isCurrentWeek}
                                                                isDateInRange={isDateInRange}
                                                                autoFormatDate={autoFormatDate}
                                                                handleAssignmentUpdate={handleAssignmentUpdate}
                                                                handleAllocationChange={handleAllocationChange}
                                                                handleAllocationBlur={handleAllocationBlur}
                                                                handleFillForward={handleFillForward}
                                                                handleKeyDown={handleKeyDown}
                                                                handlePaste={handlePaste}
                                                                handleRemoveMember={handleRemoveMember}
                                                                projectId={p.id}
                                                                setCursor={setCursor}
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
                                                                getFilteredEmployees={getFilteredEmployees}
                                                                setCursor={setCursor}
                                                                cellRefs={cellRefs}
                                                                rightSpacerWidth={rightSpacerWidth}
                                                            />
                                                        );
                                                    })()}
                                                </React.Fragment>
                                            ))}

                                            {/* Group Summary Row */}
                                            {(() => {
                                                const { stats, weeklyStatus, activeClientProjects, headcount, idle } = groupCalc;
                                                const monthName = (d) => format(d, 'M월');

                                                return (
                                                    <React.Fragment key={`summary-${group.name}`}>
                                                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                                                            <td colSpan={7 + weeks.length} style={{ padding: 0 }}>
                                                                {/* Wrapper to enforce sticky positioning inside the colSpan */}
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
                                                            <td style={{ position: 'sticky', left: 0, zIndex: 10, backgroundColor: '#f1f5f9', padding: '4px 8px', fontSize: '0.75em', fontWeight: 'bold', color: '#475569', textAlign: 'right', borderRight: '1px solid #cbd5e1' }} colSpan={7}>
                                                                미투입 (0 MM)
                                                            </td>
                                                            {leftSpacerWidth > 0 && <td style={{ width: leftSpacerWidth, backgroundColor: '#f1f5f9' }} />}
                                                            {visibleWeeks.map(week => {
                                                                const dateStr = format(week, 'yyyy-MM-dd');
                                                                const members = weeklyStatus[dateStr]?.zero || [];
                                                                const isCurrent = isCurrentWeek(week);
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
                                                            <td style={{ position: 'sticky', left: 0, zIndex: 10, backgroundColor: '#fffbeb', padding: '4px 8px', fontSize: '0.75em', fontWeight: 'bold', color: '#d97706', textAlign: 'right', borderRight: '1px solid #fcd34d' }} colSpan={7}>
                                                                부분 투입 (0.5 MM 이하)
                                                            </td>
                                                            {leftSpacerWidth > 0 && <td style={{ width: leftSpacerWidth, backgroundColor: '#fffbeb' }} />}
                                                            {visibleWeeks.map(week => {
                                                                const dateStr = format(week, 'yyyy-MM-dd');
                                                                const members = weeklyStatus[dateStr]?.under50 || [];
                                                                const isCurrent = isCurrentWeek(week);
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
                                                            <td style={{ position: 'sticky', left: 0, zIndex: 10, backgroundColor: '#eff6ff', padding: '4px 8px', fontSize: '0.75em', fontWeight: 'bold', color: '#2563eb', textAlign: 'right', borderRight: '1px solid #bfdbfe' }} colSpan={7}>
                                                                풀투입 (1 MM 이상)
                                                            </td>
                                                            {leftSpacerWidth > 0 && <td style={{ width: leftSpacerWidth, backgroundColor: '#eff6ff' }} />}
                                                            {visibleWeeks.map(week => {
                                                                const dateStr = format(week, 'yyyy-MM-dd');
                                                                const members = weeklyStatus[dateStr]?.over100 || [];
                                                                const isCurrent = isCurrentWeek(week);
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
                                                    </React.Fragment>
                                                );
                                            })()}
                                        </React.Fragment>
                                    );
                                });
                            })()
                        )}
                    </tbody>
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
const AddProjectModal = React.memo(({ isOpen, onClose, onAdd, allMasterProjects, employees, currentProjects, viewMode, selectedGroup }) => {
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
