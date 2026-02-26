import { google } from 'googleapis';
import * as dotenv from 'dotenv';

dotenv.config();

const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_KEY!;

const TAB_CONFIG: Record<string, { table: string; headerRow: number }> = {
    'Registered Owner Details': { table: 'Registered_Owner_Details', headerRow: 1 },
    'Collections 2026': { table: 'Collections_2026', headerRow: 5 },
    'Collections 2025': { table: 'Collections_2025', headerRow: 2 },
    'Expense Report 2025': { table: 'Expense_Report_2025', headerRow: 2 },
    'All Excess Amount 2025': { table: 'Excess_Amount_2025', headerRow: 2 },
};

// Fetch Google Sheet data
async function getSheetData(sheets: any, tabName: string, headerRow: number) {
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: GOOGLE_SHEET_ID!,
        range: `'${tabName}'!A1:ZZ`,
    });
    const rows = res.data.values || [];
    if (rows.length < headerRow) return { headers: [], data: [] };

    const headers = rows[headerRow - 1]
        .map((h: string) => String(h).trim())
        .filter((h: string) => h !== '');

    const dataRows = rows.slice(headerRow);
    const data = dataRows.map((row: string[]) => {
        const obj: Record<string, string> = {};
        headers.forEach((header: string, i: number) => {
            obj[header] = row[i] !== undefined ? String(row[i]).trim() : '';
        });
        return obj;
    }).filter((obj: Record<string, string>) => {
        // skip empty rows
        return Object.values(obj).some(v => v !== '' && v !== null);
    });

    return { headers, data };
}

// Fetch Supabase data
async function getSupabaseData(tableName: string) {
    const url = `${SUPABASE_URL}/rest/v1/${tableName}?select=*&order=id&limit=1000`;
    const res = await fetch(url, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
    });

    if (!res.ok) {
        const body = await res.text();
        return { error: `HTTP ${res.status}: ${body}`, data: null, columns: null };
    }

    const data = await res.json();
    const columns = data.length > 0
        ? Object.keys(data[0]).filter(k => k !== 'id' && k !== 'synced_at')
        : [];

    return { error: null, data, columns };
}

async function compare() {
    const auth = new google.auth.JWT({
        email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: GOOGLE_PRIVATE_KEY,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    for (const [tabName, config] of Object.entries(TAB_CONFIG)) {
        console.log(`\n${'='.repeat(70)}`);
        console.log(`  ${tabName} → ${config.table}`);
        console.log('='.repeat(70));

        // Get Google Sheet data
        const sheet = await getSheetData(sheets, tabName, config.headerRow);
        console.log(`  📊 Google Sheet: ${sheet.data.length} rows, ${sheet.headers.length} columns`);
        console.log(`     Headers: ${sheet.headers.join(', ')}`);

        // Get Supabase data
        const supa = await getSupabaseData(config.table);

        if (supa.error) {
            console.log(`  ❌ Supabase error: ${supa.error}`);
            console.log('');
            continue;
        }

        console.log(`  📊 Supabase:     ${supa.data.length} rows, ${supa.columns!.length} columns`);
        console.log(`     Columns: ${supa.columns!.join(', ')}`);

        // Column comparison
        const sheetHeaders = new Set(sheet.headers);
        const supaColumns = new Set(supa.columns!);

        const missingInSupabase = sheet.headers.filter((h: string) => !supaColumns.has(h));
        const extraInSupabase = supa.columns!.filter((c: string) => !sheetHeaders.has(c));

        if (missingInSupabase.length > 0) {
            console.log(`  ⚠️  MISSING in Supabase: ${missingInSupabase.join(', ')}`);
        }
        if (extraInSupabase.length > 0) {
            console.log(`  ⚠️  EXTRA in Supabase (not in sheet): ${extraInSupabase.join(', ')}`);
        }
        if (missingInSupabase.length === 0 && extraInSupabase.length === 0) {
            console.log(`  ✅ Columns match perfectly!`);
        }

        // Row count comparison
        if (sheet.data.length !== supa.data.length) {
            console.log(`  ⚠️  ROW COUNT MISMATCH: Sheet=${sheet.data.length}, Supabase=${supa.data.length}`);
        } else {
            console.log(`  ✅ Row counts match: ${sheet.data.length}`);
        }

        // Sample value comparison (first 3 rows)
        if (supa.data.length > 0 && sheet.data.length > 0) {
            console.log(`\n  🔍 Sample value comparison (first 3 rows):`);
            const compareRows = Math.min(3, sheet.data.length, supa.data.length);
            for (let r = 0; r < compareRows; r++) {
                const sheetRow = sheet.data[r];
                const supaRow = supa.data[r];
                let diffs: string[] = [];

                for (const header of sheet.headers) {
                    const sheetVal = String(sheetRow[header] ?? '').trim();
                    const supaVal = String(supaRow[header] ?? '').trim();
                    if (sheetVal !== supaVal) {
                        diffs.push(`"${header}": sheet="${sheetVal}" vs supa="${supaVal}"`);
                    }
                }

                if (diffs.length === 0) {
                    console.log(`     Row ${r + 1}: ✅ Values match`);
                } else {
                    console.log(`     Row ${r + 1}: ⚠️ ${diffs.length} differences`);
                    diffs.forEach(d => console.log(`       - ${d}`));
                }
            }
        }

        console.log('');
    }
}

compare().catch(console.error);
