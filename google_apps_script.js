// ═══════════════════════════════════════════════════════════════════
//  Google Sheets → Supabase Auto-Sync (Google Apps Script)
//  Paste this entire script into Extensions → Apps Script
// ═══════════════════════════════════════════════════════════════════

// ── CONFIGURATION ──────────────────────────────────────────────────
var SUPABASE_URL = "https://bhdrlzaqejkrqsozbcbr.supabase.co";
var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoZHJsemFxZWprcnFzb3piY2JyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4NzM4OTAsImV4cCI6MjA4NTQ0OTg5MH0.W1kWS99fv-QjQI_eVE3XvPhMWbgMQoGqOtaUHcVlP9s";

// Tab config: "custom" flag means it uses a special sync function
var TAB_CONFIG = {
    "Registered Owner Details": { table: "Registered_Owner_Details", headerRow: 1, skipColumns: [] },
    "Collections 2026": { table: "Collections_2026", headerRow: 5, skipColumns: [] },
    "Collections 2025": { table: "Collections_2025", headerRow: 2, skipColumns: ["Total Collection 2025", "Total Outstanding 2025"] },
    "Expense Report 2025": { table: "Expense_Report_2025", custom: true },
    "All Excess Amount 2025": { table: "Excess_Amount_2025", headerRow: 2, skipColumns: [] }
};

// Set which tabs to sync: "all" or an array of specific tab names
var SYNC_TABS = "all";


// ── EXPENSE REPORT 2025: Column Renaming ───────────────────────────
var EXPENSE_COL_MAP = {
    "SN": "SN",
    "Collected_From": "Category",
    "Expense_for": "Category",
    "Aug": "Aug_2025",
    "Sept": "Sept_2025",
    "Oct": "Oct_2025",
    "Nov": "Nov_2025",
    "Dec": "Dec_2025",
    "Total_Collections": "Total_Each_Category",
    "Total Expenses": "Total_Each_Category"
};

// ── EXPENSE REPORT 2025: Row Value Transformation ──────────────────
var EXPENSE_ROW_MAP = {
    "Owners' Contribution": "Owners' Contribution",
    "Realtech Contribution": "Realtech Contribution",
    "Total Collections": "Total Collections Each Month",
    "Security": "Security Expense",
    "House Kepping": "House Keeping Expense",
    "Caretaker": "Caretaker Expense",
    "Other Expenses": "Other Expenses",
    "Total Expenses": "Total Expenses Each Month",
    "Excess Amount": "Excess Amount",
    "Expense borne by Owners": "Expense borne by Owners",
    "Expense borne by each Owner": "Expense borne by each Owner",
    "Excess amount for each FULL Paid Owner": "Excess amount for each Paid Owner"
};


// ── MAIN SYNC FUNCTION ────────────────────────────────────────────
function syncToSupabase() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var tabsToSync = [];

    if (SYNC_TABS === "all") {
        for (var tabName in TAB_CONFIG) {
            tabsToSync.push(tabName);
        }
    } else {
        tabsToSync = SYNC_TABS;
    }

    Logger.log("🚀 Starting sync for: " + tabsToSync.join(", "));

    for (var i = 0; i < tabsToSync.length; i++) {
        var tabName = tabsToSync[i];
        var config = TAB_CONFIG[tabName];

        if (!config || config.table === "SKIP") {
            Logger.log("⏭️ Skipping tab: " + tabName);
            continue;
        }

        try {
            if (config.custom) {
                syncExpenseReport2025(ss, tabName, config.table);
            } else {
                syncOneTab(ss, tabName, config.table, config.headerRow, config.skipColumns || []);
            }
        } catch (e) {
            Logger.log("❌ Error syncing '" + tabName + "': " + e.message);
        }
    }

    Logger.log("🎉 Sync complete!");
}


// ── SYNC A SINGLE TAB (generic) ──────────────────────────────────
function syncOneTab(ss, tabName, tableName, headerRow, skipColumns) {
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) {
        Logger.log("⚠️ Sheet tab '" + tabName + "' not found — skipping.");
        return;
    }

    var data = sheet.getDataRange().getValues();
    if (data.length < headerRow + 1) {
        Logger.log("⏭️ '" + tabName + "' has no data rows — skipping.");
        return;
    }

    var allHeaders = data[headerRow - 1];
    var headers = [];
    var headerIndices = [];
    for (var hi = 0; hi < allHeaders.length; hi++) {
        var h = String(allHeaders[hi]).trim();
        if (h !== "" && skipColumns.indexOf(h) === -1) {
            headers.push(h);
            headerIndices.push(hi);
        }
    }
    var rows = data.slice(headerRow);
    Logger.log("   📋 Headers (row " + headerRow + "): " + headers.join(", "));

    var payload = [];
    for (var r = 0; r < rows.length; r++) {
        var obj = {};
        var hasData = false;
        for (var c = 0; c < headers.length; c++) {
            var header = headers[c];
            var value = rows[r][headerIndices[c]];
            if (value instanceof Date) value = value.toISOString();
            if (value === "" || value === undefined) value = null;
            obj[header] = value;
            if (value !== null) hasData = true;
        }
        if (hasData) payload.push(obj);
    }

    Logger.log("📄 '" + tabName + "' → '" + tableName + "': " + payload.length + " rows");
    upsertToSupabase(tableName, payload);
}


