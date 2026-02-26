/**
 * Mapping of Google Sheet tab names → Supabase table names.
 * Add new entries here when you add a new tab to the sheet.
 */
export const TAB_TABLE_MAP: Record<string, string> = {
    'Registered Owner Details': 'registered_owner_details',
    'Collections 2026': 'collections_2026',
    'Collections 2025': 'collections_2025',
    'Expense Report 2025': 'expense_report_2025',
    'Expense Report 2026': 'expense_report_2026',
    'All Excess Amount 2025': 'all_excess_amount_2025',
    'Collection Details N-D': 'collection_details_n_d',
    'Collection Details-A-O': 'collection_details_a_o',
    'Expense': 'expense',
};
