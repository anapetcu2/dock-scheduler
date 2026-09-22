"""Prints the import summary (SPEC.md section 7.8)."""

from importer.load import ImportStats


def print_report(stats: ImportStats, summary: dict) -> None:
    print("=== Import summary ===")
    print(f"Berths: {summary['berths']}")
    print(f"Vessels: {summary['vessels']}")
    print(f"Bookings: {summary['bookings']}")
    print(f"Import issues: {summary['issues']}")

    print("\n=== Classification table ===")
    for kind, count in sorted(stats.classification_counts.items(), key=lambda kv: -kv[1]):
        print(f"  {count:6d}  {kind}")

    print("\n=== Import issues by type ===")
    counts: dict[str, int] = {}
    for issue in stats.issues:
        key = issue.issue_type.value
        counts[key] = counts.get(key, 0) + 1
    for issue_type, count in sorted(counts.items(), key=lambda kv: -kv[1]):
        print(f"  {count:6d}  {issue_type}")

    variant_issues = [i for i in stats.issues if i.issue_type.value == "NAME_VARIANTS_MERGED"]
    if variant_issues:
        print("\n=== Name-variant groups merged ===")
        for issue in variant_issues:
            print(f"  {issue.message}")

    if stats.summary_sheet_days:
        print("\n=== Days booked per berth per year: computed vs 8YR Dock Summary (2006-2013) ===")
        berths = sorted({name for (_, name) in stats.summary_sheet_days})
        years = sorted({year for (year, _) in stats.summary_sheet_days})
        header = "  " + f"{'Berth':<20}" + "".join(f"{y:>18}" for y in years)
        print(header)
        for berth in berths:
            row = f"  {berth:<20}"
            for year in years:
                computed = stats.year_berth_days.get((year, berth), 0)
                expected = stats.summary_sheet_days.get((year, berth))
                if expected is None:
                    cell = f"{computed:>6d} / n/a"
                else:
                    diff = computed - expected
                    cell = f"{computed:>6d}/{expected:<4d}({diff:+d})"
                row += f"{cell:>18}"
            print(row)
