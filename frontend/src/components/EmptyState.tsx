import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-surface-600 bg-surface-850/50 px-4 py-12 text-center text-sm text-slate-400">
      <Inbox className="h-6 w-6 text-slate-600" />
      {children}
    </div>
  );
}
