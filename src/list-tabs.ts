import { google } from 'googleapis';
import * as dotenv from 'dotenv';

dotenv.config();

const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

async function listTabs() {
    const auth = new google.auth.JWT({
        email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: GOOGLE_PRIVATE_KEY,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const res = await sheets.spreadsheets.get({
        spreadsheetId: GOOGLE_SHEET_ID!,
        fields: 'sheets.properties.title',
    });

    console.log('Available sheet tabs:');
    res.data.sheets?.forEach((s, i) => {
        console.log(`  ${i + 1}. "${s.properties?.title}"`);
    });
}

listTabs().catch(console.error);
