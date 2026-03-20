import { useState, useEffect, useCallback, useMemo } from 'react';
import { dashboardAPI, integrationsAPI } from '../api';
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    ComposedChart, Line, LineChart, Area, Sector, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    RadialBarChart, RadialBar, ReferenceLine
} from 'recharts';

const COLORS = ['#60A5FA', '#34D399', '#FBBF24', '#F87171', '#A78BFA', '#22D3EE', '#F472B6'];

const getSkillStyle = (level) => {
    switch (level) {
        case '특급': return { backgroundColor: 'rgba(167, 139, 250, 0.15)', color: '#C084FC', border: '1px solid rgba(167, 139, 250, 0.3)' }; // Purple
        case '고급': return { backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', border: '1px solid rgba(56, 189, 248, 0.3)' }; // Sky blue
        case '중급': return { backgroundColor: 'rgba(52, 211, 153, 0.15)', color: '#34D399', border: '1px solid rgba(52, 211, 153, 0.3)' }; // Emerald
        case '초급': return { backgroundColor: 'rgba(251, 191, 36, 0.15)', color: '#FBBF24', border: '1px solid rgba(251, 191, 36, 0.3)' }; // Amber
        default: return { backgroundColor: 'rgba(255,255,255,0.05)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.1)' }; // Default gray
    }
};

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="custom-tooltip">
                <p className="label">{`${label || ''}`}</p>
                {payload.map((entry, index) => (
                    <p key={index} className="intro" style={{ color: entry.color }}>
                        {`${entry.name}: ${entry.value}`}
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

    return (
        <g>
            <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill} style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                {payload.name}
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
            <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="#fff">{`${value}명`}</text>
            <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={18} textAnchor={textAnchor} fill="#999">
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
            <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="#fff" style={{ fontWeight: 'bold' }}>
                {`${payload.name} ${value}명`}
            </text>
            <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={18} textAnchor={textAnchor} fill="#999" style={{ fontSize: '0.85rem' }}>
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
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeIndexGroup, setActiveIndexGroup] = useState(0);
    const [activeIndexEmp, setActiveIndexEmp] = useState(0);
    const [integrations, setIntegrations] = useState([]);
    const [hiddenSeries, setHiddenSeries] = useState([]);
    const [showGroupTable, setShowGroupTable] = useState(false);
    const [benchSort, setBenchSort] = useState({ key: 'group_name', direction: 'asc' });

    const handleBenchSort = (key) => {
        setBenchSort(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

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
                    <h1 className="text-gradient" style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>Dashboard</h1>
                    <p className="text-muted">Workforce Status Management System</p>
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
                    <div className="stat-value text-gradient">{stats?.totalEmployees || 0}</div>
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
                        {stats?.benchList?.length || 0}
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
                    <div className="flex gap-2 text-xs font-bold">
                        <span className="px-2 py-1 rounded bg-green-500/20 text-green-400 border border-green-500/30">
                            &lt; 10% : 안정 (Stable)
                        </span>
                        <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                            10% ~ 20% : 경계 (Caution)
                        </span>
                        <span className="px-2 py-1 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                            &ge; 20% : 위험 (Critical)
                        </span>
                    </div>
                </div>
                <div className="card-body" style={{ overflowX: 'auto' }}>

                    {/* Visual Chart for Idle Rates */}
                    {stats?.idleStats && (
                        <div style={{ height: '320px', marginBottom: '2rem' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                    data={stats.idleStats.map(period => {
                                        const dataPoint = { name: period.label, Total: parseFloat(period.totalIdleRate) };
                                        period.byGroup.forEach(g => {
                                            dataPoint[g.name] = parseFloat(g.idleRate);
                                        });
                                        return dataPoint;
                                    })}
                                    margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis
                                        stroke="#94a3b8"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        unit="%"
                                        domain={[0, 100]}
                                        ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                        itemStyle={{ color: '#e2e8f0' }}
                                        cursor={{ stroke: 'rgba(255,255,255,0.2)' }}
                                    />

                                    {/* Reference Key Lines */}
                                    <ReferenceLine y={10} stroke="#10B981" strokeDasharray="3 3" label={{ position: 'right', value: 'Amber', fill: '#10B981', fontSize: 10 }} />
                                    <ReferenceLine y={20} stroke="#EF4444" strokeDasharray="3 3" label={{ position: 'right', value: 'Red', fill: '#EF4444', fontSize: 10 }} />

                                    <Legend
                                        wrapperStyle={{ paddingTop: '10px', cursor: 'pointer' }}
                                        onClick={handleLegendClick}
                                        payload={[
                                            {
                                                value: 'Total',
                                                type: 'line',
                                                id: 'Total',
                                                color: hiddenSeries.includes('Total') ? '#ccc' : '#ef4444',
                                                inactive: hiddenSeries.includes('Total')
                                            },
                                            ...(stats.idleStats[0]?.byGroup?.map((g, i) => ({
                                                value: g.name,
                                                type: 'line',
                                                id: g.name,
                                                color: hiddenSeries.includes(g.name) ? '#ccc' : (stats.employeesByGroup?.find(eg => eg.name === g.name)?.color || COLORS[i % COLORS.length]),
                                                inactive: hiddenSeries.includes(g.name)
                                            })) || [])
                                        ]}
                                    />

                                    {/* Group Lines (Rendered First = Bottom Layer) */}
                                    {stats.idleStats[0]?.byGroup?.map((group, index) => (
                                        <Line
                                            key={group.id}
                                            type="monotone"
                                            dataKey={group.name}
                                            stroke={stats.employeesByGroup?.find(g => g.name === group.name)?.color || COLORS[index % COLORS.length]}
                                            strokeWidth={2}
                                            strokeOpacity={0.8}
                                            dot={{ r: 3 }}
                                            activeDot={{ r: 5 }}
                                            hide={hiddenSeries.includes(group.name)}
                                        />
                                    ))}

                                    {/* Total Line (Rendered Last = Top Layer) */}
                                    <Line
                                        type="monotone"
                                        dataKey="Total"
                                        stroke="#ef4444"
                                        strokeWidth={4}
                                        dot={{ r: 5, fill: '#ef4444', stroke: '#fff', strokeWidth: 2 }}
                                        activeDot={{ r: 7 }}
                                        hide={hiddenSeries.includes('Total')}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {stats?.idleStats ? (
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
                                    <tr style={{ backgroundColor: 'rgba(30, 41, 59, 0.95)', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                                        <td className="p-3 pl-4 rounded-l-lg font-bold text-white shadow-sm" style={{ fontSize: '0.9rem' }}>
                                            전체 (Total)
                                        </td>
                                        {stats.idleStats.map(period => {
                                            const rate = parseFloat(period.totalIdleRate);
                                            let config = {
                                                bg: 'rgba(16, 185, 129, 0.12)',
                                                text: '#34d399',
                                                border: 'rgba(16, 185, 129, 0.25)',
                                                bar: '#10b981'
                                            };

                                            if (rate >= 20) {
                                                config = {
                                                    bg: 'rgba(239, 68, 68, 0.18)',
                                                    text: '#f87171',
                                                    border: 'rgba(239, 68, 68, 0.35)',
                                                    bar: '#ef4444'
                                                };
                                            } else if (rate >= 10) {
                                                config = {
                                                    bg: 'rgba(245, 158, 11, 0.15)',
                                                    text: '#fbbf24',
                                                    border: 'rgba(245, 158, 11, 0.3)',
                                                    bar: '#f59e0b'
                                                };
                                            }

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
                                                        <span style={{ fontSize: '0.95rem', fontWeight: 800, lineHeight: 1, marginBottom: '2px' }}>{rate}%</span>
                                                        <span style={{ fontSize: '0.72rem', opacity: 0.8, lineHeight: 1 }}>{period.totalIdleCount}명</span>
                                                        {/* Mini Progress Bar */}
                                                        <div style={{
                                                            position: 'absolute',
                                                            bottom: 0,
                                                            left: 0,
                                                            height: '3px',
                                                            width: `${Math.min(rate, 100)}%`,
                                                            backgroundColor: config.bar,
                                                            transition: 'width 0.5s ease'
                                                        }}></div>
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>

                                    {/* Group Rows */}
                                    {stats.idleStats[0]?.byGroup?.map((group) => (
                                        <tr key={group.id} className="group hover:bg-white/5 transition-colors duration-200">
                                            <td className="p-3 pl-4 rounded-l-lg text-gray-300 font-medium" style={{ fontSize: '0.85rem' }}>
                                                {group.name}
                                            </td>
                                            {stats.idleStats.map(period => {
                                                const groupData = period.byGroup.find(g => g.id === group.id);
                                                const count = groupData?.idleCount || 0;
                                                const rate = parseFloat(groupData?.idleRate || 0);

                                                let config = {
                                                    bg: 'rgba(16, 185, 129, 0.08)',
                                                    text: '#34d399',
                                                    border: 'rgba(16, 185, 129, 0.15)',
                                                    bar: '#10b981'
                                                };

                                                if (rate >= 20) {
                                                    config = {
                                                        bg: 'rgba(239, 68, 68, 0.12)',
                                                        text: '#f87171',
                                                        border: 'rgba(239, 68, 68, 0.2)',
                                                        bar: '#ef4444'
                                                    };
                                                } else if (rate >= 10) {
                                                    config = {
                                                        bg: 'rgba(245, 158, 11, 0.1)',
                                                        text: '#fbbf24',
                                                        border: 'rgba(245, 158, 11, 0.18)',
                                                        bar: '#f59e0b'
                                                    };
                                                }

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
                                                            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                                                                {rate}%
                                                            </span>
                                                            <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '1px' }}>
                                                                {count}명
                                                            </span>
                                                            {/* Mini Progress Bar */}
                                                            <div style={{
                                                                position: 'absolute',
                                                                bottom: 0,
                                                                left: 0,
                                                                height: '2px',
                                                                width: `${Math.min(rate, 100)}%`,
                                                                backgroundColor: config.bar,
                                                                opacity: 0.7
                                                            }}></div>
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-muted text-center py-4">데이터가 없습니다.</p>
                    )}
                </div>
            </div>

            {/* Charts Row 1: Interactive Donut Charts */}
            <div className="grid grid-2 mb-lg dashboard-grid">
                <div className="glass-card">
                    <div className="card-header border-0 pb-0 flex justify-between items-center">
                        <h3 className="card-title"><BilingualText className="text-gradient" en="Group Personnel Status" ko="그룹별 인원 현황" /></h3>
                        <button
                            className="btn btn-sm btn-outline-info"
                            style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                            onClick={() => setShowGroupTable(!showGroupTable)}
                        >
                            {showGroupTable ? '차트로 보기' : '표로 보기'}
                        </button>
                    </div>
                    <div className="card-body" style={{ height: '380px' }}>
                        {showGroupTable ? (
                            <div style={{ height: '100%', overflowY: 'auto' }}>
                                <table className="w-full text-left" style={{ borderCollapse: 'collapse', fontSize: '20px' }}>
                                    <thead className="bg-slate-800/50 text-slate-300 sticky top-0">
                                        <tr>
                                            <th className="p-4 border-b border-slate-700/50">그룹</th>
                                            <th className="p-4 border-b border-slate-700/50 text-center">정규직</th>
                                            <th className="p-4 border-b border-slate-700/50 text-center">계약직</th>
                                            <th className="p-4 border-b border-slate-700/50 text-center font-bold text-info">총 인원</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats?.employeesByGroup?.map((group, idx) => (
                                            <tr key={idx} className="border-b border-slate-700/30 hover:bg-white/5 transition-colors">
                                                <td className="p-4 font-medium flex items-center gap-2">
                                                    <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: group.color || COLORS[idx % COLORS.length] }}></span>
                                                    {group.name}
                                                </td>
                                                <td className="p-4 text-center text-slate-300">{group.regular_count || 0}</td>
                                                <td className="p-4 text-center text-slate-400">{group.contract_count || 0}</td>
                                                <td className="p-4 text-center font-bold text-info">{group.count}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-slate-800/80 sticky bottom-0" style={{ backdropFilter: 'blur(4px)' }}>
                                        <tr style={{ borderTop: '2px solid var(--primary)' }}>
                                            <td className="p-4 font-bold text-white">합계 (Total)</td>
                                            <td className="p-4 text-center font-bold text-white">
                                                {stats?.employeesByGroup?.reduce((sum, g) => sum + (g.regular_count || 0), 0)}
                                            </td>
                                            <td className="p-4 text-center font-bold text-white">
                                                {stats?.employeesByGroup?.reduce((sum, g) => sum + (g.contract_count || 0), 0)}
                                            </td>
                                            <td className="p-4 text-center font-bold text-primary" style={{ fontSize: '1.1em' }}>
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
                                            <tspan x="50%" dy="-10" fontSize="14" fill="#94a3b8">전체 인원</tspan>
                                            <tspan x="50%" dy="26" fontSize="28" fontWeight="bold" fill="#fff">{stats?.totalEmployees || 0}</tspan>
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
                        <h3 className="card-title"><BilingualText className="text-gradient" en="Employment Type" ko="고용 형태" /></h3>
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
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                                        <XAxis type="number" hide />
                                        <YAxis
                                            dataKey="name"
                                            type="category"
                                            stroke="#94A3B8"
                                            fontSize={12}
                                            width={100}
                                        />
                                        <Tooltip
                                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                            content={({ active, payload, label }) => {
                                                if (active && payload && payload.length) {
                                                    const dataItem = stats.groupWorkforceDetails.find(d => d.name === label);
                                                    return (
                                                        <div className="custom-tooltip glass-card p-3" style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(15, 23, 42, 0.95)', minWidth: '220px' }}>
                                                            <p className="font-bold mb-2 text-white text-lg">{label}</p>
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
                                                                            <div className="text-[11px] text-gray-300 pl-2 border-l-2" style={{ borderColor: entry.color, opacity: 0.8 }}>
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
                    <div className="card-body refined-scrollbar" style={{ height: '360px', overflowY: 'auto', padding: '0 1rem' }}>
                        {stats?.upcomingRolloffs?.length > 0 ? (
                            <table className="w-full text-left" style={{ borderCollapse: 'separate', borderSpacing: '0 4px' }}>
                                <thead>
                                    <tr>
                                        <th className="text-center text-muted text-[11px] font-bold uppercase tracking-widest pb-2" style={{ width: '16%' }}>이름</th>
                                        <th className="text-center text-muted text-[11px] font-bold uppercase tracking-widest pb-2" style={{ width: '10%' }}>소속</th>
                                        <th className="text-center text-muted text-[11px] font-bold uppercase tracking-widest pb-2" style={{ width: '10%' }}>고용</th>
                                        <th className="text-center text-muted text-[11px] font-bold uppercase tracking-widest pb-2" style={{ width: '44%' }}>프로젝트</th>
                                        <th className="text-center text-muted text-[11px] font-bold uppercase tracking-widest pb-2" style={{ width: '20%' }}>종료일</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.upcomingRolloffs.map((item, index) => {
                                        const today = new Date();
                                        const endDate = new Date(item.input_end_date);
                                        const diffTime = endDate - today;
                                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                                        return (
                                            <tr key={index} className="hover:bg-white/5 transition-colors duration-200">
                                                <td className="py-1 px-2 pl-4 rounded-l-lg text-center">
                                                    <div className="font-weight-600 text-white text-sm whitespace-nowrap">
                                                        {item.employee_name} <span className="text-xs text-muted font-normal ml-1">{item.position}</span>
                                                    </div>
                                                </td>
                                                <td className="py-1 px-2 text-center">
                                                    <span className="badge" style={{ backgroundColor: `${item.group_color}15`, color: item.group_color, fontSize: '11px', padding: '2px 8px' }}>
                                                        {item.group_name}
                                                    </span>
                                                </td>
                                                <td className="py-1 px-2 text-sm text-center whitespace-nowrap">
                                                    <span style={{
                                                        color: item.employment_type === '정규직' ? '#60A5FA' : (item.employment_type === '계약직' ? '#FBBF24' : '#94A3B8'),
                                                        fontWeight: (item.employment_type === '정규직' || item.employment_type === '계약직') ? '600' : 'normal'
                                                    }}>
                                                        {item.employment_type || '-'}
                                                    </span>
                                                </td>
                                                <td className="py-1 px-2 text-center">
                                                    <div className="text-sm text-gray-300 font-medium truncate mx-auto" style={{ maxWidth: '320px' }} title={item.project_name}>
                                                        {item.project_name}
                                                    </div>
                                                </td>
                                                <td className="py-1 px-2 pr-4 rounded-r-lg text-center whitespace-nowrap">

                                                    <div className="flex items-center justify-center" style={{ gap: '12px' }}>
                                                        <div className="text-xs text-info font-bold">{item.input_end_date}</div>
                                                        <span className={`badge ${diffDays <= 7 ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '10px', padding: '2px 6px' }}>
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
                                en={`Bench / Low Utilization (${stats?.benchList?.length || 0})`}
                                ko={`유휴 인력 현황 (Bench) - ${stats?.benchList?.length || 0}명`}
                            />
                        </h3>
                    </div>
                    <div className="card-body refined-scrollbar" style={{ height: '360px', overflowY: 'auto', padding: '0 1rem' }}>
                        {stats?.benchList?.length > 0 ? (
                            <table className="w-full text-left" style={{ borderCollapse: 'separate', borderSpacing: '0 4px' }}>
                                <thead>
                                    <tr>
                                        <th
                                            className="text-center text-muted text-[11px] font-bold uppercase tracking-widest pb-2 cursor-pointer hover:text-white transition-colors"
                                            onClick={() => handleBenchSort('name')}
                                            style={{ width: '22%' }}
                                        >
                                            이름 {benchSort.key === 'name' && (benchSort.direction === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th
                                            className="text-center text-muted text-[11px] font-bold uppercase tracking-widest pb-2 cursor-pointer hover:text-white transition-colors"
                                            onClick={() => handleBenchSort('group_name')}
                                            style={{ width: '18%' }}
                                        >
                                            소속 {benchSort.key === 'group_name' && (benchSort.direction === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th
                                            className="text-center text-muted text-[11px] font-bold uppercase tracking-widest pb-2 cursor-pointer hover:text-white transition-colors"
                                            onClick={() => handleBenchSort('employment_type')}
                                            style={{ width: '18%' }}
                                        >
                                            고용 {benchSort.key === 'employment_type' && (benchSort.direction === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th
                                            className="text-center text-muted text-[11px] font-bold uppercase tracking-widest pb-2 cursor-pointer hover:text-white transition-colors"
                                            onClick={() => handleBenchSort('skill_level')}
                                            style={{ width: '22%' }}
                                        >
                                            등급 {benchSort.key === 'skill_level' && (benchSort.direction === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th
                                            className="text-center text-muted text-[11px] font-bold uppercase tracking-widest pb-2 cursor-pointer hover:text-white transition-colors"
                                            onClick={() => handleBenchSort('status')}
                                            style={{ width: '20%' }}
                                        >
                                            상태 {benchSort.key === 'status' && (benchSort.direction === 'asc' ? '↑' : '↓')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedBenchList.map((item, index) => (
                                        <tr key={index} className="hover:bg-white/5 transition-colors duration-200">
                                            <td className="py-1 px-2 pl-4 rounded-l-lg text-center">
                                                <div className="font-weight-600 text-white text-sm">
                                                    {item.name} <span className="text-xs text-muted font-normal ml-1">{item.position}</span>
                                                </div>
                                            </td>
                                            <td className="py-1 px-2 text-center">
                                                <span className="badge" style={{ backgroundColor: `${item.group_color}15`, color: item.group_color, fontSize: '11px', padding: '4px 8px' }}>{item.group_name}</span>
                                            </td>
                                            <td className="py-1 px-2 text-sm text-center whitespace-nowrap">
                                                <span style={{
                                                    color: item.employment_type === '정규직' ? '#60A5FA' : (item.employment_type === '계약직' ? '#FBBF24' : '#94A3B8'),
                                                    fontWeight: (item.employment_type === '정규직' || item.employment_type === '계약직') ? '600' : 'normal'
                                                }}>
                                                    {item.employment_type || '-'}
                                                </span>
                                            </td>
                                            <td className="py-1 px-2 text-center">
                                                <span
                                                    className="font-bold px-2 py-1 rounded text-[12px]"
                                                    style={getSkillStyle(item.skill_level)}
                                                >
                                                    {item.skill_level || '-'}
                                                </span>
                                            </td>
                                            <td className="py-1 px-2 pr-4 text-center rounded-r-lg">
                                                {item.leave_status && (
                                                    <span className="badge badge-warning" style={{ fontSize: '11px', padding: '2px 8px' }}>
                                                        {item.leave_status}
                                                    </span>
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
