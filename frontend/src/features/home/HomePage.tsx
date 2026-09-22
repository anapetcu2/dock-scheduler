import {
  Anchor,
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  Compass,
  LayoutDashboard,
  Sailboat,
  Search,
  Sparkles,
} from "lucide-react";
import type { ComponentType } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../auth/useAuth";

interface Service {
  to: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  accent: string;
  requiresAuth?: boolean;
}

const SERVICES: Service[] = [
  {
    to: "/",
    icon: CalendarDays,
    title: "Schedule",
    description:
      "A live, color-coded timeline of every berth. Drag across empty days to book, click a bar to view or edit — conflicts are impossible by design.",
    accent: "from-blue-500 to-brand-700",
  },
  {
    to: "/vessels",
    icon: Sailboat,
    title: "Vessels",
    description:
      "The full fleet roster: lengths, drafts, organizations, and booking history, split into what's active and what still needs data.",
    accent: "from-sky-400 to-blue-600",
  },
  {
    to: "/berths",
    icon: Anchor,
    title: "Berths",
    description:
      "Manage dock capacity — lengths and draft limits for every berth, editable inline by admins.",
    accent: "from-cyan-400 to-sky-600",
  },
  {
    to: "/availability",
    icon: Search,
    title: "Find a berth",
    description:
      "Give it a vessel or a length and a date range — get back every berth that fits, sorted tightest-first.",
    accent: "from-emerald-400 to-teal-600",
  },
  {
    to: "/reports",
    icon: LayoutDashboard,
    title: "Reports",
    description:
      "Utilization charts and a CSV export across any year range — see how hard each berth is working.",
    accent: "from-amber-400 to-orange-600",
  },
  {
    to: "/review",
    icon: ClipboardCheck,
    title: "Data review",
    description:
      "Where 23 years of historical spreadsheet data gets audited — double-bookings, mismatched lengths, unresolved parse issues.",
    accent: "from-violet-400 to-fuchsia-600",
    requiresAuth: true,
  },
];

export function HomePage() {
  const { isLoggedIn, user } = useAuth();

  return (
    <div className="animate-fade-in-up">
      <Hero isLoggedIn={isLoggedIn} userName={user?.name} />

      <section className="mx-auto mt-14 max-w-6xl">
        <div className="mb-8 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Everything in one place
          </h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.filter((s) => !s.requiresAuth || isLoggedIn).map((service, i) => (
            <ServiceCard key={service.to + service.title} service={service} index={i} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Hero({ isLoggedIn, userName }: { isLoggedIn: boolean; userName?: string }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-surface-700 bg-surface-850 px-6 py-16 shadow-panel sm:px-12">
      {/* Decorative background: a faint grid plus slow-floating glow orbs. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(#93c5fd 1px, transparent 1px), linear-gradient(90deg, #93c5fd 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
        aria-hidden
      />
      <div
        className="animate-float pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-brand-600/30 blur-3xl"
        aria-hidden
      />
      <div
        className="animate-float-slow pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-sky-500/20 blur-3xl"
        aria-hidden
      />

      <div className="relative flex flex-col items-center text-center">
        <span className="animate-fade-in mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-gradient shadow-glow">
          <Compass className="h-8 w-8 text-white" />
        </span>
        <h1
          className="animate-gradient-x bg-gradient-to-r from-brand-300 via-sky-300 to-brand-400 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl"
          style={{ backgroundSize: "200% 200%" }}
        >
          Dock Scheduler
        </h1>
        <p className="animate-fade-in-up mt-4 max-w-xl text-balance text-base text-slate-400 sm:text-lg">
          {isLoggedIn
            ? `Welcome back, ${userName?.split(" ")[0] ?? "there"}. Conflict-free berth booking for the whole fleet, from a single live timeline.`
            : "Conflict-free berth booking for the whole fleet — a live timeline, instant fit checks, and 23 years of history, all in one place."}
        </p>
        <div className="animate-fade-in-up mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className="transition-default group inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-glow hover:brightness-110"
          >
            Open the schedule
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          {!isLoggedIn && (
            <Link
              to="/login"
              className="transition-default rounded-lg border border-surface-600 bg-surface-800 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:border-surface-500 hover:bg-surface-700"
            >
              Log in
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function ServiceCard({ service, index }: { service: Service; index: number }) {
  const Icon = service.icon;
  return (
    <Link
      to={service.to}
      style={{ animationDelay: `${index * 70}ms`, animationFillMode: "backwards" }}
      className="animate-fade-in-up group relative overflow-hidden rounded-2xl border border-surface-700 bg-surface-850 p-5 shadow-panel transition-all duration-300 ease-out hover:-translate-y-1 hover:border-surface-500 hover:shadow-glow"
    >
      <div
        className={`absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${service.accent} opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-25`}
        aria-hidden
      />
      <div className="relative">
        <span
          className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${service.accent} text-white shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}
        >
          <Icon className="h-5 w-5" />
        </span>
        <h3 className="flex items-center gap-1.5 text-base font-semibold text-slate-100">
          {service.title}
          <ArrowRight className="h-3.5 w-3.5 -translate-x-1 text-brand-400 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{service.description}</p>
      </div>
    </Link>
  );
}
