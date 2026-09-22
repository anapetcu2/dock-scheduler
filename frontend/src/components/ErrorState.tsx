import { AlertTriangle } from "lucide-react";

import { ApiError } from "../api/client";

function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    if (typeof error.detail === "string") return error.detail;
    if (
      typeof error.detail === "object" &&
      error.detail !== null &&
      "detail" in error.detail &&
      typeof (error.detail as { detail: unknown }).detail === "string"
    ) {
      return (error.detail as { detail: string }).detail;
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

export function ErrorState({ error }: { error: unknown }) {
  return (
    <div
      className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
      role="alert"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
      {messageFor(error)}
    </div>
  );
}
