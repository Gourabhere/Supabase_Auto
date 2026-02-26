// ═══════════════════════════════════════════════════════════════════
//  DATA COMPARISON: Google Sheets vs Supabase (Matched by Flat_No/Category)
//  Run "compareAll" in Apps Script to see differences in the log.
// ═══════════════════════════════════════════════════════════════════

var CMP_SUPABASE_URL = "https://bhdrlzaqejkrqsozbcbr.supabase.co";
var CMP_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoZHJsemFxZWprcnFzb3piY2JyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4NzM4OTAsImV4cCI6MjA4NTQ0OTg5MH0.W1kWS99fv-QjQI_eVE3XvPhMWbgMQoGqOtaUHcVlP9s";

// matchKey = the column used to match rows (uses SUPABASE column name after mapping)
var CMP_TAB_CONFIG = {
    "Registered Owner Details": { table: "Registered_Owner_Details", headerRow: 1, matchKey: "Flat_No", skipColumns: [] },
    "Collections 2026": { table: "Collections_2026", headerRow: 5, matchKey: "Flat_No", skipColumns: [] },
    "Collections 2025": { table: "Collections_2025", headerRow: 2, matchKey: "Flat_No", skipColumns: ["Total Collection 2025", "Total Outstanding 2025"] },
    "Expense Report 2025": { table: "Expense_Report_2025", custom: true, matchKey: "Category" },
    "All Excess Amount 2025": { table: "Excess_Amount_2025", headerRow: 2, matchKey: "Flat_No", skipColumns: [] }
};

