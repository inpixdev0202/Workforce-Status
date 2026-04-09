import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Table, TrendingUp, Search, Plus, Save, Trash2, CheckCircle2, ChevronsLeftRight, FileText, Download, Filter, Maximize2, Sun, Moon, Settings, X, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Calendar, ClipboardCopy, Lock, AlignLeft, Columns, ChevronRightSquare, LayoutList, BookOpen, RotateCcw, Sparkles, Layers, PlusCircle } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { projectsAPI, projectReportsAPI, employeesAPI } from '../api';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const SpreadsheetCellInput = React.memo(({ initialValue, onCommit, onFocus, isFocused, className = "", isMultilineField = false, type = "text", align = "left", readOnly = false }) => {
    const [localValue, setLocalValue] = useState(initialValue || '');
    const inputRef = useRef(null);
    const selectionRef = useRef({ start: 0, end: 0 });

    useEffect(() => {
        if (!isFocused) {
            setLocalValue(initialValue || '');
        }
    }, [initialValue, isFocused]);

    useEffect(() => {
        if (isFocused && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isFocused]);

    useEffect(() => {
        if (isFocused && inputRef.current && type !== 'date') {
            const { start, end } = selectionRef.current;
            try {
                inputRef.current.setSelectionRange(start, end);
            } catch (e) {}
        }
    });

    const handleChange = (e) => {
        const { value, selectionStart, selectionEnd } = e.target;
        if (type !== 'date') {
            selectionRef.current = { start: selectionStart || 0, end: selectionEnd || 0 };
        }
        setLocalValue(value);
    };

    const handleBlur = () => {
        if (localValue !== initialValue) {
            onCommit(localValue);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            const isLineBreak = e.altKey || e.shiftKey;
            
            if (isLineBreak && isMultilineField && type !== 'date') {
                e.preventDefault();
                e.stopPropagation();
                
                const { selectionStart, selectionEnd } = e.target;
                setLocalValue(prev => {
                    const newValue = prev.substring(0, selectionStart) + "\n" + prev.substring(selectionEnd);
                    // Update selection ref for next render
                    selectionRef.current = { start: selectionStart + 1, end: selectionStart + 1 };
                    return newValue;
                });
            } else if (!isLineBreak) {
                e.preventDefault();
                e.stopPropagation();
                inputRef.current.blur();
            }
        }
    };

    const inputClasses = `w-full bg-transparent border-none outline-none px-2 text-inherit m-0 p-0 block pointer-events-auto`;
    const inputStyle = { 
        width: '100%',
        height: '100%',
        background: 'transparent',
        border: 'none',
        outline: 'none',
        margin: 0,
        padding: isMultilineField ? '4px 8px' : '0 8px',
        textAlign: align,
        fontSize: 'inherit',
        fontWeight: 'inherit',
        lineHeight: '1.4',
        color: 'inherit',
        display: 'block',
        pointerEvents: 'auto'
    };

    const isMultiline = isMultilineField;

    return (
        <div 
            className={`${isFocused ? 'focused-field overflow-hidden' : 'bg-transparent'} ${className}`}
            onClick={() => inputRef.current?.focus()}
            style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                width: '100%',
                height: '100%',
                // For multiline, avoid flex centering if it trips certain browsers
                display: isMultiline ? 'block' : 'flex',
                alignItems: isMultiline ? 'stretch' : 'center',
                justifyContent: align === 'center' ? 'center' : 'flex-start',
                overflow: 'hidden'
            }}
        >
                {readOnly ? (
                    <div 
                        className={`w-full h-full flex items-center px-1 text-[var(--text-muted)] opacity-80 cursor-default select-none ${align === 'center' ? 'justify-center' : 'justify-start'} ${className}`}
                        style={{ fontSize: 'inherit', fontWeight: 'inherit', textAlign: align, whiteSpace: isMultiline ? 'pre-wrap' : 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                        {localValue || '-'}
                    </div>
                ) : (
                    type === 'date' || !isMultiline ? (
                        <input 
                            ref={inputRef}
                            type={type}
                            value={localValue}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            onFocus={onFocus}
                            onKeyDown={handleKeyDown}
                            style={inputStyle}
                            spellCheck={false}
                        />
                    ) : (
                        <textarea 
                            ref={inputRef}
                            value={localValue}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            onFocus={onFocus}
                            onKeyDown={handleKeyDown}
                            rows={2} // Baseline for browser behavior
                            spellCheck={false}
                            style={{ 
                                ...inputStyle,
                                height: '100%',
                                minHeight: '100%',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-all',
                                resize: 'none',
                                overflowX: 'hidden',
                                overflowY: 'auto'
                            }}
                        />
                    )
                )}
        </div>
    );
});

const ColumnResizeHandle = React.memo(({ column, onMouseDown }) => (
    <div 
        onMouseDown={(e) => onMouseDown(e, column)}
        className="absolute -right-1 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-600/20 transition-all z-[100] group/handle pointer-events-auto resize-handle"
    >
        <div className="absolute right-[3px] top-0 bottom-0 w-[2px] opacity-0 group-hover/handle:opacity-100 bg-blue-500 transition-all duration-200 pointer-events-none" />
    </div>
));

const RowResizeHandle = React.memo(({ rowId, onMouseDown }) => (
    <div 
        onMouseDown={(e) => onMouseDown(e, rowId)}
        className="absolute -bottom-1 left-0 right-0 h-2 cursor-row-resize hover:bg-blue-600/20 transition-all z-[100] group/row-handle pointer-events-auto resize-handle"
    >
        <div className="absolute bottom-[3px] left-0 right-0 h-[2px] opacity-0 group-hover/row-handle:opacity-100 bg-blue-500 transition-all duration-200 pointer-events-none" />
    </div>
));

const SpreadsheetCellSelect = React.memo(({ value, options, onCommit, onFocus, onBlur, isFocused, className = "", style = {}, pillClass = "", readOnly = false }) => {
    if (readOnly) {
        return (
            <div 
                className={`w-full h-full flex items-center justify-center text-[var(--text-muted)] opacity-80 cursor-default select-none ${className} ${pillClass}`}
                style={{ fontSize: 'inherit', fontWeight: 'inherit', textAlign: 'center', ...style }}
            >
                {value || '-'}
            </div>
        );
    }
    return (
        <div className={`w-full h-full flex items-center justify-center p-1 ${isFocused ? 'focused-field' : ''}`}>
            <select
                value={value || ''}
                onChange={(e) => onCommit(e.target.value)}
                onFocus={onFocus}
                onBlur={onBlur}
                className={`${className} cursor-pointer text-center outline-none border-none bg-transparent transition-colors duration-300`}
                style={{ 
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    width: '100%',
                    padding: '2px 0',
                    ...style
                }}
            >
                <option value="" disabled hidden>-</option>
                {options.map(opt => (
                    <option key={opt} value={opt} style={{ background: 'var(--surface-high)', color: 'var(--text-primary)' }}>
                        {opt}
                    </option>
                ))}
            </select>
        </div>
    );
});




const getCategoryStyle = (category) => {
    const normalize = (val) => {
        const str = String(val || '').normalize('NFC').trim();
        if (str === '수행') return '진행중';
        if (['수주', '드롭', '탈락'].includes(str)) return '종료';
        return str || '진행중';
    };
    
    const cat = normalize(category);
    
    switch (cat) {
        case '진행예정': return { color: '#3b82f6', text: '진행예정' }; // Blue
        case '진행중': return { color: '#10b981', text: '진행중' };   // Emerald
        case '홀딩': return { color: '#f59e0b', text: '홀딩' };     // Amber
        case '종료': return { color: '#f43f5e', text: '종료' };     // Rose
        default: return { color: 'var(--text-muted)', text: cat };
    }
};

const getHealthStyle = (health) => {
    const normalize = (val) => String(val || '').trim();
    const h = normalize(health);
    
    if (h.includes('🟢')) return { class: 'glow-pill-emerald', text: '정상' };
    if (h.includes('🟡')) return { class: 'glow-pill-teal', text: '주의' };
    if (h.includes('🔴')) return { class: 'glow-pill-coral', text: '위험' };
    return { class: '', text: h };
};

const HealthSelect = React.memo(({ value, onCommit, onFocus, onBlur, isFocused, theme, readOnly = false }) => {
    const options = ['🟢 정상', '🟡 주의', '🔴 위험'];
    const hStyle = getHealthStyle(value);

    if (readOnly) {
        return (
            <div 
                className={`w-full h-full flex items-center justify-center text-[var(--text-muted)] opacity-80 cursor-default select-none ${hStyle.class}`}
                style={{ fontSize: '11px', fontWeight: 'bold', textAlign: 'center' }}
            >
                {value || '-'}
            </div>
        );
    }

    return (
        <div className={`w-full h-full flex items-center justify-center p-1 ${isFocused ? 'focused-field' : ''}`}>
            <select
                value={value || ''}
                onChange={(e) => onCommit(e.target.value)}
                onFocus={onFocus}
                onBlur={onBlur}
                className={`glow-pill ${hStyle.class} cursor-pointer text-center outline-none border-none bg-transparent`}
                style={{ 
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    width: '100%',
                    padding: '2px 0'
                }}
            >
                <option value="" disabled hidden>-</option>
                {options.map(opt => (
                    <option key={opt} value={opt} style={{ background: 'var(--surface-high)', color: 'var(--text-primary)' }}>
                        {opt}
                    </option>
                ))}
            </select>
        </div>
    );
});


const MasterProjectModal = ({ isOpen, onClose, projects, onSelect, theme }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const modalRef = useRef(null);

    const filteredProjects = useMemo(() => {
        const typePriority = { 'Client': 1, 'Internal': 2, 'Annual': 3, 'Leave': 4 };
        
        const sorted = [...projects].sort((a, b) => {
            const pA = typePriority[a.type] || 99;
            const pB = typePriority[b.type] || 99;
            if (pA !== pB) return pA - pB;
            return (a.name || '').localeCompare(b.name || '', 'ko');
        });

        const cleaned = sorted.map(p => ({
            ...p,
            displayName: (p.name || '').replace(/\s*\(.*?\)\s*/g, '').trim()
        }));
        
        if (!searchTerm) return cleaned;
        return cleaned.filter(p => p.displayName.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [projects, searchTerm]);

    if (!isOpen) return null;

    return createPortal(
        <div 
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                zIndex: 100000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(2, 6, 15, 0.75)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                padding: '24px',
            }}
        >
            <div 
                ref={modalRef}
                style={{
                    width: '100%',
                    maxWidth: '520px',
                    maxHeight: '80vh',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: '18px',
                    border: theme === 'light' ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.08)',
                    backgroundColor: theme === 'light' ? '#ffffff' : 'rgba(10, 15, 26, 0.97)',
                    overflow: 'hidden',
                    boxShadow: theme === 'light'
                        ? '0 20px 60px rgba(0,0,0,0.18)'
                        : '0 0 0 1px rgba(255,255,255,0.04), 0 32px 80px rgba(0,0,0,0.9), 0 0 40px rgba(16,185,129,0.08)',
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '18px 20px',
                    borderBottom: theme === 'light' ? '1px solid rgba(0,0,0,0.07)' : '1px solid rgba(255,255,255,0.06)',
                    background: theme === 'light' ? 'rgba(16,185,129,0.03)' : 'rgba(16,185,129,0.04)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            padding: '9px',
                            borderRadius: '12px',
                            background: 'rgba(16,185,129,0.15)',
                            color: '#34d399',
                            border: '1px solid rgba(16,185,129,0.2)',
                            boxShadow: '0 0 16px rgba(16,185,129,0.15)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <BookOpen size={18} />
                        </div>
                        <div>
                            <div style={{ fontSize: '14px', fontWeight: 900, color: '#34d399', letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1.2 }}>
                                Project Master Library
                            </div>
                            <div style={{ fontSize: '10px', color: theme === 'light' ? '#94a3b8' : '#475569', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: '3px' }}>
                                {filteredProjects.length} Projects Available
                            </div>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        style={{
                            padding: '7px', borderRadius: '9px',
                            background: 'transparent', border: 'none',
                            color: '#64748b', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = theme === 'light' ? '#0f172a' : '#e2e8f0'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
                    >
                        <X size={17} />
                    </button>
                </div>

                {/* Search */}
                <div style={{ padding: '12px 14px', flexShrink: 0, borderBottom: theme === 'light' ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#475569', display: 'flex' }}>
                            <Search size={15} />
                        </div>
                        <input 
                            autoFocus
                            type="text"
                            placeholder="프로젝트 검색..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                background: theme === 'light' ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)',
                                border: theme === 'light' ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '10px',
                                padding: '9px 12px 9px 36px',
                                fontSize: '13px', fontWeight: 600,
                                color: theme === 'light' ? '#0f172a' : '#e2e8f0',
                                outline: 'none', boxSizing: 'border-box',
                                caretColor: '#10b981',
                                transition: 'border-color 0.15s, box-shadow 0.15s',
                            }}
                            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(16,185,129,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.08)'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.08)'; e.currentTarget.style.boxShadow = 'none'; }}
                        />
                    </div>
                </div>

                {/* List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
                    {filteredProjects.length > 0 ? (
                        filteredProjects.map((p, idx) => (
                            <button
                                key={`master-${idx}`}
                                onClick={() => onSelect(p)}
                                style={{
                                    width: '100%', padding: '11px 14px', textAlign: 'left',
                                    background: 'transparent', border: '1px solid transparent',
                                    borderRadius: '10px', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    marginBottom: '2px', transition: 'all 0.12s ease',
                                    color: theme === 'light' ? '#334155' : '#cbd5e1',
                                    fontSize: '13px', fontWeight: 600, outline: 'none', boxSizing: 'border-box',
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.background = 'rgba(16,185,129,0.08)';
                                    e.currentTarget.style.borderColor = 'rgba(16,185,129,0.2)';
                                    e.currentTarget.style.color = theme === 'light' ? '#059669' : '#34d399';
                                    const icon = e.currentTarget.querySelector('[data-icon]');
                                    if (icon) icon.style.background = 'rgba(16,185,129,0.18)';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.borderColor = 'transparent';
                                    e.currentTarget.style.color = theme === 'light' ? '#334155' : '#cbd5e1';
                                    const icon = e.currentTarget.querySelector('[data-icon]');
                                    if (icon) icon.style.background = 'rgba(16,185,129,0.08)';
                                }}
                            >
                                    <ChevronRight size={14} style={{ color: '#10b981' }} />
                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {p.displayName}
                                </span>
                            </button>
                        ))
                    ) : (
                        <div style={{ padding: '48px 0', textAlign: 'center' }}>
                            <Search size={32} style={{ margin: '0 auto 10px', opacity: 0.25, color: '#94a3b8' }} />
                            <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', opacity: 0.3, color: '#94a3b8' }}>결과 없음</p>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

const ProjectAutocomplete = ({ value, onOpenLibrary, theme, readOnly = false }) => {
    const isMasterLinked = !!value;

    return (
        <div 
            className={`relative w-full h-full group flex items-center overflow-hidden transition-colors ${(theme === 'light' ? 'hover:bg-emerald-50/30' : 'hover:bg-emerald-500/5')} ${readOnly && isMasterLinked ? 'bg-white/[0.02]' : ''}`}
            title={readOnly && isMasterLinked ? "마스터 DB에서 관리되는 프로젝트입니다" : "우측 책 아이콘을 클릭하여 마스터에서 가져올 수 있습니다"}
        >
            <input
                type="text"
                value={value || ''}
                readOnly
                placeholder="마스터에서 선택(아이콘 클릭)..."
                className={`flex-1 h-full px-3 py-1 bg-transparent border-none outline-none text-[12px] font-bold placeholder:text-muted-foreground/40 ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'} ${readOnly && isMasterLinked ? 'cursor-default' : ''}`}
                spellCheck={false}
            />
            
            {!readOnly && (
                <div
                    className="flex flex-shrink-0 items-center justify-center w-7 h-7 mr-0.5 opacity-60 group-hover:opacity-100 transition-all cursor-pointer hover:scale-110 active:scale-95"
                    style={{ color: '#10b981' }}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onOpenLibrary();
                    }}
                    title="마스터 라이브러리 열기"
                >
                    <BookOpen size={16} />
                </div>
            )}
        </div>
    );
};

const ReportDataRow = React.memo(({ 
    item, 
    rowIndex, 
    columns, 
    columnWidths, 
    rowHeight, 
    focusedCell, 
    setFocusedCell,
    onCellChange,
    onProjectSelect,
    onOpenLibrary,
    onDelete,
    onRowResize,
    theme,
    lastWeekProjects,
    masterProjects,
    pmList = [],
    pdList = []
}) => {
    const { user } = useAuth();
    const isAdmin = user?.role === 'Admin';
    const isOwner = isAdmin || 
                    (String(item.pd || '').trim() === String(user?.name || '').trim()) ||
                    (String(item.pm || '').trim() === String(user?.name || '').trim());

    const catStyle = useMemo(() => getCategoryStyle(item.category, theme === 'dark'), [item.category, theme]);

    return (
        <tr className={`group transition-colors ${isOwner ? 'hover:bg-white/[0.01]' : 'opacity-80 bg-slate-900/10'}`}>
            <td 
                className="w-10 bg-[var(--surface-high)] p-0 text-[10px] font-extrabold text-[var(--text-muted)] text-center select-none sticky left-0 z-20 relative opacity-50"
                style={{ height: rowHeight }}
            >
                {rowIndex + 1}
                <RowResizeHandle rowId={item.id} onMouseDown={onRowResize} />
            </td>
            
            {columns.map((col) => {
                const cellId = `${item.id}-${col.key}`;

                if (col.key === 'manage') {
                    return (
                        <td key={col.key} className="p-0 text-center w-[60px] relative" style={{ height: rowHeight }}>
                            {isAdmin && (
                                <button 
                                    onClick={() => onDelete(item.id)}
                                    className="trash-delete-btn relative z-10 w-full h-full flex items-center justify-center cursor-pointer"
                                    title="행삭제"
                                    style={{ border: 'none', background: 'none', padding: 0 }}
                                >
                                    <Trash2 size={16} className="trash-delete-icon" />
                                </button>
                            )}
                        </td>
                    );
                }

                const isProgressCol = (col.label && ['진행상황', '내용'].some(l => col.label.includes(l))) || (col.key && ['progress', 'progress_status'].includes(col.key));
                
                const isMasterSourced = !isProgressCol && ([
                    'projectName', 'pd', 'pm', 'kickoff', 'rfpInfo', 
                    'mainContractor', 'estimatedAmount', 'clientInfo', 'category'
                ].includes(col.key) || (col.label && (
                    ['프로젝트명', 'PD', 'PM', '시작일', '종료일', '주사업자', '금액(예상)', '고객 정보', '구분'].some(l => col.label.includes(l)) ||
                    col.label.toUpperCase().includes('PD') || 
                    col.label.toUpperCase().includes('PM')
                )));
                
                const isLinked = !!item.projectName;
                // A cell is Read-only if it's master-sourced AND linked, OR if the user is NOT the owner
                const isReadOnly = (isMasterSourced && isLinked) || !isOwner;

                if (col.key === 'projectName') {
                    return (
                        <td key={col.key} className={`p-0 relative ${isReadOnly ? 'bg-white/[0.02]' : ''}`} style={{ width: columnWidths[col.key], height: rowHeight }}>
                            <ProjectAutocomplete 
                                value={item[col.key]}
                                onSelect={(p, isFull) => onProjectSelect(item.id, p, isFull)}
                                onFocus={() => setFocusedCell({ rowId: item.id, field: cellId })}
                                isFocused={focusedCell?.field === cellId}
                                lastWeekProjects={lastWeekProjects}
                                onOpenLibrary={() => onOpenLibrary(item.id)}
                                theme={theme}
                                readOnly={isReadOnly}
                            />
                        </td>
                    );
                }

                if (col.key === 'category') {
                    const categoryOptions = ['진행예정', '진행중', '홀딩', '종료'];
                    const normalize = (val) => {
                        const str = String(val || '').normalize('NFC').trim();
                        if (str === '수행') return '진행중';
                        if (['수주', '드롭', '탈락'].includes(str)) return '종료';
                        return str || '진행중';
                    };
                    const displayValue = normalize(item[col.key]);
                    return (
                        <td key={col.key} className="p-0 relative transition-colors duration-200" style={{ width: columnWidths[col.key], height: rowHeight }}>
                            <SpreadsheetCellSelect
                                value={displayValue}
                                options={categoryOptions}
                                onCommit={(v) => onCellChange(item.id, col.key, v)}
                                onFocus={() => setFocusedCell({ rowId: item.id, field: cellId })}
                                onBlur={() => setFocusedCell(null)}
                                isFocused={focusedCell?.field === cellId}
                                className="font-black text-center text-[11px] tracking-tight"
                                style={{ color: catStyle.color }}
                                readOnly={isReadOnly}
                            />
                        </td>
                    );
                }

                const isHealthCol = col.key === 'health' || ['운영 상태', '운영상태', 'Health'].includes(col.label);
                if (isHealthCol) {
                    const hStyle = getHealthStyle(item[col.key], theme === 'dark');
                    return (
                        <td key={col.key} className="p-0 relative" style={{ width: columnWidths[col.key], height: rowHeight, backgroundColor: hStyle.bg, border: 'none' }}>
                            <HealthSelect 
                                value={item[col.key]}
                                onCommit={(v) => onCellChange(item.id, col.key, v)}
                                onFocus={() => setFocusedCell({ rowId: item.id, field: cellId })}
                                onBlur={() => setFocusedCell(null)}
                                isFocused={focusedCell?.field === cellId}
                                theme={theme}
                                readOnly={false}
                            />
                        </td>
                    );
                }

                const isCopyCol = col.label && col.label.includes('복사');
                
                const isPDPM = col.label && (
                    col.label.toUpperCase().includes('PD') || 
                    col.label.toUpperCase().includes('PM') || 
                    col.label.includes('담당') || 
                    col.label.includes('보고자') ||
                    (col.key && (col.key.toLowerCase().includes('pd') || col.key.toLowerCase().includes('pm')))
                );

                const isPD = col.label && (col.label.toUpperCase().includes('PD') || (col.key && col.key.toLowerCase().includes('pd')));
                const isPM = col.label && (col.label.toUpperCase().includes('PM') || (col.key && col.key.toLowerCase().includes('pm')));

                if (isPDPM && (isPD || isPM)) {
                    const options = isPM ? pmList : pdList;
                    if (options.length > 0) {
                        return (
                            <td key={col.key} className={`p-0 relative align-middle ${isReadOnly ? 'bg-white/[0.02]' : ''}`} style={{ width: columnWidths[col.key], height: rowHeight }}>
                                <SpreadsheetCellSelect
                                    value={item[col.key]}
                                    options={options}
                                    onCommit={(v) => onCellChange(item.id, col.key, v)}
                                    onFocus={() => setFocusedCell({ rowId: item.id, field: cellId })}
                                    onBlur={() => setFocusedCell(null)}
                                    isFocused={focusedCell?.field === cellId}
                                    className="text-center text-[12px] font-extrabold"
                                    readOnly={isReadOnly}
                                />
                            </td>
                        );
                    }
                }
                const isDate = col.label && (col.label.includes('시작') || col.label.includes('종료') || col.label.includes('날짜') || (col.key && col.key.toLowerCase().includes('date')));
                const multilineLabels = ['상세', '내용', '비고', '진행상황', '투입계획', '특이사항', '고객 정보', '보고'];
                const isMultiline = !isPDPM && (
                    ['progress', 'status', 'plan', 'rfpInfo', 'proposal'].includes(col.key) || 
                    (col.label && multilineLabels.some(l => col.label.includes(l)))
                );

                return (
                    <td key={col.key} className={`p-0 relative ${isPDPM ? 'align-middle' : ''} ${isReadOnly ? 'bg-white/[0.02]' : ''}`} style={{ width: columnWidths[col.key], height: rowHeight }}>
                        <SpreadsheetCellInput 
                            initialValue={item[col.key]}
                            onCommit={(v) => onCellChange(item.id, col.key, v)}
                            onFocus={() => setFocusedCell({ rowId: item.id, field: cellId })}
                            isFocused={focusedCell?.field === cellId}
                            className={`text-[var(--text-muted)] ${col.key === 'status' ? 'text-[10px]' : (isPDPM ? 'text-[12px] font-extrabold text-[var(--text-primary)]' : 'text-[11px]')}`}
                            align={isPDPM ? 'center' : 'left'}
                            type={isDate ? 'date' : 'text'}
                            isMultilineField={isMultiline}
                            readOnly={isReadOnly}
                        />
                    </td>
                );
            })}
        </tr>
    );
});

// --- Utility Helpers ---

// Helper for super-robust project name matching (handles invisible whitespace/tabs/newlines/NFO/NFC)
const normalizeProjectName = (name) => {
    if (!name) return '';
    // Strip bracketed content (e.g., "(2024-1234)" or "[Dev]") for robust matching
    const cleaned = String(name).replace(/\s*\(.*?\)\s*/g, '').replace(/\s*\[.*?\]\s*/g, '');
    return cleaned.normalize('NFC').replace(/\s+/g, '').trim().toUpperCase();
};

// Helper to convert Master DB dates (YYYY.MM.DD or Date object) to Report date input format (YYYY-MM-DD)
const normalizeToDashDate = (val) => {
    if (!val || val === '-' || val === '') return '';
    
    // If it's already YYYY-MM-DD, return as is to avoid timezone shifts
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(val))) return String(val);
    
    try {
        const d = new Date(val);
        if (isNaN(d.getTime())) return '';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    } catch (e) {
        return '';
    }
};

const ColumnSettingsModal = ({ isOpen, onClose, columns, onUpdateColumns, onSyncAllWidths, isSyncing, onResetLayout }) => {
    const [localColumns, setLocalColumns] = useState(columns);
    const [newColLabel, setNewColLabel] = useState('');

    useEffect(() => {
        if (isOpen) setLocalColumns(columns);
    }, [isOpen, columns]);

    const handleAdd = () => {
        if (!newColLabel.trim()) return;
        const newKey = `custom_${Date.now()}`;
        const newCol = { key: newKey, label: newColLabel.trim(), width: 120 };
        const updated = [...localColumns];
        const manageIdx = updated.findIndex(c => c.key === 'manage');
        if (manageIdx !== -1) {
            updated.splice(manageIdx, 0, newCol);
        } else {
            updated.push(newCol);
        }
        setLocalColumns(updated);
        setNewColLabel('');
    };

    const handleDelete = (key) => {
        if (['category', 'projectName', 'manage'].includes(key)) return;
        setLocalColumns(localColumns.filter(c => c.key !== key));
    };

    const move = (index, direction) => {
        const newIdx = index + direction;
        if (newIdx < 0 || newIdx >= localColumns.length) return;
        if (index <= 1 && direction < 0) return;
        if (localColumns[index].key === 'manage') return;
        if (localColumns[newIdx].key === 'manage') return;

        const updated = [...localColumns];
        [updated[index], updated[newIdx]] = [updated[newIdx], updated[index]];
        setLocalColumns(updated);
    };

    const handleSave = () => {
        onUpdateColumns(localColumns);
        onClose();
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100000] flex justify-end" style={{ pointerEvents: 'auto' }}>
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-[4px] animate-in fade-in duration-300"
                onClick={onClose}
            />
            <div 
                className="relative w-[400px] h-full flex flex-col shadow-[-20px_0_60px_rgba(0,0,0,0.8)] border-l border-[#00f2ff]/30 animate-in slide-in-from-right duration-500 ease-out"
                style={{ backgroundColor: '#0d1117' }}
            >
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '2px', background: 'linear-gradient(to bottom, transparent, #00f2ff, transparent)', opacity: 0.5 }} />

                <div style={{ padding: '24px 24px 16px 24px', backgroundColor: 'rgba(22, 27, 34, 0.9)', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div className="flex items-center gap-3">
                        <div className="flex gap-1.5">
                            <div className="w-2h-2 rounded-full" style={{ backgroundColor: '#ff5f56', width: '9px', height: '9px' }} />
                            <div className="w-2h-2 rounded-full" style={{ backgroundColor: '#ffbd2e', width: '9px', height: '9px' }} />
                            <div className="w-2h-2 rounded-full" style={{ backgroundColor: '#27c93f', width: '9px', height: '9px' }} />
                        </div>
                        <div style={{ width: '1px', height: '14px', backgroundColor: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
                        <div className="flex flex-col">
                            <span style={{ fontSize: '15px', fontWeight: '900', color: '#fff', letterSpacing: '-0.02em' }}>시트 구성</span>
                            <span style={{ fontSize: '9px', color: '#00f2ff', fontWeight: 'bold', opacity: 0.6, textTransform: 'uppercase', marginTop: '-1px' }}>Settings</span>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: '6px', borderRadius: '50%' }} 
                        className="hover:bg-white/10 hover:text-white transition-all active:scale-90"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ padding: '24px' }}>
                    <div style={{ marginBottom: '28px' }}>
                        <label style={{ display: 'block', fontSize: '9px', fontWeight: '900', color: '#00f2ff', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '10px', opacity: 0.8 }}>Add New Column</label>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <input 
                                type="text" 
                                value={newColLabel}
                                onChange={(e) => setNewColLabel(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                                placeholder="컬럼명 입력"
                                style={{ 
                                    flex: 1,
                                    backgroundColor: 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(0, 242, 255, 0.15)',
                                    borderRadius: '12px',
                                    padding: '12px 50px 12px 16px',
                                    color: '#fff',
                                    fontSize: '13px',
                                    outline: 'none'
                                }}
                                className="focus:border-[#00f2ff]/40 focus:bg-white/[0.06] transition-all"
                            />
                            <button 
                                onClick={handleAdd} 
                                style={{ position: 'absolute', right: '8px', backgroundColor: '#fff', color: '#000', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '10px', fontWeight: '900', cursor: 'pointer' }}
                                className="active:scale-95 transition-transform shadow-xl hover:bg-[#00f2ff]"
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', padding: '0 4px' }}>
                        <span style={{ fontSize: '10px', fontWeight: '900', color: '#666', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Architecture</span>
                        <div style={{ padding: '3px 8px', backgroundColor: 'rgba(0, 242, 255, 0.08)', borderRadius: '20px', border: '1px solid rgba(0, 242, 255, 0.15)' }}>
                            <span style={{ fontSize: '9px', fontWeight: '900', color: '#00f2ff' }}>{localColumns.length} UNITS</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {localColumns.map((col, idx) => {
                            const isProtected = ['category', 'projectName', 'manage'].includes(col.key);
                            return (
                                <div 
                                    key={col.key} 
                                    style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '12px', 
                                        padding: '4px 14px', 
                                        backgroundColor: 'rgba(255,255,255,0.02)', 
                                        borderRadius: '12px',
                                        border: '1px solid transparent'
                                    }}
                                    className="hover:bg-white/[0.04] hover:border-white/[0.08] transition-all group"
                                >
                                    <div style={{ width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '900', color: '#00f2ff', backgroundColor: 'rgba(0, 242, 255, 0.08)', borderRadius: '10px', border: '1px solid rgba(0, 242, 255, 0.15)' }}>
                                        {String.fromCharCode(65 + idx)}
                                    </div>
                                    <div style={{ flex: 1, fontSize: '13.5px', fontWeight: 'bold', color: isProtected ? '#fff' : '#aaa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {col.label}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        {!isProtected && col.key !== 'manage' ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }} className="opacity-0 group-hover:opacity-100 transition-all">
                                                <button onClick={() => move(idx, -1)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: '4px' }} className="hover:text-white"><ChevronUp size={16} /></button>
                                                <button onClick={() => move(idx, 1)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: '4px' }} className="hover:text-white"><ChevronDown size={16} /></button>
                                                <div style={{ width: '1px', height: '12px', backgroundColor: 'rgba(255,255,255,0.08)', margin: '0 2px' }} />
                                                <button onClick={() => handleDelete(col.key)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: '4px' }} className="hover:text-red-400"><Trash2 size={16} /></button>
                                            </div>
                                        ) : (
                                            <div style={{ padding: '6px', opacity: 0.3 }}>
                                                <Lock size={12} style={{ color: '#00f2ff' }} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div style={{ marginTop: '32px', padding: '16px', backgroundColor: 'rgba(0, 242, 255, 0.03)', borderRadius: '16px', border: '1px dashed rgba(0, 242, 255, 0.2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <Settings size={14} className="text-[#00f2ff]" />
                            <span style={{ fontSize: '11px', fontWeight: '900', color: '#00f2ff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Global Sync</span>
                        </div>
                        <p style={{ fontSize: '11px', color: '#888', lineHeight: '1.5', marginBottom: '12px' }}>
                            현재 설정된 모든 컬럼의 너비를 일괄 적용합니다.<br/>
                            <span style={{ color: '#aaa' }}>※ 과거와 미래의 모든 주간보고 레이아웃이 통일됩니다. (데이터는 보존됨)</span>
                        </p>
                        <button
                            onClick={() => {
                                if (window.confirm('모든 주간보고의 컬럼 너비를 현재 설정으로 동기화하시겠습니까?')) {
                                    onSyncAllWidths();
                                }
                            }}
                            disabled={isSyncing}
                            className={`w-full py-3 rounded-xl text-[11px] font-900 uppercase tracking-[0.1em] transition-all ${isSyncing 
                                ? 'bg-white/5 text-white/20 cursor-not-allowed' 
                                : 'premium-btn-cyan'}`}
                        >
                            {isSyncing ? 'Syncing...' : '모든 주간보고에 너비 적용'}
                        </button>
                    </div>
                </div>

                <div style={{ padding: '20px 24px', borderTop: '1px solid rgba(255,255,255,0.08)', backgroundColor: 'rgba(22, 27, 34, 0.95)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button 
                            onClick={onClose} 
                            style={{ flex: 1, padding: '13px', borderRadius: '14px', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer' }}
                            className="premium-btn-outline transition-all"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSave} 
                            style={{ flex: 1.5, padding: '13px', borderRadius: '14px', fontSize: '13px', fontWeight: '900', cursor: 'pointer' }}
                            className="premium-btn-blue transition-all"
                        >
                            Apply Config
                        </button>
                    </div>
                    
                    <button
                        onClick={() => {
                            if (window.confirm('모든 설정을 초기화하고 기본 레이아웃으로 변경하시겠습니까?')) {
                                onResetLayout();
                                onClose();
                            }
                        }}
                        style={{ 
                            padding: '8px', 
                            backgroundColor: 'transparent', 
                            border: 'none', 
                            color: '#475569', 
                            fontSize: '10px', 
                            fontWeight: 'bold', 
                            textDecoration: 'underline',
                            cursor: 'pointer',
                        }}
                        className="hover:text-[#00f2ff] hover:opacity-100 transition-all flex items-center justify-center gap-1.5 opacity-60"
                    >
                        <RotateCcw size={12} />
                        기본 레이아웃으로 변경 (초기화)
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

const getReportingFriday = (dateInput = new Date()) => {
    let d;
    if (typeof dateInput === 'string') {
        const [y, m, d_] = dateInput.split('-').map(Number);
        d = new Date(y, m - 1, d_);
    } else {
        d = new Date(dateInput);
    }
    const day = d.getDay(); // 0(Sun) - 6(Sat)
    const diff = (day <= 5) ? (5 - day) : (-1); // If after Fri, go to next Fri (or stay if Fri)
    const friday = new Date(d.setDate(d.getDate() + diff));
    const yr = friday.getFullYear();
    const mo = String(friday.getMonth() + 1).padStart(2, '0');
    const da = String(friday.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
};

const offsetDate = (dateStr, days) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + days);
    const yr = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const da = String(date.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
};

const mergeReportData = (current, previous) => {
    if (!previous || previous.length === 0) return current;
    
    // Support new object format in merge source
    const prevRows = Array.isArray(previous) ? previous : (previous.rows || []);
    const prevColWidths = (!Array.isArray(previous) && previous.columnWidths) ? previous.columnWidths : null;

    if (!current || current.length === 0) {
        return prevRows.map(p => ({ ...p, id: Date.now() + Math.random() + Math.random() }));
    }

    const merged = [...current];
    prevRows.forEach(prevRow => {
        if (!prevRow.projectName || prevRow.projectName.trim() === '') return;
        
        const existingIdx = merged.findIndex(curr => 
            curr.projectName && curr.projectName.trim() === prevRow.projectName.trim()
        );

        if (existingIdx !== -1) {
            const currRow = merged[existingIdx];
            
            // ALWAYS sync rowHeight if project matches, to ensure layout consistency
            if (prevRow.rowHeight) {
                merged[existingIdx] = { ...merged[existingIdx], rowHeight: prevRow.rowHeight };
            }

            const hasCurrentDetails = (currRow.progress && currRow.progress !== '-') || (currRow.plan && currRow.plan !== '-');
            
            if (!hasCurrentDetails) {
                // If current row is empty, carry over content too
                merged[existingIdx] = { ...prevRow, id: currRow.id };
            }
        } else {
            merged.push({ ...prevRow, id: Date.now() + Math.random() + Math.random() });
        }
    });

    // If source had columnWidths, we could optionally return them too, 
    // but the calling function usually handles state sync.
    return merged;
};

const ProjectReport = () => {
    const { user } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [selectedDate, setSelectedDate] = useState(() => getReportingFriday());
    const [reportData, setReportData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [lastWeekProjects, setLastWeekProjects] = useState([]);
    const [pmList, setPmList] = useState([]);
    const [pdList, setPdList] = useState([]);
    const [masterProjects, setMasterProjects] = useState([]);
    
    const COLUMN_WIDTHS_KEY = 'project_report_column_widths_v2';
    const ROW_HEIGHTS_KEY = 'project_report_row_heights_v2';
    const COLUMNS_CONFIG_KEY = 'project_report_columns_config_v2';

    const DEFAULT_COLUMN_WIDTHS = {
        category: 80,
        projectName: 320,
        pd: 120,
        pm: 120,
        status: 100,
        kickoff: 120,
        rfpInfo: 120,
        progress: 500,
        manage: 60
    };

    // Fetch data from server
    const fetchData = useCallback(async () => {
            setIsLoading(true);
            dataLoaded.current = false;
            try {
                // 1. Fetch current week's data
                const resCurrent = await projectReportsAPI.getByDate(selectedDate);
                const loaded = resCurrent.data;
                
                let currentRows = [];
                let currentLayout = null;
                
                if (Array.isArray(loaded)) {
                    currentRows = loaded;
                } else if (loaded && loaded.rows) {
                    currentRows = loaded.rows;
                    currentLayout = { 
                        columnWidths: loaded.columnWidths, 
                        rowHeights: loaded.rowHeights 
                    };
                }

                // 2. Fetch previous week and master data early for repair and carry-over
                const prevDateStr = offsetDate(selectedDate, -7);
                const [resPrev, resMaster] = await Promise.all([
                    projectReportsAPI.getByDate(prevDateStr),
                    projectsAPI.getAll()
                ]);
                
                const prevLoaded = resPrev.data;
                const prevRows = Array.isArray(prevLoaded) ? prevLoaded : (prevLoaded?.rows || []);
                const masterProjectsList = resMaster.data || [];
                setMasterProjects(masterProjectsList);



                // Helper: Robust column mapping for seeding and repair
                const getColKey = (keywords, defaultKey, ignoreKeys = []) => {
                    const col = (currentLayout?.columns || columns).find(c => {
                        if (ignoreKeys.includes(c.key)) return false;
                        const lbl = (c.label || '').toUpperCase();
                        const key = (c.key || '').toUpperCase();
                        return keywords.some(k => lbl.includes(k) || key.includes(k));
                    });
                    return col ? col.key : defaultKey;
                };

                const pdKey = getColKey(['PD', '보고자'], 'pd');
                const pmKey = getColKey(['PM', '담당'], 'pm', [pdKey]);
                const statusKey = getColKey(['상태', '운영', 'STATUS'], 'status');
                const startKey = getColKey(['시작', '기간', 'KICKOFF'], 'kickoff');
                const endKey = getColKey(['종료', '특이', 'RFP'], 'rfpInfo', [startKey]);
                const clientInfoKey = getColKey(['고객', 'CLIENTINFO'], 'clientInfo');

                const getMasterVal = (obj, fields) => {
                    if (typeof obj !== 'object' || !obj) return null;
                    for (let f of fields) {
                        if (obj[f] !== undefined && obj[f] !== null && obj[f] !== '' && obj[f] !== '-') return obj[f];
                    }
                    return null;
                };

                // Track if any master metadata was updated (for user notification)
                let masterUpdated = false;

                // 3. AUTO-SEEDING: Filter Master projects for 'Ongoing' AND 'Client' type.
                const activeMasterProjects = masterProjectsList.filter(m => {
                    const status = String(m.status || '').normalize('NFC').trim().toLowerCase();
                    const type = String(m.type || '').normalize('NFC').trim().toLowerCase();

                    // Only include projects with active/ongoing status (not upcoming/예정)
                    const isActive = !status || ['active', '진행중', '수행', 'ongoing', '진행'].some(s => status === s);

                    // Exclude if project hasn't started yet (start_date is after selected week)
                    const startDate = m.start_date || m.startDate;
                    const hasStarted = !startDate || new Date(startDate) <= new Date(selectedDate);
                    // Only include Client type projects (고객사 is alias for Client)
                    const isRelevant = !type || ['client', '고객사'].some(t => type.includes(t));

                    return isActive && isRelevant && hasStarted;
                });

                // Determine if selected week is current week or future (sync mode) vs past (archive mode)
                const todayMonday = (() => {
                    const d = new Date();
                    const day = d.getDay();
                    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                    d.setDate(diff);
                    d.setHours(0, 0, 0, 0);
                    return d;
                })();
                const selectedWeekDate = new Date(selectedDate);
                const isCurrentOrFutureWeek = selectedWeekDate >= todayMonday;

                if (currentRows.length === 0 || isCurrentOrFutureWeek) {
                    const existingNames = new Set((currentRows || []).map(r => normalizeProjectName(r.projectName)));
                    const seededRows = [...(currentRows || [])];

                    // If we have prevRows, and current is empty, start with prevRows
                    if (currentRows.length === 0 && prevRows.length > 0) {
                        prevRows.forEach(p => {
                            seededRows.push({ ...p, id: Date.now() + Math.random() });
                            existingNames.add(normalizeProjectName(p.projectName));
                        });
                    }

                    // Current/future week: add any master projects missing from the list
                    // Past week: only seed if completely empty (already handled above)
                    if (isCurrentOrFutureWeek) {
                        activeMasterProjects.forEach((master, index) => {
                            const normName = normalizeProjectName(master.name || master.projectName);
                            if (!existingNames.has(normName)) {
                                seededRows.push({
                                    id: Date.now() + index + Math.random(),
                                    projectName: master.name || master.projectName,
                                    type: 'Client',
                                    category: master.status || '진행중',
                                    [statusKey]: master.status || '진행중',
                                    [pdKey]: getMasterVal(master, ['pd', 'PD', 'pD', 'Pd']) || '',
                                    [pmKey]: getMasterVal(master, ['pm', 'PM', 'pM', 'Pm']) || '',
                                    [startKey]: normalizeToDashDate(getMasterVal(master, ['start_date', 'startDate', 'kickoff', 'startDay'])) || '',
                                    [endKey]: normalizeToDashDate(getMasterVal(master, ['end_date', 'endDate', 'rfpInfo', 'endDay', 'rfp_info'])) || '',
                                    progress: '-',
                                    plan: '-',
                                    pt: '-',
                                    proposal: '-'
                                });
                                existingNames.add(normName);
                            }
                        });
                    }

                    // FINAL REPAIR: Ensure all rows (new and carryover) have the LATEST metadata from Master
                    currentRows = seededRows.map(row => {
                        const master = masterProjectsList.find(m => normalizeProjectName(m.name || m.projectName) === normalizeProjectName(row.projectName));
                        if (!master) return { ...row, id: row.id || (Date.now() + Math.random()) };

                        const updated = { 
                            ...row, 
                            id: row.id || (Date.now() + Math.random()),
                            progress: row.progress || '-',
                            plan: row.plan || '-'
                        };

                        // Sync Master Info
                        const pdVal = getMasterVal(master, ['pd', 'PD', 'pD', 'Pd']);
                        const pmVal = getMasterVal(master, ['pm', 'PM', 'pM', 'Pm']);
                        const startVal = normalizeToDashDate(getMasterVal(master, ['start_date', 'startDate', 'kickoff', 'startDay']));
                        const endVal = normalizeToDashDate(getMasterVal(master, ['end_date', 'endDate', 'rfpInfo', 'endDay', 'rfp_info']));
                        const masterStatus = getMasterVal(master, ['status', 'operatingStatus', 'operating_status']);
                        const clientInfo = getMasterVal(master, ['clientInfo', 'client_info', 'customer']);

                        let changed = false;
                        if (pdVal && row[pdKey] !== pdVal) { updated[pdKey] = pdVal; changed = true; }
                        else if (pdVal) updated[pdKey] = pdVal;
                        if (pmVal && row[pmKey] !== pmVal) { updated[pmKey] = pmVal; changed = true; }
                        else if (pmVal) updated[pmKey] = pmVal;
                        if (startVal && row[startKey] !== startVal) { updated[startKey] = startVal; changed = true; }
                        else if (startVal) updated[startKey] = startVal;
                        if (endVal && row[endKey] !== endVal) { updated[endKey] = endVal; changed = true; }
                        else if (endVal) updated[endKey] = endVal;
                        if (masterStatus && row[statusKey] !== masterStatus) { updated[statusKey] = masterStatus; changed = true; }
                        else if (masterStatus) updated[statusKey] = masterStatus;
                        if (clientInfo) updated[clientInfoKey] = clientInfo;

                        if (changed) masterUpdated = true;
                        return updated;
                    });
                } else {
                    // METADATA REPAIR: If rows already exist, fill in missing PM/Date/Status from Master DB
                    currentRows = currentRows.map(row => {
                        const master = masterProjectsList.find(m => normalizeProjectName(m.name || m.projectName) === normalizeProjectName(row.projectName));
                        if (!master) return row;

                        const pdVal = getMasterVal(master, ['pd', 'PD', 'pD', 'Pd']);
                        const pmVal = getMasterVal(master, ['pm', 'PM', 'pM', 'Pm']);
                        const startVal = normalizeToDashDate(getMasterVal(master, ['start_date', 'startDate', 'kickoff', 'startDay']));
                        const endVal = normalizeToDashDate(getMasterVal(master, ['end_date', 'endDate', 'rfpInfo', 'endDay', 'rfp_info']));
                        const masterStatus = getMasterVal(master, ['status', 'operatingStatus', 'operating_status']);

                        const updated = { ...row };

                        if (!updated.type) updated.type = 'Client';
                        let changed = false;
                        if (pdVal && row[pdKey] !== pdVal) { updated[pdKey] = pdVal; changed = true; }
                        else if (pdVal) updated[pdKey] = pdVal;
                        if (pmVal && row[pmKey] !== pmVal) { updated[pmKey] = pmVal; changed = true; }
                        else if (pmVal) updated[pmKey] = pmVal;
                        if (startVal && row[startKey] !== startVal) { updated[startKey] = startVal; changed = true; }
                        else if (startVal) updated[startKey] = startVal;
                        if (endVal && row[endKey] !== endVal) { updated[endKey] = endVal; changed = true; }
                        else if (endVal) updated[endKey] = endVal;
                        if (masterStatus && row[statusKey] !== masterStatus) { updated[statusKey] = masterStatus; changed = true; }
                        else if (masterStatus) updated[statusKey] = masterStatus;

                        if (changed) masterUpdated = true;
                        return updated;
                    });
                }

                setReportData(currentRows || []);
                setLastWeekProjects(prevRows); // For manual clone and copy-row suggestions

                // 4. Handle Layout Inheritance
                if (currentLayout) {
                    const isCurrentDefault = JSON.stringify(currentLayout.columnWidths) === JSON.stringify(DEFAULT_COLUMN_WIDTHS);
                    if (!isCurrentDefault) {
                        if (currentLayout.columnWidths) setColumnWidths(currentLayout.columnWidths);
                    } else if (prevLayout && prevLayout.columnWidths) {
                        setColumnWidths(prevLayout.columnWidths);
                    }
                    if (currentLayout.rowHeights) setRowHeights(currentLayout.rowHeights);
                } else if (prevLayout) {
                    if (prevLayout.columnWidths) setColumnWidths(prevLayout.columnWidths);
                    if (prevLayout.rowHeights) setRowHeights(prevLayout.rowHeights);
                }

                // Final flag update with safety delay to prevent empty-auto-save race condition
                setTimeout(() => {
                    dataLoaded.current = true;
                }, 500);

                // Notify user if master metadata was updated on load
                if (masterUpdated) {
                    setShowMasterSyncToast(true);
                    setTimeout(() => setShowMasterSyncToast(false), 4000);
                }
                
                // Fetch master projects if not already fetched during seeding
                if (masterProjects.length === 0) {
                    const resMaster = await projectsAPI.getAll();
                    setMasterProjects(resMaster.data);
                }

                // Fetch PD/PM lists
                const [pms, pds] = await Promise.all([
                    employeesAPI.getAll({ job_role: 'PM', status: 'active' }),
                    employeesAPI.getAll({ job_role: 'PD', status: 'active' })
                ]);
                setPmList(pms.data.map(e => e.name));
                setPdList(pds.data.map(e => e.name));
            } catch (error) {
                console.error('Failed to fetch data:', error);
            } finally {
                setIsLoading(false);
            }
    }, [selectedDate, masterProjects.length]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // AUTO-SAVE LOGIC: Debounce manual changes
    useEffect(() => {
        // Prevent auto-save on initial load or if no data yet
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        
        // If data hasn't finished loading first time, don't try to "save back" an empty state
        if (!dataLoaded.current) return;

        setAutoSaveStatus('Saving...');
        setIsAutoSaving(true);

        const timer = setTimeout(async () => {
            try {
                // Double check it's still the correct date and data is loaded before auto-save
                if (!dataLoaded.current) return;

                // Apply same filtering as manual save for current/future weeks
                const todayMon = (() => {
                    const d = new Date(); const day = d.getDay();
                    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
                    d.setHours(0, 0, 0, 0); return d;
                })();
                const isCurrent = new Date(selectedDate) >= todayMon;
                let rowsToAutoSave = reportData;
                if (isCurrent && masterProjects.length > 0) {
                    rowsToAutoSave = reportData.filter(item => {
                        if (!item.projectName || item.projectName === '') return true;
                        const masterMatch = masterProjects.find(m =>
                            normalizeProjectName(m.name || m.projectName) === normalizeProjectName(item.projectName)
                        );
                        if (!masterMatch) return false;
                        const masterType = String(masterMatch.type || '').toLowerCase();
                        return !masterType || masterType === 'client' || masterType === '고객사';
                    });
                }

                await projectReportsAPI.save({
                    week_date: selectedDate,
                    data: {
                        rows: rowsToAutoSave,
                        columnWidths: columnWidths,
                        rowHeights: { header: rowHeights.header }
                    }
                });
                setAutoSaveStatus('Saved');
                setTimeout(() => setAutoSaveStatus(''), 2000);
            } catch (error) {
                console.error('Auto-save failed:', error);
                setAutoSaveStatus('Error');
            } finally {
                setIsAutoSaving(false);
            }
        }, 2000); 

        return () => clearTimeout(timer);
    }, [reportData, selectedDate]);

    const handleSave = async (silent = false, rowsOverride = null) => {
        try {
            // For current/future weeks, only save rows that exist in master as Client type
            // For past weeks, save all rows as-is (archive mode)
            const todayMon = (() => {
                const d = new Date(); const day = d.getDay();
                d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
                d.setHours(0, 0, 0, 0); return d;
            })();
            const isCurrent = new Date(selectedDate) >= todayMon;

            let rowsToSave = rowsOverride || reportData;
            if (isCurrent && masterProjects.length > 0) {
                rowsToSave = rowsToSave.filter(item => {
                    if (!item.projectName || item.projectName === '') return true;
                    const masterMatch = masterProjects.find(m =>
                        normalizeProjectName(m.name || m.projectName) === normalizeProjectName(item.projectName)
                    );
                    if (!masterMatch) return false;
                    const masterType = String(masterMatch.type || '').toLowerCase();
                    return !masterType || masterType === 'client' || masterType === '고객사';
                });
            }

            const dataToSave = {
                rows: rowsToSave,
                columnWidths: columnWidths,
                rowHeights: { header: rowHeights.header }
            };
            
            await projectReportsAPI.save({
                week_date: selectedDate,
                data: dataToSave
            });
            
            if (!silent) {
                setShowSaveToast(true);
                setTimeout(() => setShowSaveToast(false), 3000);
            }
            return true;
        } catch (error) {
            console.error('Failed to save report:', error);
            if (!silent) alert('서버 오류로 저장에 실패했습니다.');
            return false;
        }
    };

    const handlePrevWeek = async () => {
        await handleSave(true);
        const prevWeekDate = offsetDate(selectedDate, -7);
        dataLoaded.current = false;
        setIsLoading(true); // Show spinner without clearing UI
        setSelectedDate(prevWeekDate);
    };

    const handleNextWeek = async () => {
        const nextWeekDate = offsetDate(selectedDate, 7);
        const currentFriday = getReportingFriday();

        if (nextWeekDate > currentFriday) {
            alert('미래 주차는 열리지 않습니다.');
            return;
        }

        await handleSave(true);
        dataLoaded.current = false;
        setIsLoading(true); // Show spinner without clearing UI
        setSelectedDate(nextWeekDate);
    };


    


    const [columns, setColumns] = useState(() => {
        const saved = localStorage.getItem(COLUMNS_CONFIG_KEY);
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { console.error(e); }
        }
        return [
            { key: 'category', label: '구분', width: 80 },
            { key: 'projectName', label: '프로젝트명', width: 320 },
            { key: 'pd', label: 'PD', width: 120 },
            { key: 'pm', label: 'PM', width: 120 },
            { key: 'status', label: '운영상태', width: 100 },
            { key: 'kickoff', label: '시작일', width: 120 },
            { key: 'rfpInfo', label: '종료일', width: 120 },
            { key: 'progress', label: '진행상황', width: 500 },
            { key: 'manage', label: '관리', width: 60 }
        ];
    });

    useEffect(() => {
        localStorage.setItem(COLUMNS_CONFIG_KEY, JSON.stringify(columns));
    }, [columns]);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategories, setSelectedCategories] = useState(['진행예정', '진행중', '홀딩', '종료']);
    const [showSaveToast, setShowSaveToast] = useState(false);
    const [showMasterSyncToast, setShowMasterSyncToast] = useState(false);
    const [focusedCell, setFocusedCell] = useState(null);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isMasterModalOpen, setIsMasterModalOpen] = useState(false);
    const [activeMasterRowId, setActiveMasterRowId] = useState(null);
    const [isAutoSaving, setIsAutoSaving] = useState(false);
    const [isSyncingAllWidths, setIsSyncingAllWidths] = useState(false);
    const [autoSaveStatus, setAutoSaveStatus] = useState(''); // 'Saving...', 'Saved', ''
    const isInitialMount = useRef(true);
    const dataLoaded = useRef(false);

    const handleUpdateColumns = useCallback((newCols) => {
        setReportData(prevData => {
            return prevData.map(item => {
                const newItem = { ...item };
                newCols.forEach(col => {
                    if (newItem[col.key] === undefined) {
                        newItem[col.key] = '-';
                    }
                });
                return newItem;
            });
        });
        setColumns(newCols);
    }, []);

    const handleSyncAllWidths = async () => {
        setIsSyncingAllWidths(true);
        try {
            const res = await projectReportsAPI.updateAllColumnWidths(columnWidths);
            alert(res.data.message || '모든 주간보고의 컬럼 너비가 동기화되었습니다.');
        } catch (error) {
            console.error('Failed to sync widths:', error);
            alert('동기화 처리 중 오류가 발생했습니다.');
        } finally {
            setIsSyncingAllWidths(false);
        }
    };

    const columnLetters = useMemo(() => 
        Array.from({ length: columns.length }, (_, i) => String.fromCharCode(65 + i))
    , [columns]);

    const [columnWidths, setColumnWidths] = useState(() => {
        const saved = localStorage.getItem(COLUMN_WIDTHS_KEY);
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { console.error(e); }
        }
        return DEFAULT_COLUMN_WIDTHS;
    });

    const getSafeWidth = useCallback((key) => {
        const w = Number(columnWidths[key]);
        if (!isNaN(w) && w > 0) return w;
        const colDef = columns.find(c => c.key === key);
        return Number(colDef?.width) || 120;
    }, [columnWidths, columns]);

    const totalWidth = useMemo(() => {
        const colTotal = columns.reduce((acc, col) => acc + getSafeWidth(col.key), 0);
        return 40 + colTotal; 
    }, [columns, getSafeWidth]);


    const [rowHeights, setRowHeights] = useState(() => {
        const saved = localStorage.getItem(ROW_HEIGHTS_KEY);
        if (saved) {
            try { 
                const parsed = JSON.parse(saved);
                if (parsed && !parsed.header) parsed.header = 36;
                return parsed;
            } catch (e) { console.error(e); }
        }
        return { header: 36 };
    });

    useEffect(() => {
        localStorage.setItem(COLUMN_WIDTHS_KEY, JSON.stringify(columnWidths));
    }, [columnWidths]);

    useEffect(() => {
        localStorage.setItem(ROW_HEIGHTS_KEY, JSON.stringify(rowHeights));
    }, [rowHeights]);

    const resizingRef = useRef({ isResizing: false, type: null, id: null, startPos: 0, startSize: 0 });

    const handleMouseMove = useCallback((e) => {
        if (!resizingRef.current.isResizing) return;
        if (resizingRef.current.type === 'col') {
            const deltaX = e.clientX - resizingRef.current.startPos;
            const newWidth = Math.max(40, resizingRef.current.startSize + deltaX);
            setColumnWidths(prev => ({ ...prev, [resizingRef.current.id]: newWidth }));
        } else if (resizingRef.current.type === 'row') {
            const deltaY = e.clientY - resizingRef.current.startPos;
            const newHeight = Math.max(24, resizingRef.current.startSize + deltaY);
            if (resizingRef.current.id === 'header') {
                setRowHeights(prev => ({ ...prev, header: newHeight }));
            } else {
                // Update specific row item in reportData
                setReportData(prevData => prevData.map(item => 
                    item.id === resizingRef.current.id ? { ...item, rowHeight: newHeight } : item
                ));
            }
        }
    }, [handleSave]); // Added handleSave to ensure it can be triggered optionally

    const handleMouseUp = useCallback(() => {
        resizingRef.current.isResizing = false;
        document.body.style.cursor = 'default';
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }, [handleMouseMove]);

    const handleColumnMouseDown = useCallback((e, column) => {
        e.stopPropagation();
        const startWidth = Number(columnWidths[column]) || Number(columns.find(c => c.key === column)?.width) || 120;
        resizingRef.current = { isResizing: true, type: 'col', id: column, startPos: e.clientX, startSize: startWidth };
        document.body.style.cursor = 'col-resize';
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [columnWidths, columns, handleMouseMove, handleMouseUp]);

    const handleRowMouseDown = useCallback((e, rowId) => {
        e.stopPropagation();
        const startHeight = rowId === 'header' ? (rowHeights.header || 36) : (reportData.find(item => item.id === rowId)?.rowHeight || 80);
        resizingRef.current = { isResizing: true, type: 'row', id: rowId, startPos: e.clientY, startSize: startHeight };
        document.body.style.cursor = 'row-resize';
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [rowHeights, reportData, handleMouseMove, handleMouseUp]);

    const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
    const handleResetLayout = () => {
        localStorage.removeItem(COLUMN_WIDTHS_KEY);
        localStorage.removeItem(ROW_HEIGHTS_KEY);
        setColumnWidths(DEFAULT_COLUMN_WIDTHS);
        setRowHeights({ header: 36 });
        const newRows = reportData.map(row => ({ ...row, rowHeight: 80 }));
        setReportData(newRows);
        setIsResetConfirmOpen(false);
        // Save automatically to persist the reset with overridden data to avoid stale state
        handleSave(true, newRows);
    };

    const handleCellChange = useCallback((id, field, value) => {
        setReportData(prev => {
            const targetRow = prev.find(r => r.id === id);
            if (!targetRow) return prev;
            const pName = targetRow.projectName;

            const colDef = columns.find(c => c.key === field);
            const label = colDef?.label || '';
            const isPDPM = label.toUpperCase().includes('PD') || label.toUpperCase().includes('PM') || label.includes('담당') || label.includes('보고자') || field.toLowerCase().includes('pd') || field.toLowerCase().includes('pm');
            const isDate = label.includes('시작') || label.includes('종료') || label.includes('날짜') || field.toLowerCase().includes('date') || field === 'kickoff';

            if ((isPDPM || isDate) && pName && pName.trim() !== '') {
                // Background sync all reports
                projectReportsAPI.syncProjectField(pName, field, value).catch(err => console.error('Global sync failed:', err));
                // Update all matching rows in current view
                return prev.map(item => (item.projectName && item.projectName.trim() === pName.trim()) ? { ...item, [field]: value } : item);
            }
            
            return prev.map(item => item.id === id ? { ...item, [field]: value } : item);
        });
    }, [columns]);

    const handleProjectSelect = useCallback((id, projectData, isFullAutofill) => {
        setReportData(prev => prev.map(item => {
            if (item.id === id) {
                if (isFullAutofill) {
                    return { 
                        ...item, 
                        ...projectData, 
                        id,
                        status: ''
                    };
                } else {
                    const name = typeof projectData === 'string' ? projectData : (projectData.name || projectData.displayName || '');
                    
                    // 1. DYNAMIC COLUMN MAPPING
                    // Identify the correct destination keys based on column labels
                    const getColKey = (keywords, defaultKey, ignoreKeys = []) => {
                        const col = columns.find(c => {
                            if (ignoreKeys.includes(c.key)) return false;
                            const lbl = (c.label || '').toUpperCase();
                            const key = (c.key || '').toUpperCase();
                            return keywords.some(k => lbl.includes(k) || key.includes(k));
                        });
                        return col ? col.key : defaultKey;
                    };

                    const pdKey = getColKey(['PD', '보고자'], 'pd');
                    const pmKey = getColKey(['PM', '담당'], 'pm', [pdKey]);
                    const startKey = getColKey(['시작', '기간', 'KICKOFF', 'START'], 'kickoff');
                    const endKey = getColKey(['종료', '특이', 'RFP', 'END'], 'rfpInfo', [startKey]);

                    // 2. DATA EXTRACTION WITH CASE INSENSITIVITY
                    const getVal = (obj, fields) => {
                        if (typeof obj !== 'object' || !obj) return null;
                        for (let f of fields) {
                            if (obj[f] !== undefined && obj[f] !== null && obj[f] !== '' && obj[f] !== '-') return obj[f];
                        }
                        return null;
                    };

                    const pdVal = getVal(projectData, ['pd', 'PD', 'pD', 'Pd']);
                    const pmVal = getVal(projectData, ['pm', 'PM', 'pM', 'Pm']);
                    const startVal = normalizeToDashDate(getVal(projectData, ['start_date', 'startDate', 'kickoff', 'startDay']));
                    const endVal = normalizeToDashDate(getVal(projectData, ['end_date', 'endDate', 'rfpInfo', 'endDay', 'rfp_info']));

                    const updatedItem = { ...item, projectName: name };

                    // Only update if we found a value to avoid overwriting with empty
                    if (pdVal !== null) updatedItem[pdKey] = pdVal;
                    if (pmVal !== null) updatedItem[pmKey] = pmVal;
                    if (startVal) updatedItem[startKey] = startVal;
                    if (endVal) updatedItem[endKey] = endVal;

                    if (typeof projectData === 'object' && projectData.type) {
                        updatedItem.type = projectData.type;
                    }

                    return updatedItem;
                }
            }
            return item;
        }));
    }, [columns]);

    const handleOpenMasterLibrary = useCallback((id) => {
        setActiveMasterRowId(id);
        setIsMasterModalOpen(true);
    }, []);

    const handleHeaderChange = useCallback((key, newLabel) => {
        setColumns(prev => prev.map(col => col.key === key ? { ...col, label: newLabel } : col));
    }, []);

    const addNewRow = () => {
        const defaultPD = (user?.role === 'PD' || user?.role === 'Admin') ? user?.name : '';
        const defaultPM = (user?.role === 'PM') ? user?.name : '';
        const newRow = { id: Date.now(), category: '진행중', projectName: '', pd: defaultPD, pm: defaultPM, mainContractor: '-', estimatedAmount: '-', progress: '-', kickoff: '-', rfpInfo: '-', proposal: '-', pt: '-', status: '', plan: '', clientInfo: '-', rowHeight: 80, type: 'Client' };
        setReportData([newRow, ...reportData]);
    };

    const deleteRow = useCallback((id) => {
        if (window.confirm('이 행을 삭제하시겠습니까?')) {
            setReportData(prev => prev.filter(item => item.id !== id));
        }
    }, []);


    const filteredData = useMemo(() => {
        const orderArr = ['진행예정', '진행중', '홀딩', '종료'];
        
        const normalize = (val) => {
            const str = String(val || '').normalize('NFC').trim();
            if (str === '수행' || str === 'active' || str === 'Active') return '진행중';
            if (['수주', '드롭', '탈락'].includes(str)) return '종료';
            return str || '진행중';
        };

        return reportData
            .filter(item => {
                const cat = normalize(item.category);
                const matchesCategory = selectedCategories.includes(cat);
                const matchesSearch = (item.projectName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                      (item.pd || '').toLowerCase().includes(searchTerm.toLowerCase());

                // Ownership Filtering: If not Admin, only show own projects (PD or PM match)
                const isOwner = user?.role === 'Admin' ||
                                (String(item.pd || '').trim() === String(user?.name || '').trim()) ||
                                (String(item.pm || '').trim() === String(user?.name || '').trim());

                // Filter by master:
                // Current/future week: exclude rows not in master + non-Client types
                // Past week (archive): only exclude non-Client types, keep rows even if not in master
                const todayMon = (() => {
                    const d = new Date(); const day = d.getDay();
                    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
                    d.setHours(0, 0, 0, 0); return d;
                })();
                const isCurrent = new Date(selectedDate) >= todayMon;

                if (item.projectName && item.projectName !== '' && masterProjects.length > 0) {
                    const masterMatch = masterProjects.find(m =>
                        normalizeProjectName(m.name || m.projectName) === normalizeProjectName(item.projectName)
                    );
                    if (masterMatch) {
                        // Exclude if not Client type (applies to all weeks)
                        const masterType = String(masterMatch.type || '').toLowerCase();
                        const isClientType = !masterType || masterType === 'client' || masterType === '고객사';
                        if (!isClientType) return false;
                        // Exclude if not ongoing status (applies to current/future weeks)
                        if (isCurrent) {
                            const masterStatus = String(masterMatch.status || '').normalize('NFC').trim().toLowerCase();
                            const isOngoing = !masterStatus || ['active', '진행중', '수행', 'ongoing', '진행'].some(s => masterStatus === s);
                            if (!isOngoing) return false;

                            // Exclude if project hasn't started yet (start_date is after selected week)
                            const startDate = masterMatch.start_date || masterMatch.startDate;
                            if (startDate) {
                                const start = new Date(startDate);
                                const weekDate = new Date(selectedDate);
                                if (start > weekDate) return false;
                            }
                        }
                    } else if (isCurrent) {
                        // Not in master + current/future week: exclude
                        return false;
                    }
                    // Not in master + past week: keep as-is (archive)
                }

                return matchesCategory && matchesSearch && isOwner;
            })
            .sort((a, b) => {
                const weights = { '진행예정': 0, '진행중': 1, '홀딩': 2, '종료': 3 };
                
                const catA = normalize(a.category);
                const catB = normalize(b.category);
                
                const weightA = weights[catA] || 99;
                const weightB = weights[catB] || 99;

                if (weightA !== weightB) return weightA - weightB;
                
                // Helper to get group from item or master DB (covers old reports too)
                const getGroupVal = (item) => {
                    if (item.project_group) return item.project_group;
                    const normalizedName = normalizeProjectName(item.projectName);
                    const master = masterProjects.find(m => normalizeProjectName(m.name) === normalizedName);
                    return master?.project_group || '';
                };

                // Prioritize Project Group within the same category
                const groupPriority = { '구축': 1, 'ISG1': 2, 'ISD': 3 };
                const gA = groupPriority[getGroupVal(a)] || 99;
                const gB = groupPriority[getGroupVal(b)] || 99;
                
                if (gA !== gB) return gA - gB;

                // Then sort alphabetically by project name
                const nameA = normalizeProjectName(a.projectName);
                const nameB = normalizeProjectName(b.projectName);
                return nameA.localeCompare(nameB, 'ko');
            });
    }, [reportData, searchTerm, selectedCategories, masterProjects, selectedDate]);

    const handleExportExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('프로젝트보고');

        const exportColumns = columns.filter(col => col.key !== 'manage');

        worksheet.columns = [
            { header: 'No', key: 'no', width: 5 },
            ...exportColumns.map(col => ({
                header: col.label,
                key: col.key,
                width: Math.max(15, (columnWidths[col.key] || 100) / 7.5)
            }))
        ];

        const headerRow = worksheet.getRow(1);
        headerRow.height = 25;
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1E293B' }
        };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

        filteredData.forEach((row, index) => {
            const rowData = { no: index + 1 };
            exportColumns.forEach(col => {
                rowData[col.key] = row[col.key];
            });
            const excelRow = worksheet.addRow(rowData);
            excelRow.height = 30;

            const categoryCell = excelRow.getCell('category');
            const categoryValue = String(row.category || '').normalize('NFC').trim();
            
            let bgColor = 'FFFFFFFF';
            let textColor = 'FF000000';

            const normalize = (val) => {
                const str = String(val || '').normalize('NFC').trim();
                if (str === '수행') return '진행중';
                if (['수주', '드롭', '탈락'].includes(str)) return '종료';
                return str || '진행중';
            };
            const cat = normalize(categoryValue);

            if (cat === '진행중') {
                bgColor = 'FFE6FFFA'; textColor = 'FF059669';
            } else if (cat === '홀딩') {
                bgColor = 'FFFFFAF0'; textColor = 'FFD97706';
            } else if (cat === '종료') {
                bgColor = 'FFF1F5F9'; textColor = 'FF475569';
            }

            categoryCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: bgColor.replace('#', '') }
            };
            categoryCell.font = { color: { argb: textColor.replace('#', '') }, bold: true, size: 9 };
            categoryCell.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        worksheet.eachRow((row, rowNumber) => {
            row.eachCell((cell, colNumber) => {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
                };
                
                if (rowNumber > 1) {
                    const colDef = exportColumns[colNumber - 2]; // -2 because of 'No' column at 1
                    const isPDPMCell = colDef && (
                        colDef.label.toUpperCase().includes('PD') || 
                        colDef.label.toUpperCase().includes('PM') || 
                        colDef.label.includes('담당') || 
                        colDef.label.includes('보고자') ||
                        (colDef.key && (colDef.key.toLowerCase().includes('pd') || colDef.key.toLowerCase().includes('pm')))
                    );

                    if (cell.address.indexOf('A') !== 0) {
                        cell.font = { size: 9 };
                        cell.alignment = { 
                            vertical: 'middle', 
                            horizontal: (isPDPMCell || colDef?.key === 'category') ? 'center' : 'left',
                            wrapText: true 
                        };
                    } else {
                        cell.font = { size: 9, color: { argb: 'FF64748B' } };
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    }
                }
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `프로젝트보고_${selectedDate}.xlsx`);
    };

    return (
        <div className={`flex flex-col h-full min-h-0 animate-in fade-in duration-700 ${theme === 'light' ? 'light-theme' : ''}`}>
            <style>
                {`
                    .report-spreadsheet-container {
                        --grid-border: rgba(255, 255, 255, 0.15);
                    }
                    .light-theme .report-spreadsheet-container {
                        --grid-border: rgba(0, 0, 0, 0.15);
                    }
                    .report-spreadsheet-container table { 
                        border-collapse: separate !important; 
                        border-spacing: 0 !important; 
                        table-layout: fixed !important; 
                        width: max-content !important; 
                    }
                    .report-spreadsheet-container td, .report-spreadsheet-container th { 
                        padding: 0 !important; 
                        margin: 0 !important; 
                        border: 1px solid var(--grid-border) !important; 
                    }
                    .report-spreadsheet-container td { position: relative !important; }
                    .report-spreadsheet-container input, .report-spreadsheet-container textarea { box-shadow: none !important; border: none !important; outline: none !important; appearance: none !important; user-select: text !important; cursor: text !important; width: 100% !important; height: 100% !important; background: transparent; color: inherit; }
                    .report-spreadsheet-container .focused-field { box-shadow: inset 0 0 0 2px #3b82f6 !important; z-index: 60 !important; background: var(--bg-secondary) !important; color: var(--text-primary) !important; caret-color: #3b82f6 !important; }
                    .report-spreadsheet-container thead th {
                        position: sticky !important;
                        background: var(--bg-tertiary) !important;
                    }
                    .report-spreadsheet-container thead tr:nth-child(1) th {
                        top: 0 !important;
                        z-index: 55 !important;
                    }
                    .report-spreadsheet-container thead tr:nth-child(2) th {
                        top: 28px !important;
                        z-index: 55 !important;
                    }
                    .report-spreadsheet-container td.sticky { 
                        position: sticky !important;
                        left: 0 !important;
                        z-index: 40 !important;
                        background: var(--bg-tertiary) !important; 
                    }
                    .report-spreadsheet-container thead th:first-child {
                        left: 0 !important;
                        z-index: 65 !important;
                    }
                    .report-spreadsheet-container td:not(.sticky) { overflow: hidden !important; background: var(--bg-secondary); }
                    .report-spreadsheet-container .resize-handle { z-index: 100 !important; pointer-events: auto !important; }
                    .trash-delete-btn { opacity: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: none !important; border: none !important; padding: 0 !important; cursor: pointer; color: #94a3b8; transition: all 0.15s ease; outline: none !important; }
                    tr:hover .trash-delete-btn { opacity: 1; }
                    .trash-delete-btn:hover .trash-delete-icon { stroke: #ff0000 !important; filter: drop-shadow(0 0 4px rgba(255, 0, 0, 0.4)); }
                    .trash-delete-icon { stroke: currentColor; fill: none; pointer-events: none; transition: stroke 0.15s ease; }
                    
                    .btn-save:hover { color: #3b82f6 !important; background: rgba(59, 130, 246, 0.15) !important; filter: drop-shadow(0 0 5px rgba(59, 130, 246, 0.5)); }
                    .btn-add:hover { color: #10b981 !important; background: rgba(16, 185, 129, 0.15) !important; filter: drop-shadow(0 0 5px rgba(16, 185, 129, 0.5)); }
                    .btn-cols:hover { color: #8b5cf6 !important; background: rgba(139, 92, 246, 0.15) !important; filter: drop-shadow(0 0 5px rgba(139, 92, 246, 0.5)); }
                    .btn-theme:hover { color: #f59e0b !important; background: rgba(245, 158, 11, 0.15) !important; filter: drop-shadow(0 0 5px rgba(245, 158, 11, 0.5)); }
                    .btn-excel:hover { color: #16a34a !important; background: rgba(22, 163, 74, 0.15) !important; filter: drop-shadow(0 0 5px rgba(22, 163, 74, 0.5)); }
                    .btn-week:hover { color: #f472b6 !important; background: rgba(244, 114, 182, 0.15) !important; filter: drop-shadow(0 0 5px rgba(244, 114, 182, 0.5)); }
                    .btn-clone:hover { color: #60a5fa !important; background: rgba(96, 165, 250, 0.15) !important; filter: drop-shadow(0 0 5px rgba(96, 165, 250, 0.5)); }
                    .btn-reset:hover { color: #f43f5e !important; background: rgba(244, 63, 94, 0.15) !important; filter: drop-shadow(0 0 5px rgba(244, 63, 94, 0.5)); }

                    .report-transition-wrapper {
                        /* Removed fade animations as requested */
                    }
                    
                    /* Premium Button Variations */
                    .premium-btn-cyan {
                        background: linear-gradient(135deg, #00f2ff 0%, #00d2ff 100%) !important;
                        color: #000 !important;
                        box-shadow: 0 0 15px rgba(0, 242, 255, 0.3) !important;
                        border: none !important;
                    }
                    .premium-btn-cyan:hover {
                        background: linear-gradient(135deg, #40f6ff 0%, #00f2ff 100%) !important;
                        box-shadow: 0 0 25px rgba(0, 242, 255, 0.5) !important;
                        transform: translateY(-1px);
                    }
                    .premium-btn-cyan:active { transform: translateY(0); }

                    .premium-btn-blue {
                        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
                        color: #fff !important;
                        box-shadow: 0 0 15px rgba(37, 99, 235, 0.3) !important;
                        border: none !important;
                    }
                    .premium-btn-blue:hover {
                        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
                        box-shadow: 0 0 25px rgba(37, 99, 235, 0.5) !important;
                        transform: translateY(-1px);
                    }
                    
                    .premium-btn-outline {
                        background: rgba(255,255,255,0.03) !important;
                        border: 1px solid rgba(255,255,255,0.1) !important;
                        color: #94a3b8 !important;
                    }
                    .premium-btn-outline:hover {
                        background: rgba(255,255,255,0.08) !important;
                        border-color: rgba(255,255,255,0.2) !important;
                        color: #fff !important;
                    }

                    /* New Theme-Aware Empty State Button */
                    .premium-empty-action-btn {
                        position: relative;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 10px;
                        padding: 12px 32px;
                        border-radius: 16px;
                        font-weight: 900;
                        font-size: 13px;
                        color: white !important;
                        background: #2563eb !important;
                        border: 1px solid rgba(255,255,255,0.1) !important;
                        box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.3) !important;
                        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        overflow: hidden;
                        outline: none !important;
                    }
                    .premium-empty-action-btn:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 20px 35px -5px rgba(37, 99, 235, 0.4) !important;
                        background: #1d4ed8 !important;
                    }
                    .premium-empty-action-btn:active {
                        transform: translateY(0);
                    }
                    
                    .light-theme .premium-empty-action-btn {
                        background: #3b82f6 !important;
                        box-shadow: 0 10px 25px -5px rgba(59, 130, 246, 0.4) !important;
                        color: white !important;
                    }
                    .light-theme .premium-empty-action-btn:hover {
                        background: #2563eb !important;
                    }

                     /* Premium Date Navigator */
                     .premium-date-nav {
                         display: flex;
                         align-items: center;
                         gap: 8px;
                         padding: 5px 12px;
                         border-radius: 12px;
                         background: rgba(255, 255, 255, 0.03) !important;
                         backdrop-filter: blur(10px);
                         border: 1px solid rgba(255, 255, 255, 0.1) !important;
                         box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
                         transition: all 0.3s ease;
                     }
                     .light-theme .premium-date-nav {
                         background: rgba(0, 0, 0, 0.03) !important;
                         border: 1px solid rgba(0, 0, 0, 0.05) !important;
                         box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
                     }
                     .premium-date-text {
                         font-size: 13px;
                         font-weight: 900;
                         letter-spacing: -0.01em;
                         text-transform: uppercase;
                         color: var(--text-primary);
                         min-width: 140px;
                         text-align: center;
                     }
                     .premium-nav-btn {
                         padding: 2px;
                         border-radius: 6px;
                         color: var(--text-muted);
                         background: transparent !important;
                         transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                         display: flex;
                         align-items: center;
                         justify-content: center;
                         border: none !important;
                         outline: none !important;
                     }
                     .premium-nav-btn:hover {
                         color: #3b82f6;
                         transform: scale(1.2);
                     }
                     .premium-nav-btn:active {
                         transform: scale(0.9);
                     }

                    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                `}
            </style>
            {showSaveToast && (
                <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top duration-500">
                    <div
                        className="px-6 py-3 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.8)] flex items-center gap-3 border"
                        style={{ backgroundColor: '#000000', borderColor: '#2563eb', color: '#ffffff', opacity: 1, zIndex: 9999 }}
                    >
                        <CheckCircle2 size={20} color="#2563eb" /><span className="font-bold">성공적으로 저장되었습니다.</span>
                    </div>
                </div>
            )}
            <div className={`flex items-center justify-between px-4 py-1.5 bg-[var(--bg-secondary)] border-b border-[var(--border)] z-30 ${theme === 'light' ? 'shadow-sm' : ''}`}>
                <div className="flex items-center gap-2">
                    <button onClick={handleSave} className="premium-icon-btn btn-save" title="저장 (Save)"><Save size={16} /></button>
                    <button onClick={addNewRow} className="premium-icon-btn btn-add" title="행 추가 (Add Row)"><Plus size={16} /></button>

                    <button onClick={() => setIsSettingsModalOpen(true)} className="premium-icon-btn btn-cols" title="열 설정 (Columns)"><Columns size={16} /></button>
                    <button onClick={handleExportExcel} className="premium-icon-btn btn-excel" title="엑셀로 다운로드"><Download size={16} /></button>
                    
                    <div className="w-px h-5 bg-[var(--border)] mx-1"></div>
                    
                    <div className="premium-date-nav">
                        <button onClick={handlePrevWeek} className="premium-nav-btn" title="이전 주">
                            <ChevronLeft size={18} strokeWidth={2.5} />
                        </button>
                        
                        <div className="premium-date-text">
                            {selectedDate} 주간보고
                        </div>
                        
                        <button onClick={handleNextWeek} className="premium-nav-btn" title="다음 주">
                            <ChevronRight size={18} strokeWidth={2.5} />
                        </button>
                    </div>

                    {showMasterSyncToast && (
                        <div className="flex items-center gap-2 px-3 py-1 rounded-lg border text-xs font-bold animate-in fade-in duration-300"
                            style={{ backgroundColor: '#1c1500', borderColor: '#f59e0b', color: '#f59e0b' }}>
                            <CheckCircle2 size={14} color="#f59e0b" />
                            마스터 정보 업데이트됨
                        </div>
                    )}

                </div>
                <div className="flex items-center gap-3">
                    {autoSaveStatus && (
                        <div className={`text-[10px] font-bold px-2 py-1 rounded-md transition-all animate-pulse ${
                            autoSaveStatus === 'Saving...' ? 'text-blue-400 bg-blue-500/10' : 
                            autoSaveStatus === 'Saved' ? 'text-emerald-400 bg-emerald-500/10' : 
                            'text-red-400 bg-red-500/10'
                        }`}>
                            {autoSaveStatus === 'Saving...' ? '⚡ 자동 저장 중...' : 
                             autoSaveStatus === 'Saved' ? '✅ 저장됨' : '❌ 저장 실패'}
                        </div>
                    )}
                    <div className="w-px h-5 bg-[var(--border)] mx-1"></div>
                    <div className="flex items-center gap-4 px-2 scale-90 origin-right transition-all">
                        {['진행중', '홀딩', '종료'].map(cat => {
                            const isActive = selectedCategories.includes(cat);
                            
                            // Signature Premium Colors
                            const getCatColor = (c) => {
                                switch(c) {
                                    case '진행중': return '#10b981'; // Emerald
                                    case '홀딩': return '#f59e0b';   // Amber
                                    case '종료': return '#f43f5e';   // Rose
                                    default: return 'var(--text-primary)';
                                }
                            };

                            return (
                                <button
                                    key={cat}
                                    onClick={() => {
                                        setSelectedCategories(prev => 
                                            prev.includes(cat) 
                                                ? prev.filter(c => c !== cat) 
                                                : [...prev, cat]
                                        );
                                    }}
                                    className={`relative px-2 py-1 text-[11px] tracking-widest transition-all duration-300 group ${isActive ? 'font-black' : 'font-medium opacity-50'}`}
                                    style={{
                                        color: isActive ? getCatColor(cat) : (theme === 'dark' ? '#ffffff' : '#000000'),
                                        background: 'transparent',
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        outline: 'none',
                                        boxShadow: 'none'
                                    }}
                                >
                                    {cat}
                                </button>
                            );
                        })}
                    </div>
                    <div className="search-container-premium min-w-[200px]">
                        <div className="sunken-input-wrapper w-full">
                            <input 
                                type="text" 
                                value={searchTerm} 
                                onChange={(e) => setSearchTerm(e.target.value)} 
                                placeholder="Sheet Logistics Search..." 
                                spellCheck={false} 
                                className="sunken-input pl-10 text-[12px] font-bold" 
                            />
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
                            <div className="sunken-input-active-bar" />
                            {searchTerm && (
                                <button 
                                    onClick={() => setSearchTerm('')} 
                                    className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-100 text-muted-foreground"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex-1 overflow-auto bg-[var(--bg-primary)] report-spreadsheet-container relative">
                {isLoading && (
                    <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px] z-[1000] flex items-center justify-center pointer-events-none">
                        <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
                    </div>
                )}
                <div key={selectedDate} className="report-transition-wrapper">
                    <table className="table-fixed shadow-sm" style={{ width: totalWidth, minWidth: '100%' }}>
                        <colgroup>
                            <col style={{ width: 40 }} />
                            {columns.map(col => (
                                <col key={col.key} style={{ width: getSafeWidth(col.key) }} />
                            ))}
                        </colgroup>
                        <thead className="z-40">
                            <tr className="bg-[var(--surface-highest)]">
                                <th className="w-10 h-7 border-none bg-[var(--surface-highest)] flex items-center justify-center text-[9px] font-bold text-[var(--text-muted)] select-none">#</th>
                                {columnLetters.map((le, idx) => (
                                    <th key={idx} className="border-none text-[9px] font-bold text-[var(--text-muted)] text-center h-7 relative p-0 select-none" style={{ width: getSafeWidth(columns[idx]?.key) }}>
                                        {le}
                                        <ColumnResizeHandle column={columns[idx]?.key} onMouseDown={handleColumnMouseDown} />
                                    </th>
                                ))}
                            </tr>
                            <tr className="bg-[var(--surface-highest)]">
                                <th className="w-10 border-none bg-[var(--surface-highest)] select-none relative" style={{ height: rowHeights.header || 36 }}>
                                    <RowResizeHandle rowId="header" onMouseDown={handleRowMouseDown} />
                                </th>
                                {columns.map((col, idx) => (
                                    <th key={idx} className={`border-none p-0 text-[11px] font-extrabold uppercase tracking-[0.1em] text-[var(--text-primary)] text-center relative truncate select-none ${col.key === 'plan' ? 'bg-blue-500/5' : ''}`} style={{ width: getSafeWidth(col.key), height: rowHeights.header || 36, fontFamily: 'Manrope, sans-serif' }}>
                                        {col.key === 'manage' ? (
                                            <span className="p-1.5 inline-block">{col.label}</span>
                                        ) : (
                                            <SpreadsheetCellInput 
                                                initialValue={col.label}
                                                onCommit={(v) => handleHeaderChange(col.key, v)}
                                                onFocus={() => setFocusedCell({ rowId: 'header', field: col.key })}
                                                isFocused={focusedCell?.rowId === 'header' && focusedCell?.field === col.key}
                                                className="text-center font-bold uppercase !px-1 text-[var(--text-primary)]"
                                                align="center"
                                            />
                                        )}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.length > 0 ? (
                                filteredData.map((item, rowIndex) => (
                                    <ReportDataRow 
                                        key={item.id} 
                                        item={item} 
                                        rowIndex={rowIndex} 
                                        columns={columns} 
                                        columnWidths={columnWidths} 
                                        rowHeight={item.rowHeight || 80} 
                                        focusedCell={focusedCell} 
                                        setFocusedCell={setFocusedCell} 
                                        onCellChange={handleCellChange} 
                                        onProjectSelect={handleProjectSelect} 
                                        onOpenLibrary={handleOpenMasterLibrary} 
                                        onDelete={deleteRow} 
                                        onRowResize={handleRowMouseDown} 
                                        theme={theme} 
                                        lastWeekProjects={lastWeekProjects} 
                                        masterProjects={masterProjects} 
                                        pmList={pmList}
                                        pdList={pdList}
                                    />
                                ))
                            ) : isLoading ? (
                                <tr>
                                    <td colSpan={columns.length + 1} className="py-[100px]"></td>
                                </tr>
                            ) : (
                                <tr>
                                    <td colSpan={columns.length + 1} className="py-24 text-center bg-[var(--bg-secondary)] relative overflow-hidden">
                                        {/* Abstract background glow */}
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500/5 blur-[100px] rounded-full pointer-events-none" />
                                        
                                        <div className="flex flex-col items-center gap-6 relative z-10">
                                            <div className="relative group/icon">
                                                <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full opacity-0 group-hover/icon:opacity-100 transition-opacity duration-700" />
                                                <Layers size={56} strokeWidth={1} className="text-blue-500/40 relative animate-pulse duration-[3000ms]" />
                                            </div>
                                            
                                            <div className="flex flex-col gap-2 max-w-sm mx-auto">
                                                <h3 className="text-lg font-black text-[var(--text-primary)] tracking-tight">이번 주 주간보고 시트가 비어 있습니다</h3>
                                                <p className="text-xs text-[var(--text-muted)] leading-relaxed px-4">
                                                    프로젝트 마스터에서 행을 가져오거나,<br/>
                                                    첫 번째 프로젝트를 직접 추가하여 작성을 시작하세요.
                                                </p>
                                            </div>
                                            
                                            <button 
                                                onClick={addNewRow} 
                                                className="premium-empty-action-btn mt-2 active:scale-95 group"
                                            >
                                                <PlusCircle size={18} className="group-hover:rotate-90 transition-transform duration-300" />
                                                첫 번째 프로젝트 추가하기
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <ColumnSettingsModal 
                isOpen={isSettingsModalOpen} 
                onClose={() => setIsSettingsModalOpen(false)} 
                columns={columns} 
                onUpdateColumns={handleUpdateColumns} 
                onSyncAllWidths={handleSyncAllWidths}
                isSyncing={isSyncingAllWidths}
                onResetLayout={handleResetLayout}
            />

            {/* Custom confirmation for layout reset to avoid blocking browser dialogs */}
            {isResetConfirmOpen && createPortal(
                <div className="fixed inset-0 z-[100001] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsResetConfirmOpen(false)} />
                    <div className="relative bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl shadow-2xl p-6 max-w-sm w-full animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-4 text-emerald-500">
                            <RotateCcw size={24} />
                            <h3 className="text-lg font-bold">레이아웃 초기화</h3>
                        </div>
                        <p className="text-sm text-[var(--text-muted)] mb-6 leading-relaxed">
                            모든 셀의 너비와 높이를 기본값으로 되돌리시겠습니까?<br/>
                            <span className="text-[10px] opacity-70 mt-1 block">* 확인 후 자동 저장되어 즉시 반영됩니다.</span>
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setIsResetConfirmOpen(false)} className="px-4 py-2 rounded-lg text-sm font-bold hover:bg-[var(--bg-tertiary)] transition-colors">취소</button>
                            <button onClick={handleResetLayout} className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all">확인</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            
            <MasterProjectModal 
                isOpen={isMasterModalOpen}
                onClose={() => setIsMasterModalOpen(false)}
                projects={masterProjects}
                onSelect={(projectObj) => {
                    if (activeMasterRowId) {
                        handleProjectSelect(activeMasterRowId, projectObj, false);
                    }
                    setIsMasterModalOpen(false);
                }}
                theme={theme}
            />
        </div>
    );
};

export default ProjectReport;
