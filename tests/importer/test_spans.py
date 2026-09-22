import pytest

from importer.layout import find_month_headers
from importer.ruleset import load_config
from importer.spans import (
    berth_rows_for_block,
    build_merge_lookup,
    extract_spans,
    find_unlabeled_entries,
)

from .builders import fill_cell, new_sheet, write_early_layout_month


@pytest.fixture()
def config():
    return load_config()


def _single_berth_block(berth_name: str = "Test Berth - 100'"):
    wb, ws = new_sheet()
    write_early_layout_month(
        ws, label_row=1, month_label="JANUARY 2020", first_weekday_index=2, num_days=31
    )
    ws.cell(row=4, column=1, value=berth_name)
    header = find_month_headers(ws, default_year=2020)[0]
    return wb, ws, header


class TestMergedRanges:
    def test_merged_range_is_one_span(self, config):
        wb, ws, header = _single_berth_block()
        ws.merge_cells(start_row=4, start_column=3, end_row=4, end_column=6)
        ws.cell(row=4, column=3, value="R/V Merged Boat")

        merge_lookup = build_merge_lookup(ws)
        spans, issues = extract_spans(
            ws, header, 4, "Test Berth - 100'", "2020", config, merge_lookup
        )

        assert len(spans) == 1
        assert spans[0].text == "R/V Merged Boat"
        assert spans[0].start_col == 3
        assert spans[0].end_col == 6

    def test_merged_range_with_no_text_is_orphan_fill(self, config):
        wb, ws, header = _single_berth_block()
        ws.merge_cells(start_row=4, start_column=3, end_row=4, end_column=5)

        merge_lookup = build_merge_lookup(ws)
        spans, issues = extract_spans(
            ws, header, 4, "Test Berth - 100'", "2020", config, merge_lookup
        )

        assert spans == []
        assert len(issues) == 1
        assert issues[0].code == "ORPHAN_FILL"


class TestNameNotInFirstCell:
    def test_name_later_in_run_claims_leading_unnamed_cells(self, config):
        wb, ws, header = _single_berth_block()
        fill_cell(ws, 4, 3)  # unnamed, colored
        fill_cell(ws, 4, 4)  # unnamed, colored
        fill_cell(ws, 4, 5, "R/V Late Name")  # name appears on the third day

        merge_lookup = build_merge_lookup(ws)
        spans, issues = extract_spans(
            ws, header, 4, "Test Berth - 100'", "2020", config, merge_lookup
        )

        assert len(spans) == 1
        assert spans[0].text == "R/V Late Name"
        assert spans[0].start_col == 3  # extends back to cover the unnamed cells
        assert spans[0].end_col == 5


class TestBackToBackNames:
    def test_two_adjacent_names_both_become_spans_with_a_warning(self, config):
        wb, ws, header = _single_berth_block()
        fill_cell(ws, 4, 3, "R/V First Boat")
        fill_cell(ws, 4, 4, "R/V Second Boat")  # immediately adjacent, no gap

        merge_lookup = build_merge_lookup(ws)
        spans, issues = extract_spans(
            ws, header, 4, "Test Berth - 100'", "2020", config, merge_lookup
        )

        assert len(spans) == 2
        assert spans[0].text == "R/V First Boat"
        assert spans[0].start_col == 3
        assert spans[0].end_col == 3
        assert spans[1].text == "R/V Second Boat"
        assert spans[1].start_col == 4
        assert spans[1].end_col == 4
        assert any(i.code == "AMBIGUOUS_BOUNDARY" for i in issues)


class TestOrphanFill:
    def test_colored_run_with_no_name_is_orphan_fill(self, config):
        wb, ws, header = _single_berth_block()
        fill_cell(ws, 4, 3)
        fill_cell(ws, 4, 4)
        fill_cell(ws, 4, 5)

        merge_lookup = build_merge_lookup(ws)
        spans, issues = extract_spans(
            ws, header, 4, "Test Berth - 100'", "2020", config, merge_lookup
        )

        assert spans == []
        assert len(issues) == 1
        assert issues[0].code == "ORPHAN_FILL"
        assert issues[0].start_col == 3
        assert issues[0].end_col == 5


class TestUnlabeledRowEntry:
    def test_text_below_last_berth_row_is_flagged(self, config):
        wb, ws = new_sheet()
        write_early_layout_month(
            ws, label_row=1, month_label="JANUARY 2020", first_weekday_index=2, num_days=31
        )
        ws.cell(row=4, column=1, value="Only Berth - 100'")
        # A blank gap row with a stray vessel name typed into it, then
        # nothing until the sheet ends (no next month block).
        ws.cell(row=5, column=4, value="R/V Stray Boat")
        header = find_month_headers(ws, default_year=2020)[0]

        berth_rows = berth_rows_for_block(ws, header)
        assert berth_rows == [(4, "Only Berth - 100'")]

        entries = find_unlabeled_entries(ws, header, berth_rows, "2020")
        assert len(entries) == 1
        assert entries[0].text == "R/V Stray Boat"
        assert entries[0].berth_above == "Only Berth - 100'"
