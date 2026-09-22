from importer.layout import calendar_mismatches, find_month_headers

from .builders import new_sheet, write_early_layout_month, write_later_layout_month


class TestFindMonthHeaders:
    def test_detects_early_layout_shape(self):
        # August 1997 starts on a Friday: Mon-first index 4.
        _, ws = new_sheet()
        write_early_layout_month(
            ws, label_row=1, month_label="AUGUST 1997", first_weekday_index=4, num_days=31
        )

        headers = find_month_headers(ws, default_year=1997)

        assert len(headers) == 1
        h = headers[0]
        assert h.year == 1997
        assert h.month == 8
        assert h.label_row == 1
        assert h.weekday_row == 2
        assert h.daynum_row == 3
        assert h.first_day_col == 2
        assert h.first_berth_row == 4

    def test_detects_later_layout_shape_with_calendar_aligned_start(self):
        # January 2014 starts on a Wednesday: Mon-first index 2. Calendar
        # alignment means the first day isn't necessarily column B.
        _, ws = new_sheet()
        write_later_layout_month(
            ws, label_row=6, month_label="January", first_col=3, first_weekday_index=2, num_days=31
        )

        headers = find_month_headers(ws, default_year=2014)

        assert len(headers) == 1
        h = headers[0]
        assert h.year == 2014
        assert h.month == 1
        assert h.weekday_row == 7
        assert h.daynum_row == 6
        assert h.first_day_col == 3
        assert h.first_berth_row == 8

    def test_bare_month_label_uses_default_year(self):
        _, ws = new_sheet()
        write_later_layout_month(
            ws, label_row=1, month_label="March", first_col=2, first_weekday_index=1, num_days=31
        )

        headers = find_month_headers(ws, default_year=2015)
        assert headers[0].year == 2015

    def test_explicit_year_in_label_overrides_default_year(self):
        # A carried-over December block at the top of the next year's
        # sheet, as seen in the real workbook.
        _, ws = new_sheet()
        write_early_layout_month(
            ws, label_row=1, month_label="DECEMBER 2002", first_weekday_index=0, num_days=31
        )

        headers = find_month_headers(ws, default_year=2003)
        assert headers[0].year == 2002
        assert headers[0].month == 12

    def test_multiple_consecutive_months_detected_in_order(self):
        _, ws = new_sheet()
        write_early_layout_month(
            ws, label_row=1, month_label="JANUARY 2000", first_weekday_index=5, num_days=31
        )
        write_early_layout_month(
            ws, label_row=8, month_label="FEBRUARY 2000", first_weekday_index=1, num_days=29
        )

        headers = find_month_headers(ws, default_year=2000)
        assert [(h.month, h.year) for h in headers] == [(1, 2000), (2, 2000)]


class TestCalendarMismatches:
    def test_matching_calendar_has_no_mismatches(self):
        _, ws = new_sheet()
        # June 2024 starts on a Saturday: Mon-first index 5.
        write_later_layout_month(
            ws, label_row=1, month_label="June", first_col=2, first_weekday_index=5, num_days=30
        )
        header = find_month_headers(ws, default_year=2024)[0]

        assert calendar_mismatches(ws, header) == []

    def test_wrong_weekday_alignment_is_flagged(self):
        _, ws = new_sheet()
        # Deliberately wrong: June 2024 really starts on a Saturday, but
        # this writes it starting from Monday.
        write_later_layout_month(
            ws, label_row=1, month_label="June", first_col=2, first_weekday_index=0, num_days=30
        )
        header = find_month_headers(ws, default_year=2024)[0]

        mismatches = calendar_mismatches(ws, header)
        assert len(mismatches) > 0
