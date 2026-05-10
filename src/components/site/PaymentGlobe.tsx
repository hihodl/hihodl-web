"use client";

import { useEffect, useRef, useState } from "react";

/**
 * PaymentGlobe v3 — Earth with hand-traced continents.
 *
 * Continents are simplified lat/lng polygons (~150 vertices total).
 * Each frame, every vertex is projected orthographically to 2D.
 * Continents whose center is on the visible hemisphere render as
 * filled SVG paths — recognisable as land masses, not dots.
 *
 * Brand alignment (PM feedback May 5):
 *   - Globe land: brand blue (sampled from HIHODL-512 steel-blue logo bg)
 *   - Cities + payment arcs: amber (action color)
 *   - Atmosphere: cool blue tone
 *
 * No external libs. Pure SVG + math.
 */

const RAD = Math.PI / 180;
const VIEW = 400;
const CX = VIEW / 2;
const CY = VIEW / 2;
const R = 160;
const ROTATION_PERIOD_MS = 90_000;

type LatLng = [number, number]; // [lat, lng]

/* ─── Continent polygons (hand-traced, simplified) ─── */

const CONTINENTS: { name: string; points: LatLng[] }[] = [
  {
    name: "North America",
    points: [
      [72, -156], [70, -141], [70, -125], [69, -110], [62, -98], [60, -94],
      [55, -82], [60, -78], [62, -68], [55, -57], [49, -53], [44, -65],
      [40, -73], [37, -76], [32, -80], [29, -81], [25, -80], [25, -83],
      [29, -88], [29, -94], [25, -97], [22, -97], [20, -97], [18, -94],
      [16, -91], [13, -89], [11, -87], [9, -83], [7, -78], [9, -82],
      [12, -86], [16, -94], [18, -103], [22, -106], [26, -112], [29, -114],
      [32, -117], [35, -121], [40, -124], [44, -124], [48, -124], [52, -132],
      [56, -135], [60, -145], [62, -148], [60, -155], [58, -158], [60, -163],
      [65, -165], [69, -163], [71, -156],
    ],
  },
  {
    name: "Greenland",
    points: [
      [83, -38], [80, -20], [76, -18], [70, -22], [64, -42], [60, -45],
      [62, -50], [68, -52], [72, -55], [78, -55], [82, -50],
    ],
  },
  {
    name: "South America",
    points: [
      [12, -72], [11, -68], [12, -62], [10, -60], [9, -55], [5, -52],
      [1, -50], [-1, -47], [-5, -36], [-8, -35], [-13, -38], [-18, -40],
      [-23, -45], [-26, -48], [-32, -52], [-34, -55], [-38, -57], [-42, -62],
      [-50, -68], [-55, -68], [-54, -73], [-46, -75], [-38, -73], [-30, -71],
      [-22, -70], [-18, -71], [-12, -77], [-6, -81], [-2, -80], [2, -78],
      [7, -78], [11, -75],
    ],
  },
  {
    name: "Europe",
    points: [
      [70, 28], [70, 20], [68, 14], [62, 5], [58, 5], [58, 11], [55, 8],
      [54, 3], [53, -3], [56, -5], [58, -3], [59, 3], [55, -1], [52, 0],
      [50, -3], [48, -5], [44, -8], [40, -9], [37, -9], [36, -6], [37, -2],
      [37, 4], [40, 0], [42, 9], [40, 14], [37, 16], [40, 18], [44, 14],
      [45, 12], [44, 9], [46, 13], [45, 18], [42, 20], [40, 23], [40, 27],
      [42, 28], [45, 29], [50, 30], [55, 30], [60, 28], [65, 30], [68, 30],
    ],
  },
  {
    name: "Africa",
    points: [
      [37, -7], [36, 0], [33, 10], [33, 22], [30, 30], [31, 35], [27, 34],
      [22, 37], [16, 39], [12, 43], [12, 49], [10, 52], [4, 50], [1, 47],
      [-2, 41], [-10, 40], [-14, 40], [-21, 35], [-26, 33], [-32, 28],
      [-34, 26], [-35, 20], [-32, 18], [-29, 16], [-22, 14], [-18, 12],
      [-12, 13], [-7, 12], [-4, 11], [-1, 9], [3, 9], [5, 8], [4, 4],
      [4, 1], [6, -2], [4, -8], [-1, -10], [-5, -12], [4, -8], [9, -13],
      [13, -16], [18, -16], [22, -16], [26, -13], [30, -10], [33, -7], [37, -8],
    ],
  },
  {
    name: "Asia",
    points: [
      [78, 105], [76, 130], [72, 145], [68, 175], [65, 178], [60, 165],
      [56, 162], [55, 158], [56, 152], [60, 148], [56, 143], [54, 142],
      [52, 142], [46, 144], [44, 146], [42, 142], [40, 130], [37, 127],
      [34, 126], [37, 121], [34, 119], [30, 121], [26, 119], [21, 109],
      [22, 102], [18, 105], [12, 109], [10, 105], [13, 100], [11, 99],
      [8, 99], [12, 94], [16, 94], [22, 90], [22, 88], [21, 89], [20, 86],
      [16, 80], [10, 78], [8, 77], [11, 75], [16, 73], [20, 70], [25, 64],
      [27, 57], [25, 56], [22, 60], [16, 53], [13, 49], [12, 43], [16, 41],
      [22, 39], [27, 35], [30, 35], [32, 35], [36, 36], [37, 41], [38, 48],
      [37, 54], [40, 50], [42, 49], [42, 53], [42, 60], [42, 75], [44, 80],
      [50, 85], [55, 85], [60, 75], [65, 70], [70, 65], [72, 75], [73, 80],
      [78, 90],
    ],
  },
  {
    name: "Indonesia/SEA islands",
    points: [
      [5, 95], [3, 100], [-2, 102], [-4, 105], [-6, 106], [-8, 110],
      [-9, 115], [-8, 118], [-3, 119], [0, 117], [3, 113], [4, 105],
      [5, 100],
    ],
  },
  {
    name: "Australia",
    points: [
      [-12, 130], [-12, 135], [-12, 142], [-15, 145], [-18, 146], [-22, 150],
      [-28, 153], [-34, 151], [-37, 149], [-38, 145], [-38, 141], [-35, 138],
      [-32, 137], [-32, 133], [-34, 128], [-32, 122], [-26, 114], [-22, 113],
      [-18, 122], [-15, 128], [-12, 130],
    ],
  },
  {
    name: "Japan",
    points: [
      [45, 142], [42, 142], [38, 141], [35, 139], [33, 132], [33, 130],
      [37, 137], [40, 140], [44, 144],
    ],
  },
  {
    name: "UK",
    points: [
      [60, -5], [58, -3], [55, -3], [54, -6], [51, -5], [50, -2], [52, 1],
      [54, 0], [58, -2], [60, -3],
    ],
  },
  {
    name: "Madagascar",
    points: [
      [-12, 49], [-15, 50], [-19, 49], [-22, 48], [-25, 47], [-25, 45],
      [-22, 44], [-18, 44], [-14, 47],
    ],
  },
  {
    name: "New Zealand",
    points: [
      [-34, 173], [-37, 175], [-40, 176], [-42, 174], [-41, 172], [-37, 170],
      [-35, 172],
    ],
  },
];

