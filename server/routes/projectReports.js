import express from 'express';
import { query, run, get } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// mysql2 auto-parses JSON columns, so handle both object and string cases
const parseDataJson = (raw) => {
    if (!raw) return null;
    if (typeof raw === 'string') {
        try { return JSON.parse(raw); } catch { return null; }
    }
    return raw; // already an object
};

// Get report for a specific date
router.get('/:date', authenticateToken, async (req, res) => {
    try {
        const { date } = req.params;
        const { role, name } = req.user;
        const report = await get('SELECT * FROM project_reports WHERE week_date = ?', [date]);
        
        if (report) {
            let data = parseDataJson(report.data_json);

            // If not Admin and not report_admin, filter rows to only show those owned by the user (PD or PM)
            const isReportAdmin = role === 'Admin' || (req.user.permissions && req.user.permissions.report_admin === true);
            if (!isReportAdmin) {
                const rows = Array.isArray(data) ? data : (data.rows || []);
                const filteredRows = rows.filter(row => {
                    const pdVal = String(row.pd || '').trim();
                    const pmVal = String(row.pm || '').trim();
                    const userName = String(name || '').trim();
                    return pdVal === userName || pmVal === userName;
                });

                if (Array.isArray(data)) {
                    data = filteredRows;
                } else {
                    data = { ...data, rows: filteredRows };
                }
            }
            
            res.json(data);
        } else {
            res.json([]);
        }
    } catch (error) {
        console.error('Error fetching project report:', error);
        res.status(500).json({ message: 'Error fetching report' });
    }
});

// Save report for a specific date (with Merge Logic for PD/PM)
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { week_date, data } = req.body;
        const { role, name: userName } = req.user;

        if (!week_date || !data) {
            return res.status(400).json({ message: 'Missing date or data' });
        }

        let incomingRows = Array.isArray(data) ? data : (data.rows || []);
        let finalData = data;

        // Merge logic for non-report-admin users to prevent data loss of other users' projects
        const isReportAdmin = role === 'Admin' || (req.user.permissions && req.user.permissions.report_admin === true);
        if (!isReportAdmin) {
            const existingReport = await get('SELECT * FROM project_reports WHERE week_date = ?', [week_date]);
            let existingRows = [];

            if (existingReport) {
                const parsedExisting = parseDataJson(existingReport.data_json);
                existingRows = Array.isArray(parsedExisting) ? parsedExisting : (parsedExisting.rows || []);
            }

            // 1. Identify rows in existing data that do NOT belong to the current user
            const otherUsersRows = existingRows.filter(row => {
                const pdVal = String(row.pd || '').trim();
                const pmVal = String(row.pm || '').trim();
                const normalizedUser = String(userName || '').trim();
                return pdVal !== normalizedUser && pmVal !== normalizedUser;
            });

            // 2. Identify rows in incoming data that DO belong to the current user
            const myIncomingRows = incomingRows.filter(row => {
                const pdVal = String(row.pd || '').trim();
                const pmVal = String(row.pm || '').trim();
                const normalizedUser = String(userName || '').trim();
                return pdVal === normalizedUser || pmVal === normalizedUser;
            });

            // 3. Combine them
            const mergedRows = [...otherUsersRows, ...myIncomingRows];

            if (Array.isArray(data)) {
                finalData = mergedRows;
            } else {
                finalData = {
                    ...data,
                    rows: mergedRows
                };
            }
        }

        const dataJson = JSON.stringify(finalData);
        
        await run(
            `INSERT INTO project_reports (week_date, data_json, updated_at)
             VALUES (?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT (week_date)
             DO UPDATE SET data_json = EXCLUDED.data_json, updated_at = CURRENT_TIMESTAMP`,
            [week_date, dataJson]
        );
        
        res.json({ message: 'Report saved successfully' });
    } catch (error) {
        console.error('Error saving project report:', error);
        res.status(500).json({ message: 'Error saving report' });
    }
});

// Update column widths for ALL reports
router.post('/update-all-column-widths', authenticateToken, async (req, res) => {
    try {
        const { columnWidths } = req.body;
        if (!columnWidths) {
            return res.status(400).json({ message: 'Missing columnWidths' });
        }

        const allReports = await query('SELECT * FROM project_reports');
        
        for (const report of allReports) {
            let data = parseDataJson(report.data_json);
            
            if (Array.isArray(data)) {
                // Migrate legacy array to new object format
                data = {
                    rows: data,
                    columnWidths: columnWidths
                };
            } else {
                // Update existing object's columnWidths
                data.columnWidths = columnWidths;
            }
            
            await run(
                'UPDATE project_reports SET data_json = ?, updated_at = CURRENT_TIMESTAMP WHERE week_date = ?',
                [JSON.stringify(data), report.week_date]
            );
        }

        res.json({ message: `Successfully updated column widths for ${allReports.length} reports.` });
    } catch (error) {
        console.error('Error updating all column widths:', error);
        res.status(500).json({ message: 'Error updating column widths' });
    }
});

// Global Metadata Sync: Update a specific field for a project across ALL weekly reports
router.post('/sync-project-field', authenticateToken, async (req, res) => {
    try {
        const { projectName, field, value } = req.body;
        if (!projectName || !field) {
            return res.status(400).json({ message: 'Missing projectName or field' });
        }

        // 1. Update Projects Master Table if field matches
        // Map UI keys to DB columns
        const dbFieldMap = {
            'pd': 'pd',
            'pm': 'pm',
            'kickoff': 'start_date',
            'rfpinfo': 'end_date',
            'status': 'status'
        };

        const dbColumn = dbFieldMap[field.toLowerCase()];
        if (dbColumn) {
            await run(`UPDATE projects SET ${dbColumn} = ? WHERE name = ?`, [value, projectName]);
        }

        // 2. Update ALL Project Reports
        const allReports = await query('SELECT * FROM project_reports');
        let updateCount = 0;

        for (const report of allReports) {
            let data = parseDataJson(report.data_json);
            let rows = Array.isArray(data) ? data : (data.rows || []);
            let modified = false;

            rows = rows.map(row => {
                if (row.projectName && row.projectName.trim() === projectName.trim()) {
                    if (row[field] !== value) {
                        modified = true;
                        return { ...row, [field]: value };
                    }
                }
                return row;
            });

            if (modified) {
                if (Array.isArray(data)) {
                    data = rows;
                } else {
                    data.rows = rows;
                }

                await run(
                    'UPDATE project_reports SET data_json = ?, updated_at = CURRENT_TIMESTAMP WHERE week_date = ?',
                    [JSON.stringify(data), report.week_date]
                );
                updateCount++;
            }
        }

        res.json({ message: `Successfully synced '${field}' for project '${projectName}' across ${updateCount} weeks.` });
    } catch (error) {
        console.error('Error syncing project field:', error);
        res.status(500).json({ message: 'Error syncing project field' });
    }
});

export default router;
