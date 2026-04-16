import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Table, TrendingUp, Search, Plus, Save, Trash2, CheckCircle2, ChevronsLeftRight, FileText, Download, Filter, Maximize2, Sun, Moon, Settings, X, ChevronUp, ChevronDown, Lock, AlignLeft, Columns } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { salesAPI } from '../api';
import { useTheme } from '../context/ThemeContext';

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
            // Optional: Move cursor to end on initial focus if needed, 
            // but we usually want to maintain if already set.
            // For now, let's just restore from selectionRef.
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
                // Insert newline at cursor
                e.preventDefault();
                const { selectionStart, selectionEnd } = e.target;
                const newValue = localValue.substring(0, selectionStart) + "\n" + localValue.substring(selectionEnd);
                setLocalValue(newValue);
                // Update selection to be after the new newline
                selectionRef.current = { start: selectionStart + 1, end: selectionStart + 1 };
            } else {
                // Normal Enter blurs (commits)
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

const SpreadsheetCellSelect = React.memo(({ value, options, onCommit, onFocus, isFocused, className = "" }) => {
    return (
        <select
            value={value || ''}
            onChange={(e) => onCommit(e.target.value)}
            onFocus={onFocus}
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
        return str === '수행' ? '진행중' : (str || '진행중');
    };
    
    const cat = normalize(category);
    
    if (!isDark) {
        switch (cat) {
            case '진행예정': return { bg: '#ebf8ff', text: '#2563eb' };   // Light Blue
            case '진행중': return { bg: '#e6fffa', text: '#059669' }; // Light Emerald
            case '홀딩': return { bg: '#fffaf0', text: '#d97706' };   // Light Amber
            case '수주': return { bg: '#f0f9ff', text: '#0369a1' };   // Sky Blue
            case '드롭': return { bg: '#fff5f5', text: '#dc2626' };   // Light Red
            case '탈락': return { bg: '#f7fafc', text: '#4b5563' };   // Light Gray
            default: return { bg: 'transparent', text: 'inherit' };
        }
    }

    // Neon Styles for Dark Mode
    switch (cat) {
        case '진행예정':
            return {
                bg: 'rgba(59, 130, 246, 0.12)',
                text: '#3b82f6',
                shadow: '0 0 8px rgba(59, 130, 246, 0.5)'
            };
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
        case '수주':
            return {
                bg: 'rgba(0, 242, 255, 0.12)',
                text: '#00f2ff',
                shadow: '0 0 8px rgba(0, 242, 255, 0.8)'
            };
        case '드롭':
            return {
                bg: 'rgba(255, 49, 49, 0.12)',
                text: '#ff3131',
                shadow: '0 0 8px rgba(255, 49, 49, 0.6)'
            };
        case '탈락':
            return {
                bg: 'rgba(211, 211, 211, 0.1)',
                text: '#d3d3d3',
                shadow: 'none'
            };
        default:
            return { bg: 'transparent', text: 'inherit', shadow: 'none' };
    }
};

const SalesDataRow = React.memo(({ 
    item, 
    rowIndex, 
    columns, 
    columnWidths, 
    rowHeight, 
    focusedCell, 
    setFocusedCell,
    onCellChange,
    onDelete,
    onRowResize,
    theme
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
                if (col.key === 'manage') {
                    return (
                        <td key={col.key} className="border border-[var(--border)] p-0 text-center w-[60px] relative" style={{ height: rowHeight }}>
                            <button 
                                onClick={() => onDelete(item.id)}
                                className="trash-delete-btn relative z-10 w-full h-full flex items-center justify-center cursor-pointer"
                                title="행삭제"
                                style={{ border: 'none', background: 'none', padding: 0 }}
                            >
                                <Trash2 
                                    size={16} 
                                    className="trash-delete-icon"
                                />
                            </button>
                        </td>
                    );
                }

                if (col.key === 'category') {
                    const categoryOptions = ['진행예정', '진행중', '홀딩', '수주', '드롭', '탈락'];
                    const displayValue = item[col.key] === '수행' ? '진행중' : item[col.key];
                    return (
                        <td 
                            key={col.key} 
                            className="border border-[var(--border)] p-0 relative transition-colors duration-200" 
                            style={{ 
                                width: columnWidths[col.key], 
                                height: rowHeight,
                                backgroundColor: catStyle.bg
                            }}
                        >
                            <SpreadsheetCellSelect
                                value={displayValue}
                                options={categoryOptions}
                                onCommit={(v) => onCellChange(item.id, col.key, v)}
                                onFocus={() => setFocusedCell({ rowId: item.id, field: `${item.id}-${col.key}` })}
                                isFocused={focusedCell?.field === `${item.id}-${col.key}`}
                                className="font-bold text-center text-[11px]"
                                style={{ 
                                    color: catStyle.text,
                                    textShadow: theme === 'dark' ? catStyle.shadow : 'none'
                                }}
                            />
                        </td>
                    );
                }

                return (
                    <td key={col.key} className="border border-[var(--border)] p-0 relative" style={{ width: columnWidths[col.key], height: rowHeight }}>
                        <SpreadsheetCellInput 
                            initialValue={item[col.key]}
                            onCommit={(v) => onCellChange(item.id, col.key, v)}
                            onFocus={() => setFocusedCell({ rowId: item.id, field: `${item.id}-${col.key}` })}
                            isFocused={focusedCell?.field === `${item.id}-${col.key}`}
                            className={
                                col.key === 'projectName' ? 'font-bold text-[var(--text-primary)] text-[11px]' :
                                col.key === 'status' ? 'text-[var(--text-muted)] text-[10px]' :
                                'text-[var(--text-muted)] text-[11px]'
                            }
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

    return (
        <div className="fixed inset-0 z-[100000] flex justify-end" style={{ pointerEvents: 'auto' }}>
            {/* Backdrop Overlay */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-[4px] animate-in fade-in duration-300"
                onClick={onClose}
            />
            
            {/* Sliding Sidebar Container */}
            <div 
                className="relative w-[400px] h-full flex flex-col shadow-[-20px_0_60px_rgba(0,0,0,0.8)] border-l border-[#00f2ff]/30 animate-in slide-in-from-right duration-500 ease-out"
                style={{ backgroundColor: '#0d1117' }}
            >
                {/* Left Accent Glow Line */}
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '2px', background: 'linear-gradient(to bottom, transparent, #00f2ff, transparent)', opacity: 0.5 }} />

                {/* Sidebar Header */}
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

                {/* Content Area - Scrollable */}
                <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ padding: '24px' }}>
                    {/* Add Column Section */}
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

                    {/* Column List Section */}
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

                {/* Sidebar Footer - Sticky */}
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
        </div>
    );
};

const SalesStatus = () => {
    const STORAGE_KEY = 'sales_data_v3';
    const COLUMN_WIDTHS_KEY = 'sales_column_widths_v3';
    const ROW_HEIGHTS_KEY = 'sales_row_heights_v3';
    const COLUMNS_CONFIG_KEY = 'sales_columns_config_v3';
    
    const [salesData, setSalesData] = useState([]);
    const [columns, setColumns] = useState([]);
    const [columnWidths, setColumnWidths] = useState({});
    const [rowHeights, setRowHeights] = useState({});
    
    const [isLoading, setIsLoading] = useState(true);
    const [autoSaveStatus, setAutoSaveStatus] = useState('');
    const [isAutoSaving, setIsAutoSaving] = useState(false);
    
    const dataLoaded = useRef(false);
    const isInitialMount = useRef(true);

    const { theme, toggleTheme } = useTheme();

    const [searchTerm, setSearchTerm] = useState('');
    const [showSaveToast, setShowSaveToast] = useState(false);
    const [focusedCell, setFocusedCell] = useState(null);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

    // Initialization and Data Fetching
    useEffect(() => {
        const fetchInitialData = async () => {
            setIsLoading(true);
            try {
                const res = await salesAPI.get();
                if (res.data) {
                    // Server Data exists
                    setSalesData(res.data.rows || []);
                    setColumns(res.data.columns || []);
                    setColumnWidths(res.data.columnWidths || {});
                    setRowHeights(res.data.rowHeights || {});
                } else {
                    // Start Migration Logic: Check if local storage has anything
                    console.log("No data found on server, attempting migration from local storage...");
                    const localData = localStorage.getItem(STORAGE_KEY);
                    const localCols = localStorage.getItem(COLUMNS_CONFIG_KEY);
                    const localWidths = localStorage.getItem(COLUMN_WIDTHS_KEY);
                    const localHeights = localStorage.getItem(ROW_HEIGHTS_KEY);

                    if (localData || localCols) {
                        setSalesData(localData ? JSON.parse(localData) : []);
                        setColumns(localCols ? JSON.parse(localCols) : []);
                        setColumnWidths(localWidths ? JSON.parse(localWidths) : {});
                        setRowHeights(localHeights ? JSON.parse(localHeights) : {});
                    } else {
                        // Total fallback to Defaults if nothing exists anywhere
                        setSalesData([
                            { id: 1, category: '진행중', projectName: '2026.02 샘플 프로젝트', pd: '담당자명', mainContractor: '-', estimatedAmount: '예상액', progress: '-', kickoff: '-', rfpInfo: '-', proposal: '-', pt: '-', status: '내용 없음', plan: '', clientInfo: '-' }
                        ]);
                        setColumns([
                            { key: 'category', label: '구분', width: 80 },
                            { key: 'projectName', label: '프로젝트명', width: 320 },
                            { key: 'pd', label: 'PD명', width: 150 },
                            { key: 'mainContractor', label: '주사업자명', width: 150 },
                            { key: 'estimatedAmount', label: '예상금액', width: 120 },
                            { key: 'progress', label: '진행사항', width: 180 },
                            { key: 'kickoff', label: '킥오프/기간', width: 120 },
                            { key: 'rfpInfo', label: 'RFP설명회', width: 120 },
                            { key: 'proposal', label: '제안서', width: 120 },
                            { key: 'pt', label: 'PT', width: 100 },
                            { key: 'status', label: '현황 및 계획', width: 500 },
                            { key: 'plan', label: '예상인력투입계획', width: 150 },
                            { key: 'clientInfo', label: '고객사 정보', width: 200 },
                            { key: 'manage', label: '관리', width: 60 }
                        ]);
                    }
                }
            } catch (err) {
                console.error("Failed to load sales data", err);
            } finally {
                setIsLoading(false);
                dataLoaded.current = true;
            }
        };

        fetchInitialData();
    }, []);

    // AUTO-SAVE LOGIC
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        if (!dataLoaded.current) return;
        
        // Wait until at least default columns are mounted
        if (columns.length === 0) return;

        setAutoSaveStatus('Saving...');
        setIsAutoSaving(true);

        const timer = setTimeout(async () => {
            try {
                if (!dataLoaded.current) return;
                await salesAPI.save({
                    rows: salesData,
                    columns: columns,
                    columnWidths: columnWidths,
                    rowHeights: rowHeights
                });
                setAutoSaveStatus('Saved');
                setTimeout(() => setAutoSaveStatus(''), 2000);
            } catch (err) {
                console.error("Auto-save failed", err);
                setAutoSaveStatus('Error');
            } finally {
                setIsAutoSaving(false);
            }
        }, 2000);

        return () => clearTimeout(timer);
    }, [salesData, columns, columnWidths, rowHeights]);

    const handleUpdateColumns = useCallback((newCols) => {
        setSalesData(prevData => {
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

    const resizingRef = useRef({ isResizing: false, type: null, id: null, startPos: 0, startSize: 0 });

    const handleColumnMouseDown = useCallback((e, column) => {
        e.stopPropagation();
        const th = e.currentTarget.closest('th');
        const actualWidth = th ? th.getBoundingClientRect().width : (columnWidths[column] || 120);
        resizingRef.current = { isResizing: true, type: 'col', id: column, startPos: e.clientX, startSize: actualWidth };
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
            setRowHeights(prev => ({ ...prev, [resizingRef.current.id]: newHeight }));
        }
    }, []);

    const handleMouseUp = useCallback(() => {
        resizingRef.current.isResizing = false;
        document.body.style.cursor = 'default';
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }, [handleMouseMove]);

    const handleCellChange = useCallback((id, field, value) => {
        setSalesData(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
    }, []);

    const handleHeaderChange = useCallback((key, newLabel) => {
        setColumns(prev => prev.map(col => col.key === key ? { ...col, label: newLabel } : col));
    }, []);

    const addNewRow = () => {
        const newRow = { id: Date.now(), category: '진행중', projectName: '', pd: '', mainContractor: '-', estimatedAmount: '-', progress: '-', kickoff: '-', rfpInfo: '-', proposal: '-', pt: '-', status: '', plan: '', clientInfo: '-' };
        setSalesData([newRow, ...salesData]);
    };

    const deleteRow = useCallback((id) => {
        if (window.confirm('이 행을 삭제하시겠습니까?')) {
            setSalesData(prev => prev.filter(item => item.id !== id));
        }
    }, []);

    const handleSave = async (silent = false) => {
        try {
            await salesAPI.save({
                rows: salesData,
                columns: columns,
                columnWidths: columnWidths,
                rowHeights: rowHeights
            });
            if (!silent) {
                setShowSaveToast(true);
                setTimeout(() => setShowSaveToast(false), 3000);
            }
        } catch (error) {
            console.error('Failed to save sales data manually:', error);
            if (!silent) alert('서버 오류로 저장에 실패했습니다.');
        }
    };

    const filteredData = useMemo(() => {
        const order = ['진행예정', '진행중', '홀딩', '수주', '드롭', '탈락'];
        
        return salesData
            .filter(item => 
                (item.projectName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.pd || '').toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort((a, b) => {
                const weights = {
                    '진행예정': 0,
                    '진행중': 1,
                    '홀딩': 2,
                    '수주': 3,
                    '드롭': 4,
                    '탈락': 5
                };
                
                const normalize = (val) => {
                    const str = String(val || '').normalize('NFC').trim();
                    if (str === '수행') return '진행중';
                    return str || '진행중';
                };
                
                const catA = normalize(a.category);
                const catB = normalize(b.category);
                
                const weightA = weights[catA] || 99;
                const weightB = weights[catB] || 99;

                // Log only if search is "DEBUG_SORT" to avoid spam
                if (searchTerm === 'DEBUG_SORT') {
                    console.log(`[SORT DEBUG] Comparing ID ${a.id} (${catA}, w:${weightA}) vs ID ${b.id} (${catB}, w:${weightB})`);
                }

                if (weightA !== weightB) return weightA - weightB;
                
                // Secondary sort: Stabilize with ID (numeric)
                const idA = Number(a.id);
                const idB = Number(b.id);
                if (!isNaN(idA) && !isNaN(idB)) return idA - idB;
                return String(a.id).localeCompare(String(b.id));
            });
    }, [salesData, searchTerm]);

    const handleExportExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('영업현황');

        // Filter out 'manage' column for Excel
        const exportColumns = columns.filter(col => col.key !== 'manage');

        // Define columns
        worksheet.columns = [
            { header: 'No', key: 'no', width: 5 },
            ...exportColumns.map(col => ({
                header: col.label,
                key: col.key,
                width: Math.max(15, (columnWidths[col.key] || 100) / 7.5)
            }))
        ];

        // Header Styling
        const headerRow = worksheet.getRow(1);
        headerRow.height = 25;
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1E293B' }
        };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

        // Add Data
        filteredData.forEach((row, index) => {
            const rowData = { no: index + 1 };
            exportColumns.forEach(col => {
                rowData[col.key] = row[col.key];
            });
            const excelRow = worksheet.addRow(rowData);
            excelRow.height = 30;

            // Styling for Category Cell
            const categoryCell = excelRow.getCell('category');
            const categoryValue = String(row.category || '').normalize('NFC').trim();
            
            let bgColor = 'FFFFFFFF';
            let textColor = 'FF000000';

            const normalize = (val) => {
                const str = String(val || '').normalize('NFC').trim();
                return str === '수행' ? '진행중' : (str || '진행중');
            };
            const cat = normalize(categoryValue);

            if (cat === '진행예정') {
                bgColor = 'FFEBF8FF'; textColor = 'FF2563EB';
            } else if (cat === '진행중') {
                bgColor = 'FFE6FFFA'; textColor = 'FF059669';
            } else if (cat === '홀딩') {
                bgColor = 'FFFFFAF0'; textColor = 'FFD97706';
            } else if (cat === '수주') {
                bgColor = 'FFF0F9FF'; textColor = 'FF0369A1';
            } else if (cat === '드롭') {
                bgColor = 'FFFFF5F5'; textColor = 'FFDC2626';
            } else if (cat === '탈락') {
                bgColor = 'FFF7FAFC'; textColor = 'FF4B5563';
            }

            categoryCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: bgColor.replace('#', '') }
            };
            categoryCell.font = { color: { argb: textColor.replace('#', '') }, bold: true, size: 9 };
            categoryCell.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        // Borders and formatting
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
        saveAs(new Blob([buffer]), `영업현황_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    if (isLoading) return (
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

    return (
        <div className={`flex flex-col h-full min-h-0 animate-in fade-in duration-700 ${theme === 'light' ? 'light-theme' : ''}`}>
            <style>
                {`
                    .sales-spreadsheet-container {
                        --grid-border: rgba(255, 255, 255, 0.15);
                    }
                    .light-theme .sales-spreadsheet-container {
                        --grid-border: rgba(0, 0, 0, 0.15);
                    }
                    .sales-spreadsheet-container table {
                        border-collapse: separate !important;
                        border-spacing: 0 !important;
                        table-layout: fixed !important;
                        min-width: 100% !important;
                    }
                    .sales-spreadsheet-container td, .sales-spreadsheet-container th { 
                        padding: 0 !important; 
                        margin: 0 !important; 
                        border: 1px solid var(--grid-border) !important; 
                    }
                    .sales-spreadsheet-container td { position: relative !important; }
                    .sales-spreadsheet-container input, .sales-spreadsheet-container textarea { box-shadow: none !important; border: none !important; outline: none !important; appearance: none !important; user-select: text !important; cursor: text !important; width: 100% !important; height: 100% !important; background: transparent; color: inherit; }
                    .sales-spreadsheet-container .focused-field { box-shadow: inset 0 0 0 2px #3b82f6 !important; z-index: 60 !important; background: var(--bg-secondary) !important; color: var(--text-primary) !important; caret-color: #3b82f6 !important; }
                    .sales-spreadsheet-container thead th {
                        position: sticky !important;
                        background: var(--bg-tertiary) !important;
                    }
                    .sales-spreadsheet-container thead tr:nth-child(1) th {
                        top: 0 !important;
                        z-index: 55 !important;
                    }
                    .sales-spreadsheet-container thead tr:nth-child(2) th {
                        top: 28px !important;
                        z-index: 55 !important;
                    }
                    .sales-spreadsheet-container td.sticky { 
                        position: sticky !important;
                        left: 0 !important;
                        z-index: 40 !important;
                        background: var(--bg-tertiary) !important; 
                    }
                    .sales-spreadsheet-container thead th:first-child {
                        left: 0 !important;
                        z-index: 65 !important;
                    }
                    .sales-spreadsheet-container td:not(.sticky) { overflow: hidden !important; background: var(--bg-secondary); }
                    .sales-spreadsheet-container .resize-handle { z-index: 100 !important; pointer-events: auto !important; }
                    .trash-delete-btn { opacity: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: none !important; border: none !important; padding: 0 !important; cursor: pointer; color: #94a3b8; transition: all 0.15s ease; outline: none !important; }
                    tr:hover .trash-delete-btn { opacity: 1; }
                    .trash-delete-btn:hover .trash-delete-icon { stroke: #ff0000 !important; filter: drop-shadow(0 0 4px rgba(255, 0, 0, 0.4)); }
                    .trash-delete-icon { stroke: currentColor; fill: none; pointer-events: none; transition: stroke 0.15s ease; }
                    
                    /* Toolbar Buttons Styles - Using global .premium-icon-btn */
                    .btn-save:hover { color: #3b82f6 !important; background: rgba(59, 130, 246, 0.15) !important; filter: drop-shadow(0 0 5px rgba(59, 130, 246, 0.5)); }
                    .btn-add:hover { color: #10b981 !important; background: rgba(16, 185, 129, 0.15) !important; filter: drop-shadow(0 0 5px rgba(16, 185, 129, 0.5)); }
                    .btn-cols:hover { color: #8b5cf6 !important; background: rgba(139, 92, 246, 0.15) !important; filter: drop-shadow(0 0 5px rgba(139, 92, 246, 0.5)); }
                    .btn-theme:hover { color: #f59e0b !important; background: rgba(245, 158, 11, 0.15) !important; filter: drop-shadow(0 0 5px rgba(245, 158, 11, 0.5)); }
                    .btn-excel:hover { color: #16a34a !important; background: rgba(22, 163, 74, 0.15) !important; filter: drop-shadow(0 0 5px rgba(22, 163, 74, 0.5)); }
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
                    <button 
                        onClick={handleSave} 
                        className="premium-icon-btn btn-save"
                        title="저장 (Save)"
                    >
                        <Save size={16} />
                    </button>
                    <button 
                        onClick={addNewRow} 
                        className="premium-icon-btn btn-add"
                        title="행 추가 (Add Row)"
                    >
                        <Plus size={16} />
                    </button>
                    <button 
                        onClick={() => setIsSettingsModalOpen(true)}
                        className="premium-icon-btn btn-cols"
                        title="열 설정 (Columns)"
                    >
                        <Columns size={16} />
                    </button>
                    
                    {autoSaveStatus && (
                        <div className={`text-[10px] font-bold px-2 py-1 rounded-md transition-all animate-pulse ${
                            autoSaveStatus === 'Saving...' ? 'text-blue-400 bg-blue-500/10' : 
                            autoSaveStatus === 'Saved' ? 'text-green-400 bg-green-500/10' : 
                            'text-red-400 bg-red-500/10'
                        }`}>
                            {autoSaveStatus === 'Saving...' ? '⚡ 자동 저장 중...' : 
                             autoSaveStatus === 'Saved' ? '✅ 저장됨' : '❌ 저장 실패'}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={toggleTheme}
                        className="premium-icon-btn btn-theme"
                        title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
                    >
                        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                    </button>
                    <div className="w-px h-5 bg-[var(--border)] mx-1"></div>
                    <button 
                        onClick={handleExportExcel}
                        className="premium-icon-btn btn-excel"
                        title="엑셀로 다운로드"
                    >
                        <Download size={16} />
                    </button>
                    <div className="w-px h-5 bg-[var(--border)] mx-1"></div>
                    <div className="search-input-wrapper">
                        <input 
                            type="text" 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                            placeholder="시트 내 검색..." 
                            spellCheck={false}
                            className="premium-search-input"
                        />
                        <Search size={14} className="search-icon-glass" />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="search-clear-btn"
                                title="검색어 지우기"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex-1 overflow-auto bg-[var(--bg-primary)] sales-spreadsheet-container relative">
                <table className="table-fixed">
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
                        {filteredData.map((item, rowIndex) => (
                            <SalesDataRow key={item.id} item={item} rowIndex={rowIndex} columns={columns} columnWidths={columnWidths} rowHeight={rowHeights[item.id] || 80} focusedCell={focusedCell} setFocusedCell={setFocusedCell} onCellChange={handleCellChange} onDelete={deleteRow} onRowResize={handleRowMouseDown} theme={theme} />
                        ))}
                    </tbody>
                </table>
            </div>
            <ColumnSettingsModal 
                isOpen={isSettingsModalOpen} 
                onClose={() => setIsSettingsModalOpen(false)} 
                columns={columns}
                onUpdateColumns={handleUpdateColumns}
            />
        </div>
    );
};

export default SalesStatus;
