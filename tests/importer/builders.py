"""Builds small in-memory workbooks for importer tests, instead of
committing binary .xlsx fixture files — easier to read, diff, and edit.
openpyxl's parsing functions (layout.py, spans.py, vessels.py) only need a
Worksheet, which behaves the same whether built in memory or loaded from
disk, so this is a drop-in equivalent to a hand-built .xlsx fixture.
"""

from openpyxl import Workbook
from openpyxl.styles import PatternFill
from openpyxl.worksheet.worksheet import Worksheet

BOOKING_FILL = PatternFill(fill_type="solid", fgColor="FF92D050")

WEEKDAY_LETTERS_MON_FIRST = ["M", "T", "W", "TR", "F", "S", "S"]


def new_sheet(name: str = "Sheet") -> tuple[Workbook, Worksheet]:
    wb = Workbook()
    ws = wb.active
    ws.title = name
    return wb, ws


def write_early_layout_month(
    ws: Worksheet, label_row: int, month_label: str, first_weekday_index: int, num_days: int
) -> None:
    """SPEC.md section 7.2's "early" shape: label row alone, weekday
    letters the next row, day-number formulas the row after."""
    ws.cell(row=label_row, column=1, value=month_label)
    for i in range(num_days):
        ws.cell(
            row=label_row + 1,
            column=2 + i,
            value=WEEKDAY_LETTERS_MON_FIRST[(first_weekday_index + i) % 7],
        )
        if i == 0:
            ws.cell(row=label_row + 2, column=2, value=1)
        else:
            ws.cell(
                row=label_row + 2,
                column=2 + i,
                value=f"=SUM({chr(ord('B') + i - 1)}{label_row + 2}+1)",
            )


def write_later_layout_month(
    ws: Worksheet,
    label_row: int,
    month_label: str,
    first_col: int,
    first_weekday_index: int,
    num_days: int,
) -> None:
    """SPEC.md section 7.2's "later" shape: day numbers on the label row
    itself (calendar-aligned start column), weekday letters the row after."""
    ws.cell(row=label_row, column=1, value=month_label)
    for i in range(num_days):
        ws.cell(row=label_row, column=first_col + i, value=i + 1)
        ws.cell(
            row=label_row + 1,
            column=first_col + i,
            value=WEEKDAY_LETTERS_MON_FIRST[(first_weekday_index + i) % 7],
        )


def fill_cell(ws: Worksheet, row: int, col: int, text: str | None = None) -> None:
    cell = ws.cell(row=row, column=col)
    if text is not None:
        cell.value = text
    cell.fill = BOOKING_FILL
