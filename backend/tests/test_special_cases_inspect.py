import json
from app.services.interactive_data_service import interactive_data_service

path = "/tmp/test.xlsx"
res = interactive_data_service.inspect_file_for_interaction(path, "Test_Schema_Special_Cases.xlsx")
print("=== TOTAL SHEETS ===", res["total_sheets"])
for s in res["sheets"]:
    print(f"Sheet: {s['name']}")
    print(f"  has_header: {s['has_header']} (type: {s['header_type']})")
    print(f"  rows: {s['row_count']}, cols: {s['column_count']}")
    print(f"  missing_summary: total={s['missing_summary']['total_missing']}, affected_rows={s['missing_summary']['affected_rows']}")
    print(f"  is_multi_table: {s['is_multi_table']}, table_regions={len(s['table_regions'])}")
    for r in s['table_regions']:
        print(f"    Region: {r['range']}, columns={r['columns']}")
