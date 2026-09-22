import { useRef, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../auth/useAuth";

interface Berth {
  to: string;
  title: string;
  description: string;
  accent: string;
  requiresAuth?: boolean;
  /** Point on the main causeway this berth's gangway branches from. */
  anchor: [number, number];
  /** The berth's dock area (top-left corner), in the shared coordinate space. */
  rect: { x: number; y: number; w: number; h: number };
  rotate: number;
  /** Which side the hover tooltip opens on. Defaults to "top" — set to
   *  "bottom" for berths sitting close to the canvas's top edge, or their
   *  tooltip gets clipped by the page instead of just floating over it. */
  tooltipSide?: "top" | "bottom";
}

const VIEW_W = 1000;
const VIEW_H = 700;

// The main causeway every berth branches off of — a smooth curve (not a
// straight/bent line) so it reads like a real breakwater road.
const PIER_P0: [number, number] = [90, 560];
const PIER_P1: [number, number] = [350, 480];
const PIER_P2: [number, number] = [650, 260];
const PIER_P3: [number, number] = [900, 180];
const MAIN_PIER_D = `M ${PIER_P0[0]} ${PIER_P0[1]} C ${PIER_P1[0]} ${PIER_P1[1]}, ${PIER_P2[0]} ${PIER_P2[1]}, ${PIER_P3[0]} ${PIER_P3[1]}`;

function cubicPoint(t: number): [number, number] {
  const mt = 1 - t;
  const x =
    mt ** 3 * PIER_P0[0] + 3 * mt ** 2 * t * PIER_P1[0] + 3 * mt * t ** 2 * PIER_P2[0] + t ** 3 * PIER_P3[0];
  const y =
    mt ** 3 * PIER_P0[1] + 3 * mt ** 2 * t * PIER_P1[1] + 3 * mt * t ** 2 * PIER_P2[1] + t ** 3 * PIER_P3[1];
  return [x, y];
}

function cubicTangentDeg(t: number): number {
  const mt = 1 - t;
  const dx = 3 * mt ** 2 * (PIER_P1[0] - PIER_P0[0]) + 6 * mt * t * (PIER_P2[0] - PIER_P1[0]) + 3 * t ** 2 * (PIER_P3[0] - PIER_P2[0]);
  const dy = 3 * mt ** 2 * (PIER_P1[1] - PIER_P0[1]) + 6 * mt * t * (PIER_P2[1] - PIER_P1[1]) + 3 * t ** 2 * (PIER_P3[1] - PIER_P2[1]);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

// The raw bezier parameter t does NOT move at a constant speed along the
// curve (it bunches up wherever the control points pull it tighter), so
// anything placed at evenly-spaced t values — piling posts, ticks — ends up
// visibly unevenly spaced on screen. This builds an arc-length lookup table
// once, so everything below can instead be placed at an even fraction of
// the curve's actual on-screen length.
const ARC_SAMPLES = 240;
const ARC_TABLE: Array<{ t: number; dist: number }> = (() => {
  const table = [{ t: 0, dist: 0 }];
  let prev = cubicPoint(0);
  let total = 0;
  for (let i = 1; i <= ARC_SAMPLES; i++) {
    const t = i / ARC_SAMPLES;
    const p = cubicPoint(t);
    total += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    table.push({ t, dist: total });
    prev = p;
  }
  return table;
})();
const CURVE_LENGTH = ARC_TABLE[ARC_TABLE.length - 1].dist;

function tAtArcFraction(fraction: number): number {
  const target = fraction * CURVE_LENGTH;
  let lo = 0;
  let hi = ARC_TABLE.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ARC_TABLE[mid].dist < target) lo = mid + 1;
    else hi = mid;
  }
  return ARC_TABLE[lo].t;
}

// Pavement joints: short lines straight across the road's full width (not
// just poking out one side), evenly spaced along the curve's real length.
const PIER_TICKS = Array.from({ length: 16 }, (_, i) => {
  const t = tAtArcFraction(0.04 + (i / 15) * 0.92);
  const [x, y] = cubicPoint(t);
  const perpRad = ((cubicTangentDeg(t) + 90) * Math.PI) / 180;
  const dx = 12 * Math.cos(perpRad);
  const dy = 12 * Math.sin(perpRad);
  return { x1: x - dx, y1: y - dy, x2: x + dx, y2: y + dy };
});

