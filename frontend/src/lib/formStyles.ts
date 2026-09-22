/** Shared Tailwind class strings for form fields, so every page's inputs,
 * selects, and labels look consistent under the dark theme without
 * repeating the same long class list everywhere. */
// Deliberately excludes width: Tailwind's generated stylesheet order (not
// className string order) decides which of two same-specificity width
// utilities wins, so a caller appending e.g. "w-24" after this string
// can't reliably override a "w-full" baked in here. Callers add their own
// width utility (usually "w-full", sometimes narrower).
export const inputClass =
  "transition-default rounded-lg border border-surface-600 bg-surface-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 hover:border-surface-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

export const labelClass = "mb-1 block text-sm font-medium text-slate-300";

export const cardClass = "rounded-xl border border-surface-700 bg-surface-850 shadow-panel";

export const tableWrapperClass =
  "w-full overflow-hidden rounded-xl border border-surface-700 bg-surface-850 shadow-panel";

export const tableHeadClass =
  "bg-surface-800/80 text-left text-xs font-medium uppercase tracking-wide text-slate-400";
