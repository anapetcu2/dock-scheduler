import { describe, expect, it } from "vitest";

import {
  addDaysISO,
  compareISODate,
  daysBetweenInclusive,
  eachISODayInRange,
  formatDateRange,
  formatDayNumber,
  formatMonthLabel,
  formatWeekdayShort,
  isMonthStartISO,
  isWeekendISO,
  parseISODate,
  shiftAnchor,
  toISODate,
  viewRangeFor,
} from "./dates";

describe("parseISODate / toISODate", () => {
  it("round-trips without shifting the day", () => {
    expect(toISODate(parseISODate("2024-01-01"))).toBe("2024-01-01");
    expect(toISODate(parseISODate("2024-12-31"))).toBe("2024-12-31");
  });

  it("throws on an invalid date string", () => {
    expect(() => parseISODate("not-a-date")).toThrow();
  });
});

describe("daysBetweenInclusive", () => {
  it("counts both endpoints, matching a spreadsheet cell-per-day", () => {
    // SPEC.md section 4: Oct 3-Oct 9 occupies 7 days.
    expect(daysBetweenInclusive("2024-10-03", "2024-10-09")).toBe(7);
  });

  it("is 1 for a single-day booking", () => {
    expect(daysBetweenInclusive("2024-06-01", "2024-06-01")).toBe(1);
  });

  it("handles a leap-day span correctly", () => {
    // 2024 is a leap year: Feb has 29 days.
    expect(daysBetweenInclusive("2024-02-28", "2024-03-01")).toBe(3);
  });

  it("handles a non-leap-year February boundary", () => {
    expect(daysBetweenInclusive("2023-02-27", "2023-03-01")).toBe(3);
  });
});

describe("addDaysISO", () => {
  it("crosses a month boundary", () => {
    expect(addDaysISO("2024-01-31", 1)).toBe("2024-02-01");
  });

  it("crosses a year boundary", () => {
    expect(addDaysISO("2024-12-31", 1)).toBe("2025-01-01");
  });

  it("crosses Feb 29 on a leap year", () => {
    expect(addDaysISO("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDaysISO("2024-02-29", 1)).toBe("2024-03-01");
  });

  it("skips Feb 29 on a non-leap year", () => {
    expect(addDaysISO("2023-02-28", 1)).toBe("2023-03-01");
  });

  it("supports negative offsets", () => {
    expect(addDaysISO("2024-03-01", -1)).toBe("2024-02-29");
  });
});

describe("eachISODayInRange", () => {
  it("includes both endpoints in order", () => {
    expect(eachISODayInRange("2024-02-27", "2024-03-01")).toEqual([
      "2024-02-27",
      "2024-02-28",
      "2024-02-29",
      "2024-03-01",
    ]);
  });
});

describe("compareISODate", () => {
  it("orders lexically, which matches chronological order for ISO dates", () => {
    expect(compareISODate("2024-01-01", "2024-01-02")).toBeLessThan(0);
    expect(compareISODate("2024-02-01", "2024-01-31")).toBeGreaterThan(0);
    expect(compareISODate("2024-01-01", "2024-01-01")).toBe(0);
  });
});

describe("isWeekendISO", () => {
  it("identifies Saturday and Sunday", () => {
    expect(isWeekendISO("2024-06-01")).toBe(true); // Saturday
    expect(isWeekendISO("2024-06-02")).toBe(true); // Sunday
    expect(isWeekendISO("2024-06-03")).toBe(false); // Monday
  });
});

describe("isMonthStartISO", () => {
  it("is true only on the 1st", () => {
    expect(isMonthStartISO("2024-05-01")).toBe(true);
    expect(isMonthStartISO("2024-05-02")).toBe(false);
  });
});

describe("formatting helpers", () => {
  it("formats day number, weekday, and month label", () => {
    expect(formatDayNumber("2024-06-03")).toBe("3");
    expect(formatWeekdayShort("2024-06-03")).toBe("M");
    expect(formatMonthLabel("2024-06-03")).toBe("June 2024");
  });

  it("formats a date range, collapsing a single day", () => {
    expect(formatDateRange("2024-06-03", "2024-06-03")).toBe("Jun 3, 2024");
    expect(formatDateRange("2024-06-03", "2024-06-05")).toBe("Jun 3, 2024 – Jun 5, 2024");
  });
});

describe("viewRangeFor", () => {
  it("2w is a rolling 14-day window starting at the anchor", () => {
    expect(viewRangeFor("2w", "2024-06-10")).toEqual({ start: "2024-06-10", end: "2024-06-23" });
  });

  it("month snaps to the full calendar month containing the anchor", () => {
    expect(viewRangeFor("month", "2024-02-15")).toEqual({
      start: "2024-02-01",
      end: "2024-02-29", // leap year
    });
    expect(viewRangeFor("month", "2023-02-15")).toEqual({
      start: "2023-02-01",
      end: "2023-02-28",
    });
  });

  it("3m spans three full calendar months from the anchor's month", () => {
    expect(viewRangeFor("3m", "2024-01-20")).toEqual({
      start: "2024-01-01",
      end: "2024-03-31",
    });
  });
});

describe("shiftAnchor", () => {
  it("moves a month view forward and back a full month", () => {
    expect(shiftAnchor("month", "2024-02-01", 1)).toBe("2024-03-01");
    expect(shiftAnchor("month", "2024-03-01", -1)).toBe("2024-02-01");
  });

  it("moves a 2w view by 14 days", () => {
    expect(shiftAnchor("2w", "2024-06-10", 1)).toBe("2024-06-24");
    expect(shiftAnchor("2w", "2024-06-10", -1)).toBe("2024-05-27");
  });

  it("moves a 3m view by three months and snaps to month start", () => {
    expect(shiftAnchor("3m", "2024-01-15", 1)).toBe("2024-04-01");
  });
});