/* ─── Cities ─── */

const CITIES = [
  { id: "ny",   name: "NEW YORK",     lat: 40.7,  lng: -74.0,  important: true },
  { id: "sfo",  name: "SAN FRANCISCO", lat: 37.8, lng: -122.4 },
  { id: "lis",  name: "LISBON",       lat: 38.7,  lng: -9.1,   important: true },
  { id: "lag",  name: "LAGOS",        lat: 6.5,   lng: 3.4,    important: true },
  { id: "ber",  name: "BERLIN",       lat: 52.5,  lng: 13.4 },
  { id: "cdmx", name: "MEXICO CITY",  lat: 19.4,  lng: -99.1,  important: true },
  { id: "mnl",  name: "MANILA",       lat: 14.6,  lng: 120.98 },
  { id: "buen", name: "BUENOS AIRES", lat: -34.6, lng: -58.4 },
  { id: "tok",  name: "TOKYO",        lat: 35.7,  lng: 139.7 },
];

const ARC_PAIRS: Array<[string, string]> = [
  ["sfo", "lis"], ["ny", "lag"], ["ber", "cdmx"], ["lis", "buen"],
  ["mnl", "lis"], ["tok", "buen"], ["ny", "lis"],
];

/* ─── Orthographic projection ─── */

function project(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
): { x: number; y: number; depth: number } | null {
  const rLat = lat * RAD;
  const rCLat = centerLat * RAD;
  const dLng = (lng - centerLng) * RAD;
  const cosC =
    Math.sin(rCLat) * Math.sin(rLat) +
    Math.cos(rCLat) * Math.cos(rLat) * Math.cos(dLng);
  if (cosC < 0) return null;
  const x = R * Math.cos(rLat) * Math.sin(dLng);
  const y =
    R *
    (Math.cos(rCLat) * Math.sin(rLat) -
      Math.sin(rCLat) * Math.cos(rLat) * Math.cos(dLng));
  return { x: CX + x, y: CY - y, depth: cosC };
}

