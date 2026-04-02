import { useState, useEffect, useCallback, useMemo } from 'react';
import { dashboardAPI, integrationsAPI } from '../api';
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    ComposedChart, Line, LineChart, Area, AreaChart, Sector, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    RadialBarChart, RadialBar, ReferenceLine
} from 'recharts';
import { useTheme } from '../context/ThemeContext';

const COLORS = ['#00687a', '#00a3bf', '#4a6267', '#525e7d', '#004e5d', '#3d494c', '#70797b']; // Clinical Architect Palette

const getSkillStyle = (level) => {
    switch (level) {
        case '특급': return { backgroundColor: 'rgba(139, 92, 246, 0.15)', color: '#7C3AED', border: '1px solid rgba(139, 92, 246, 0.3)' }; // Purple
        case '고급': return { backgroundColor: 'rgba(2, 132, 199, 0.15)', color: '#0284C7', border: '1px solid rgba(2, 132, 199, 0.3)' }; // blue
        case '중급': return { backgroundColor: 'rgba(5, 150, 105, 0.15)', color: '#059669', border: '1px solid rgba(5, 150, 105, 0.3)' }; // Emerald
        case '초급': return { backgroundColor: 'rgba(217, 119, 6, 0.15)', color: '#D97706', border: '1px solid rgba(217, 119, 6, 0.3)' }; // Amber
        default: return { backgroundColor: 'var(--surface-high)', color: 'var(--text-muted)', border: '1px solid var(--border)' }; // Default
    }
};

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="custom-tooltip glass-card p-3 shadow-premium" style={{ 
                backgroundColor: 'var(--surface-high)', 
                border: '1px solid var(--border)',
                borderRadius: '12px'
            }}>
                <p className="font-bold mb-2 text-primary" style={{ fontSize: '1rem' }}>{`${label || ''}`}</p>
                {payload.map((entry, index) => (
                    <p key={index} className="text-sm font-semibold" style={{ color: entry.color, marginBottom: '4px' }}>
                        {`${entry.name}: ${entry.value}명`}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

const renderActiveShape = (props) => {
    const RADIAN = Math.PI / 180;
    const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
    const sin = Math.sin(-RADIAN * midAngle);
    const cos = Math.cos(-RADIAN * midAngle);
    const sx = cx + (outerRadius + 10) * cos;
    const sy = cy + (outerRadius + 10) * sin;
    const mx = cx + (outerRadius + 30) * cos;
    const my = cy + (outerRadius + 30) * sin;
    const ex = mx + (cos >= 0 ? 1 : -1) * 22;
    const ey = my;
    const textAnchor = cos >= 0 ? 'start' : 'end';

    const displayName = payload.employment_type || payload.name;

    return (
        <g>
            <text x={cx} y={cy - 4} textAnchor="middle" fill={fill} style={{ fontSize: '1.25rem', fontWeight: '900' }}>
                {displayName}
            </text>
            <text x={cx} y={cy + 20} textAnchor="middle" fill="var(--text-muted)" style={{ fontSize: '0.95rem', fontWeight: '600' }}>
                {value}명
            </text>
            <Sector
                cx={cx}
                cy={cy}
                innerRadius={innerRadius}
                outerRadius={outerRadius}
                startAngle={startAngle}
                endAngle={endAngle}
                fill={fill}
            />
            <Sector
                cx={cx}
                cy={cy}
                startAngle={startAngle}
                endAngle={endAngle}
                innerRadius={outerRadius + 6}
                outerRadius={outerRadius + 10}
                fill={fill}
            />
            <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
            <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
            <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill={fill} style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{displayName}</text>
            <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={18} textAnchor={textAnchor} fill="var(--text-primary)" style={{ fontSize: '1rem', fontWeight: 'bold' }}>{`${value}명`}</text>
            <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={36} textAnchor={textAnchor} fill="var(--text-muted)" style={{ fontSize: '0.8rem' }}>
                {`(${(percent * 100).toFixed(0)}%)`}
            </text>
        </g>
    );
};

const renderActiveShapeGroup = (props) => {
    const RADIAN = Math.PI / 180;
    const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
    const sin = Math.sin(-RADIAN * midAngle);
    const cos = Math.cos(-RADIAN * midAngle);
    const sx = cx + (outerRadius + 10) * cos;
    const sy = cy + (outerRadius + 10) * sin;
    const mx = cx + (outerRadius + 30) * cos;
    const my = cy + (outerRadius + 30) * sin;
    const ex = mx + (cos >= 0 ? 1 : -1) * 22;
    const ey = my;
    const textAnchor = cos >= 0 ? 'start' : 'end';

    return (
        <g>
            <Sector
                cx={cx}
                cy={cy}
                innerRadius={innerRadius}
                outerRadius={outerRadius}
                startAngle={startAngle}
                endAngle={endAngle}
                fill={fill}
            />
            <Sector
                cx={cx}
                cy={cy}
                startAngle={startAngle}
                endAngle={endAngle}
                innerRadius={outerRadius + 6}
                outerRadius={outerRadius + 10}
                fill={fill}
            />
            <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
            <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
            <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="var(--text-primary)" style={{ fontWeight: 'bold' }}>
                {`${payload.name} ${value}명`}
            </text>
            <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={18} textAnchor={textAnchor} fill="var(--text-muted)" style={{ fontSize: '0.85rem' }}>
                {`(정규직: ${payload.regular_count || 0}, 계약직: ${payload.contract_count || 0}) / ${(percent * 100).toFixed(0)}%`}
            </text>
        </g>
    );
};

// Bilingual Text Component
const BilingualText = ({ en, ko, className = '' }) => (
    <div className="bilingual-container">
        <span className={`bilingual-en ${className}`}>{en}</span>
        <span className="bilingual-ko">{ko}</span>
    </div>
);

function Dashboard() {
    const { theme } = useTheme();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const isDark = theme === 'dark';
    const [activeIndexGroup, setActiveIndexGroup] = useState(0);
    const [activeIndexEmp, setActiveIndexEmp] = useState(0);
    const [integrations, setIntegrations] = useState([]);
    const [hiddenSeries, setHiddenSeries] = useState([]);
    const [showGroupTable, setShowGroupTable] = useState(false);
    const [benchSort, setBenchSort] = useState({ key: 'group_name', direction: 'asc' });
    const [idleViewMode, setIdleViewMode] = useState(() => {
        const saved = localStorage.getItem('idleViewPref');
        return (saved && saved !== 'tactical') ? saved : 'original';
    });

    const handleBenchSort = (key) => {
        setBenchSort(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    // Save View Preference
    useEffect(() => {
        localStorage.setItem('idleViewPref', idleViewMode);
    }, [idleViewMode]);

    const sortedBenchList = useMemo(() => {
        if (!stats?.benchList) return [];
        return [...stats.benchList].sort((a, b) => {
            let aVal = (benchSort.key === 'group_name' ? a.group_name : (benchSort.key === 'status' ? a.leave_status : a[benchSort.key])) || '';
            let bVal = (benchSort.key === 'group_name' ? b.group_name : (benchSort.key === 'status' ? b.leave_status : b[benchSort.key])) || '';

            if (aVal < bVal) return benchSort.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return benchSort.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [stats?.benchList, benchSort]);

    const activeBenchCount = useMemo(() => {
        if (!stats?.benchList) return 0;
        return stats.benchList.filter(item => !item.leave_status).length;
    }, [stats?.benchList]);

    const handleLegendClick = (e) => {
        const { value } = e;

        if (!stats?.idleStats?.[0]) return;

        const groupNames = stats.idleStats[0].byGroup.map(g => g.name);
        const allIds = ['Total', ...groupNames];
        const others = allIds.filter(id => id !== value);

        setHiddenSeries(prev => {
            // Check if currently ONLY this value is visible (meaning all others are hidden)
            const isAlreadySolo = prev.length === others.length && others.every(o => prev.includes(o));

            if (isAlreadySolo) {
                return []; // Restore all
            } else {
                return others; // Hide all except selected
            }
        });
    };


    const onPieEnterGroup = useCallback((_, index) => {
        setActiveIndexGroup(index);
    }, []);

    const onPieEnterEmp = useCallback((_, index) => {
        setActiveIndexEmp(index);
    }, []);

    useEffect(() => {
        loadStats();
        loadIntegrations();
    }, []);

    const loadIntegrations = async () => {
        try {
            const response = await integrationsAPI.getAll();
            setIntegrations(response.data);
        } catch (err) {
            console.error('Failed to load integrations:', err);
        }
    };

    const loadStats = async () => {
        try {
            setLoading(true);
            const response = await dashboardAPI.getStats();
            setStats(response.data);
            setError(null);
        } catch (err) {
            setError('데이터를 불러오는데 실패했습니다.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const utilizationData = useMemo(() => {
        return stats?.groupUtilization?.map((item, index) => ({
            name: item.name,
            uv: item.idle,
            fill: COLORS[index % COLORS.length]
        })) || [];
    }, [stats?.groupUtilization]);

    const renderIdleWorkforceChart = () => {
        if (!stats?.idleStats) return null;

        const chartData = stats.idleStats.map(period => {
            const dataPoint = { 
                name: period.label, 
                Total: parseFloat(period.totalIdleRate),
                Total_count: period.totalIdleCount
            };
            period.byGroup.forEach(g => {
                dataPoint[g.name] = parseFloat(g.idleRate);
                dataPoint[`${g.name}_count`] = g.idleCount;
            });
            return dataPoint;
        });

        const IdleTooltip = ({ active, payload, label }) => {
            if (active && payload && payload.length) {
                return (
                    <div className="custom-tooltip glass-card p-3 shadow-premium" style={{ 
                        backgroundColor: 'var(--surface-high)', 
                        border: '1px solid var(--border)',
                        borderRadius: '12px'
                    }}>
                        <p className="font-bold mb-2 text-primary" style={{ fontSize: '1rem' }}>{label}</p>
                        {payload.map((entry, index) => (
                            <p key={index} className="text-sm font-semibold" style={{ color: entry.color, marginBottom: '4px' }}>
                                {`${entry.name} : ${entry.payload[`${entry.name}_count`] || 0}명, ${entry.value}%`}
                            </p>
                        ))}
                    </div>
                );
            }
            return null;
        };

        if (idleViewMode === 'refined') {
            return (
                <div style={{ height: '320px', marginBottom: '2.5rem' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                            <defs>
                                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                                </linearGradient>
                                {stats.idleStats[0]?.byGroup?.map((g, i) => (
                                    <linearGradient key={`grad-${g.id}`} id={`color-${g.id}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={stats.employeesByGroup?.find(eg => eg.name === g.name)?.color || COLORS[i % COLORS.length]} stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor={stats.employeesByGroup?.find(eg => eg.name === g.name)?.color || COLORS[i % COLORS.length]} stopOpacity={0}/>
                                    </linearGradient>
                                ))}
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                            <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
                            <Tooltip content={<IdleTooltip />} />
                            <Area type="monotone" dataKey="Total" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" className="recharts-area-refined" />
                            {stats.idleStats[0]?.byGroup?.map((group, index) => (
                                <Area 
                                    key={group.id}
                                    type="monotone" 
                                    dataKey={group.name} 
                                    stroke={stats.employeesByGroup?.find(g => g.name === group.name)?.color || COLORS[index % COLORS.length]} 
                                    fillOpacity={1} 
                                    fill={`url(#color-${group.id})`}
                                    hide={hiddenSeries.includes(group.name)}
                                />
                            ))}
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            );
        }

        // Original Mode
        return (
            <div style={{ height: '320px', marginBottom: '2rem' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                        <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
                        <Tooltip content={<IdleTooltip />} />
                        <Legend wrapperStyle={{ paddingTop: '10px' }} onClick={handleLegendClick} />
                        <Line type="monotone" dataKey="Total" stroke="#ef4444" strokeWidth={4} dot={{ r: 5, fill: '#ef4444' }} hide={hiddenSeries.includes('Total')} />
                        {stats.idleStats[0]?.byGroup?.map((group, index) => (
                            <Line 
                                key={group.id}
                                type="monotone" 
                                dataKey={group.name} 
                                stroke={stats.employeesByGroup?.find(g => g.name === group.name)?.color || COLORS[index % COLORS.length]} 
                                strokeWidth={2}
                                dot={{ r: 3 }}
                                hide={hiddenSeries.includes(group.name)}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        );
    };

    const getStatusConfig = (rate, isRefined = false) => {
        const numRate = parseFloat(rate);
        if (numRate >= 20) {
            return {
                bg: isRefined ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.12)',
                text: '#f87171',
                border: 'rgba(239, 68, 68, 0.2)',
                bar: '#ef4444'
            };
        } else if (numRate >= 10) {
            return {
                bg: isRefined ? 'rgba(245, 158, 11, 0.06)' : 'rgba(245, 158, 11, 0.1)',
                text: '#fbbf24',
                border: 'rgba(245, 158, 11, 0.18)',
                bar: '#f59e0b'
            };
        }
        return {
            bg: isRefined ? 'rgba(16, 185, 129, 0.05)' : 'rgba(16, 185, 129, 0.08)',
            text: '#34d399',
            border: 'rgba(16, 185, 129, 0.15)',
            bar: '#10b981'
        };
    };

    const renderOriginalIdleGrid = () => {
        if (!stats?.idleStats) return null;
        return (
            <div className="overflow-x-auto">
                <table className="w-full text-left border-separate" style={{ borderSpacing: '0 4px' }}>
                    <thead>
                        <tr>
                            <th className="text-muted text-[11px] font-semibold uppercase tracking-wider pb-2 pl-4" style={{ width: '130px' }}>Group</th>
                            {stats.idleStats.map((period, idx) => (
                                <th key={period.key} className={`text-muted text-center text-[11px] font-semibold uppercase tracking-wider pb-2 ${idx === 0 ? 'text-white' : ''}`}>
                                    {period.label}
                                    <div style={{ fontSize: '9px', opacity: 0.5, marginTop: '1px' }}>
                                        {period.key.replace('week', 'W').replace('month', 'M').replace('Current', 'Now')}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="text-xs">
                        {/* Total Row */}
                        <tr style={{ backgroundColor: 'var(--surface-high)', boxShadow: 'var(--shadow-sm)' }}>
                            <td className="p-3 pl-4 rounded-l-lg font-bold text-[var(--text-primary)] shadow-sm" style={{ fontSize: '0.9rem' }}>
                                전체 (Total)
                            </td>
                            {stats.idleStats.map(period => {
                                const config = getStatusConfig(period.totalIdleRate);
                                return (
                                    <td key={period.key} className={`p-1 text-center ${period === stats.idleStats[stats.idleStats.length - 1] ? 'rounded-r-lg' : ''}`}>
                                        <div style={{
                                            backgroundColor: config.bg,
                                            color: config.text,
                                            border: `1px solid ${config.border}`,
                                            borderRadius: '8px',
                                            padding: '6px 12px',
                                            display: 'inline-flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            minWidth: '75px',
                                            minHeight: '44px',
                                            position: 'relative',
                                            overflow: 'hidden',
                                            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.05)'
                                        }}>
                                            <span style={{ fontSize: '0.95rem', fontWeight: 800, lineHeight: 1, marginBottom: '2px' }}>{period.totalIdleRate}%</span>
                                            <span style={{ fontSize: '0.72rem', opacity: 0.8, lineHeight: 1 }}>{period.totalIdleCount}명</span>
                                            <div style={{ position: 'absolute', bottom: 0, left: 0, height: '3px', width: `${Math.min(parseFloat(period.totalIdleRate), 100)}%`, backgroundColor: config.bar, transition: 'width 0.5s ease' }}></div>
                                        </div>
                                    </td>
                                );
                            })}
                        </tr>

                        {stats.idleStats[0]?.byGroup?.map((group) => (
                            <tr key={group.id} className="group hover:bg-white/5 transition-colors duration-200">
                                <td className="p-3 pl-4 rounded-l-lg text-[var(--text-secondary)] font-medium" style={{ fontSize: '0.85rem' }}>
                                    {group.name}
                                </td>
                                {stats.idleStats.map(period => {
                                    const groupData = period.byGroup.find(g => g.id === group.id);
                                    const count = groupData?.idleCount || 0;
                                    const rate = groupData?.idleRate || 0;
                                    const config = getStatusConfig(rate);

                                    return (
                                        <td key={period.key} className={`p-1 text-center ${period === stats.idleStats[stats.idleStats.length - 1] ? 'rounded-r-lg' : ''}`}>
                                            <div style={{
                                                backgroundColor: config.bg,
                                                color: config.text,
                                                border: `1px solid ${config.border}`,
                                                borderRadius: '8px',
                                                padding: '6px 12px',
                                                display: 'inline-flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                minWidth: '75px',
                                                minHeight: '44px',
                                                position: 'relative',
                                                overflow: 'hidden',
                                                transition: 'transform 0.2s ease',
                                                cursor: 'default'
                                            }} className="hover:scale-105">
                                                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{rate}%</span>
                                                <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '1px' }}>{count}명</span>
                                                <div style={{ position: 'absolute', bottom: 0, left: 0, height: '2px', width: `${Math.min(parseFloat(rate), 100)}%`, backgroundColor: config.bar, opacity: 0.7 }}></div>
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    const renderRefinedIdleGrid = () => {
        if (!stats?.idleStats) return null;
        return (
            <div className="glass-card-stack pb-6">
                {/* Refined Header Summary */}
                <div className="refined-item-card" style={{ background: 'var(--surface-highest)', border: '2px solid var(--primary-muted)', marginBottom: '1rem' }}>
                    <div style={{ minWidth: '220px' }}>
                        <div className="font-bold text-primary" style={{ fontSize: '1.2rem' }}>유휴율 종합 관리</div>
                    </div>
                    <div className="flex flex-1 justify-end gap-6">
                        {stats.idleStats.map(period => {
                            const config = getStatusConfig(period.totalIdleRate, true);
                            return (
                                <div key={period.key} className="text-center" style={{ minWidth: '100px' }}>
                                    <div className="text-[9px] font-bold text-muted uppercase mb-2">{period.label}</div>
                                    <div className="glass-pill" style={{ color: config.text, background: config.bg, borderColor: config.border, justifyContent: 'center' }}>
                                        <div className="glow-dot" style={{ background: config.text }}></div>
                                        {period.totalIdleCount}명, {period.totalIdleRate}%
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Group Cards */}
                {stats.idleStats[0]?.byGroup?.map((group) => (
                    <div key={group.id} className="refined-item-card" style={{ padding: '0.75rem 1.25rem' }}>
                        <div className="flex items-center gap-4" style={{ minWidth: '220px' }}>
                            <div style={{ width: '4px', height: '32px', borderRadius: '4px', background: stats.employeesByGroup?.find(g => g.name === group.name)?.color || 'var(--primary)' }}></div>
                            <div>
                                <div className="text-[15px] font-bold" style={{ color: 'var(--text-primary)' }}>{group.name}</div>
                            </div>
                        </div>
                        <div className="flex flex-1 justify-end gap-6">
                            {stats.idleStats.map(period => {
                                const groupData = period.byGroup.find(g => g.id === group.id);
                                const config = getStatusConfig(groupData?.idleRate || 0, true);
                                return (
                                    <div key={period.key} className="text-center" style={{ minWidth: '100px' }}>
                                        <div className="glass-pill" style={{ color: config.text, background: config.bg, borderColor: config.border, justifyContent: 'center' }}>
                                            {groupData?.idleCount || 0}명, {groupData?.idleRate || 0}%
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        );
    };


    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container page">
                <div className="glass-card">
                    <p className="text-danger">{error}</p>
                    <button onClick={loadStats} className="btn btn-primary mt-md">
                        다시 시도
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="container page">
            <div className="mb-lg flex justify-between items-end">
                <div>
                    <h1 className="text-gradient-primary" style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>Dashboard</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Workforce Status Management System</p>
                </div>
                <div className="text-right">
                    <div className="text-gradient-info" style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                        {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}
                    </div>
                </div>
            </div>

            {/* Top Stats Cards */}
            <div className="grid grid-4 mb-lg dashboard-grid">
                <div className="stat-card premium">
                    <div className="stat-value text-gradient-primary">{stats?.totalEmployees || 0}</div>
                    <div className="stat-label"><BilingualText en="Total Employees" ko="총 직원 수" /></div>
                </div>
                <div className="stat-card premium">
                    <div className="stat-value text-gradient-success">{stats?.totalGroups || 0}</div>
                    <div className="stat-label"><BilingualText en="Active Groups" ko="활성 그룹" /></div>
                </div>
                <div className="stat-card premium">
                    <div className="stat-value text-gradient-warning">{stats?.totalAssignments || 0}</div>
                    <div className="stat-label"><BilingualText en="Active Assignments" ko="프로젝트 실투입" /></div>
                </div>
                <div className="stat-card premium">
                    <div className="stat-value text-gradient-info">
                        {activeBenchCount}
                    </div>
                    <div className="stat-label"><BilingualText en="Non-Client Workforce" ko="미투입/내부 투입 인력" /></div>
                </div>
            </div>

            {/* Idle Status Table Section */}
            <div className="glass-card mb-lg dashboard-grid">
                <div className="card-header border-0 pb-0 flex justify-between items-center">
                    <h3 className="card-title">
                        <BilingualText className="text-gradient-warning" en="Idle Workforce Status (Rate %)" ko="유휴율 상세 현황 (%)" />
                    </h3>
                    <div className="flex items-center gap-4">
                        <div className="segmented-control">
                            <button 
                                className={`view-mode-btn ${idleViewMode === 'original' ? 'active' : ''}`}
                                onClick={() => setIdleViewMode('original')}
                            >
                                Original
                            </button>
                            <button 
                                className={`view-mode-btn ${idleViewMode === 'refined' ? 'active' : ''}`}
                                onClick={() => setIdleViewMode('refined')}
                            >
                                Refined
                            </button>
                        </div>
                        <div className="flex gap-2 text-xs font-bold border-l border-outline-variant pl-4">
                            <span className="px-2 py-1 rounded bg-green-500/20 text-green-400 border border-green-500/30">
                                &lt; 10% : 안정
                            </span>
                            <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                                10-20% : 경계
                            </span>
                            <span className="px-2 py-1 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                                &ge; 20% : 위험
                            </span>
                        </div>
                    </div>
                </div>
                <div className="card-body" style={{ overflowX: 'auto' }}>

                    {/* Visual Chart for Idle Rates */}
                    {renderIdleWorkforceChart()}

                    {stats?.idleStats ? (
                        <>
                            {idleViewMode === 'original' && renderOriginalIdleGrid()}
                            {idleViewMode === 'refined' && renderRefinedIdleGrid()}
                            {idleViewMode === 'tactical' && renderTacticalIdleGrid()}
                        </>
                    ) : (
                        <p className="text-muted text-center py-4">데이터가 없습니다.</p>
                    )}
                </div>
            </div>

            {/* Charts Row 1: Interactive Donut Charts */}
            <div className="grid grid-2 mb-lg dashboard-grid">
                <div className="glass-card">
                    <div className="card-header border-0 pb-0 pt-3 flex justify-between items-center" style={{ minHeight: 'auto' }}>
                        <h3 className="card-title" style={{ fontSize: '1.2rem', fontWeight: '800' }}><BilingualText className="text-gradient-primary" en="Group Personnel Status" ko="그룹별 인원 현황" /></h3>
                        <button
                            className="btn btn-sm btn-outline-info"
                            style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                            onClick={() => setShowGroupTable(!showGroupTable)}
                        >
                            {showGroupTable ? '차트로 보기' : '표로 보기'}
                        </button>
                    </div>
                    <div className="card-body" style={{ height: '420px', paddingTop: '4px' }}>
                        {showGroupTable ? (
                            <div className="refined-scrollbar" style={{ paddingRight: '4px', display: 'flex', justifyContent: 'center' }}>
                                <table className="premium-glass-table" style={{ maxWidth: '700px', margin: '0 auto' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ width: '40%' }}>그룹</th>
                                            <th className="text-center" style={{ width: '20%' }}>정규직</th>
                                            <th className="text-center" style={{ width: '20%' }}>계약직</th>
                                            <th className="text-center font-bold text-primary" style={{ width: '20%' }}>총 인원</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats?.employeesByGroup?.map((group, idx) => (
                                            <tr key={idx}>
                                                <td className="font-bold" style={{ color: 'var(--text-primary)' }}>
                                                    <div className="flex items-center">
                                                        <span 
                                                            className="group-indicator-glow" 
                                                            style={{ backgroundColor: group.color || COLORS[idx % COLORS.length] }}
                                                        ></span>
                                                        {group.name}
                                                    </div>
                                                </td>
                                                <td className="text-center">
                                                    <span style={{ fontWeight: '700', fontSize: '1.1rem', color: 'var(--text-primary)' }}>{group.regular_count || 0}</span>
                                                </td>
                                                <td className="text-center">
                                                    <span style={{ fontWeight: '500', fontSize: '1.1rem', color: 'var(--text-muted)' }}>{group.contract_count || 0}</span>
                                                </td>
                                                <td className="text-center">
                                                    <span style={{ fontWeight: '800', fontSize: '1.2rem', color: 'var(--primary)' }}>
                                                        {group.count}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <td style={{ color: 'var(--text-primary)', fontWeight: 800 }}>합계 (Total)</td>
                                            <td className="text-center" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                                                {stats?.employeesByGroup?.reduce((sum, g) => sum + (g.regular_count || 0), 0)}
                                            </td>
                                            <td className="text-center" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                                                {stats?.employeesByGroup?.reduce((sum, g) => sum + (g.contract_count || 0), 0)}
                                            </td>
                                            <td className="text-center text-primary" style={{ fontSize: '1.2rem' }}>
                                                {stats?.employeesByGroup?.reduce((sum, g) => sum + (g.count || 0), 0)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        ) : (
                            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                                            <tspan x="50%" dy="-10" fontSize="14" fill={isDark ? '#94a3b8' : '#64748b'}>전체 인원</tspan>
                                            <tspan x="50%" dy="26" fontSize="28" fontWeight="bold" fill={isDark ? '#fff' : '#1e293b'}>{stats?.totalEmployees || 0}</tspan>
                                        </text>
                                        <Pie
                                            activeIndex={activeIndexGroup}
                                            activeShape={renderActiveShapeGroup}
                                            data={stats?.employeesByGroup}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={80}
                                            outerRadius={100}
                                            dataKey="count"
                                            nameKey="name"
                                            onMouseEnter={onPieEnterGroup}
                                            stroke="none"
                                        >
                                            {stats?.employeesByGroup?.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                </div>

                <div className="glass-card">
                    <div className="card-header border-0 pb-0">
                        <h3 className="card-title"><BilingualText className="text-gradient-primary" en="Employment Type" ko="고용 형태" /></h3>
                    </div>
                    <div className="card-body" style={{ height: '380px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    activeIndex={activeIndexEmp}
                                    activeShape={renderActiveShape}
                                    data={stats?.employmentStatus}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80}
                                    outerRadius={100}
                                    dataKey="count"
                                    nameKey="employment_type"
                                    onMouseEnter={onPieEnterEmp}
                                    stroke="none"
                                >
                                    {stats?.employmentStatus?.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>


            {/* Charts Row 2: Radar & RadialBar (Skills & Utilization) */}

            {/* Charts Row 3: Radar & RadialBar (Skills & Utilization) */}
            <div className="grid grid-2 mb-lg dashboard-grid">
                <div className="glass-card">
                    <div className="card-header border-0 pb-0">
                        <h3 className="card-title"><BilingualText className="text-gradient-success" en="Skill Capability Profile" ko="보유 기술 역량 분포" /></h3>
                    </div>
                    <div className="card-body" style={{ height: '350px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={stats?.skillLevelStatus}>
                                <PolarGrid stroke="#334155" />
                                <PolarAngleAxis dataKey="skill_level" tick={{ fill: '#CBD5E1', fontSize: 13 }} />
                                <PolarRadiusAxis angle={30} domain={[0, 'auto']} stroke="#94A3B8" />
                                <Radar name="Employees" dataKey="count" stroke="#34D399" strokeWidth={3} fill="#34D399" fillOpacity={0.4} />
                                <Tooltip content={<CustomTooltip />} />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glass-card">
                    <div className="card-header border-0 pb-0 flex justify-between items-center">
                        <h3 className="card-title">
                            <BilingualText className="text-gradient-info" en="Group Workforce Detail (As of Today)" ko="그룹별 활성 인력 상세 (오늘 기준)" />
                        </h3>
                    </div>
                    <div className="card-body" style={{ minHeight: '350px' }}>
                        {!stats?.groupWorkforceDetails || stats.groupWorkforceDetails.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-muted" style={{ height: '350px' }}>
                                데이터가 없거나 로딩 중입니다...
                            </div>
                        ) : (
                            <div style={{ width: '100%', height: '350px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={stats.groupWorkforceDetails}
                                        layout="vertical"
                                        margin={{ top: 20, right: 30, left: 40, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
                                        <XAxis type="number" hide />
                                        <YAxis
                                            dataKey="name"
                                            type="category"
                                            stroke="#94A3B8"
                                            fontSize={12}
                                            width={100}
                                        />
                                        <Tooltip
                                            cursor={{ fill: 'var(--surface-low)', opacity: 0.2 }}
                                            content={({ active, payload, label }) => {
                                                if (active && payload && payload.length) {
                                                    const dataItem = stats.groupWorkforceDetails.find(d => d.name === label);
                                                    return (
                                                        <div className="custom-tooltip glass-card p-3 shadow-premium" style={{ 
                                                            border: '1px solid var(--border)', 
                                                            background: 'var(--surface-high)', 
                                                            minWidth: '220px',
                                                            borderRadius: '12px'
                                                        }}>
                                                            <p className="font-bold mb-3 text-primary text-base border-b border-border pb-2">{label}</p>
                                                            {payload.map((entry, index) => {
                                                                const names = entry.dataKey === 'bench' ? dataItem?.benchNames :
                                                                    entry.dataKey === 'other' ? dataItem?.otherNames : null;
                                                                return (
                                                                    <div key={index} className="mb-3">
                                                                        <div className="flex justify-between gap-4 text-sm font-bold mb-1" style={{ color: entry.color }}>
                                                                            <span>{entry.name}:</span>
                                                                            <span>{entry.value}명</span>
                                                                        </div>
                                                                        {names && names.length > 0 && (
                                                                            <div className="text-[11px] pl-2 border-l-2 leading-relaxed" style={{ 
                                                                                borderColor: entry.color, 
                                                                                color: 'var(--text-secondary)',
                                                                                fontWeight: '500'
                                                                            }}>
                                                                                {names.join(', ')}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Legend verticalAlign="top" height={36} />
                                        <Bar name="실투입 (Client)" dataKey="client" stackId="a" fill="#60A5FA" />
                                        <Bar name="유휴 (Bench)" dataKey="bench" stackId="a" fill="#FBBF24" />
                                        <Bar name="기타 (Other)" dataKey="other" stackId="a" fill="#94A3B8" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Strategic Insights Row: Roll-offs & Bench */}
            <div className="grid grid-2 mb-lg dashboard-grid">
                {/* Upcoming Roll-offs */}
                <div className="glass-card">
                    <div className="card-header border-0 pb-0">
                        <h3 className="card-title">
                            <BilingualText
                                className="text-gradient-warning"
                                en={`Upcoming Roll-offs (30 Days) - ${stats?.upcomingRolloffs?.length || 0}`}
                                ko={`투입 종료 예정 (30일 이내) - ${stats?.upcomingRolloffs?.length || 0}명`}
                            />
                        </h3>
                    </div>
                    <div className="card-body refined-scrollbar" style={{ height: '760px', overflowY: 'auto', padding: '0 1rem' }}>
                        {stats?.upcomingRolloffs?.length > 0 ? (
                            <table className="w-full text-left" style={{ borderCollapse: 'separate', borderSpacing: '0 8px' }}>
                                <thead>
                                    <tr>
                                        <th className="text-center text-muted text-[10px] font-bold uppercase tracking-[0.2em] pb-3" style={{ width: '18%' }}>이름</th>
                                        <th className="text-center text-muted text-[10px] font-bold uppercase tracking-[0.2em] pb-3" style={{ width: '12%' }}>그룹</th>
                                        <th className="text-center text-muted text-[10px] font-bold uppercase tracking-[0.2em] pb-3" style={{ width: '12%' }}>고용</th>
                                        <th className="text-center text-muted text-[10px] font-bold uppercase tracking-[0.2em] pb-3" style={{ width: '38%' }}>프로젝트</th>
                                        <th className="text-center text-muted text-[10px] font-bold uppercase tracking-[0.2em] pb-3" style={{ width: '20%' }}>종료일</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.upcomingRolloffs.map((item, index) => {
                                        const today = new Date();
                                        const endDate = new Date(item.input_end_date);
                                        const diffTime = endDate - today;
                                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                                        return (
                                            <tr 
                                                key={index} 
                                                className="premium-editorial-row group"
                                                style={{ 
                                                    backgroundColor: 'var(--surface-low)',
                                                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    cursor: 'default',
                                                    boxShadow: '0 2px 8px -2px rgba(0,0,0,0.05)',
                                                    marginBottom: '12px'
                                                }}
                                            >
                                                <td className="py-5 px-3 pl-5 text-center" style={{ 
                                                    borderTopLeftRadius: '14px', 
                                                    borderBottomLeftRadius: '14px',
                                                    borderLeft: `6px solid ${item.group_color || 'var(--primary)'}`
                                                }}>
                                                    <div className="flex flex-col items-center">
                                                        <div style={{ fontSize: '15px', fontWeight: '900', color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: '1.1' }}>
                                                            {item.employee_name}
                                                        </div>
                                                        <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '4px', opacity: 0.6 }}>
                                                            {item.position}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-2 text-center">
                                                    <span style={{ 
                                                        backgroundColor: `${item.group_color}10`, 
                                                        color: item.group_color, 
                                                        fontSize: '10px', 
                                                        padding: '4px 10px', 
                                                        borderRadius: '6px', 
                                                        border: `1px solid ${item.group_color}30`, 
                                                        fontWeight: '800',
                                                        textTransform: 'uppercase',
                                                        display: 'inline-block'
                                                    }}>
                                                        {item.group_name}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-2 text-center">
                                                    <span style={{
                                                        fontSize: '11px',
                                                        color: item.employment_type === '정규직' ? 'var(--primary)' : (item.employment_type === '계약직' ? '#D97706' : 'var(--text-muted)'),
                                                        fontWeight: '800'
                                                    }}>
                                                        {item.employment_type || '-'}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-2 text-center">
                                                    <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', opacity: 0.85, maxWidth: '260px', margin: '0 auto' }} className="truncate" title={item.project_name}>
                                                        {item.project_name}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-2 pr-4 rounded-r-xl text-center whitespace-nowrap" style={{ borderTopRightRadius: '12px', borderBottomRightRadius: '12px' }}>
                                                    <div className="flex flex-col items-center gap-1">
                                                        <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
                                                            {item.input_end_date}
                                                        </div>
                                                        <span style={{ 
                                                            padding: '2px 8px', 
                                                            borderRadius: '99px', 
                                                            fontSize: '10px', 
                                                            fontWeight: '900', 
                                                            backgroundColor: diffDays <= 7 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(0, 163, 191, 0.1)',
                                                            color: diffDays <= 7 ? '#ef4444' : 'var(--primary)',
                                                            border: `1px solid ${diffDays <= 7 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0, 163, 191, 0.2)'}`,
                                                            textTransform: 'uppercase'
                                                        }}>
                                                            {diffDays <= 0 ? 'D-Day' : `D-${diffDays}`}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted">
                                예정된 종료 인원이 없습니다.
                            </div>
                        )}
                    </div>
                </div>

                {/* Bench / Low Utilization */}
                <div className="glass-card">
                    <div className="card-header border-0 pb-0">
                        <h3 className="card-title">
                            <BilingualText
                                className="text-gradient-danger"
                                en={`Bench / Low Utilization (${activeBenchCount})`}
                                ko={`유휴 인력 현황 (Bench) - ${activeBenchCount}명`}
                            />
                        </h3>
                    </div>
                    <div className="card-body refined-scrollbar" style={{ height: '760px', overflowY: 'auto', padding: '0 1rem' }}>
                        {stats?.benchList?.length > 0 ? (
                            <table className="w-full text-left" style={{ borderCollapse: 'separate', borderSpacing: '0 8px' }}>
                                <thead>
                                    <tr>
                                        <th
                                            className="text-center text-muted text-[10px] font-bold uppercase tracking-[0.2em] pb-3 cursor-pointer hover:text-primary transition-colors"
                                            onClick={() => handleBenchSort('name')}
                                            style={{ width: '22%' }}
                                        >
                                            이름 {benchSort.key === 'name' && (benchSort.direction === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th
                                            className="text-center text-muted text-[10px] font-bold uppercase tracking-[0.2em] pb-3 cursor-pointer hover:text-primary transition-colors"
                                            onClick={() => handleBenchSort('group_name')}
                                            style={{ width: '18%' }}
                                        >
                                            그룹 {benchSort.key === 'group_name' && (benchSort.direction === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th
                                            className="text-center text-muted text-[10px] font-bold uppercase tracking-[0.2em] pb-3 cursor-pointer hover:text-primary transition-colors"
                                            onClick={() => handleBenchSort('employment_type')}
                                            style={{ width: '18%' }}
                                        >
                                            고용 {benchSort.key === 'employment_type' && (benchSort.direction === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th
                                            className="text-center text-muted text-[10px] font-bold uppercase tracking-[0.2em] pb-3 cursor-pointer hover:text-primary transition-colors"
                                            onClick={() => handleBenchSort('skill_level')}
                                            style={{ width: '22%' }}
                                        >
                                            기술등급 {benchSort.key === 'skill_level' && (benchSort.direction === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th
                                            className="text-center text-muted text-[10px] font-bold uppercase tracking-[0.2em] pb-3 cursor-pointer hover:text-primary transition-colors"
                                            onClick={() => handleBenchSort('status')}
                                            style={{ width: '20%' }}
                                        >
                                            상태 {benchSort.key === 'status' && (benchSort.direction === 'asc' ? '↑' : '↓')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedBenchList.map((item, index) => (
                                        <tr 
                                            key={index} 
                                            className="premium-editorial-row group"
                                            style={{ 
                                                backgroundColor: 'var(--surface-low)',
                                                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                                cursor: 'default',
                                                boxShadow: '0 2px 8px -2px rgba(0,0,0,0.05)',
                                                marginBottom: '12px'
                                            }}
                                        >
                                            <td className="py-5 px-3 pl-5 text-center" style={{ 
                                                borderTopLeftRadius: '14px', 
                                                borderBottomLeftRadius: '14px',
                                                borderLeft: `6px solid ${item.group_color || 'var(--primary)'}`
                                            }}>
                                                <div className="flex flex-col items-center">
                                                    <div style={{ fontSize: '15px', fontWeight: '900', color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: '1.2' }}>
                                                        {item.name}
                                                    </div>
                                                    <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '4px', opacity: 0.6 }}>
                                                        {item.position}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 px-2 text-center">
                                                <span style={{ 
                                                    backgroundColor: `${item.group_color}10`, 
                                                    color: item.group_color, 
                                                    fontSize: '10px', 
                                                    padding: '4px 10px', 
                                                    borderRadius: '6px', 
                                                    border: `1px solid ${item.group_color}30`, 
                                                    fontWeight: '800',
                                                    textTransform: 'uppercase',
                                                    display: 'inline-block'
                                                }}>
                                                    {item.group_name}
                                                </span>
                                            </td>
                                            <td className="py-4 px-2 text-center">
                                                <span style={{
                                                    fontSize: '11px',
                                                    color: item.employment_type === '정규직' ? 'var(--primary)' : (item.employment_type === '계약직' ? '#D97706' : 'var(--text-muted)'),
                                                    fontWeight: '800'
                                                }}>
                                                    {item.employment_type || '-'}
                                                </span>
                                            </td>
                                            <td className="py-4 px-2 text-center">
                                                <span
                                                    style={{ 
                                                        ...getSkillStyle(item.skill_level),
                                                        fontSize: '10px',
                                                        fontWeight: '900',
                                                        padding: '2px 8px',
                                                        borderRadius: '6px',
                                                        textTransform: 'uppercase'
                                                    }}
                                                >
                                                    {item.skill_level || '-'}
                                                </span>
                                            </td>
                                            <td className="py-4 px-2 pr-4 text-center" style={{ borderTopRightRadius: '12px', borderBottomRightRadius: '12px' }}>
                                                {item.leave_status ? (
                                                    <span style={{ 
                                                        padding: '3px 10px', 
                                                        borderRadius: '99px', 
                                                        fontSize: '10px', 
                                                        fontWeight: '800', 
                                                        backgroundColor: 'rgba(245, 158, 11, 0.1)', 
                                                        color: '#d97706', 
                                                        border: '1px solid rgba(245, 158, 11, 0.2)',
                                                        textTransform: 'uppercase'
                                                    }}>
                                                        {item.leave_status}
                                                    </span>
                                                ) : (
                                                    <span style={{ fontSize: '10px', fontWeight: '900', color: 'var(--text-muted)', opacity: 0.3, letterSpacing: '0.1em' }}>IDLE</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted">
                                유휴 인력이 없습니다.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Floating Glass Dock for Integrations */}
            {integrations.length > 0 && (
                <div className="floating-dock-container">
                    <div className="dock-label">Systems</div>
                    {integrations.map((item) => (
                        <a 
                            key={item.id} 
                            href={item.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="dock-item"
                        >
                            <span className="tooltip">{item.name}</span>
                            {item.icon_emoji || '🔗'}
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
}

export default Dashboard;