// A shoreline the causeway grows out of, in each far corner.
const LAND_SW = "M -20 720 L -20 590 L 70 555 L 150 590 L 175 660 L 150 720 Z";
const LAND_NE = "M 1020 -20 L 1020 90 L 930 60 L 880 5 L 900 -20 Z";
// Small unconnected jetty fingers off the shoreline, purely decorative.
const JETTY_STUBS = [
  "M 60 588 L 20 545",
  "M 110 598 L 130 545",
  "M 920 40 L 965 15",
];

// A point offset perpendicular to the causeway at parameter t, for placing
// channel buoys just off to one side of it.
function offsetPoint(t: number, dist: number, side: 1 | -1): [number, number] {
  const [x, y] = cubicPoint(t);
  const rad = ((cubicTangentDeg(t) + 90) * Math.PI) / 180;
  return [x + side * dist * Math.cos(rad), y + side * dist * Math.sin(rad)];
}

// The causeway's painted edge lines, each a polyline hugging the curve at a
// fixed perpendicular offset so they actually follow the road's curvature.
function buildEdgePath(side: 1 | -1): string {
  const n = 32;
  const pts = Array.from({ length: n + 1 }, (_, i) => offsetPoint(tAtArcFraction(i / n), 12, side));
  return `M ${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L ")}`;
}
const ROAD_EDGE_LEFT = buildEdgePath(-1);
const ROAD_EDGE_RIGHT = buildEdgePath(1);

// Small grit specks scattered across the road surface for an asphalt texture.
const ROAD_SPECKLES = Array.from({ length: 46 }, (_, i) => {
  const t = (i + 0.5) / 46;
  const side: 1 | -1 = i % 2 === 0 ? 1 : -1;
  const dist = ((i * 37) % 11) * 0.9;
  const [x, y] = offsetPoint(t, dist, side);
  return [x, y, (i % 3) + 0.5] as [number, number, number];
});

// Alternating red/green channel markers flanking the causeway, like a real chart.
const BUOYS: Array<{ t: number; side: 1 | -1; color: string }> = [
  { t: 0.12, side: -1, color: "#e0685f" },
  { t: 0.12, side: 1, color: "#4caf6d" },
  { t: 0.4, side: -1, color: "#e0685f" },
  { t: 0.4, side: 1, color: "#4caf6d" },
  { t: 0.7, side: -1, color: "#e0685f" },
  { t: 0.7, side: 1, color: "#4caf6d" },
];

// Soft depth-contour rings in open water, like a bathymetric chart.
const CONTOURS: Array<{ cx: number; cy: number; rx: number; ry: number }> = [
  { cx: 250, cy: 560, rx: 130, ry: 65 },
  { cx: 250, cy: 560, rx: 210, ry: 105 },
  { cx: 780, cy: 480, rx: 150, ry: 80 },
];

// Cursor ripples cycle through these accent hues for a bit of variety.
const RIPPLE_HUES = ["#e7ecfb", "#abb9f2", "#92e0e2", "#a0c5d4"];

// A couple of markers along the water rendered as tiny vessel hulls instead
// of plain dots, for texture variety.
const HULLS: Array<{ x: number; y: number; rotate: number; color: string }> = [
  { x: 230, y: 620, rotate: 25, color: "#abb9f2" },
  { x: 900, y: 460, rotate: -30, color: "#92e0e2" },
  { x: 500, y: 120, rotate: 60, color: "#a0c5d4" },
  { x: 45, y: 400, rotate: -15, color: "#b3d7e4" },
];

// The six berths' gangways branch off the causeway at even fractions of its
// real length, so the pilings marking them end up evenly spaced on screen —
// not just evenly spaced in the curve's (non-uniform) bezier parameter.
const ANCHORS = [0, 0.2, 0.4, 0.6, 0.8, 1].map((f) => cubicPoint(tAtArcFraction(f)));

