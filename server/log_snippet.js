
const fs = require('fs');
if (period.key === 'current_week') {
    const logMsg = `Group: ${g.name}, Capacity: ${s.totalCapacity}, Allocated: ${s.totalAllocated}, Util: ${utilization}%, IdleRate: ${idleRate}%\n`;
    fs.appendFileSync('debug_log.txt', logMsg);
}
