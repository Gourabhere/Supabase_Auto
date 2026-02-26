import { google } from 'googleapis';
import * as dotenv from 'dotenv';

dotenv.config();

const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

const TAB_CONFIG: Record<string, { table: string; headerRow: number }> = {
    'Registered Owner Details': { table: 'Registered_Owner_Details', headerRow: 1 },
    'Collections 2026': { table: 'Collections_2026', headerRow: 5 },
    'Collections 2025': { table: 'Collections_2025', headerRow: 2 },
    'Expense Report 2025': { table: 'Expense_Report_2025', headerRow: 2 },
    'All Excess Amount 2025': { table: 'Excess_Amount_2025', headerRow: 2 },
};

async function getHeaders() {
    const auth = new google.auth.JWT({
        email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: GOOGLE_PRIVATE_KEY,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    for (const [tabName, config] of Object.entries(TAB_CONFIG)) {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: GOOGLE_SHEET_ID!,
            range: `'${tabName}'!A${config.headerRow}:ZZ${config.headerRow}`,
        });

        const row = res.data.values?.[0] || [];
        const headers = row.filter((h: string) => h && String(h).trim() !== '').map((h: string) => String(h).trim());

        console.log(`\n=== ${tabName} → ${config.table} (Row ${config.headerRow}) ===`);
        console.log(`Columns (${headers.length}):`);
        headers.forEach((h: string, i: number) => console.log(`  ${i + 1}. "${h}"`));
    }
}

getHeaders().catch(console.error);