/* ─── Component ─── */

export function PaymentGlobe() {
  const [centerLng, setCenterLng] = useState(-30);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;
      const angle = (elapsed / ROTATION_PERIOD_MS) * 360;
      const lng = -30 - angle;
      setCenterLng(((lng + 540) % 360) - 180);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const centerLat = 12;

  // Cities
  const projectedCities = CITIES.map((c) => ({
    ...c,
    p: project(c.lat, c.lng, centerLat, centerLng),
  }));

  // Active arc
  const [arcIdx, setArcIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setArcIdx((i) => (i + 1) % ARC_PAIRS.length), 2800);
    return () => clearInterval(id);
  }, []);
  const [fromId, toId] = ARC_PAIRS[arcIdx];
  const fromCity = projectedCities.find((c) => c.id === fromId);
  const toCity = projectedCities.find((c) => c.id === toId);

  return (
    <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="w-full h-full select-none">
      <defs>
        <radialGradient id="sphere-fill" cx="40%" cy="35%" r="65%">
          <stop offset="0%"   stopColor="rgba(114, 149, 181, 0.20)" />
          <stop offset="55%"  stopColor="rgba(44, 69, 102, 0.45)" />
          <stop offset="100%" stopColor="rgba(15, 24, 34, 0.30)" />
        </radialGradient>
        <radialGradient id="atmosphere" cx="50%" cy="50%" r="55%">
          <stop offset="68%"  stopColor="rgba(79,112,144,0)" />
          <stop offset="86%"  stopColor="rgba(79,112,144,0.20)" />
          <stop offset="100%" stopColor="rgba(79,112,144,0)" />
        </radialGradient>
        <linearGradient id="arc-stroke" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#FFD234" />
          <stop offset="100%" stopColor="#FFB703" />
        </linearGradient>
        <filter id="arc-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.6" />
        </filter>
      </defs>

      {/* Atmosphere glow */}
      <circle cx={CX} cy={CY} r={R + 28} fill="url(#atmosphere)" />

      {/* Sphere base */}
      <circle
        cx={CX}
        cy={CY}
        r={R}
        fill="url(#sphere-fill)"
        stroke="rgba(79,112,144,0.25)"
        strokeWidth="0.5"
      />

      {/* Continents — hand-traced polygons */}
      <g>
        {CONTINENTS.map((c) => {
          // Project each vertex; if any go nullify (back of sphere), break the path
          const segments: Array<Array<{ x: number; y: number }>> = [];
          let current: Array<{ x: number; y: number }> = [];
          for (const [lat, lng] of c.points) {
            const p = project(lat, lng, centerLat, centerLng);
            if (p) {
              current.push({ x: p.x, y: p.y });
            } else if (current.length) {
              segments.push(current);
              current = [];
            }
          }
          if (current.length) segments.push(current);
          if (!segments.length) return null;

          // Build path data — only render if segment has 3+ points
          const d = segments
            .filter((s) => s.length >= 3)
            .map(
              (s) =>
                `M${s[0].x.toFixed(1)},${s[0].y.toFixed(1)} ` +
                s.slice(1).map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") +
                " Z",
            )
            .join(" ");
          if (!d) return null;

          return (
            <path
              key={c.name}
              d={d}
              fill="rgba(114, 149, 181, 0.45)"
              stroke="rgba(160, 195, 230, 0.30)"
              strokeWidth="0.5"
            />
          );
        })}
      </g>

      {/* Latitude grid (subtle) */}
      <g opacity="0.2">
        {[-30, 0, 30, 60].map((lat) => {
          const ry = Math.abs(R * Math.cos(lat * RAD) * Math.sin(centerLat * RAD));
          const yOff = R * Math.sin(lat * RAD) * Math.cos(centerLat * RAD);
          return (
            <ellipse
              key={lat}
              cx={CX}
              cy={CY - yOff}
              rx={R * Math.cos(lat * RAD)}
              ry={Math.max(1, ry)}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="0.4"
            />
          );
        })}
      </g>

      {/* City dots + labels */}
      {projectedCities.map((c) => {
        if (!c.p) return null;
        const isActive = c.id === fromId || c.id === toId;
        const size = c.important ? 3 : 2;
        return (
          <g key={c.id}>
            {isActive && (
              <circle
                cx={c.p.x}
                cy={c.p.y}
                r={size}
                fill="none"
                stroke="#FFD234"
                strokeWidth="0.8"
                style={{
                  transformOrigin: `${c.p.x}px ${c.p.y}px`,
                  animation: "ring-pulse 1.6s ease-out infinite",
                }}
              />
            )}
            <circle
              cx={c.p.x}
              cy={c.p.y}
              r={size}
              fill={isActive ? "#FFD234" : "#FFB703"}
              opacity={Math.min(1, 0.7 + c.p.depth * 0.4)}
            />
            {c.important && c.p.depth > 0.3 && (
              <text
                x={c.p.x + size + 3}
                y={c.p.y - size - 1}
                fontSize="6.5"
                fontFamily="ui-monospace, monospace"
                fontWeight="500"
                fill="#FFFFFF"
                opacity={Math.min(1, c.p.depth * 1.2)}
                letterSpacing="0.6"
              >
                {c.name}
              </text>
            )}
          </g>
        );
      })}

      {/* Active payment arc */}
      {fromCity?.p && toCity?.p && (
        <PaymentArc
          key={`${fromId}-${toId}-${arcIdx}`}
          fromX={fromCity.p.x}
          fromY={fromCity.p.y}
          toX={toCity.p.x}
          toY={toCity.p.y}
        />
      )}

      <style>{`
        @keyframes ring-pulse {
          0%   { r: 3; opacity: 0.7; }
          100% { r: 12; opacity: 0; }
        }
        @keyframes arc-draw {
          0%   { stroke-dashoffset: 220; opacity: 0; }
          15%  { opacity: 1; }
          70%  { stroke-dashoffset: 0; opacity: 1; }
          100% { stroke-dashoffset: -220; opacity: 0; }
        }
        @keyframes packet-fly {
          0%   { offset-distance: 0%; opacity: 0; }
          15%  { opacity: 1; }
          85%  { opacity: 1; }
          100% { offset-distance: 100%; opacity: 0; }
        }
      `}</style>
    </svg>
  );
}

function PaymentArc({
  fromX,
  fromY,
  toX,
  toY,
}: {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}) {
  const cx = (fromX + toX) / 2;
  const cy = (fromY + toY) / 2;
  const dx = cx - CX;
  const dy = cy - CY;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const arcHeight = 70;
  const ctrlX = cx + (dx / dist) * arcHeight;
  const ctrlY = cy + (dy / dist) * arcHeight - 30;
  const pathD = `M${fromX},${fromY} Q${ctrlX},${ctrlY} ${toX},${toY}`;

  return (
    <g filter="url(#arc-glow)">
      <path
        d={pathD}
        fill="none"
        stroke="url(#arc-stroke)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeDasharray="220"
        strokeDashoffset="220"
        style={{ animation: "arc-draw 2.6s ease-in-out forwards" }}
      />
      <circle
        r="3"
        fill="#FFD234"
        style={{
          offsetPath: `path('${pathD}')`,
          animation: "packet-fly 2.6s ease-in-out forwards",
        }}
      />
    </g>
  );
}