// Every rect position below is chosen so the rotated card's bounding box
// (half-width*|cos| + half-height*|sin| in each axis) stays fully inside
// [0,VIEW_W] x [0,VIEW_H] — a rotated 170x80 card needs ~93px of horizontal
// clearance and ~65px of vertical clearance from every edge. Don't move a
// berth without re-checking that, or it'll get clipped like before.
const BERTHS: Berth[] = [
  {
    to: "/",
    title: "Schedule",
    description:
      "A live, color-coded timeline of every berth. Drag across empty days to book, click a bar to view or edit.",
    accent: "#8189d6",
    anchor: ANCHORS[0],
    rect: { x: 65, y: 575, w: 170, h: 80 },
    rotate: -15,
  },
  {
    to: "/vessels",
    title: "Vessels",
    description:
      "The full fleet roster: lengths, drafts, organizations, and booking history for every vessel.",
    accent: "#abb9f2",
    anchor: ANCHORS[1],
    rect: { x: 275, y: 280, w: 170, h: 80 },
    rotate: 18,
  },
  {
    to: "/berths",
    title: "Berths",
    description: "Manage dock capacity — lengths and draft limits for every berth, editable by admins.",
    accent: "#a0c5d4",
    anchor: ANCHORS[2],
    rect: { x: 375, y: 480, w: 170, h: 80 },
    rotate: -16,
  },
  {
    to: "/availability",
    title: "Find a berth",
    description:
      "Give it a vessel or a length and a date range — get back every berth that fits, tightest-first.",
    accent: "#92e0e2",
    anchor: ANCHORS[3],
    rect: { x: 605, y: 110, w: 170, h: 80 },
    rotate: 17,
    tooltipSide: "bottom",
  },
  {
    to: "/reports",
    title: "Reports",
    description: "Utilization charts and a CSV export across any year range for the whole dock.",
    accent: "#b3d7e4",
    anchor: ANCHORS[4],
    rect: { x: 675, y: 350, w: 170, h: 80 },
    rotate: -18,
  },
  {
    to: "/review",
    title: "Data review",
    description:
      "Where 23 years of historical data gets audited — double-bookings, mismatches, parse issues.",
    accent: "#7c87c9",
    requiresAuth: true,
    anchor: ANCHORS[5],
    rect: { x: 805, y: 30, w: 170, h: 80 },
    rotate: 15,
    tooltipSide: "bottom",
  },
];

// Small stationary "vessels at anchor" scattered across the open water, purely decorative.
// [x, y, radius, opacity]
const DOTS: Array<[number, number, number, number]> = [
  [160, 200, 4, 0.3],
  [520, 640, 5, 0.35],
  [610, 470, 4, 0.3],
  [960, 320, 4, 0.25],
  [740, 550, 5, 0.35],
  [960, 620, 4, 0.3],
  [130, 90, 5, 0.3],
  [330, 40, 4, 0.25],
  [950, 60, 4, 0.3],
  [40, 650, 4, 0.25],
];
// A couple of the hulls below get a faint expanding ripple ring.
const RIPPLES: Array<[number, number]> = [[230, 620], [900, 460]];

// Faint lat/long-style chart grid lines across the water.
const GRID_X = Array.from({ length: 9 }, (_, i) => (i + 1) * 100);
const GRID_Y = Array.from({ length: 6 }, (_, i) => (i + 1) * 100);

function pct(value: number, total: number) {
  return `${(value / total) * 100}%`;
}

/**
 * The homepage: a full-viewport aerial view of a port. The whole page is the
 * navigation — each berth is a real link to a feature, its gangway branching
 * off the main causeway. Hovering (or focusing) a berth surfaces what it
 * does; clicking it goes there. No icons — the layout itself is the UI.
 */
