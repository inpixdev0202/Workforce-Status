import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { format, startOfWeek, endOfWeek, addWeeks, startOfMonth, endOfMonth, addMonths, eachDayOfInterval, isWeekend, addDays } from 'date-fns';
import { initializeDatabase, query, get } from './db.js';
import groupsRouter from './routes/groups.js';
import employeesRouter from './routes/employees.js';
import attendanceRouter from './routes/attendance.js';
import projectsRouter from './routes/projects.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import integrationsRouter from './routes/integrations.js';
import projectReportsRouter from './routes/projectReports.js';
import salesRouter from './routes/sales.js';
import { authenticateToken } from './middleware/auth.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(async (req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Initialize database
await initializeDatabase();

// Public API Routes
app.use('/api/auth', authRouter);

// Apply Authentication Middleware to all following API routes
app.use('/api', authenticateToken);

// Protected API Routes
app.use('/api/users', usersRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/integrations', integrationsRouter);
app.use('/api/project-reports', projectReportsRouter);
app.use('/api/sales', salesRouter);

// Health check
app.get('/api/health', async (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'connected'
    });
});

let dashboardStatsCache = { data: null, timestamp: 0 };
const DASHBOARD_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Dashboard statistics
app.get('/api/dashboard/stats', async (req, res) => {
    try {
        if (dashboardStatsCache.data && (Date.now() - dashboardStatsCache.timestamp < DASHBOARD_CACHE_TTL)) {
            console.log('Serving dashboard stats from cache');
            return res.json(dashboardStatsCache.data);
        }

        // Dynamic import to ensure module is loaded
        const { startOfWeek, endOfWeek, addWeeks, startOfMonth, endOfMonth, addMonths, format, eachDayOfInterval, isWeekend, parseISO } = await import('date-fns');

        const now = new Date();
        const todayStr = format(now, 'yyyy-MM-dd');
        const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
        const rangeStart = format(thisWeekStart, 'yyyy-MM-dd');
        const rangeEnd = format(addWeeks(thisWeekStart, 16), 'yyyy-MM-dd');

        const [
            totalEmployeesResult,
            totalGroupsResult,
            totalAssignmentsResult,
            employmentStatus,
            skillLevelStatus,
            workLocationStatus,
            employees,
            groups,
            allAllocations,
            allAssignmentsResult
        ] = await Promise.all([
            get("SELECT COUNT(*) as count FROM employees WHERE status = 'active' AND (exclude_from_stats IS NULL OR exclude_from_stats = 0)"),
            get('SELECT COUNT(*) as count FROM groups'),
            get(`
                SELECT COUNT(DISTINCT pa.employee_id) as count 
                FROM project_assignments pa
                JOIN projects p ON pa.project_id = p.id
                WHERE (p.status = 'active' OR p.status = '진행중')
                  AND (pa.input_start_date <= ? OR pa.input_start_date IS NULL)
                  AND (pa.input_end_date >= ? OR pa.input_end_date IS NULL)
                  AND (LOWER(p.type) = 'client' OR p.type = '수행')
            `, [todayStr, todayStr]),
            query("SELECT employment_type, COUNT(*) as count FROM employees WHERE status = 'active' AND (exclude_from_stats IS NULL OR exclude_from_stats = 0) GROUP BY employment_type"),
            query("SELECT skill_level, COUNT(*) as count FROM employees WHERE status = 'active' AND (exclude_from_stats IS NULL OR exclude_from_stats = 0) GROUP BY skill_level"),
            query(`
                SELECT pa.work_location, COUNT(*) as count
                FROM project_assignments pa
                JOIN projects p ON pa.project_id = p.id
                WHERE p.status = 'active' 
                  AND (pa.input_end_date >= ? OR pa.input_end_date IS NULL)
                  AND (pa.input_start_date <= ? OR pa.input_start_date IS NULL)
                GROUP BY pa.work_location
            `, [todayStr, todayStr]),
            query("SELECT id, group_id, name, employment_type FROM employees WHERE status = 'active' AND (exclude_from_stats IS NULL OR exclude_from_stats = 0)"),
            query("SELECT id, name FROM groups"),
            query(`
                SELECT pa.assignment_id, pa.period_date, pa.value, e.id as employee_id, e.group_id, p.type as project_type
                FROM project_allocations pa
                JOIN project_assignments pass ON pa.assignment_id = pass.id
                JOIN projects p ON pass.project_id = p.id
                JOIN employees e ON pass.employee_id = e.id
                WHERE pa.period_date BETWEEN ? AND ? 
                  AND (e.status = 'active' OR e.retirement_date >= ?)
                  AND (e.retirement_date >= ? OR e.retirement_date IS NULL)
            `, [rangeStart, rangeEnd, rangeStart, rangeStart]),
            query("SELECT DISTINCT employee_id FROM project_assignments")
        ]);

        const groupMap = groups.reduce((acc, g) => ({ ...acc, [g.id]: g.name }), {});

        // Helper to get formatted date strings for a range excluding weekends
        const getWorkingDays = (start, end) => {
            const days = eachDayOfInterval({ start, end });
            return days.filter(d => !isWeekend(d)).map(d => format(d, 'yyyy-MM-dd'));
        };

        const periods = [
            { key: 'thisWeek', label: '이번 주', type: 'week', weeks: [thisWeekStart] },
            { key: 'nextWeek', label: '다음 주', type: 'week', weeks: [addWeeks(thisWeekStart, 1)] },
            { key: 'thisMonth', label: '이번 달', type: 'month', weeks: [thisWeekStart, addWeeks(thisWeekStart, 1), addWeeks(thisWeekStart, 2), addWeeks(thisWeekStart, 3)] },
            { key: 'month1', label: '+1개월', type: 'month', weeks: [addWeeks(thisWeekStart, 4), addWeeks(thisWeekStart, 5), addWeeks(thisWeekStart, 6), addWeeks(thisWeekStart, 7)] },
            { key: 'month2', label: '+2개월', type: 'month', weeks: [addWeeks(thisWeekStart, 8), addWeeks(thisWeekStart, 9), addWeeks(thisWeekStart, 10), addWeeks(thisWeekStart, 11)] },
            { key: 'month3', label: '+3개월', type: 'month', weeks: [addWeeks(thisWeekStart, 12), addWeeks(thisWeekStart, 13), addWeeks(thisWeekStart, 14), addWeeks(thisWeekStart, 15)] }
        ];

        // Build a map of employee allocations
        const allocMap = {};
        const leaveAllocMap = {};
        allAllocations.forEach(row => {
            if (!allocMap[row.employee_id]) allocMap[row.employee_id] = {};
            if (!allocMap[row.employee_id][row.period_date]) allocMap[row.employee_id][row.period_date] = 0;
            allocMap[row.employee_id][row.period_date] += parseFloat(row.value);

            if (row.project_type === 'Leave') {
                if (!leaveAllocMap[row.employee_id]) leaveAllocMap[row.employee_id] = {};
                if (!leaveAllocMap[row.employee_id][row.period_date]) leaveAllocMap[row.employee_id][row.period_date] = 0;
                leaveAllocMap[row.employee_id][row.period_date] += parseFloat(row.value);
            }
        });

        const assignedEmpSet = new Set(allAssignmentsResult.map(r => r.employee_id));

        // Precalculate Regular Employee base per group
        const groupRegulars = {};
        groups.forEach(g => {
            const regularsInGroup = employees.filter(e =>
                e.group_id === g.id &&
                (e.employment_type === 'Regular' || e.employment_type === '정규직' || e.employment_type === 'Permanent') &&
                assignedEmpSet.has(e.id)
            );
            groupRegulars[g.id] = regularsInGroup;
        });

        // Calculate Stats for each Period
        const idleStats = periods.map(period => {
            const totalWeeklyZeroCounts = [];
            const totalWeeklyHeadcounts = [];
            const groupWeeklyZeroCounts = {};
            const groupWeeklyHeadcounts = {};
            groups.forEach(g => {
                groupWeeklyZeroCounts[g.id] = [];
                groupWeeklyHeadcounts[g.id] = [];
            });

            period.weeks.forEach(weekStart => {
                const weekEnd = addDays(weekStart, 4); // Mon to Fri
                const workingDays = getWorkingDays(weekStart, weekEnd);

                let weeklyGlobalZero = 0;
                let weeklyGlobalHeadcount = 0;

                groups.forEach(g => {
                    const regulars = groupRegulars[g.id] || [];
                    let weeklyGroupZero = 0;
                    let weeklyGroupHeadcount = 0;

                    regulars.forEach(emp => {
                        // Dynamic check: Exclude if retired as of this week
                        if (emp.retirement_date && weekStart > new Date(emp.retirement_date)) {
                            return;
                        }

                        let totalMMForWeek = 0;
                        let leaveMMForWeek = 0;
                        workingDays.forEach(dateStr => {
                            totalMMForWeek += (allocMap[emp.id]?.[dateStr] || 0);
                            leaveMMForWeek += (leaveAllocMap[emp.id]?.[dateStr] || 0);
                        });

                        // Make headcount dynamic: exclude from idle stat denominator if on leave
                        if (leaveMMForWeek >= 0.1) {
                            return;
                        }

                        weeklyGroupHeadcount++;
                        weeklyGlobalHeadcount++;

                        // Logic exactly matches ProjectStatus.jsx
                        if (totalMMForWeek < 0.1) {
                            weeklyGroupZero++;
                            weeklyGlobalZero++;
                        }
                    });

                    groupWeeklyZeroCounts[g.id].push(weeklyGroupZero);
                    groupWeeklyHeadcounts[g.id].push(weeklyGroupHeadcount);
                });

                totalWeeklyZeroCounts.push(weeklyGlobalZero);
                totalWeeklyHeadcounts.push(weeklyGlobalHeadcount);
            });

            // Averages across the mapped weeks
            const numWeeks = period.weeks.length || 1;
            const avgTotalIdle = totalWeeklyZeroCounts.reduce((a, b) => a + b, 0) / numWeeks;
            const avgTotalHeadcount = totalWeeklyHeadcounts.reduce((a, b) => a + b, 0) / numWeeks;
            const totalIdleRate = avgTotalHeadcount > 0 ? (avgTotalIdle / avgTotalHeadcount) * 100 : 0;

            const byGroup = groups.map(g => {
                const avgGroupIdle = groupWeeklyZeroCounts[g.id].reduce((a, b) => a + b, 0) / numWeeks;
                const avgGroupHeadcount = groupWeeklyHeadcounts[g.id].reduce((a, b) => a + b, 0) / numWeeks;
                const groupIdleRate = avgGroupHeadcount > 0 ? (avgGroupIdle / avgGroupHeadcount) * 100 : 0;

                return {
                    id: g.id,
                    name: g.name,
                    idleCount: Math.round(avgGroupIdle),
                    idleRate: Math.max(0, groupIdleRate).toFixed(1)
                };
            });

            return {
                key: period.key,
                label: period.label,
                totalIdleCount: Math.round(avgTotalIdle),
                totalIdleRate: Math.max(0, totalIdleRate).toFixed(1),
                byGroup: byGroup
            };
        });

        // 4. Monthly Trend (Legacy support or enhanced)
        const monthlyTrend = [];
        const chartStart = new Date();
        chartStart.setDate(1);

        const monthPromises = Array.from({ length: 12 }).map(async (_, index) => {
            const i = index - 6; // -6 to 5
            const d = new Date(chartStart);
            d.setMonth(d.getMonth() + i);
            const yearMonth = d.toISOString().slice(0, 7);
            const label = `${d.getMonth() + 1}월`;

            const safeEndOfMonth = format(endOfMonth(new Date(`${yearMonth}-01T00:00:00`)), 'yyyy-MM-dd');

            // Fetch demand and supply concurrently
            const [demandResult, supplyStats] = await Promise.all([
                query(`
                    SELECT p.type, SUM(pa.value) as total_mm 
                    FROM project_allocations pa
                    JOIN project_assignments pas ON pa.assignment_id = pas.id
                    JOIN projects p ON pas.project_id = p.id
                    WHERE pa.period_date::TEXT LIKE ?
                    GROUP BY p.type
                `, [`${yearMonth}%`]),
                query(`
                    SELECT employment_type, COUNT(*) as count 
                    FROM employees 
                    WHERE status = 'active' AND (exclude_from_stats IS NULL OR exclude_from_stats = 0) 
                      AND created_at <= ? 
                      AND (retirement_date > ? OR retirement_date IS NULL)
                    GROUP BY employment_type
                `, [safeEndOfMonth, `${yearMonth}-01`])
            ]);

            let clientMM = 0;
            let internalMM = 0;
            let leaveMM = 0;

            demandResult.forEach(row => {
                const type = row.type || 'Client'; // Default to Client
                const val = parseFloat(row.total_mm) || 0;
                if (type === 'Client') clientMM += val;
                else if (type === 'Internal' || type === 'Bench' || type === 'Annual') internalMM += val;
                else if (type === 'Leave') leaveMM += val;
                else clientMM += val; // Default others to client or treat as internal
            });

            let regularCount = 0;
            let contractorCount = 0;
            supplyStats.forEach(stat => {
                const type = stat.employment_type || '';
                const countVal = parseInt(stat.count, 10) || 0;
                
                if (['Regular', '정규직', 'Permanent'].includes(type) || !type) {
                    if (type === 'Regular' || type === '정규직' || type === 'Permanent') {
                        regularCount += countVal;
                    } else {
                        contractorCount += countVal;
                    }
                } else {
                    contractorCount += countVal;
                }
            });

            return {
                name: label,
                yearMonth: yearMonth,
                demand: parseFloat((clientMM / 4).toFixed(1)).toFixed(1), // Billable Demand (FTE)
                client: (clientMM / 4).toFixed(1),
                internal: (internalMM / 4).toFixed(1),
                leave: (leaveMM / 4).toFixed(1),
                totalUsage: ((clientMM + internalMM + leaveMM) / 4).toFixed(1),
                regular: regularCount,
                contractor: contractorCount,
                supply: regularCount + contractorCount,
                sortIndex: i
            };
        });

        const unorderedTrend = await Promise.all(monthPromises);
        unorderedTrend.sort((a, b) => a.sortIndex - b.sortIndex);
        unorderedTrend.forEach(item => {
            delete item.sortIndex;
            monthlyTrend.push(item);
        });

        // 5. Rest of Data
        const next30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const [
            rawEmployeesByGroup,
            recentEmployees,
            upcomingRolloffs,
            benchList
        ] = await Promise.all([
            query(`
                SELECT 
                    g.name, 
                    g.color, 
                    COUNT(e.id) as count,
                    SUM(CASE WHEN e.employment_type IN ('Regular', '정규직', 'Permanent') THEN 1 ELSE 0 END) as regular_count,
                    SUM(CASE WHEN e.employment_type NOT IN ('Regular', '정규직', 'Permanent') OR e.employment_type IS NULL THEN 1 ELSE 0 END) as contract_count
                FROM groups g 
                LEFT JOIN employees e ON g.id = e.group_id AND (e.status = 'active' OR (e.retirement_date >= ?)) AND (e.exclude_from_stats IS NULL OR e.exclude_from_stats = 0)
                GROUP BY g.id 
                ORDER BY g.display_order
            `, [todayStr]),
            query("SELECT e.*, g.name as group_name, g.color as group_color FROM employees e LEFT JOIN groups g ON e.group_id = g.id WHERE (e.status = 'active' OR (e.retirement_date >= ?)) AND (e.exclude_from_stats IS NULL OR e.exclude_from_stats = 0) ORDER BY e.created_at DESC LIMIT 5", [todayStr]),
            query(`
                SELECT e.name as employee_name, e.position, e.employment_type, g.name as group_name, g.color as group_color, p.name as project_name, pa.input_end_date
                FROM project_assignments pa JOIN employees e ON pa.employee_id = e.id LEFT JOIN groups g ON e.group_id = g.id JOIN projects p ON pa.project_id = p.id
                WHERE pa.input_end_date BETWEEN ? AND ? 
                  AND (e.exclude_from_stats IS NULL OR e.exclude_from_stats = 0)
                ORDER BY pa.input_end_date ASC
            `, [todayStr, next30Days]),
            query(`
                SELECT DISTINCT e.id, e.name, e.position, e.skill_level, e.employment_type, g.name as group_name, g.color as group_color,
                (SELECT p.name FROM project_assignments pa JOIN projects p ON pa.project_id = p.id 
                 WHERE pa.employee_id = e.id AND (pa.input_end_date >= ? OR pa.input_end_date IS NULL) 
                 AND (pa.input_start_date <= ? OR pa.input_start_date IS NULL) AND p.type = 'Leave' 
                 ORDER BY pa.input_start_date DESC LIMIT 1) as leave_status
                FROM employees e 
                LEFT JOIN groups g ON e.group_id = g.id
                WHERE (e.status = 'active' OR e.retirement_date >= ?)
                  AND (e.retirement_date >= ? OR e.retirement_date IS NULL)
                  AND e.employment_type IN ('Regular', '정규직', 'Permanent')
                  AND e.id NOT IN (
                    SELECT employee_id 
                    FROM project_assignments pa
                    JOIN projects p ON pa.project_id = p.id
                    WHERE (pa.input_end_date >= ? OR pa.input_end_date IS NULL) 
                      AND (pa.input_start_date <= ? OR pa.input_start_date IS NULL)
                      AND (LOWER(p.type) = 'client' OR p.type = '수행')
                )
                AND (e.exclude_from_stats IS NULL OR e.exclude_from_stats = 0)
            `, [todayStr, todayStr, todayStr, todayStr, todayStr, todayStr])
        ]);

        const employeesByGroup = rawEmployeesByGroup.map(g => ({
            ...g,
            count: parseInt(g.count, 10) || 0,
            regular_count: parseInt(g.regular_count, 10) || 0,
            contract_count: parseInt(g.contract_count, 10) || 0
        }));

        // Calculate Group Workforce Detail (Stacked Bar Chart Data)
        const groupWorkforceDetails = await Promise.all(groups.map(async g => {
            const groupEmployees = await query(`
                SELECT e.id, e.name, e.employment_type, e.exclude_from_stats,
                (SELECT p.type FROM project_assignments pa JOIN projects p ON pa.project_id = p.id 
                 WHERE pa.employee_id = e.id AND (pa.input_end_date >= ? OR pa.input_end_date IS NULL) 
                 AND (pa.input_start_date <= ? OR pa.input_start_date IS NULL) 
                 ORDER BY CASE p.type WHEN 'Client' THEN 1 WHEN 'Leave' THEN 2 WHEN 'Internal' THEN 3 WHEN 'Bench' THEN 4 WHEN 'Annual' THEN 5 ELSE 6 END, pa.input_start_date DESC LIMIT 1) as current_project_type
                FROM employees e
                WHERE e.group_id = ? AND (e.status = 'active' OR e.retirement_date >= ?) AND (e.retirement_date >= ? OR e.retirement_date IS NULL)
            `, [todayStr, todayStr, g.id, todayStr, todayStr]);

            let client = 0;
            let bench = 0;
            let other = 0;
            let benchNames = [];
            let otherNames = [];

            groupEmployees.forEach(emp => {
                const isRegular = ['Regular', '정규직', 'Permanent'].includes(emp.employment_type);
                const isExcluded = !!emp.exclude_from_stats;
                const projectType = emp.current_project_type;

                // Skip Ghost Employees entirely (to perfectly match ProjectStatus.jsx headcount logic)
                if (isRegular && !assignedEmpSet.has(emp.id)) {
                    return;
                }

                if (isExcluded) {
                    if (isRegular) {
                        other++;
                        otherNames.push(`${emp.name} (제외됨)`);
                    }
                } else if (projectType === 'Client') {
                    client++;
                } else if (projectType === 'Leave') {
                    if (isRegular) {
                        other++;
                        otherNames.push(`${emp.name} (휴직)`);
                    }
                } else if (isRegular && (!projectType || ['Internal', 'Bench', 'Annual'].includes(projectType))) {
                    bench++;
                    benchNames.push(emp.name);
                } else {
                    // This block captures Non-Regulars Not in Client projects,
                    // and Non-Regulars in Internal/Bench/Annual projects.
                    // User requested to exclude non-regulars from 'Other'.
                }
            });

            return {
                name: g.name,
                client,
                bench,
                other,
                benchNames,
                otherNames
            };
        }));

        const finalResult = {
            totalEmployees: totalEmployeesResult?.count || 0,
            totalGroups: totalGroupsResult?.count || 0,
            totalAssignments: totalAssignmentsResult?.count || 0,
            employeesByGroup,
            recentEmployees,
            upcomingRolloffs,
            benchList,
            groupWorkforceDetails,
            employmentStatus,
            skillLevelStatus,
            workLocationStatus,
            monthlyTrend,
            idleStats // New detailed stats
        };

        dashboardStatsCache.data = finalResult;
        dashboardStatsCache.timestamp = Date.now();

        res.json(finalResult);

    } catch (error) {
        console.error('Stats Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use(async (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start server only if not in Vercel Serverless environment
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`
╔════════════════════════════════════════════╗
║   Workforce Status Management System      ║
║   Server running on port ${PORT}            ║
║   Environment: ${process.env.NODE_ENV || 'development'}           ║
╚════════════════════════════════════════════╝
      `);
    });
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    process.exit(0);
});

export default app;
