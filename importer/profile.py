"""Exploratory profiling of the historical workbook, run BEFORE writing any
parsing logic (SPEC.md section 7.1). Prints:

- sheet names
- for each year sheet, the rows detected as month headers, and which of the
  two rows around each one holds weekday letters vs day numbers
- distinct column-A labels (berth rows and anything else) with counts
- a frequency table of cell fills (fill type + color), broken down by
  whether the cell has text, whether it's in a berth row, and whether it's
  in a weekend column
- all distinct text values found in berth rows

Run with: uv run python -m importer.profile [path-to-workbook]
"""

import sys
from collections import Counter
from pathlib import Path

import openpyxl
from openpyxl.worksheet.worksheet import Worksheet

from importer.layout import MONTH_LABEL_RE, YEAR_SHEET_RE, find_month_headers, is_weekday_row

DEFAULT_PATH = Path(__file__).resolve().parent.parent / "data" / "Dock_Schedule.xlsx"


def _fill_key(cell) -> tuple:
    fill = cell.fill
    if fill is None or fill.fill_type is None:
        return (None, None, None)
    color = fill.fgColor
    if color is None:
        return (fill.fill_type, None, None)
    if color.type == "rgb":
        return (fill.fill_type, "rgb", color.rgb)
    if color.type == "indexed":
        return (fill.fill_type, "indexed", color.indexed)
    if color.type == "theme":
        return (fill.fill_type, "theme", (color.theme, color.tint))
    return (fill.fill_type, color.type, None)


def profile_year_sheet(ws: Worksheet, default_year: int) -> list:
    headers = find_month_headers(ws, default_year=default_year)
    print(f"  {len(headers)} month header(s) found")
    for header in headers:
        weekday_row = "label row" if header.weekday_row == header.label_row else header.weekday_row
        daynum_row = "label row" if header.daynum_row == header.label_row else header.daynum_row
        print(
            f"    {header.label!r} at row {header.label_row}: "
            f"weekday row={weekday_row}, day-number row={daynum_row}, "
            f"first day column={header.first_day_col}"
        )
    return headers


def profile(path: Path) -> None:
    wb = openpyxl.load_workbook(path, data_only=False)
    print(f"Sheets ({len(wb.sheetnames)}): {wb.sheetnames}\n")

    berth_labels: Counter[str] = Counter()
    berth_texts: Counter[str] = Counter()
    fill_freq: Counter[tuple] = Counter()

    for name in wb.sheetnames:
        if not YEAR_SHEET_RE.match(name):
            continue
        ws = wb[name]
        print(f"=== {name} ===")
        headers = profile_year_sheet(ws, default_year=int(name))

        for header in headers:
            row = header.first_berth_row
            while row <= ws.max_row:
                label = ws.cell(row=row, column=1).value
                if label is None:
                    break
                if (
                    not isinstance(label, str)
                    or is_weekday_row(ws, row)
                    or MONTH_LABEL_RE.match(label.strip())
                ):
                    break
                berth_labels[label.strip()] += 1

                for day in range(1, header.days_in_month() + 1):
                    col = header.column_for_day(day)
                    cell = ws.cell(row=row, column=col)
                    has_text = isinstance(cell.value, str) and cell.value.strip() != ""
                    is_weekend = header.date_for_column(col).weekday() >= 5
                    fill_freq[(_fill_key(cell), has_text, True, is_weekend)] += 1
                    if has_text:
                        berth_texts[cell.value.strip()] += 1
                row += 1
        print()

    print("=== Distinct column-A labels in berth rows (with counts) ===")
    for label, count in berth_labels.most_common():
        print(f"  {count:5d}  {label!r}")

    print("\n=== Fill frequency: (fill_key, has_text, in_berth_row, is_weekend) -> count ===")
    for key, count in fill_freq.most_common(40):
        print(f"  {count:5d}  {key}")

    print("\n=== Distinct texts found in berth rows (with counts) ===")
    for text, count in berth_texts.most_common():
        print(f"  {count:5d}  {text!r}")


if __name__ == "__main__":
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PATH
    profile(path)