export function HomePage() {
  const { isLoggedIn } = useAuth();
  const berths = BERTHS.filter((b) => !b.requiresAuth || isLoggedIn);

  // Cursor ripples: moving over the water spawns a short-lived expanding
  // ring right under the pointer, so the water visibly reacts. Positions are
  // kept as percentages of the container the listener is bound to (read via
  // currentTarget, not a separate ref) so this keeps working no matter what
  // the pointer has moved over in between — there's nothing that can go
  // stale here the way a stored ref to a different element could.
  const nextRippleId = useRef(0);
  const lastSpawnAt = useRef(0);
  const [cursorRipples, setCursorRipples] = useState<
    Array<{ id: number; left: string; top: string; hue: string }>
  >([]);

  function handlePointerMove(e: React.MouseEvent<HTMLDivElement>) {
    const now = performance.now();
    if (now - lastSpawnAt.current < 90) return;
    lastSpawnAt.current = now;
    const box = e.currentTarget.getBoundingClientRect();
    const left = `${((e.clientX - box.left) / box.width) * 100}%`;
    const top = `${((e.clientY - box.top) / box.height) * 100}%`;
    const hue = RIPPLE_HUES[nextRippleId.current % RIPPLE_HUES.length];
    const id = nextRippleId.current++;
    setCursorRipples((prev) => [...prev.slice(-11), { id, left, top, hue }]);
    window.setTimeout(() => {
      setCursorRipples((prev) => prev.filter((r) => r.id !== id));
    }, 1900);
  }

  return (
    <div
      className="relative left-1/2 right-1/2 -my-6 -ml-[50vw] -mr-[50vw] h-[calc(100vh-3.6rem)] min-h-[600px] w-screen overflow-hidden"
      onMouseMove={handlePointerMove}
    >
      <h1 className="sr-only">Dock Scheduler</h1>

      {/* Water. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 20% 15%, #0f4a58 0%, transparent 50%), radial-gradient(circle at 85% 80%, #0c3a48 0%, transparent 45%), linear-gradient(160deg, #04222c 0%, #083241 55%, #051b24 100%)",
        }}
        aria-hidden
      />
      {/* Faint wave texture, two layers crossing at different angles. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(115deg, #e7ecfb 0px, #e7ecfb 1px, transparent 1px, transparent 46px)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(35deg, #e7ecfb 0px, #e7ecfb 1px, transparent 1px, transparent 64px)",
        }}
        aria-hidden
      />
      <div
        className="animate-float pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full bg-brand-500/10 blur-3xl"
        aria-hidden
      />
      <div
        className="animate-float-slow pointer-events-none absolute -right-10 bottom-10 h-80 w-80 rounded-full bg-vessel/10 blur-3xl"
        aria-hidden
      />
      {/* Vignette. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          boxShadow: "inset 0 0 140px 40px rgba(2,10,15,0.55)",
        }}
        aria-hidden
      />

      {/* Causeway, gangways, pilings, shoreline, and anchored vessels — decorative. */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        {/* Chart grid, like a nautical chart's lat/long lines. */}
        {GRID_X.map((x) => (
          <line key={`gx-${x}`} x1={x} y1={0} x2={x} y2={VIEW_H} stroke="#e7ecfb" strokeWidth={1} opacity={0.04} />
        ))}
        {GRID_Y.map((y) => (
          <line key={`gy-${y}`} x1={0} y1={y} x2={VIEW_W} y2={y} stroke="#e7ecfb" strokeWidth={1} opacity={0.04} />
        ))}

        {/* Depth contours, like a bathymetric chart. */}
        {CONTOURS.map((c, i) => (
          <ellipse
            key={`contour-${i}`}
            cx={c.cx}
            cy={c.cy}
            rx={c.rx}
            ry={c.ry}
            fill="none"
            stroke="#e7ecfb"
            strokeWidth={1}
            opacity={0.05}
          />
        ))}

        {/* Shoreline in two far corners, so the causeway reads as leaving land. */}
        <path d={LAND_SW} fill="#33473c" stroke="#4a5f52" strokeWidth={2} opacity={0.9} />
        <path d={LAND_NE} fill="#33473c" stroke="#4a5f52" strokeWidth={2} opacity={0.9} />
        {JETTY_STUBS.map((d, i) => (
          <path key={`jetty-${i}`} d={d} fill="none" stroke="#c9c4b3" strokeWidth={5} strokeLinecap="round" opacity={0.6} />
        ))}

        {/* Channel markers flanking the causeway. */}
        {BUOYS.map((b, i) => {
          const [x, y] = offsetPoint(b.t, 34, b.side);
          return (
            <g key={`buoy-${i}`}>
              <circle cx={x} cy={y} r={4.5} fill={b.color} opacity={0.75} />
              <circle cx={x} cy={y} r={7.5} fill="none" stroke={b.color} strokeWidth={1} opacity={0.35} />
            </g>
          );
        })}

        {RIPPLES.map(([x, y], i) => (
          <circle
            key={`ripple-${i}`}
            cx={x}
            cy={y}
            r={14}
            fill="none"
            stroke="#e7ecfb"
            strokeWidth={1}
            opacity={0.2}
          >
            <animate attributeName="r" values="10;26" dur="3.5s" begin={`${i * 1.2}s`} repeatCount="indefinite" />
            <animate
              attributeName="opacity"
              values="0.3;0"
              dur="3.5s"
              begin={`${i * 1.2}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}
        {DOTS.map(([x, y, r, o], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="#e7ecfb" opacity={o} />
        ))}
        {HULLS.map((h, i) => (
          <ellipse
            key={`hull-${i}`}
            cx={h.x}
            cy={h.y}
            rx={8}
            ry={3.2}
            fill={h.color}
            opacity={0.55}
            transform={`rotate(${h.rotate} ${h.x} ${h.y})`}
          />
        ))}

        {berths.map((b) => (
          <line
            key={b.to}
            x1={b.anchor[0]}
            y1={b.anchor[1]}
            x2={b.rect.x + b.rect.w / 2}
            y2={b.rect.y + b.rect.h / 2}
            stroke="#c9c4b3"
            strokeWidth={9}
            strokeLinecap="round"
            opacity={0.85}
          />
        ))}
        {/* Causeway drop shadow, for a bit of elevation. */}
        <path
          d={MAIN_PIER_D}
          fill="none"
          stroke="#010a0f"
          strokeWidth={26}
          strokeLinecap="round"
          transform="translate(4 6)"
          opacity={0.25}
        />
        <path d={MAIN_PIER_D} fill="none" stroke="#c9c4b3" strokeWidth={24} strokeLinecap="round" />
        {/* Asphalt grit texture. */}
        {ROAD_SPECKLES.map(([x, y, r], i) => (
          <circle key={`speckle-${i}`} cx={x} cy={y} r={r} fill="#5f5a4c" opacity={0.18} />
        ))}
        {/* Painted edge lines, following the curve. */}
        <path d={ROAD_EDGE_LEFT} fill="none" stroke="#f2efe4" strokeWidth={1.5} opacity={0.5} />
        <path d={ROAD_EDGE_RIGHT} fill="none" stroke="#f2efe4" strokeWidth={1.5} opacity={0.5} />
        {/* Pavement joints, straight across the road's width. */}
        {PIER_TICKS.map((tick, i) => (
          <line
            key={`tick-${i}`}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke="#7d7868"
            strokeWidth={1.5}
            opacity={0.3}
          />
        ))}
        <path
          d={MAIN_PIER_D}
          fill="none"
          stroke="#f2efe4"
          strokeWidth={2}
          strokeDasharray="9 11"
          opacity={0.55}
        />
        {berths.map((b) => (
          <circle
            key={`piling-${b.to}`}
            cx={b.anchor[0]}
            cy={b.anchor[1]}
            r={8}
            fill="#8f8a78"
            stroke="#f2efe4"
            strokeWidth={1.5}
          />
        ))}

        {/* Bollards at each berth's corners. */}
        {berths.map((b) => {
          const cx = b.rect.x + b.rect.w / 2;
          const cy = b.rect.y + b.rect.h / 2;
          const corners: Array<[number, number]> = [
            [b.rect.x + 10, b.rect.y + 10],
            [b.rect.x + b.rect.w - 10, b.rect.y + 10],
            [b.rect.x + 10, b.rect.y + b.rect.h - 10],
            [b.rect.x + b.rect.w - 10, b.rect.y + b.rect.h - 10],
          ];
          return (
            <g key={`bollards-${b.to}`} transform={`rotate(${b.rotate} ${cx} ${cy})`}>
              {corners.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={2.5} fill="#f2efe4" opacity={0.55} />
              ))}
            </g>
          );
        })}

        {/* Compass rose. */}
        <g transform="translate(935 650)" opacity={0.4}>
          <circle r={34} fill="none" stroke="#e7ecfb" strokeWidth={1} />
          <circle r={2} fill="#e7ecfb" />
          <line x1={0} y1={-34} x2={0} y2={-22} stroke="#e7ecfb" strokeWidth={1.5} />
          <line x1={0} y1={34} x2={0} y2={22} stroke="#e7ecfb" strokeWidth={1} />
          <line x1={-34} y1={0} x2={-22} y2={0} stroke="#e7ecfb" strokeWidth={1} />
          <line x1={34} y1={0} x2={22} y2={0} stroke="#e7ecfb" strokeWidth={1} />
          <path d="M0,-26 L5,0 L0,26 L-5,0 Z" fill="#e7ecfb" opacity={0.6} />
          <text x={0} y={-40} textAnchor="middle" fontSize={11} fill="#e7ecfb" fontFamily="monospace">
            N
          </text>
        </g>

        {/* Scale bar. */}
        <g transform="translate(50 40)" opacity={0.35}>
          <line x1={0} y1={0} x2={90} y2={0} stroke="#e7ecfb" strokeWidth={1.5} />
          <line x1={0} y1={-5} x2={0} y2={5} stroke="#e7ecfb" strokeWidth={1.5} />
          <line x1={45} y1={-3} x2={45} y2={3} stroke="#e7ecfb" strokeWidth={1} />
          <line x1={90} y1={-5} x2={90} y2={5} stroke="#e7ecfb" strokeWidth={1.5} />
          <text x={45} y={18} textAnchor="middle" fontSize={10} fill="#e7ecfb" fontFamily="monospace">
            500 m
          </text>
        </g>

      </svg>

      {/* Ripples spawned by the cursor moving over the water — layered
          glow + two rings, in HTML/CSS rather than SVG SMIL so it keeps
          working reliably everywhere and is easy to make richer. */}
      <div className="pointer-events-none absolute inset-0 z-10">
        {cursorRipples.map((r) => (
          <span
            key={r.id}
            className="absolute"
            style={{ left: r.left, top: r.top }}
          >
            <span
              className="animate-ripple-core absolute rounded-full blur-[2px]"
              style={{
                width: 28,
                height: 28,
                background: `radial-gradient(circle, ${r.hue}bb 0%, transparent 70%)`,
              }}
            />
            <span
              className="animate-ripple-ring absolute rounded-full border"
              style={{ width: 16, height: 16, borderColor: r.hue, borderWidth: 1.5 }}
            />
            <span
              className="animate-ripple-ring-slow absolute rounded-full border"
              style={{ width: 16, height: 16, borderColor: r.hue, borderWidth: 1 }}
            />
          </span>
        ))}
      </div>

      {/* Interactive berths. */}
      {berths.map((b) => {
        const left = pct(b.rect.x, VIEW_W);
        const top = pct(b.rect.y, VIEW_H);
        const width = pct(b.rect.w, VIEW_W);
        const height = pct(b.rect.h, VIEW_H);
        return (
          <Link
            key={b.to}
            to={b.to}
            aria-label={`${b.title} — ${b.description}`}
            className="group absolute flex items-center justify-center"
            style={{ left, top, width, height, transform: `rotate(${b.rotate}deg)` }}
          >
            <span
              className="transition-default absolute inset-0 rounded-lg border-2 shadow-lg backdrop-blur-[1px] group-hover:shadow-glow"
              style={{ borderColor: b.accent, backgroundColor: `${b.accent}26` }}
              aria-hidden
            />
            <span
              className="transition-default absolute inset-1 rounded-md border border-dashed opacity-50"
              style={{ borderColor: b.accent }}
              aria-hidden
            />
            {/* A moored hull, sitting in the slip. */}
            <span
              className="transition-default absolute inset-x-[12%] inset-y-[22%] opacity-40 group-hover:opacity-60"
              style={{
                backgroundColor: b.accent,
                clipPath: "polygon(2% 50%, 16% 12%, 84% 12%, 98% 50%, 84% 88%, 16% 88%)",
              }}
              aria-hidden
            />
            <span
              className="absolute left-2 top-1.5 font-mono text-[9px] uppercase tracking-widest text-white/50"
              style={{ transform: `rotate(${-b.rotate}deg)` }}
              aria-hidden
            >
              Berth
            </span>

            <span
              className="relative px-2 text-center"
              style={{ transform: `rotate(${-b.rotate}deg)` }}
              aria-hidden
            >
              <span className="font-sans text-sm font-semibold text-white drop-shadow-sm sm:text-base">
                {b.title}
              </span>
            </span>

            <span
              className={`pointer-events-none absolute left-1/2 z-20 w-52 ${
                b.tooltipSide === "bottom" ? "top-full mt-3" : "bottom-full mb-3"
              }`}
              style={{ transform: `translateX(-50%) rotate(${-b.rotate}deg)` }}
              aria-hidden
            >
              <span
                className={`block scale-95 rounded-lg border border-surface-700 bg-white/95 p-3 text-left opacity-0 shadow-panel backdrop-blur transition-all duration-200 group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100 ${
                  b.tooltipSide === "bottom" ? "origin-top" : "origin-bottom"
                }`}
              >
                <span className="block font-sans text-sm font-semibold text-slate-900">
                  {b.title}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                  {b.description}
                </span>
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
