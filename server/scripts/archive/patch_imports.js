import fs from 'fs';

const targetFile = 'd:\\Workforce-Status\\server\\server.js';
let content = fs.readFileSync(targetFile, 'utf8');

const regex = /import dotenv from 'dotenv';\s*import \{ initializeDatabase, query, get \} from '\.\/db\.js';/g;

const newLogic = `import dotenv from 'dotenv';
import { format, startOfWeek, endOfWeek, addWeeks, startOfMonth, endOfMonth, addMonths, eachDayOfInterval, isWeekend, addDays } from 'date-fns';
import { initializeDatabase, query, get } from './db.js';`;

const updatedContent = content.replace(regex, newLogic);
fs.writeFileSync(targetFile, updatedContent, 'utf8');

if (content !== updatedContent) {
    console.log("Successfully replaced imports block.");
} else {
    console.log("Failed to match regex. No changes made.");
}
