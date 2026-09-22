import { useSearchParams } from "react-router-dom";

import { type ViewRange, shiftAnchor, todayISO, viewRangeFor } from "../../lib/dates";

const VALID_VIEWS: ViewRange[] = ["2w", "month", "3m"];

/** Keeps the visible schedule range in the URL query string
 * (`?start=2019-06-01&view=month`), per SPEC.md section 9.1, so views are
 * linkable and the back button works. */
export function useScheduleRange() {
  const [searchParams, setSearchParams] = useSearchParams();

  const view: ViewRange = VALID_VIEWS.includes(searchParams.get("view") as ViewRange)
    ? (searchParams.get("view") as ViewRange)
    : "month";
  const anchor = searchParams.get("start") || todayISO();

  const range = viewRangeFor(view, anchor);

  const setView = (nextView: ViewRange) => {
    setSearchParams({ view: nextView, start: anchor });
  };

  const goTo = (nextAnchor: string) => {
    setSearchParams({ view, start: nextAnchor });
  };

  const goPrevious = () => goTo(shiftAnchor(view, anchor, -1));
  const goNext = () => goTo(shiftAnchor(view, anchor, 1));
  const goToday = () => goTo(todayISO());

  return { view, anchor, range, setView, goPrevious, goNext, goToday, goTo };
}
