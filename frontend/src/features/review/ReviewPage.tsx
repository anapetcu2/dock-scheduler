import { useState } from "react";

import { useBerths } from "../../api/berths";
import { useReviewSummary } from "../../api/review";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { BookingDrawer, type DrawerState } from "../bookings/BookingDrawer";
import { ImportIssuesTab } from "./ImportIssuesTab";
import { IntegrityTab } from "./IntegrityTab";
import { SummaryCards } from "./SummaryCards";

type Tab = "integrity" | "import-issues";

export function ReviewPage() {
  const [tab, setTab] = useState<Tab>("integrity");
  const [drawer, setDrawer] = useState<DrawerState>({ mode: "closed" });
  const { data: summary, isPending, isError, error } = useReviewSummary();
  const { data: berths } = useBerths();

  return (
    <div className="animate-fade-in-up">
      <h1 className="mb-4 text-xl font-semibold text-slate-100">Data review</h1>

      {isPending && <LoadingState label="Loading summary…" />}
      {isError && <ErrorState error={error} />}
      {summary && <SummaryCards summary={summary} />}

      <div className="mb-4 mt-6 flex gap-1 border-b border-surface-700">
        <TabButton active={tab === "integrity"} onClick={() => setTab("integrity")}>
          Integrity
        </TabButton>
        <TabButton active={tab === "import-issues"} onClick={() => setTab("import-issues")}>
          Import issues
        </TabButton>
      </div>

      {tab === "integrity" ? (
        <IntegrityTab onOpenBooking={(bookingId) => setDrawer({ mode: "view", bookingId })} />
      ) : (
        <ImportIssuesTab />
      )}

      <BookingDrawer
        state={drawer}
        berths={berths ?? []}
        onClose={() => setDrawer({ mode: "closed" })}
        onOpenBooking={(bookingId) => setDrawer({ mode: "view", bookingId })}
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`transition-default border-b-2 px-3 py-2 text-sm font-medium ${
        active ? "border-brand-500 text-brand-300" : "border-transparent text-slate-500 hover:text-slate-300"
      }`}
    >
      {children}
    </button>
  );
}
