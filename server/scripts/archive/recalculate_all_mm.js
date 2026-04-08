
import { getDB, saveDatabase, initializeDatabase, query, run } from './db.js';
import { addDays, format, parseISO, startOfWeek, eachWeekOfInterval } from 'date-fns';

// Helper duplicated from client/src/components/ProjectStatus.jsx
const calculateWeeklyMM = (weekStart, projectStart, projectEnd) => {
    let workingDays = 0;
    // projectStart/End are already Date objects or strings we can parse
    const pStart = typeof projectStart === 'string' ? parseISO(projectStart) : projectStart;
    const pEnd = typeof projectEnd === 'string' ? parseISO(projectEnd) : projectEnd;

    // Check Mon(0) to Fri(4) relative to weekStart
    for (let i = 0; i < 5; i++) {
        const day = addDays(weekStart, i);
        // Set time to 0 for accurate date comparison
        day.setHours(0, 0, 0, 0);
        const dayTime = day.getTime();

        const pStartTime = new Date(pStart).setHours(0, 0, 0, 0);
        const pEndTime = new Date(pEnd).setHours(0, 0, 0, 0);

        // Check if day is within project range (inclusive)
        if (dayTime >= pStartTime && dayTime <= pEndTime) {
            workingDays++;
        }
    }

    return (workingDays * 0.2).toFixed(1);
};

async function recalculateAll() {
    await initializeDatabase();
    const db = await getDB();

    console.log('--- STARTING BULK RECALCULATION ---');

    // 1. Get all assignments with dates
    const assignments = query(`
        SELECT id, input_start_date, input_end_date 
        FROM project_assignments 
        WHERE input_start_date IS NOT NULL AND input_end_date IS NOT NULL
    `);

    console.log(`Found ${assignments.length} assignments to process.`);

    let totalUpdates = 0;
    const allUpdates = [];

    for (const assign of assignments) {
        try {
            if (!assign.input_start_date || !assign.input_end_date) continue;

            const startD = parseISO(assign.input_start_date);
            const endD = parseISO(assign.input_end_date);

            if (isNaN(startD.getTime()) || isNaN(endD.getTime()) || startD > endD) {
                console.log(`Skipping invalid dates for ID ${assign.id}`);
                continue;
            }

            // Generate all weeks for this project
            const start = startOfWeek(startD, { weekStartsOn: 1 });
            const allProjectWeeks = eachWeekOfInterval({ start, end: endD }, { weekStartsOn: 1 });

            for (const week of allProjectWeeks) {
                const dateStr = format(week, 'yyyy-MM-dd');
                const calculatedMM = calculateWeeklyMM(week, startD, endD);

                if (parseFloat(calculatedMM) > 0) {
                    allUpdates.push({
                        assignment_id: assign.id,
                        period_date: dateStr,
                        value: calculatedMM
                    });
                }
            }
        } catch (error) {
            console.error(`Error processing assignment ${assign.id}:`, error.message);
        }
    }

    console.log(`Calculated ${allUpdates.length} expected allocations.`);

    // 2. Perform Batch Update
    // We will use REPLACE logic or similar. To be safe/fast, we can delete old within range and insert new?
    // Or just iterate and update if different.

    run('BEGIN TRANSACTION');
    try {
        for (const update of allUpdates) {
            // Check existing
            const existing = query(
                'SELECT id, value FROM project_allocations WHERE assignment_id = ? AND period_date = ?',
                [update.assignment_id, update.period_date]
            )[0];

            if (existing) {
                // Update only if different
                // Convert to fixed(1) for comparison
                const currentVal = parseFloat(existing.value || 0).toFixed(1);
                const newVal = parseFloat(update.value).toFixed(1);

                if (currentVal !== newVal) {
                    run('UPDATE project_allocations SET value = ? WHERE id = ?', [update.value, existing.id]);
                    // console.log(`Updated ID ${update.assignment_id} : ${update.period_date} -> ${update.value}`);
                    totalUpdates++;
                }
            } else {
                // Insert if missing
                run(`
                    INSERT INTO project_allocations (assignment_id, period_date, value)
                    VALUES (?, ?, ?)
                `, [update.assignment_id, update.period_date, update.value]);
                // console.log(`Inserted ID ${update.assignment_id} : ${update.period_date} -> ${update.value}`);
                totalUpdates++;
            }
        }

        run('COMMIT');
        saveDatabase();
        console.log(`--- FINISHED. Total records updated/inserted: ${totalUpdates} ---`);
    } catch (err) {
        console.error('Failed:', err);
        try { run('ROLLBACK'); } catch (e) { }
    }
}

recalculateAll();
