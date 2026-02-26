import { google } from 'googleapis';
import * as dotenv from 'dotenv';

dotenv.config();

const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

const TAB_CONFIG: Record<string, { table: string; headerRow: number }> = {
    'Registered Owner Details': { table: 'registered_owner_details', headerRow: 1 },
    'Collections 2026': { table: 'Collections_2026', headerRow: 5 },
    'Collections 2025': { table: 'collections_2025', headerRow: 2 },
    'Expense Report 2025': { table: 'expense_report_2025', headerRow: 2 },
    'Expense Report 2026': { table: 'expense_report_2026', headerRow: 2 },
    'All Excess Amount 2025': { table: 'all_excess_amount_2025', headerRow: 2 },
    'Collection Details N-D': { table: 'collection_details_n_d', headerRow: 2 },
    'Collection Details-A-O': { table: 'collection_details_a_o', headerRow: 3 },
    'Expense': { table: 'expense', headerRow: 2 },
};

function sanitizeCol(name: string): string {
    return name
        .trim()
        .replace(/[^a-zA-Z0-9_]/g, '_')  // replace special chars with _
        .replace(/_+/g, '_')              // collapse multiple _
        .replace(/^_|_$/g, '');           // trim leading/trailing _
}

async function generateSQL() {
    const auth = new google.auth.JWT({
        email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: GOOGLE_PRIVATE_KEY,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const sqlStatements: string[] = [];

    for (const [tabName, config] of Object.entries(TAB_CONFIG)) {
        try {
            const res = await sheets.spreadsheets.values.get({
                spreadsheetId: GOOGLE_SHEET_ID!,
                range: `'${tabName}'!A${config.headerRow}:ZZ${config.headerRow}`,
            });

            const row = res.data.values?.[0];
            if (!row) {
                console.log(`-- ⚠️ No headers found for "${tabName}"`);
                continue;
            }

            const columns = row
                .map((h: string) => String(h).trim())
                .filter((h: string) => h !== '')
                .map((h: string) => sanitizeCol(h));

            // Use "text" type for everything – safe default, can be changed later
            const colDefs = columns.map((col: string) => `  "${col}" text`);

            const sql = [
                `-- Tab: "${tabName}"`,
                `CREATE TABLE IF NOT EXISTS "${config.table}" (`,
                `  id bigint generated always as identity primary key,`,
                colDefs.join(',\n') + ',',
                `  synced_at timestamptz default now()`,
                `);`,
                '',
            ].join('\n');

            sqlStatements.push(sql);
            console.log(`✅ ${tabName} → ${config.table} (${columns.length} columns)`);
        } catch (e: any) {
            console.log(`❌ ${tabName}: ${e.message}`);
        }
    }

    const fullSQL = sqlStatements.join('\n');
    console.log('\n\n-- ═══════════════════════════════════════════════════');
    console.log('-- FULL SQL — Copy and run in Supabase SQL Editor');
    console.log('-- ═══════════════════════════════════════════════════\n');
    console.log(fullSQL);

    // Also write to file
    require('fs').writeFileSync('create_tables.sql', fullSQL);
    console.log('\n📄 SQL also saved to: create_tables.sql');
}

generateSQL().catch(console.error);
