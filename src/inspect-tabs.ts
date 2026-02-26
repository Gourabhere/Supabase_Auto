import { google } from 'googleapis';
import * as dotenv from 'dotenv';

dotenv.config();

const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

const TABS = [
    'Registered Owner Details',
    'Collections 2026',
    'Collections 2025',
    'Expense Report 2025',
    'Expense Report 2026',
    'All Excess Amount 2025',
    'Collection Details N-D',
    'Collection Details-A-O',
    'Expense',
];

async function inspect() {
    const auth = new google.auth.JWT({
        email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: GOOGLE_PRIVATE_KEY,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    for (const tab of TABS) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`TAB: "${tab}"`);
        console.log('='.repeat(60));

        try {
            const res = await sheets.spreadsheets.values.get({
                spreadsheetId: GOOGLE_SHEET_ID!,
                range: `'${tab}'!A1:Z10`, // first 10 rows, first 26 columns
            });

            const rows = res.data.values;
            if (!rows || rows.length === 0) {
                console.log('  (empty)');
                continue;
            }

            for (let i = 0; i < rows.length; i++) {
                const nonEmpty = rows[i].filter((c: string) => c && c.trim() !== '');
                console.log(`  Row ${i + 1} (${nonEmpty.length} values): ${nonEmpty.slice(0, 8).join(' | ')}${nonEmpty.length > 8 ? ' | ...' : ''}`);
            }
        } catch (e: any) {
            console.log(`  ERROR: ${e.message}`);
        }
    }
}

inspect().catch(console.error);