// ── CUSTOM SYNC: Expense Report 2025 ──────────────────────────────
// This sheet has 2 sections with different headers (row 2 = Collections, row 8 = Expenses)
// Both sections get merged, columns renamed, and Category values transformed
function syncExpenseReport2025(ss, tabName, tableName) {
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) {
        Logger.log("⚠️ Sheet tab '" + tabName + "' not found — skipping.");
        return;
    }

    var data = sheet.getDataRange().getValues();
    Logger.log("📄 Syncing '" + tabName + "' → '" + tableName + "' (custom mapping)");

    // Section 1: Collections (header row 2, data rows 3-5)
    var collectionsHeaders = data[1]; // row 2 (0-indexed: 1)
    // Section 2: Expenses (header row 8, data rows 9+)
    var expensesHeaderRow = -1;
    for (var r = 5; r < Math.min(data.length, 15); r++) {
        var firstCell = String(data[r][0]).trim();
        if (firstCell === "SN" || firstCell === "Expense_for" ||
            (data[r][1] && String(data[r][1]).trim() === "Expense_for")) {
            expensesHeaderRow = r;
            break;
        }
    }

    var payload = [];
    var snCounter = 1;

    // Process Section 1 (Collections)
    var sec1Start = 2; // row 3 (0-indexed: 2)
    var sec1End = expensesHeaderRow > 0 ? expensesHeaderRow : data.length;
    for (var r1 = sec1Start; r1 < sec1End; r1++) {
        var row = data[r1];
        var rawCategory = String(row[1] || "").trim(); // Column B = Collected_From
        if (rawCategory === "" || rawCategory === "0") continue;

        var obj = buildExpenseRow(snCounter, rawCategory, row, collectionsHeaders);
        if (obj) {
            payload.push(obj);
            snCounter++;
        }
    }

    // Process Section 2 (Expenses)
    if (expensesHeaderRow > 0) {
        var expensesHeaders = data[expensesHeaderRow];
        for (var r2 = expensesHeaderRow + 1; r2 < data.length; r2++) {
            var row2 = data[r2];
            var rawCategory2 = String(row2[1] || "").trim(); // Column B = Expense_for
            if (rawCategory2 === "" || rawCategory2 === "0") continue;

            var obj2 = buildExpenseRow(snCounter, rawCategory2, row2, expensesHeaders);
            if (obj2) {
                payload.push(obj2);
                snCounter++;
            }
        }
    }

    Logger.log("   📦 " + payload.length + " rows (merged from Collections + Expenses sections)");

    // Delete existing rows first (no unique constraint, so we clear and re-insert)
    var delUrl = SUPABASE_URL + "/rest/v1/" + tableName + "?Category=neq.NEVER_MATCH";
    var delResponse = UrlFetchApp.fetch(delUrl, {
        method: "delete",
        headers: {
            "apikey": SUPABASE_KEY,
            "Authorization": "Bearer " + SUPABASE_KEY
        },
        muteHttpExceptions: true
    });
    var delCode = delResponse.getResponseCode();
    if (delCode >= 200 && delCode < 300) {
        Logger.log("   🗑️ Cleared old Expense Report rows.");
    } else {
        Logger.log("   ⚠️ Delete HTTP " + delCode + ": " + delResponse.getContentText());
    }

    upsertToSupabase(tableName, payload);
}

function buildExpenseRow(sn, rawCategory, rowData, headers) {
    // Transform category name
    var category = EXPENSE_ROW_MAP[rawCategory] || rawCategory;

    var obj = { "SN": String(sn), "Category": category };
    var hasData = false;

    for (var c = 2; c < headers.length; c++) { // skip SN (0) and Category (1)
        var sheetHeader = String(headers[c]).trim();
        if (sheetHeader === "") continue;

        var supaCol = EXPENSE_COL_MAP[sheetHeader] || sheetHeader;
        var value = rowData[c];
        if (value instanceof Date) value = value.toISOString();
        if (value === "" || value === undefined) value = null;
        obj[supaCol] = value;
        if (value !== null) hasData = true;
    }

    return hasData ? obj : null;
}


// ── UPSERT HELPER ─────────────────────────────────────────────────
function upsertToSupabase(tableName, payload) {
    if (payload.length === 0) {
        Logger.log("   ⏭️ No data to upsert.");
        return;
    }

    var BATCH_SIZE = 500;
    for (var i = 0; i < payload.length; i += BATCH_SIZE) {
        var batch = payload.slice(i, i + BATCH_SIZE);

        var options = {
            method: "post",
            contentType: "application/json",
            headers: {
                "apikey": SUPABASE_KEY,
                "Authorization": "Bearer " + SUPABASE_KEY,
                "Prefer": "resolution=merge-duplicates"
            },
            payload: JSON.stringify(batch),
            muteHttpExceptions: true
        };

        var url = SUPABASE_URL + "/rest/v1/" + tableName;
        var response = UrlFetchApp.fetch(url, options);
        var code = response.getResponseCode();

        if (code >= 200 && code < 300) {
            Logger.log("   ✅ Batch " + (Math.floor(i / BATCH_SIZE) + 1) + " upserted successfully.");
        } else {
            Logger.log("   ❌ HTTP " + code + ": " + response.getContentText());
        }
    }
}


// ── SET UP 5-MINUTE AUTO TRIGGER ──────────────────────────────────
function createTrigger() {
    var triggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < triggers.length; i++) {
        if (triggers[i].getHandlerFunction() === "syncToSupabase") {
            ScriptApp.deleteTrigger(triggers[i]);
        }
    }

    ScriptApp.newTrigger("syncToSupabase")
        .timeBased()
        .everyMinutes(5)
        .create();

    Logger.log("✅ Trigger created! syncToSupabase will run every 5 minutes.");
}


// ── REMOVE TRIGGER ────────────────────────────────────────────────
function removeTrigger() {
    var triggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < triggers.length; i++) {
        if (triggers[i].getHandlerFunction() === "syncToSupabase") {
            ScriptApp.deleteTrigger(triggers[i]);
        }
    }
    Logger.log("✅ All syncToSupabase triggers removed.");
}
