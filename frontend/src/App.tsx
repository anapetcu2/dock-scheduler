import { Route, Routes } from "react-router-dom";

import { Nav } from "./components/Nav";
import { LoginPage } from "./features/auth/LoginPage";
import { BerthsPage } from "./features/berths/BerthsPage";
import { SchedulePage } from "./features/schedule/SchedulePage";
import { VesselDetailPage } from "./features/vessels/VesselDetailPage";
import { VesselListPage } from "./features/vessels/VesselListPage";

export function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Nav />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Routes>
          <Route path="/" element={<SchedulePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/vessels" element={<VesselListPage />} />
          <Route path="/vessels/:vesselId" element={<VesselDetailPage />} />
          <Route path="/berths" element={<BerthsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

function NotFound() {
  return <p className="text-sm text-slate-500">Page not found.</p>;
}
