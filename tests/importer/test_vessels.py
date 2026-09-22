import pytest

from importer.ruleset import load_config
from importer.vessels import parse_vessel_detail_tab

from .builders import new_sheet


@pytest.fixture()
def config():
    return load_config()


class TestConflictingVesselLength:
    def test_explicit_loa_wins_over_name_cell_length(self, config):
        # SPEC.md section 7.5's own worked example.
        wb, ws = new_sheet()
        ws.cell(row=1, column=1, value="M/Y Western Strand 52'")
        ws.cell(row=1, column=2, value="LOA: 65', Draft: 4'")

        records = parse_vessel_detail_tab(ws, "Yachts", config)

        assert len(records) == 1
        r = records[0]
        assert r.loa_ft == 65.0
        assert r.draft_ft == 4.0
        assert r.conflicting_length == (65.0, 52.0)

    def test_no_conflict_when_lengths_agree(self, config):
        wb, ws = new_sheet()
        ws.cell(row=1, column=1, value="R/V Steady Craft 40'")
        ws.cell(row=1, column=2, value="LOA: 40'")

        records = parse_vessel_detail_tab(ws, "Science", config)
        assert records[0].conflicting_length is None
        assert records[0].loa_ft == 40.0


class TestRecordBoundaries:
    def test_stops_at_next_vessel_prefix_cell(self, config):
        wb, ws = new_sheet()
        ws.cell(row=1, column=1, value="R/V First Boat 30'")
        ws.cell(row=2, column=2, value="Some Operator")
        ws.cell(row=3, column=1, value="R/V Second Boat 40'")
        ws.cell(row=4, column=2, value="Other Operator")

        records = parse_vessel_detail_tab(ws, "Science", config)

        assert len(records) == 2
        assert records[0].mention.name == "First Boat"
        assert records[0].organization_name == "Some Operator"
        assert records[1].mention.name == "Second Boat"
        assert records[1].organization_name == "Other Operator"

    def test_captains_phones_and_emails_are_collected(self, config):
        wb, ws = new_sheet()
        ws.cell(row=1, column=1, value="R/V Contact Boat 30'")
        ws.cell(row=2, column=1, value="Capt. Jordan Reyes")
        ws.cell(row=2, column=2, value="Cell: 555-0100")
        ws.cell(row=2, column=3, value="jordan@example.com")

        records = parse_vessel_detail_tab(ws, "Science", config)

        assert records[0].captain_names == ["Capt. Jordan Reyes"]
        assert records[0].phones == ["Cell: 555-0100"]
        assert records[0].emails == ["jordan@example.com"]
