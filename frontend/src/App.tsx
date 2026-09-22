import { Route, Routes } from "react-router-dom";

import { Nav } from "./components/Nav";
import { RequireAuth } from "./components/RequireAuth";
import { LoginPage } from "./features/auth/LoginPage";
import { AvailabilityPage } from "./features/availability/AvailabilityPage";
import { BerthsPage } from "./features/berths/BerthsPage";
import { HomePage } from "./features/home/HomePage";
import { ReportsPage } from "./features/reports/ReportsPage";
import { ReviewPage } from "./features/review/ReviewPage";
import { SchedulePage } from "./features/schedule/SchedulePage";
import { VesselDetailPage } from "./features/vessels/VesselDetailPage";
import { VesselListPage } from "./features/vessels/VesselListPage";

export function App() {
  return (
    <div className="min-h-screen bg-surface-gradient">
      <Nav />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Routes>
          <Route path="/" element={<SchedulePage />} />
          <Route path="/welcome" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/vessels" element={<VesselListPage />} />
          <Route path="/vessels/:vesselId" element={<VesselDetailPage />} />
          <Route path="/berths" element={<BerthsPage />} />
          <Route path="/availability" element={<AvailabilityPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route
            path="/review"
            element={
              <RequireAuth>
                <ReviewPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

function NotFound() {
  return <p className="text-sm text-slate-400">Page not found.</p>;
}
