import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { TAB_TABLE_MAP } from './config';

dotenv.config();

// ── Required env vars ──────────────────────────────────────────────
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')!;
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID!;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_KEY!;

// ── Optional: which tabs to sync ───────────────────────────────────
// Set SYNC_TABS to "all" (default) or a comma-separated list of tab names.
// Examples:
//   SYNC_TABS=all
//   SYNC_TABS=Collections 2026,Expense Report 2026
const SYNC_TABS = process.env.SYNC_TABS || 'all';

// ── Validate ───────────────────────────────────────────────────────
if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY || !GOOGLE_SHEET_ID || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing required environment variables. Check .env or GitHub Secrets.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Determine which tabs we should sync ────────────────────────────
function getTabsToSync(): [string, string][] {
  if (SYNC_TABS.trim().toLowerCase() === 'all') {
    return Object.entries(TAB_TABLE_MAP);
  }

  const requested = SYNC_TABS.split(',').map((t) => t.trim());
  const pairs: [string, string][] = [];

  for (const tab of requested) {
    const table = TAB_TABLE_MAP[tab];
    if (!table) {
      console.warn(`⚠️  Tab "${tab}" not found in config.ts mapping – skipping.`);
      continue;
    }
    pairs.push([tab, table]);
  }

  if (pairs.length === 0) {
    console.error('❌ No valid tabs to sync. Check your SYNC_TABS value and config.ts mapping.');
    process.exit(1);
  }

  return pairs;
}

// ── Sync one tab ───────────────────────────────────────────────────
async function syncTab(
  sheets: ReturnType<typeof google.sheets>,
  tabName: string,
  tableName: string,
) {
  console.log(`\n📄 Syncing tab "${tabName}" → Supabase table "${tableName}" …`);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `'${tabName}'!A1:ZZ`, // quotes around tab name handle spaces/special chars
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    console.log(`   ⏭️  No data found – skipping.`);
    return;
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);

  const payload = dataRows.map((row) => {
    const obj: Record<string, string | null> = {};
    headers.forEach((header: string, index: number) => {
      if (header && header.trim() !== '') {
        obj[header.trim()] = row[index] !== undefined ? row[index] : null;
      }
    });
    return obj;
  });

  console.log(`   📦 ${payload.length} rows to upsert …`);

  // Batch upsert (max 1000 per request)
  const BATCH_SIZE = 1000;
  for (let i = 0; i < payload.length; i += BATCH_SIZE) {
    const batch = payload.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(tableName).upsert(batch);

    if (error) {
      console.error(`   ❌ Supabase error for "${tableName}":`, error.message);
      return; // skip this tab but continue with others
    }
  }

  console.log(`   ✅ Done.`);
}

// ── Main ───────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Google Sheets → Supabase sync starting …');

  const auth = new google.auth.JWT({
    email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: GOOGLE_PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const tabs = getTabsToSync();

  console.log(`📋 Tabs to sync: ${tabs.map(([t]) => `"${t}"`).join(', ')}`);

  for (const [tabName, tableName] of tabs) {
    await syncTab(sheets, tabName, tableName);
  }

  console.log('\n🎉 All done!');
}

main().catch((err) => {
  console.error('💥 Unexpected error:', err);
  process.exit(1);
});
