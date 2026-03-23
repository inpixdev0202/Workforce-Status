import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Table, TrendingUp, Search, Plus, Save, Trash2, CheckCircle2, ChevronsLeftRight, FileText, Download, Filter, Maximize2, Sun, Moon, Settings, X, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Calendar, ClipboardCopy, Lock, AlignLeft, Columns, ChevronRightSquare, LayoutList, BookOpen } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { projectsAPI, projectReportsAPI } from '../api';

const SpreadsheetCellInput = React.memo(({ initialValue, onCommit, onFocus, isFocused, className = "", isMultilineField = false }) => {
    const [localValue, setLocalValue] = useState(initialValue || '');
    const textAreaRef = useRef(null);
    const selectionRef = useRef({ start: 0, end: 0 });

    useEffect(() => {
        if (!isFocused) {
            setLocalValue(initialValue || '');
        }
    }, [initialValue, isFocused]);

    useEffect(() => {
        if (isFocused && textAreaRef.current) {
            textAreaRef.current.focus();
        }
    }, [isFocused]);

    useEffect(() => {
        if (isFocused && textAreaRef.current) {
            const { start, end } = selectionRef.current;
            textAreaRef.current.setSelectionRange(start, end);
        }
    });

    const handleChange = (e) => {
        const { value, selectionStart, selectionEnd } = e.target;
        selectionRef.current = { start: selectionStart, end: selectionEnd };
        setLocalValue(value);
    };

    const handleBlur = () => {
        if (localValue !== initialValue) {
            onCommit(localValue);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            if (e.altKey) {
                e.preventDefault();
                const { selectionStart, selectionEnd } = e.target;
                const newValue = localValue.substring(0, selectionStart) + "\n" + localValue.substring(selectionEnd);
                setLocalValue(newValue);
                selectionRef.current = { start: selectionStart + 1, end: selectionStart + 1 };
            } else {
                textAreaRef.current.blur();
            }
        }
    };

    return (
        <textarea 
            ref={textAreaRef}
            value={localValue}
            onChange={handleChange}
            onFocus={onFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            className={`absolute inset-0 w-full h-full px-2 py-1 transition-none leading-snug overflow-hidden block m-0 pointer-events-auto z-10 ${isFocused ? 'focused-field overflow-y-auto' : 'bg-transparent text-inherit'} ${className}`}
            rows={1}
            style={{ 
                resize: 'none',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all'
            }}
        />
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

const SpreadsheetCellSelect = React.memo(({ value, options, onCommit, onFocus, onBlur, isFocused, className = "" }) => {
    return (
        <select
            value={value || ''}
            onChange={(e) => onCommit(e.target.value)}
            onFocus={onFocus}
            onBlur={onBlur}
            className={`grid-input ${isFocused ? 'focused-field' : ''} ${className}`}
            style={{ 
                appearance: 'none',
                WebkitAppearance: 'none',
                background: 'transparent',
                textAlign: 'center',
                textAlignLast: 'center'
            }}
        >
            <option value="" disabled hidden>-</option>
            {options.map(opt => (
                <option key={opt} value={opt} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>{opt}</option>
            ))}
        </select>
    );
});

const getCategoryStyle = (category, isDark) => {
    const normalize = (val) => {
        const str = String(val || '').normalize('NFC').trim();
        if (str === '수행') return '진행중';
        if (['수주', '드롭', '탈락'].includes(str)) return '종료';
        return str || '진행중';
    };
    
    const cat = normalize(category);
    
    if (!isDark) {
        switch (cat) {
            case '진행중': return { bg: '#e6fffa', text: '#059669' }; 
            case '홀딩': return { bg: '#fffaf0', text: '#d97706' };   
            case '종료': return { bg: '#f1f5f9', text: '#475569' };   
            default: return { bg: 'transparent', text: 'inherit' };
        }
    }

    switch (cat) {
        case '진행중':
            return {
                bg: 'rgba(0, 255, 127, 0.12)',
                text: '#00ff7f',
                shadow: '0 0 8px rgba(0, 255, 127, 0.5)'
            };
        case '홀딩':
            return {
                bg: 'rgba(255, 215, 0, 0.12)',
                text: '#ffd700',
                shadow: '0 0 8px rgba(255, 215, 0, 0.5)'
            };
        case '종료':
            return {
                bg: 'rgba(148, 163, 184, 0.12)',
                text: '#94a3b8',
                shadow: 'none'
            };
        default:
            return { bg: 'transparent', text: 'inherit', shadow: 'none' };
    }
};

const getHealthStyle = (health, isDark) => {
    const normalize = (val) => String(val || '').trim();
    const h = normalize(health);
    
    if (!isDark) {
        if (h.includes('🟢')) return { bg: 'transparent', text: '#059669' };
        if (h.includes('🟡')) return { bg: 'transparent', text: '#d97706' };
        if (h.includes('🔴')) return { bg: 'transparent', text: '#dc2626' };
        return { bg: 'transparent', text: 'inherit' };
    }

    if (h.includes('🟢')) return { bg: 'transparent', text: '#10b981', shadow: '0 0 10px rgba(16, 185, 129, 0.5)' };
    if (h.includes('🟡')) return { bg: 'transparent', text: '#f59e0b', shadow: '0 0 10px rgba(245, 158, 11, 0.5)' };
    if (h.includes('🔴')) return { bg: 'transparent', text: '#ef4444', shadow: '0 0 10px rgba(239, 68, 68, 0.5)' };
    return { bg: 'transparent', text: 'inherit', shadow: 'none' };
};

const HealthSelect = React.memo(({ value, onCommit, onFocus, onBlur, isFocused, theme }) => {
    const options = ['🟢 정상', '🟡 주의', '🔴 위험'];
    const hStyle = getHealthStyle(value, theme === 'dark');

    return (
        <select
            value={value || ''}
            onChange={(e) => onCommit(e.target.value)}
            onFocus={onFocus}
            onBlur={onBlur}
            className={`w-full h-full cursor-pointer transition-all font-bold text-[11px] ${isFocused ? 'focused-field' : ''}`}
            style={{ 
                appearance: 'none',
                WebkitAppearance: 'none',
                backgroundColor: 'transparent',
                background: 'transparent',
                border: 'none',
                boxShadow: 'none',
                outline: 'none',
                color: hStyle.text,
                textShadow: theme === 'dark' ? hStyle.shadow : 'none',
                padding: '0 4px',
                textAlign: 'center',
                textAlignLast: 'center'
            }}
        >
            <option value="" disabled hidden>-</option>
            {options.map(opt => (
                <option key={opt} value={opt} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                    {opt}
                </option>
            ))}
        </select>
    );
});


const MasterProjectModal = ({ isOpen, onClose, projects, onSelect, theme }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const modalRef = useRef(null);

    const filteredProjects = useMemo(() => {
        const cleaned = projects.map(p => ({
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
                                onClick={() => onSelect(p.displayName)}
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
                                <div data-icon style={{
                                    padding: '5px', borderRadius: '7px',
                                    background: 'rgba(16,185,129,0.08)', color: '#10b981',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0, transition: 'background 0.12s ease',
                                }}>
                                    <ChevronRight size={13} />
                                </div>
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

const ProjectAutocomplete = ({ value, onOpenLibrary, theme }) => {
    return (
        <div 
            className={`relative w-full h-full group flex items-center overflow-hidden cursor-pointer transition-colors ${theme === 'light' ? 'hover:bg-emerald-50' : 'hover:bg-emerald-500/10'}`}
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onOpenLibrary();
            }}
            title="클릭하여 마스터 라이브러리 열기"
        >
            <input
                type="text"
                value={value || ''}
                readOnly
                placeholder="마스터에서 선택..."
                className={`flex-1 h-full px-3 py-1 bg-transparent border-none outline-none text-[12px] font-bold placeholder:text-muted-foreground/40 cursor-pointer pointer-events-none ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}
                spellCheck={false}
            />
            
            <div
                className="flex flex-shrink-0 items-center justify-center w-6 h-6 mr-1 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: '#10b981' }}
            >
                <BookOpen size={15} />
            </div>
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
    masterProjects
}) => {
    const catStyle = useMemo(() => getCategoryStyle(item.category, theme === 'dark'), [item.category, theme]);

    return (
        <tr className="group hover:bg-white/[0.01]">
            <td 
                className="w-10 bg-[var(--bg-tertiary)] border border-[var(--border)] p-0 text-[9px] font-bold text-[var(--text-muted)] text-center select-none sticky left-0 z-20 relative"
                style={{ height: rowHeight }}
            >
                {rowIndex + 1}
                <RowResizeHandle rowId={item.id} onMouseDown={onRowResize} />
            </td>
            
            {columns.map((col) => {
                const cellId = `${item.id}-${col.key}`;
                if (col.key === 'manage') {
                    return (
                        <td key={col.key} className="border border-[var(--border)] p-0 text-center w-[60px] relative" style={{ height: rowHeight }}>
                            <button 
                                onClick={() => onDelete(item.id)}
                                className="trash-delete-btn relative z-10 w-full h-full flex items-center justify-center cursor-pointer"
                                title="행삭제"
                                style={{ border: 'none', background: 'none', padding: 0 }}
                            >
                                <Trash2 size={16} className="trash-delete-icon" />
                            </button>
                        </td>
                    );
                }

                if (col.key === 'projectName') {
                    return (
                        <td key={col.key} className="border border-[var(--border)] p-0 relative" style={{ width: columnWidths[col.key], height: rowHeight }}>
                            <ProjectAutocomplete 
                                value={item[col.key]}
                                onSelect={(p, isFull) => onProjectSelect(item.id, p, isFull)}
                                onFocus={() => setFocusedCell({ rowId: item.id, field: cellId })}
                                isFocused={focusedCell?.field === cellId}
                                lastWeekProjects={lastWeekProjects}
                                onOpenLibrary={() => onOpenLibrary(item.id)}
                                theme={theme}
                            />
                        </td>
                    );
                }

                if (col.key === 'category') {
                    const categoryOptions = ['진행중', '홀딩', '종료'];
                    const normalize = (val) => {
                        const str = String(val || '').normalize('NFC').trim();
                        if (str === '수행') return '진행중';
                        if (['수주', '드롭', '탈락'].includes(str)) return '종료';
                        return str || '진행중';
                    };
                    const displayValue = normalize(item[col.key]);
                    return (
                        <td key={col.key} className="border border-[var(--border)] p-0 relative transition-colors duration-200" style={{ width: columnWidths[col.key], height: rowHeight, backgroundColor: catStyle.bg }}>
                            <SpreadsheetCellSelect
                                value={displayValue}
                                options={categoryOptions}
                                onCommit={(v) => onCellChange(item.id, col.key, v)}
                                onFocus={() => setFocusedCell({ rowId: item.id, field: cellId })}
                                onBlur={() => setFocusedCell(null)}
                                isFocused={focusedCell?.field === cellId}
                                className="font-bold text-center text-[11px]"
                                style={{ color: catStyle.text, textShadow: theme === 'dark' ? catStyle.shadow : 'none' }}
                            />
                        </td>
                    );
                }

                const isHealthCol = col.key === 'health' || ['운영 상태', '운영상태', 'Health', 'Status'].includes(col.label);
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
                            />
                        </td>
                    );
                }

                return (
                    <td key={col.key} className="border border-[var(--border)] p-0 relative" style={{ width: columnWidths[col.key], height: rowHeight }}>
                        <SpreadsheetCellInput 
                            initialValue={item[col.key]}
                            onCommit={(v) => onCellChange(item.id, col.key, v)}
                            onFocus={() => setFocusedCell({ rowId: item.id, field: cellId })}
                            isFocused={focusedCell?.field === cellId}
                            className={col.key === 'status' ? 'text-[var(--text-muted)] text-[10px]' : 'text-[var(--text-muted)] text-[11px]'}
                        />
                    </td>
                );
            })}
        </tr>
    );
});

const ColumnSettingsModal = ({ isOpen, onClose, columns, onUpdateColumns }) => {
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
                </div>

                <div style={{ padding: '20px 24px', borderTop: '1px solid rgba(255,255,255,0.08)', backgroundColor: 'rgba(22, 27, 34, 0.95)', display: 'flex', gap: '12px' }}>
                    <button 
                        onClick={onClose} 
                        style={{ flex: 1, padding: '12px', backgroundColor: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', color: '#666', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer' }}
                        className="hover:bg-white/[0.05] hover:text-white transition-all"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave} 
                        style={{ flex: 1.5, padding: '12px', backgroundColor: '#2563eb', border: 'none', borderRadius: '14px', color: '#fff', fontSize: '13px', fontWeight: '900', cursor: 'pointer' }}
                        className="hover:bg-blue-500 shadow-[0_5px_20px_rgba(37,99,235,0.2)] hover:shadow-[0_8px_30px_rgba(37,99,235,0.4)] active:scale-[0.98] transition-all"
                    >
                        Apply Config
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
    const [selectedDate, setSelectedDate] = useState(() => getReportingFriday());
    const [reportData, setReportData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [lastWeekProjects, setLastWeekProjects] = useState([]);
    const [masterProjects, setMasterProjects] = useState([]);
    
    const COLUMN_WIDTHS_KEY = 'project_report_column_widths_v1';
    const ROW_HEIGHTS_KEY = 'project_report_row_heights_v1';
    const COLUMNS_CONFIG_KEY = 'project_report_columns_config_v1';

    // Fetch data from server
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const resCurrent = await projectReportsAPI.getByDate(selectedDate);
                const loaded = resCurrent.data;
                
                let currentRows = [];
                let currentLayout = null;
                
                // Handle both Legacy Array format and New Object format
                if (Array.isArray(loaded)) {
                    currentRows = loaded;
                } else if (loaded && loaded.rows) {
                    currentRows = loaded.rows;
                    currentLayout = { 
                        columnWidths: loaded.columnWidths, 
                        rowHeights: loaded.rowHeights 
                    };
                }

                const isPlaceholderOnly = currentRows && currentRows.length > 0 && 
                    currentRows.every(row => !row.projectName || row.projectName.toLowerCase().includes('shared project') || row.projectName.toLowerCase().includes('test project'));

                if (currentRows && currentRows.length > 0 && !isPlaceholderOnly) {
                    // IF current week has data, STILL check immediate previous week for missing projects
                    const prevDateStr = offsetDate(selectedDate, -7);
                    const resPrevImm = await projectReportsAPI.getByDate(prevDateStr);
                    const prevLoaded = resPrevImm.data;
                    const prevRows = Array.isArray(prevLoaded) ? prevLoaded : (prevLoaded?.rows || []);
                    const prevLayout = (!Array.isArray(prevLoaded) && prevLoaded?.columnWidths) ? prevLoaded : null;

                    if (prevRows.length > 0) {
                        const merged = mergeReportData(currentRows, prevRows);
                        if (JSON.stringify(merged) !== JSON.stringify(currentRows)) {
                            console.log('🔄 Aggressive Smart Merge: Added missing ongoing projects from previous week.');
                            setReportData(merged);
                        } else {
                            setReportData(currentRows);
                        }
                    } else {
                        setReportData(currentRows);
                    }
                    
                    // Also sync layout
                    if (currentLayout) {
                        // Use current week's layout if it exists
                        if (currentLayout.columnWidths) setColumnWidths(currentLayout.columnWidths);
                        if (currentLayout.rowHeights) setRowHeights(currentLayout.rowHeights);
                    } else if (prevLayout) {
                        // INHERIT layout from previous week if current week has NO layout metadata
                        if (prevLayout.columnWidths) setColumnWidths(prevLayout.columnWidths);
                        if (prevLayout.rowHeights) setRowHeights(prevLayout.rowHeights);
                    }
                } else {
                    let foundRows = [];
                    let foundLayout = null;

                    for (let i = 1; i <= 8; i++) {
                        const checkDateStr = offsetDate(selectedDate, -7 * i);
                        const resPrev = await projectReportsAPI.getByDate(checkDateStr);
                        const prevLoaded = resPrev.data;
                        const prevRows = Array.isArray(prevLoaded) ? prevLoaded : (prevLoaded?.rows || []);

                        if (prevRows.length > 0) {
                            foundRows = prevRows;
                            if (!Array.isArray(prevLoaded)) {
                                foundLayout = { 
                                    columnWidths: prevLoaded.columnWidths, 
                                    headerHeight: prevLoaded.rowHeights?.header 
                                };
                            }
                            break;
                        }
                    }

                    if (foundRows.length > 0) {
                        setReportData(mergeReportData(currentRows || [], foundRows));
                        // Propagate column widths from the source week
                        if (foundLayout && foundLayout.columnWidths) {
                            setColumnWidths(foundLayout.columnWidths);
                        }
                    } else {
                        setReportData(currentRows || []);
                    }
                }
                
                dataLoaded.current = true;

                // Sync last week projects for autocomplete suggestions
                const d = new Date(selectedDate);
                d.setDate(d.getDate() - 7);
                const prevDate = getReportingFriday(d);
                const resPrevForSync = await projectReportsAPI.getByDate(prevDate);
                setLastWeekProjects(resPrevForSync.data);

                // Fetch master projects
                const resMaster = await projectsAPI.getAll();
                setMasterProjects(resMaster.data);
            } catch (error) {
                console.error('Failed to fetch data:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [selectedDate]);

    // AUTO-SAVE LOGIC: Debounce manual changes
    useEffect(() => {
        // Prevent auto-save on initial load or if no data yet
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        
        // If data hasn't finished loading first time, don't try to "save back" an empty state
        if (!dataLoaded.current || reportData.length === 0) return;

        setAutoSaveStatus('Saving...');
        setIsAutoSaving(true);

        const timer = setTimeout(async () => {
            try {
                await projectReportsAPI.save({
                    week_date: selectedDate,
                    data: reportData
                });
                setAutoSaveStatus('Saved');
                setTimeout(() => setAutoSaveStatus(''), 2000);
            } catch (error) {
                console.error('Auto-save failed:', error);
                setAutoSaveStatus('Error');
            } finally {
                setIsAutoSaving(false);
            }
        }, 2000); // 2 second debounce

        return () => clearTimeout(timer);
    }, [reportData, selectedDate]);

    const handleSave = async (silent = false) => {
        try {
            await projectReportsAPI.save({
                week_date: selectedDate,
                data: {
                    rows: reportData,
                    columnWidths: columnWidths,
                    rowHeights: { header: rowHeights.header }
                }
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
        if (reportData.length > 0) await handleSave(true);
        setSelectedDate(offsetDate(selectedDate, -7));
    };

    const handleNextWeek = async () => {
        if (reportData.length > 0) await handleSave(true);
        setSelectedDate(offsetDate(selectedDate, 7));
    };

    const handleClonePrevious = async () => {
        const prevDateStr = offsetDate(selectedDate, -7);
        
        try {
            const resPrev = await projectReportsAPI.getByDate(prevDateStr);
            const prevDataRaw = resPrev.data;
            
            // Handle both Legacy Array and New Object formats
            const prevRows = Array.isArray(prevDataRaw) ? prevDataRaw : (prevDataRaw?.rows || []);
            const prevColWidths = (!Array.isArray(prevDataRaw) && prevDataRaw?.columnWidths) ? prevDataRaw.columnWidths : null;

            const legacyData = localStorage.getItem('project_report_data_v1');

            if (prevRows.length > 0) {
                const merged = mergeReportData(reportData, prevRows);
                setReportData(merged);
                
                // Also migrate column widths if available
                if (prevColWidths) {
                    setColumnWidths(prevColWidths);
                }
                
                alert('지난주 데이터를 스마트 병합했습니다. 프로젝트 정보와 셀 크기가 업데이트되고, 이번 주에 새로 추가한 내용은 유지됩니다.');
            } else if (legacyData) {
                if (confirm('서버에 지난주 데이터가 없습니다. 개인 PC에 저장된 기존 통합 데이터를 서버로 가져오시겠습니까?')) {
                    try {
                        const parsed = JSON.parse(legacyData);
                        setReportData(parsed.map(row => ({ ...row, id: Date.now() + Math.random() })));
                        alert('기존 데이터를 로드했습니다. [저장]을 누르면 서버에 저장되어 모든 PM이 볼 수 있습니다.');
                    } catch (e) { console.error(e); alert('데이터 처리에 실패했습니다.'); }
                }
            } else {
                alert('가져올 수 있는 이전 데이터가 서버나 로컬에 존재하지 않습니다.');
            }
        } catch (error) {
            console.error('Clone failed:', error);
            alert('데이터를 가져오는 중 오류가 발생했습니다.');
        }
    };

    const [columns, setColumns] = useState(() => {
        const saved = localStorage.getItem(COLUMNS_CONFIG_KEY);
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { console.error(e); }
        }
        return [
            { key: 'category', label: '구분', width: 80 },
            { key: 'projectName', label: '프로젝트명', width: 320 },
            { key: 'health', label: '운영 상태', width: 100 },
            { key: 'pd', label: '보고자/담당', width: 150 },
            { key: 'mainContractor', label: '주사업자', width: 150 },
            { key: 'estimatedAmount', label: '금액(예상)', width: 120 },
            { key: 'progress', label: '진행상황', width: 180 },
            { key: 'kickoff', label: '기간/일정', width: 120 },
            { key: 'rfpInfo', label: '특이사항', width: 120 },
            { key: 'proposal', label: '비고1', width: 120 },
            { key: 'pt', label: '비고2', width: 100 },
            { key: 'status', label: '상세 보고 내용', width: 500 },
            { key: 'plan', label: '투입계획', width: 150 },
            { key: 'clientInfo', label: '고객 정보', width: 200 },
            { key: 'manage', label: '관리', width: 60 }
        ];
    });

    useEffect(() => {
        localStorage.setItem(COLUMNS_CONFIG_KEY, JSON.stringify(columns));
    }, [columns]);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategories, setSelectedCategories] = useState(['진행중', '홀딩', '종료']);
    const [showSaveToast, setShowSaveToast] = useState(false);
    const [focusedCell, setFocusedCell] = useState(null);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isMasterModalOpen, setIsMasterModalOpen] = useState(false);
    const [activeMasterRowId, setActiveMasterRowId] = useState(null);
    const [isAutoSaving, setIsAutoSaving] = useState(false);
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

    const columnLetters = useMemo(() => 
        Array.from({ length: columns.length }, (_, i) => String.fromCharCode(65 + i))
    , [columns]);

    const [columnWidths, setColumnWidths] = useState(() => {
        const saved = localStorage.getItem(COLUMN_WIDTHS_KEY);
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { console.error(e); }
        }
        return columns.reduce((acc, col) => ({ ...acc, [col.key]: col.width }), {});
    });

    const THEME_KEY = 'project_report_theme';
    const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'dark');

    useEffect(() => {
        localStorage.setItem(THEME_KEY, theme);
    }, [theme]);

    const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

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

    const handleColumnMouseDown = useCallback((e, column) => {
        e.stopPropagation();
        resizingRef.current = { isResizing: true, type: 'col', id: column, startPos: e.clientX, startSize: columnWidths[column] };
        document.body.style.cursor = 'col-resize';
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [columnWidths]);

    const handleRowMouseDown = useCallback((e, rowId) => {
        e.stopPropagation();
        resizingRef.current = { isResizing: true, type: 'row', id: rowId, startPos: e.clientY, startSize: rowHeights[rowId] || 80 };
        document.body.style.cursor = 'row-resize';
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [rowHeights]);

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
    }, []);

    const handleMouseUp = useCallback(() => {
        resizingRef.current.isResizing = false;
        document.body.style.cursor = 'default';
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }, [handleMouseMove]);

    const handleCellChange = useCallback((id, field, value) => {
        setReportData(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
    }, []);

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
                    return { ...item, projectName: typeof projectData === 'string' ? projectData : projectData.projectName };
                }
            }
            return item;
        }));
    }, []);

    const handleOpenMasterLibrary = useCallback((id) => {
        setActiveMasterRowId(id);
        setIsMasterModalOpen(true);
    }, []);

    const handleHeaderChange = useCallback((key, newLabel) => {
        setColumns(prev => prev.map(col => col.key === key ? { ...col, label: newLabel } : col));
    }, []);

    const addNewRow = () => {
        const newRow = { id: Date.now(), category: '진행중', projectName: '', pd: '', mainContractor: '-', estimatedAmount: '-', progress: '-', kickoff: '-', rfpInfo: '-', proposal: '-', pt: '-', status: '', plan: '', clientInfo: '-', rowHeight: 80 };
        setReportData([newRow, ...reportData]);
    };

    const deleteRow = useCallback((id) => {
        if (window.confirm('이 행을 삭제하시겠습니까?')) {
            setReportData(prev => prev.filter(item => item.id !== id));
        }
    }, []);


    const filteredData = useMemo(() => {
        const orderArr = ['진행중', '홀딩', '종료'];
        
        const normalize = (val) => {
            const str = String(val || '').normalize('NFC').trim();
            if (str === '수행') return '진행중';
            if (['수주', '드롭', '탈락'].includes(str)) return '종료';
            return str || '진행중';
        };

        return reportData
            .filter(item => {
                const cat = normalize(item.category);
                const matchesCategory = selectedCategories.includes(cat);
                const matchesSearch = (item.projectName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                      (item.pd || '').toLowerCase().includes(searchTerm.toLowerCase());
                return matchesCategory && matchesSearch;
            })
            .sort((a, b) => {
                const weights = { '진행중': 1, '홀딩': 2, '종료': 3 };
                
                const catA = normalize(a.category);
                const catB = normalize(b.category);
                
                const weightA = weights[catA] || 99;
                const weightB = weights[catB] || 99;

                if (weightA !== weightB) return weightA - weightB;
                
                const idA = Number(a.id);
                const idB = Number(b.id);
                if (!isNaN(idA) && !isNaN(idB)) return idA - idB;
                return String(a.id).localeCompare(String(b.id));
            });
    }, [reportData, searchTerm, selectedCategories]);

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
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
                };
                if (rowNumber > 1) {
                    if (cell.address.indexOf('A') !== 0) {
                        cell.font = { size: 9 };
                        cell.alignment = { vertical: 'middle', wrapText: true };
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
                `}
            </style>
            {showSaveToast && (
                <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top duration-500">
                    <div 
                        className="px-6 py-3 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.8)] flex items-center gap-3 border"
                        style={{ 
                            backgroundColor: '#000000', 
                            borderColor: '#2563eb', 
                            color: '#ffffff',
                            opacity: 1,
                            zIndex: 9999
                        }}
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
                    
                    <div className="w-px h-5 bg-[var(--border)] mx-1"></div>
                    
                    <div className="flex items-center gap-1 bg-[var(--bg-tertiary)] rounded-lg px-2 py-0.5 border border-[var(--border)]">
                        <button onClick={handlePrevWeek} className="p-1 hover:text-blue-500 transition-colors" title="이전 주"><ChevronLeft size={14} /></button>
                        <div className="flex items-center gap-1.5 px-1 min-w-[120px] justify-center">
                            <Calendar size={13} className="text-muted-foreground" />
                            <span className="text-[11px] font-bold tracking-tight">{selectedDate} 주간보고</span>
                        </div>
                        <button onClick={handleNextWeek} className="p-1 hover:text-blue-500 transition-colors" title="다음 주"><ChevronRight size={14} /></button>
                    </div>

                    <button 
                        onClick={handleClonePrevious} 
                        className="premium-icon-btn btn-clone flex items-center gap-1.5 px-3" 
                        title="지난주 데이터 가져오기"
                    >
                        <ClipboardCopy size={16} />
                        <span className="text-[11px] font-bold">지난주 복사</span>
                    </button>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={toggleTheme} className="premium-icon-btn btn-theme" title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}>
                        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                    </button>
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
                    <button onClick={handleExportExcel} className="premium-icon-btn btn-excel" title="엑셀로 다운로드"><Download size={16} /></button>
                    <div className="w-px h-5 bg-[var(--border)] mx-1"></div>
                    <div className="flex items-center gap-1.5 p-1 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg mr-1 scale-95 origin-right">
                        {['진행중', '홀딩', '종료'].map(cat => {
                            const isActive = selectedCategories.includes(cat);
                            const style = getCategoryStyle(cat, theme === 'dark');
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
                                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all duration-200 border-none ${
                                        isActive 
                                            ? 'scale-100' 
                                            : 'opacity-40 grayscale scale-95 hover:opacity-100 hover:grayscale-0'
                                    }`}
                                    style={{
                                        backgroundColor: isActive ? style.bg : 'transparent',
                                        color: isActive ? style.text : 'var(--text-muted)',
                                        boxShadow: isActive && theme === 'dark' ? style.shadow : 'none',
                                        border: 'none',
                                        outline: 'none'
                                    }}
                                >
                                    {cat}
                                </button>
                            );
                        })}
                    </div>
                    <div className="search-input-wrapper">
                        <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="시트 내 검색..." spellCheck={false} className="premium-search-input" />
                        <Search size={14} className="search-icon-glass" />
                        {searchTerm && <button onClick={() => setSearchTerm('')} className="search-clear-btn" title="검색어 지우기"><X size={14} /></button>}
                    </div>
                </div>
            </div>
            <div className="flex-1 overflow-auto bg-[var(--bg-primary)] report-spreadsheet-container">
                <table className="table-fixed w-max">
                    <thead className="z-40">
                        <tr className="bg-[var(--bg-tertiary)]">
                            <th className="w-10 h-7 border border-[var(--border)] bg-[var(--bg-tertiary)] flex items-center justify-center text-[9px] font-bold text-[var(--text-muted)] select-none">#</th>
                            {columnLetters.map((le, idx) => (
                                <th key={idx} className="border border-[var(--border)] text-[9px] font-bold text-[var(--text-muted)] text-center h-7 relative p-0 select-none" style={{ width: columnWidths[columns[idx].key] }}>
                                    {le}
                                    <ColumnResizeHandle column={columns[idx].key} onMouseDown={handleColumnMouseDown} />
                                </th>
                            ))}
                        </tr>
                        <tr className="bg-[var(--bg-tertiary)]">
                            <th className="w-10 border border-[var(--border)] bg-[var(--bg-tertiary)] select-none relative" style={{ height: rowHeights.header || 36 }}>
                                <RowResizeHandle rowId="header" onMouseDown={handleRowMouseDown} />
                            </th>
                            {columns.map((col, idx) => (
                                <th key={idx} className={`border border-[var(--border)] p-0 text-[10px] font-bold uppercase tracking-tight text-[var(--text-primary)] text-center relative truncate select-none ${col.key === 'plan' ? 'bg-blue-500/5' : ''}`} style={{ width: columnWidths[col.key], height: rowHeights.header || 36 }}>
                                    {col.key === 'manage' ? (
                                        <span className="p-1.5 inline-block">{col.label}</span>
                                    ) : (
                                        <SpreadsheetCellInput 
                                            initialValue={col.label}
                                            onCommit={(v) => handleHeaderChange(col.key, v)}
                                            onFocus={() => setFocusedCell({ rowId: 'header', field: col.key })}
                                            isFocused={focusedCell?.rowId === 'header' && focusedCell?.field === col.key}
                                            className="text-center font-bold uppercase !px-1 text-[var(--text-primary)]"
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
                                />
                            ))
                        ) : (
                            <tr>
                                <td colSpan={columns.length + 1} className="py-20 text-center bg-[var(--bg-secondary)]">
                                    <div className="flex flex-col items-center gap-4 opacity-50">
                                        <FileText size={48} className="text-[var(--text-muted)]" />
                                        <div className="flex flex-col gap-1">
                                            <p className="text-sm font-bold text-[var(--text-primary)]">이번 주차 보고 데이터가 없습니다.</p>
                                            <p className="text-xs text-[var(--text-muted)]">내용을 입력하거나 상단의 '지난주 복사' 버튼을 눌러 데이터를 가져오세요.</p>
                                        </div>
                                        <button onClick={addNewRow} className="mt-2 px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full text-xs font-bold transition-all shadow-lg hover:shadow-blue-500/20 flex items-center gap-2">
                                            <Plus size={14} /> 첫 번째 행 추가하기
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <ColumnSettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} columns={columns} onUpdateColumns={handleUpdateColumns} />
            
            <MasterProjectModal 
                isOpen={isMasterModalOpen}
                onClose={() => setIsMasterModalOpen(false)}
                projects={masterProjects}
                onSelect={(name) => {
                    if (activeMasterRowId) {
                        handleProjectSelect(activeMasterRowId, name, false);
                    }
                    setIsMasterModalOpen(false);
                }}
                theme={theme}
            />
        </div>
    );
};

export default ProjectReport;
