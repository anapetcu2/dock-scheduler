import { X } from "lucide-react";
import type { ReactNode } from "react";

interface DrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Drawer({ open, title, onClose, children }: DrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        aria-label="Close"
        className="animate-fade-in absolute inset-0 bg-surface-950/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="animate-slide-in-right relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-surface-700 bg-surface-850 shadow-panel">
        <div className="flex items-center justify-between border-b border-surface-700 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="transition-default rounded-lg p-1.5 text-slate-400 hover:bg-surface-700 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 px-4 py-4">{children}</div>
      </div>
    </div>
  );
}