// ── EXPENSE REPORT 2025: Column Renaming ───────────────────────────
var CMP_EXPENSE_COL_MAP = {
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
var CMP_EXPENSE_ROW_MAP = {
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


function compareAll() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    for (var tabName in CMP_TAB_CONFIG) {
        var config = CMP_TAB_CONFIG[tabName];

        if (config.custom) {
            compareExpenseReport2025(ss, tabName, config);
        } else {
            compareGenericTab(ss, tabName, config);
        }
    }

    Logger.log("\n🎉 Comparison complete!");
}


// ── GENERIC TAB COMPARISON ─────────────────────────────────────────
function compareGenericTab(ss, tabName, config) {
    Logger.log("\n" + "=".repeat(60));
    Logger.log("  " + tabName + " → " + config.table + "  (match by: " + config.matchKey + ")");
    Logger.log("=".repeat(60));

    var sheet = ss.getSheetByName(tabName);
    if (!sheet) { Logger.log("  ⚠️ Sheet tab not found: " + tabName); return; }

    var allData = sheet.getDataRange().getValues();
    var skip = config.skipColumns || [];
    var headers = allData[config.headerRow - 1]
        .map(function (h) { return String(h).trim(); })
        .filter(function (h) { return h !== "" && skip.indexOf(h) === -1; });

    var sheetRows = allData.slice(config.headerRow);
    var sheetMap = {};
    var sheetCount = 0;
    for (var r = 0; r < sheetRows.length; r++) {
        var obj = {};
        var hasData = false;
        for (var c = 0; c < headers.length; c++) {
            var val = sheetRows[r][c];
            if (val instanceof Date) val = val.toISOString();
            val = val !== undefined && val !== "" ? String(val) : "";
            obj[headers[c]] = val;
            if (val !== "") hasData = true;
        }
        if (hasData && obj[config.matchKey]) {
            sheetMap[String(obj[config.matchKey]).trim()] = obj;
            sheetCount++;
        }
    }

    Logger.log("  📊 Google Sheet: " + sheetCount + " rows, " + headers.length + " columns");
    doComparison(config, headers, sheetMap, sheetCount);
}


// ── EXPENSE REPORT 2025 COMPARISON ────────────────────────────────
function compareExpenseReport2025(ss, tabName, config) {
    Logger.log("\n" + "=".repeat(60));
    Logger.log("  " + tabName + " → " + config.table + "  (match by: " + config.matchKey + ") [CUSTOM]");
    Logger.log("=".repeat(60));

    var sheet = ss.getSheetByName(tabName);
    if (!sheet) { Logger.log("  ⚠️ Sheet tab not found: " + tabName); return; }

    var data = sheet.getDataRange().getValues();

    // Section 1: Collections (header row 2)
    var collectionsHeaders = data[1];
    // Find Section 2: Expenses header row
    var expensesHeaderRow = -1;
    for (var r = 5; r < Math.min(data.length, 15); r++) {
        var firstCell = String(data[r][0]).trim();
        if (firstCell === "SN" || firstCell === "Expense_for" ||
            (data[r][1] && String(data[r][1]).trim() === "Expense_for")) {
            expensesHeaderRow = r;
            break;
        }
    }

    var sheetMap = {};
    var supaHeaders = ["SN", "Category", "Aug_2025", "Sept_2025", "Oct_2025", "Nov_2025", "Dec_2025", "Total_Each_Category"];
    var snCounter = 1;

    // Process Section 1 (Collections)
    var sec1End = expensesHeaderRow > 0 ? expensesHeaderRow : data.length;
    for (var r1 = 2; r1 < sec1End; r1++) {
        var row = data[r1];
        var rawCategory = String(row[1] || "").trim();
        if (rawCategory === "" || rawCategory === "0") continue;

        var obj = buildCompareRow(snCounter, rawCategory, row, collectionsHeaders);
        if (obj) {
            sheetMap[obj.Category] = obj;
            snCounter++;
        }
    }

    // Process Section 2 (Expenses)
    if (expensesHeaderRow > 0) {
        var expensesHeaders = data[expensesHeaderRow];
        for (var r2 = expensesHeaderRow + 1; r2 < data.length; r2++) {
            var row2 = data[r2];
            var rawCategory2 = String(row2[1] || "").trim();
            if (rawCategory2 === "" || rawCategory2 === "0") continue;

            var obj2 = buildCompareRow(snCounter, rawCategory2, row2, expensesHeaders);
            if (obj2) {
                sheetMap[obj2.Category] = obj2;
                snCounter++;
            }
        }
    }

    var sheetCount = Object.keys(sheetMap).length;
    Logger.log("  📊 Google Sheet: " + sheetCount + " rows (merged from 2 sections)");
    doComparison(config, supaHeaders, sheetMap, sheetCount);
}

function buildCompareRow(sn, rawCategory, rowData, headers) {
    var category = CMP_EXPENSE_ROW_MAP[rawCategory] || rawCategory;
    var obj = { "SN": String(sn), "Category": category };
    var hasData = false;

    for (var c = 2; c < headers.length; c++) {
        var sheetHeader = String(headers[c]).trim();
        if (sheetHeader === "") continue;
        var supaCol = CMP_EXPENSE_COL_MAP[sheetHeader] || sheetHeader;
        var value = rowData[c];
        if (value instanceof Date) value = value.toISOString();
        obj[supaCol] = (value !== "" && value !== undefined) ? String(value) : "";
        if (value !== "" && value !== undefined) hasData = true;
    }

    return hasData ? obj : null;
}


// ── SHARED COMPARISON LOGIC ───────────────────────────────────────
function doComparison(config, headers, sheetMap, sheetCount) {
    try {
        var url = CMP_SUPABASE_URL + "/rest/v1/" + config.table + "?select=*&limit=1000";
        var response = UrlFetchApp.fetch(url, {
            headers: { "apikey": CMP_SUPABASE_KEY, "Authorization": "Bearer " + CMP_SUPABASE_KEY },
            muteHttpExceptions: true
        });

        var code = response.getResponseCode();
        if (code >= 400) { Logger.log("  ❌ Supabase HTTP " + code + ": " + response.getContentText()); return; }

        var supaData = JSON.parse(response.getContentText());
        var supaColumns = [];
        if (supaData.length > 0) {
            for (var key in supaData[0]) {
                if (key !== "id" && key !== "synced_at") supaColumns.push(key);
            }
        }

        var supaMap = {};
        for (var s = 0; s < supaData.length; s++) {
            var supaKey = String(supaData[s][config.matchKey] || "").trim();
            if (supaKey) supaMap[supaKey] = supaData[s];
        }

        Logger.log("  📊 Supabase:     " + supaData.length + " rows, " + supaColumns.length + " columns");

        // Column comparison
        var missingInSupa = headers.filter(function (h) { return supaColumns.indexOf(h) === -1; });
        var extraInSupa = supaColumns.filter(function (c) { return headers.indexOf(c) === -1; });
        if (missingInSupa.length > 0) Logger.log("  ⚠️  MISSING in Supabase: " + missingInSupa.join(", "));
        if (extraInSupa.length > 0) Logger.log("  ⚠️  EXTRA in Supabase: " + extraInSupa.join(", "));
        if (missingInSupa.length === 0 && extraInSupa.length === 0) Logger.log("  ✅ Columns match!");

        // Row count
        if (sheetCount !== supaData.length) {
            Logger.log("  ⚠️  ROW COUNT: Sheet=" + sheetCount + ", Supabase=" + supaData.length);
        } else {
            Logger.log("  ✅ Row count match: " + sheetCount);
        }

        // Value comparison by matchKey
        Logger.log("\n  🔍 Row-by-row comparison (matched by " + config.matchKey + "):");
        var matchCount = 0, diffCount = 0, missingCount = 0;

        for (var mk in sheetMap) {
            var sheetRow = sheetMap[mk];
            var supaRow = supaMap[mk];

            if (!supaRow) {
                Logger.log("     " + config.matchKey + "=" + mk + ": ❌ MISSING in Supabase");
                missingCount++;
                continue;
            }

            var diffs = [];
            for (var h = 0; h < headers.length; h++) {
                var header = headers[h];
                if (header === config.matchKey) continue;

                var sheetVal = String(sheetRow[header] || "").trim();
                var supaVal = String(supaRow[header] || "").trim();
                var sheetNorm = sheetVal.replace(/,/g, "");
                var supaNorm = supaVal.replace(/,/g, "").replace(/^null$/, "");
                if (sheetNorm !== supaNorm) {
                    diffs.push('"' + header + '": sheet="' + sheetVal + '" vs supa="' + supaVal + '"');
                }
            }

            if (diffs.length === 0) { matchCount++; }
            else {
                diffCount++;
                Logger.log("     " + config.matchKey + "=" + mk + ": ⚠️ " + diffs.length + " differences");
                for (var d = 0; d < diffs.length; d++) Logger.log("       - " + diffs[d]);
            }
        }

        var extraInSupaRows = 0;
        for (var sk in supaMap) { if (!sheetMap[sk]) extraInSupaRows++; }

        Logger.log("\n  📊 Summary:");
        Logger.log("     ✅ Matching rows: " + matchCount);
        Logger.log("     ⚠️  Rows with differences: " + diffCount);
        Logger.log("     ❌ In Sheet but not Supabase: " + missingCount);
        Logger.log("     ❌ In Supabase but not Sheet: " + extraInSupaRows);

    } catch (e) {
        Logger.log("  ❌ Error: " + e.message);
    }
}
