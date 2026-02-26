-- ═══════════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor to create all tables
-- Column names EXACTLY match Google Sheet headers
-- ═══════════════════════════════════════════════════════════════

-- Tab: "Registered Owner Details" (Header Row 1, 4 columns)
CREATE TABLE IF NOT EXISTS "Registered_Owner_Details" (
  id bigint generated always as identity primary key,
  "SN" text,
  "Flat_No" text,
  "Name" text,
  "Possession_Date" text,
  synced_at timestamptz default now()
);

-- Tab: "Collections 2026" (Header Row 5, 19 columns)
CREATE TABLE IF NOT EXISTS "Collections_2026" (
  id bigint generated always as identity primary key,
  "SN" text,
  "Flat_No" text,
  "2025_Carry_Forward" text,
  "Q1_Payment" text,
  "Balance_Till_Date" text,
  "Outstanding_in_2026" text,
  "Remarks" text,
  "January_2026" text,
  "February_2026" text,
  "March_2026" text,
  "April_2026" text,
  "May_2026" text,
  "June_2026" text,
  "July_2026" text,
  "August_2026" text,
  "September_2026" text,
  "October_2026" text,
  "November_2026" text,
  "December_2026" text,
  synced_at timestamptz default now()
);

-- Tab: "Collections 2025" (Header Row 2, 12 columns)
-- NOTE: Columns L and M (Total Collection 2025, Total Outstanding 2025) are excluded
CREATE TABLE IF NOT EXISTS "Collections_2025" (
  id bigint generated always as identity primary key,
  "SN" text,
  "Flat_No" text,
  "Aug_2025" text,
  "Sept_2025" text,
  "Oct_2025" text,
  "Nov_2025" text,
  "Dec_2025" text,
  "Total_Paid_in_2025" text,
  "Outstanding_in_2025" text,
  "Remarks" text,
  synced_at timestamptz default now()
);

-- Tab: "Expense Report 2025" — Custom column + row value mapping
-- Sheet has 2 sections (Collections rows 2-5, Expenses rows 8+), merged into one table
-- Category is UNIQUE so upsert updates existing rows instead of duplicating
DROP TABLE IF EXISTS "Expense_Report_2025";
CREATE TABLE "Expense_Report_2025" (
  id bigint generated always as identity primary key,
  "SN" text,
  "Category" text UNIQUE,
  "Aug_2025" text,
  "Sept_2025" text,
  "Oct_2025" text,
  "Nov_2025" text,
  "Dec_2025" text,
  "Total_Each_Category" text,
  synced_at timestamptz default now()
);

-- Tab: "All Excess Amount 2025" (Header Row 2, 10 columns)
CREATE TABLE IF NOT EXISTS "Excess_Amount_2025" (
  id bigint generated always as identity primary key,
  "SN" text,
  "Flat_No" text,
  "Aug_2025" text,
  "Sept_2025" text,
  "Oct_2025" text,
  "Nov_2025" text,
  "Dec_2025" text,
  "Expense_borne_by_each_Owner" text,
  "Carry_Forward_to_2026" text,
  "Total_Paid_in_2025" text,
  synced_at timestamptz default now()
);
