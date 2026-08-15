"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * HeroGlobe — v4 of the payment globe.
 *
 * Ported from the `hold-hero-globe` prototype (see prototypes/hold-hero-globe.html).
 * Successor to PaymentGlobe: glass landmasses with a specular sheen, coastlines
 * correctly clipped against the limb, a non-uniform spin that races across the
 * empty Pacific and slows over land, and currency bubbles that pop where each
 * payment lands.
 *
 * No external libraries — pure SVG + math, same as PaymentGlobe.
 *
 * Differences from the prototype, all forced by the move off the animation rig:
 *   - the composition engine's clock is replaced by a rAF clock (see useClock)
 *   - geometry that does not depend on rotation is precomputed once at module
 *     load instead of per frame (identical output, ~5k fewer slerps per frame)
 *   - honours prefers-reduced-motion, and stops animating while off screen
 *   - the caption is opt-in: the page hero supplies its own copy
 */

/* ─── Stage ─── */

const W = 1920;
const H = 1080;
const CX = 960;
const CY = 545;
const R = 458;
const TILT = (20 * Math.PI) / 180;
const DEG = Math.PI / 180;
const CYCLE = 14;

/** Authored time the globe freezes at when motion is reduced. */
const STILL_T = 3.2;

const AMBER = "#FFB703";
const ICE = "#8FB8FF";

/* ─── Math ─── */

type LonLat = [number, number];
type LatLon = [number, number];
type Projected = { x: number; y: number; z: number; front: boolean };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutQuad = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

// non-uniform spin: races across the empty Pacific, slows over land
function rotAt(T: number, spin: number) {
  const base = T * spin - 40;
  return base + 34 * Math.sin((base - 160) * DEG);
}

function project(lat: number, lon: number, rot: number): Projected {
  const la = lat * DEG;
  const lo = (lon + rot) * DEG;
  const x0 = Math.cos(la) * Math.sin(lo);
  const y0 = Math.sin(la);
  const z0 = Math.cos(la) * Math.cos(lo);
  const y = y0 * Math.cos(TILT) - z0 * Math.sin(TILT);
  const z = y0 * Math.sin(TILT) + z0 * Math.cos(TILT);
  return { x: CX + R * x0, y: CY - R * y, z, front: z > 0 };
}

function vec(lat: number, lon: number): [number, number, number] {
  const la = lat * DEG;
  const lo = lon * DEG;
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
}

function toLatLon(v: [number, number, number]): LatLon {
  const n = Math.hypot(v[0], v[1], v[2]);
  return [Math.asin(v[2] / n) / DEG, Math.atan2(v[1], v[0]) / DEG];
}

function slerp(a: LatLon, b: LatLon, t: number): LatLon {
  const va = vec(a[0], a[1]);
  const vb = vec(b[0], b[1]);
  const d = clamp(va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2], -1, 1);
  const o = Math.acos(d);
  if (o < 1e-6) return a;
  const s1 = Math.sin((1 - t) * o) / Math.sin(o);
  const s2 = Math.sin(t * o) / Math.sin(o);
  return toLatLon([
    va[0] * s1 + vb[0] * s2,
    va[1] * s1 + vb[1] * s2,
    va[2] * s1 + vb[2] * s2,
  ]);
}

/* ─── Coastlines ─── */

/* Coarse continent outlines — [lon, lat] rings, low-poly on purpose. */
const LAND: LonLat[][] = [
  /* North America */
  [[-168,66],[-166,68],[-160,71],[-156,71],[-148,70],[-141,70],[-134,69],[-128,70],[-124,74],[-115,73],[-105,73],[-96,72],[-92,74],[-82,73],[-78,73],[-74,68],[-78,63],[-88,64],[-94,58],[-92,54],[-80,52],[-79,55],[-70,58],[-64,60],[-58,54],[-56,51],[-60,47],[-66,45],[-70,43],[-74,40],[-76,35],[-81,31],[-80,25],[-82,23],[-90,29],[-94,29],[-97,26],[-97,22],[-95,18],[-92,15],[-87,13],[-83,10],[-79,9],[-83,15],[-88,16],[-92,18],[-95,16],[-101,17],[-106,23],[-110,24],[-113,31],[-117,33],[-121,35],[-124,40],[-124,46],[-123,49],[-128,53],[-133,57],[-140,60],[-146,60],[-152,59],[-158,56],[-162,59],[-165,61]],
  /* Greenland */
  [[-45,60],[-42,63],[-38,66],[-32,69],[-25,71],[-22,73],[-25,77],[-33,81],[-45,83],[-58,82],[-65,79],[-60,76],[-55,71],[-52,68],[-50,64]],
  /* Iceland */
  [[-24,65],[-18,66],[-14,65],[-19,63],[-22,64]],
  /* South America */
  [[-81,-4],[-80,-6],[-77,-12],[-71,-18],[-70,-23],[-71,-30],[-73,-37],[-74,-44],[-75,-50],[-71,-54],[-66,-55],[-65,-51],[-68,-48],[-63,-42],[-62,-39],[-57,-35],[-57,-31],[-53,-34],[-48,-25],[-45,-24],[-40,-22],[-39,-16],[-37,-11],[-35,-8],[-38,-5],[-44,-2],[-48,0],[-51,1],[-53,5],[-58,7],[-61,8],[-66,11],[-72,12],[-75,9],[-77,8],[-79,2]],
  /* Africa */
  [[-17,15],[-17,21],[-13,25],[-10,27],[-6,31],[-6,36],[0,36],[9,37],[11,33],[18,30],[25,32],[31,31],[33,28],[35,23],[38,18],[43,12],[48,12],[51,12],[48,5],[43,2],[41,-2],[40,-8],[40,-13],[35,-18],[35,-24],[32,-29],[28,-33],[22,-34],[18,-34],[15,-27],[12,-18],[13,-12],[9,-1],[9,4],[3,6],[-4,5],[-8,4],[-13,8],[-16,12]],
  /* Eurasia */
  [[-9,43],[-9,37],[-6,36],[-1,38],[3,42],[4,43],[8,44],[12,44],[15,40],[18,40],[20,40],[23,38],[27,37],[30,36],[36,36],[36,33],[35,31],[34,28],[38,22],[39,17],[43,13],[48,14],[52,17],[56,20],[57,23],[61,25],[66,25],[68,24],[70,21],[72,20],[73,16],[76,9],[78,9],[80,13],[81,16],[84,19],[87,21],[89,22],[92,21],[94,18],[97,17],[98,13],[100,13],[101,8],[103,2],[104,10],[107,11],[109,15],[106,20],[108,21],[110,22],[113,22],[117,24],[120,26],[122,30],[121,34],[119,37],[122,40],[126,40],[128,35],[129,35],[130,43],[135,44],[140,46],[143,49],[140,53],[142,59],[150,60],[155,59],[160,61],[163,60],[170,62],[179,65],[179,69],[170,70],[160,70],[150,72],[140,74],[130,74],[120,74],[110,76],[100,77],[90,76],[80,74],[70,72],[60,70],[55,68],[45,68],[40,66],[33,70],[30,70],[25,70],[20,70],[15,68],[12,65],[10,63],[6,58],[8,56],[10,54],[4,52],[0,49],[-2,48],[-5,48],[-2,44]],
  /* Great Britain */
  [[-5,50],[-3,50],[0,51],[1,53],[-1,54],[0,54],[-3,56],[-2,58],[-5,58],[-6,56],[-5,54],[-3,53],[-5,52],[-4,51]],
  /* Ireland */
  [[-10,52],[-6,52],[-6,55],[-10,55]],
  /* Japan */
  [[130,31],[132,34],[135,34],[137,37],[140,36],[141,39],[141,41],[140,42],[142,43],[145,44],[144,42],[141,40],[139,35],[136,35],[133,33],[131,32]],
  /* Sumatra */
  [[95,6],[100,3],[104,-2],[106,-6],[102,-5],[98,1]],
  /* Java */
  [[105,-6],[114,-8],[112,-7],[106,-5]],
  /* Borneo */
  [[109,2],[114,4],[117,4],[118,-1],[116,-4],[110,-3],[109,0]],
  /* New Guinea */
  [[131,-1],[141,-3],[147,-8],[141,-9],[134,-8],[131,-4]],
  /* Philippines */
  [[120,18],[122,14],[126,10],[126,7],[122,6],[120,10],[119,14]],
  /* Sri Lanka */
  [[80,9],[82,7],[81,6],[80,7]],
  /* Australia */
  [[113,-22],[114,-26],[115,-31],[118,-35],[123,-34],[129,-32],[134,-32],[137,-35],[140,-38],[145,-38],[148,-37],[150,-35],[153,-30],[153,-27],[151,-24],[149,-21],[146,-19],[143,-15],[142,-11],[139,-17],[137,-13],[133,-12],[130,-12],[126,-14],[122,-17],[117,-20]],
  /* Tasmania */
  [[145,-41],[148,-41],[148,-43],[145,-43]],
  /* New Zealand */
  [[172,-34],[174,-37],[178,-38],[177,-40],[174,-41],[171,-43],[167,-46],[166,-45],[170,-42],[172,-40],[173,-38]],
  /* Madagascar */
  [[43,-12],[48,-13],[50,-16],[50,-25],[46,-25],[44,-20],[43,-16]],
  /* Cuba */
  [[-85,22],[-80,23],[-75,20],[-80,21],[-84,21]],
];

/* ─── Cities and payment flows ─── */

const CITIES = [
  { n: "San Francisco", lat: 37.77, lon: -122.42 },
  { n: "Bogotá", lat: 4.71, lon: -74.07 },
  { n: "Madrid", lat: 40.42, lon: -3.7 },
  { n: "Lagos", lat: 6.52, lon: 3.38 },
  { n: "Dubai", lat: 25.2, lon: 55.27 },
  { n: "Manila", lat: 14.6, lon: 120.98 },
  { n: "São Paulo", lat: -23.55, lon: -46.63 },
  { n: "Berlin", lat: 52.52, lon: 13.4 },
  { n: "Buenos Aires", lat: -34.6, lon: -58.38 },
  { n: "Singapore", lat: 1.35, lon: 103.82 },
];

type Flow = {
  a: number;
  b: number;
  start: number;
  dur: number;
  color: string;
  kicker: string;
  main: string;
  to: string;
};

const FLOWS: Flow[] = [
  { a: 0, b: 2, start: 0.6, dur: 3.2, color: AMBER, kicker: "Freelance invoice · Madrid", main: "$3,200", to: "€2,940" },
  { a: 1, b: 4, start: 2.4, dur: 3.4, color: ICE, kicker: "Sent Bogotá → Dubai", main: "COP 4.8M", to: "AED 4,300" },
  { a: 5, b: 8, start: 4.2, dur: 3.4, color: AMBER, kicker: "Interest earned · 30 days", main: "+$142.60", to: "" },
  { a: 7, b: 3, start: 6.0, dur: 3.2, color: ICE, kicker: "eSIM for Brazil · paid", main: "$18", to: "" },
  { a: 6, b: 9, start: 7.8, dur: 3.4, color: AMBER, kicker: "Stay booked · Thailand", main: "9 nights", to: "$412" },
  { a: 2, b: 5, start: 9.4, dur: 3.2, color: ICE, kicker: "USD account payout", main: "€890", to: "$965" },
  { a: 4, b: 0, start: 10.6, dur: 2.6, color: AMBER, kicker: "Salary · paid in dollars", main: "$5,100", to: "" },
  { a: 9, b: 6, start: 12.1, dur: 2.4, color: ICE, kicker: "Rent sent · São Paulo", main: "R$4,100", to: "$760" },
];

/* ─── Rotation-independent geometry, resolved once ───
 *
 * Densifying a coastline and walking a great-circle arc both happen in
 * lat/lon space, so neither depends on the rotation. The prototype redid
 * both every frame; hoisting them here is the whole reason this runs at 60fps
 * with the land shadows on.
 */

const LAND_DENSE: LonLat[][] = LAND.map((ring) => {
  const dense: LonLat[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    for (let k = 0; k < 10; k++) {
      const [la, lo] = slerp([a[1], a[0]], [b[1], b[0]], k / 10);
      const seed = i * 10 + k;
      const n1 = Math.sin(seed * 12.9898) * 0.42;
      const n2 = Math.sin(seed * 4.1414 + 1.7) * 0.3;
      dense.push([lo + n1, la + n2]);
    }
  }
  return dense;
});

/**
 * The land ring in a form that needs no trigonometry per frame.
 *
 * project() takes sin/cos of (lon + rot). Expanding that with the angle-addition
 * identity separates the point from the rotation:
 *
 *   x0 = cos(lat)·sin(lon+rot) = A·cos(rot) + B·sin(rot)
 *   z0 = cos(lat)·cos(lon+rot) = B·cos(rot) − A·sin(rot)
 *
 * with A = cos(lat)·sin(lon), B = cos(lat)·cos(lon) and y0 = sin(lat) all fixed
 * per point. So the 3,840 land points cost one cos and one sin for the whole
 * frame instead of four trig calls each. Algebraically exact, not an
 * approximation — the emitted path strings are identical.
 */
type DenseRing = { a: Float64Array; b: Float64Array; sinLat: Float64Array; n: number };

const LAND_RINGS: DenseRing[] = LAND_DENSE.map((dense) => {
  const n = dense.length;
  const ring: DenseRing = {
    a: new Float64Array(n),
    b: new Float64Array(n),
    sinLat: new Float64Array(n),
    n,
  };
  for (let i = 0; i < n; i++) {
    const [lon, lat] = dense[i];
    const la = lat * DEG;
    const lo = lon * DEG;
    const c = Math.cos(la);
    ring.a[i] = c * Math.sin(lo);
    ring.b[i] = c * Math.cos(lo);
    ring.sinLat[i] = Math.sin(la);
  }
  return ring;
});

const COS_TILT = Math.cos(TILT);
const SIN_TILT = Math.sin(TILT);

/* Scratch buffers, reused every frame so projection allocates nothing. */
const MAX_RING = LAND_RINGS.reduce((m, r) => Math.max(m, r.n), 0);
const SX = new Float64Array(MAX_RING);
const SY = new Float64Array(MAX_RING);
const SF = new Uint8Array(MAX_RING);
const QX = new Float64Array(MAX_RING + 2);
const QY = new Float64Array(MAX_RING + 2);

const ARC_N = 52;

/** Per flow: the great-circle arc as lat/lon samples, with its altitude lift. */
const FLOW_ARCS: { la: number; lo: number; lift: number; s: number }[][] = FLOWS.map(
  (f) => {
    const a = CITIES[f.a];
    const b = CITIES[f.b];
    const pts = [];
    for (let i = 0; i <= ARC_N; i++) {
      const s = i / ARC_N;
      const [la, lo] = slerp([a.lat, a.lon], [b.lat, b.lon], s);
      pts.push({ la, lo, lift: 1 + 0.15 * Math.sin(Math.PI * s), s });
    }
    return pts;
  },
);

/* ─── Path building ─── */

function limb(x: number, y: number) {
  const dx = x - CX;
  const dy = y - CY;
  const m = Math.hypot(dx, dy) || 1;
  return { x: CX + (dx / m) * R, y: CY + (dy / m) * R };
}

/** One run of consecutive visible points, closed back along the limb arc. */
function runPath(qn: number): string {
  let cx = 0;
  let cy = 0;
  let d = "";
  for (let i = 0; i < qn; i++) {
    cx += QX[i];
    cy += QY[i];
    d += `${i ? " L" : "M"}${QX[i].toFixed(1)},${QY[i].toFixed(1)}`;
  }
  cx /= qn;
  cy /= qn;
  const a0 = Math.atan2(QY[qn - 1] - CY, QX[qn - 1] - CX);
  const a1 = Math.atan2(QY[0] - CY, QX[0] - CX);
  let delta = a1 - a0;
  while (delta <= -Math.PI) delta += 2 * Math.PI;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  // arc midpoint should sit on the same side as the shape's centroid
  const mid = a0 + delta / 2;
  const mx = CX + R * Math.cos(mid);
  const my = CY + R * Math.sin(mid);
  const other = mid + Math.PI;
  const ox = CX + R * Math.cos(other);
  const oy = CY + R * Math.sin(other);
  const useShort = Math.hypot(mx - cx, my - cy) <= Math.hypot(ox - cx, oy - cy);
  const largeArc = useShort ? 0 : 1;
  const sweep = (delta > 0) === useShort ? 1 : 0;
  return `${d} A ${R} ${R} 0 ${largeArc} ${sweep} ${QX[0].toFixed(1)},${QY[0].toFixed(1)} Z`;
}

/** A densified ring projected and clipped against the visible hemisphere. */
function ringPath(ring: DenseRing, cosRot: number, sinRot: number): string | null {
  const n = ring.n;
  const { a, b, sinLat } = ring;
  let frontCount = 0;
  for (let i = 0; i < n; i++) {
    const ai = a[i];
    const bi = b[i];
    const y0 = sinLat[i];
    const x0 = ai * cosRot + bi * sinRot;
    const z0 = bi * cosRot - ai * sinRot;
    const y = y0 * COS_TILT - z0 * SIN_TILT;
    const z = y0 * SIN_TILT + z0 * COS_TILT;
    SX[i] = CX + R * x0;
    SY[i] = CY - R * y;
    const front = z > 0 ? 1 : 0;
    SF[i] = front;
    frontCount += front;
  }
  if (frontCount === 0) return null;
  if (frontCount === n) {
    let d = "";
    for (let i = 0; i < n; i++) {
      d += `${i ? " L" : "M"}${SX[i].toFixed(1)},${SY[i].toFixed(1)}`;
    }
    return d + " Z";
  }

  // split into visible runs, close each run along the limb arc
  let startIdx = -1;
  for (let i = 0; i < n; i++) {
    if (SF[i] && !SF[(i - 1 + n) % n]) {
      startIdx = i;
      break;
    }
  }
  if (startIdx < 0) return null;

  const parts: string[] = [];
  let qn = -1; // -1 means "no run open"
  for (let k = 0; k < n; k++) {
    const i = (startIdx + k) % n;
    if (SF[i]) {
      if (qn < 0) {
        // enter through the limb, from the last point behind the horizon
        const j = (i - 1 + n) % n;
        const p = limb(SX[j], SY[j]);
        QX[0] = p.x;
        QY[0] = p.y;
        qn = 1;
      }
      QX[qn] = SX[i];
      QY[qn] = SY[i];
      qn++;
    } else if (qn >= 0) {
      const p = limb(SX[i], SY[i]);
      QX[qn] = p.x;
      QY[qn] = p.y;
      qn++;
      parts.push(runPath(qn));
      qn = -1;
    }
  }
  if (qn >= 0) {
    const p = limb(SX[startIdx], SY[startIdx]);
    QX[qn] = p.x;
    QY[qn] = p.y;
    qn++;
    parts.push(runPath(qn));
  }
  return parts.join(" ");
}

/* ─── Layers ─── */

function Globe({ rot }: { rot: number }) {
  const shapes: JSX.Element[] = [];
  // the whole frame's trigonometry, computed once
  const r = rot * DEG;
  const cosRot = Math.cos(r);
  const sinRot = Math.sin(r);
  LAND_RINGS.forEach((ring, i) => {
    const d = ringPath(ring, cosRot, sinRot);
    if (!d) return;
    // dark water moat: keeps neighbouring coasts visually separated
    shapes.push(
      <path
        key={`lw${i}`}
        d={d}
        fill="none"
        stroke="rgba(6,22,38,0.42)"
        strokeWidth={4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />,
    );
    shapes.push(
      <path
        key={`lf${i}`}
        d={d}
        fill="rgba(255,255,255,0.10)"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth={1.4}
        strokeLinejoin="round"
        style={{ filter: "drop-shadow(0 10px 22px rgba(3,10,18,0.45))" }}
      />,
    );
    shapes.push(
      <path key={`lg${i}`} d={d} fill="url(#hg-landSheen)" stroke="none" opacity={0.9} />,
    );
  });
  return <>{shapes}</>;
}

function flowState(f: Flow, T: number) {
  const local = (((T - f.start) % CYCLE) + CYCLE) % CYCLE;
  return { local, prog: clamp(local / f.dur, 0, 1) };
}

function Flows({ T, rot }: { T: number; rot: number }) {
  const out: JSX.Element[] = [];
  FLOWS.forEach((f, fi) => {
    const { local, prog } = flowState(f, T);
    if (local > f.dur + 1.4) return;
    const fade = local > f.dur ? 1 - (local - f.dur) / 1.4 : 1;

    const pts = FLOW_ARCS[fi].map(({ la, lo, lift, s }) => {
      const p = project(la, lo, rot);
      return {
        x: CX + (p.x - CX) * lift,
        y: CY + (p.y - CY) * lift,
        front: p.front,
        s,
      };
    });

    const segs: { x: number; y: number }[][] = [];
    let cur: { x: number; y: number }[] = [];
    pts
      .filter((p) => p.s <= prog)
      .forEach((p) => {
        if (p.front) cur.push(p);
        else if (cur.length) {
          segs.push(cur);
          cur = [];
        }
      });
    if (cur.length) segs.push(cur);

    segs.forEach((s, i) => {
      const d = s
        .map((p, j) => `${j ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
        .join(" ");
      out.push(
        <path
          key={`f${fi}s${i}`}
          d={d}
          fill="none"
          stroke={f.color}
          strokeWidth={2.6}
          strokeLinecap="round"
          opacity={0.9 * fade}
          style={{ filter: `drop-shadow(0 0 10px ${f.color}bb)` }}
        />,
      );
    });

    const head = pts[Math.round(prog * ARC_N)];
    if (head && head.front && prog < 1) {
      out.push(
        <circle
          key={`h${fi}`}
          cx={head.x}
          cy={head.y}
          r={6}
          fill="#fff"
          opacity={fade}
          style={{
            filter: `drop-shadow(0 0 14px ${f.color}) drop-shadow(0 0 28px ${f.color})`,
          }}
        />,
      );
    }

    ([
      [CITIES[f.a], 0],
      [CITIES[f.b], 1],
    ] as const).forEach(([c, end], k) => {
      const p = project(c.lat, c.lon, rot);
      if (!p.front) return;
      const hit =
        end === 0 ? clamp(1 - local / 0.9, 0, 1) : clamp((prog - 0.92) / 0.08, 0, 1);
      out.push(
        <circle
          key={`n${fi}${k}`}
          cx={p.x}
          cy={p.y}
          r={3.2}
          fill={AMBER}
          opacity={(0.45 + 0.55 * hit) * fade}
        />,
      );
      if (hit > 0.02)
        out.push(
          <circle
            key={`r${fi}${k}`}
            cx={p.x}
            cy={p.y}
            r={4 + 30 * (1 - hit)}
            fill="none"
            stroke={AMBER}
            strokeWidth={1.3}
            opacity={0.5 * hit * fade}
          />,
        );
    });
  });
  return <g>{out}</g>;
}

/** Currency bubble that pops where a payment lands. */
function Bubbles({ T, rot }: { T: number; rot: number }) {
  const items: JSX.Element[] = [];
  FLOWS.forEach((f, fi) => {
    const { local } = flowState(f, T);
    const life = local - f.dur * 0.96;
    if (life < 0 || life > 2.8) return;
    const b = CITIES[f.b];
    const p = project(b.lat, b.lon, rot);
    if (!p.front) return;
    const inP = clamp(life / 0.45, 0, 1);
    const outP = clamp((life - 2.1) / 0.7, 0, 1);
    const o = Math.min(easeOutCubic(inP), 1 - easeInOutQuad(outP));
    if (o <= 0.01) return;
    const rise = -18 * easeOutCubic(inP) - 22 * outP;
    const scale = 0.9 + 0.1 * easeOutBack(inP);
    const ax = clamp(p.x, 90, W - 110);
    const ay = clamp(p.y, 210, H - 150);
    const flip = ax > W - 470 ? -1 : 1;
    items.push(
      <div
        key={`b${fi}`}
        style={{
          position: "absolute",
          left: ax,
          top: ay,
          opacity: o,
          transform: `translate3d(${flip > 0 ? 14 : -14}px, calc(-100% + ${rise}px), 0) translateX(${flip > 0 ? "0" : "-100%"}) scale(${scale})`,
          transformOrigin: flip > 0 ? "0% 100%" : "100% 100%",
          padding: "14px 20px 16px",
          borderRadius: 18,
          background: "rgba(255,255,255,0.10)",
          border: "1px solid rgba(255,255,255,0.22)",
          boxShadow: "0 18px 44px rgba(3,10,18,0.45)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          color: "#fff",
          whiteSpace: "nowrap",
        }}
      >
        <div
          style={{
            fontSize: 15,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.55)",
            fontWeight: 600,
          }}
        >
          {f.kicker}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 10,
            marginTop: 8,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.02em" }}>
            {f.main}
          </span>
          {f.to ? (
            <span style={{ fontSize: 22, color: "rgba(255,255,255,0.42)" }}>→</span>
          ) : null}
          {f.to ? (
            <span
              style={{ fontSize: 24, fontWeight: 600, color: "rgba(255,255,255,0.86)" }}
            >
              {f.to}
            </span>
          ) : null}
        </div>
      </div>,
    );
  });
  return <>{items}</>;
}

/* ─── Clock ─── */

/**
 * Authored seconds, advanced by rAF.
 *
 * Freezes at STILL_T when the visitor asks for reduced motion, and stops
 * entirely while the globe is scrolled out of view — a hero that keeps
 * projecting 4,000 points a frame from three screens away is pure battery.
 */
function useClock(active: boolean) {
  const [T, setT] = useState(STILL_T);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reduced || !active) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1); // a backgrounded tab must not jump
      last = now;
      setT((t) => t + dt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, active]);

  return reduced ? STILL_T : T;
}

/* ─── Component ─── */

export type HeroGlobeProps = {
  /** Degrees per second of base spin. The prototype's Tweaks default is 9. */
  spin?: number;
  /** Currency bubbles that pop where a payment lands. */
  showBubbles?: boolean;
  /** The prototype's built-in caption. Off by default: the hero owns its copy. */
  showCaption?: boolean;
  headline?: string;
  subhead?: string;
  className?: string;
};

export function HeroGlobe({
  spin = 9,
  showBubbles = true,
  showCaption = false,
  headline = "Get paid anywhere. Hold dollars.",
  subhead = "HOLD · self-custodial stablecoin wallet",
  className,
}: HeroGlobeProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [visible, setVisible] = useState(true);

  // The bubbles are absolutely positioned in stage pixels, so the whole 1920x1080
  // stage is scaled as one unit rather than letting the SVG scale on its own.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const ro = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / W);
    });
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      rootMargin: "200px",
    });
    io.observe(host);
    return () => io.disconnect();
  }, []);

  const T = useClock(visible);
  const rot = rotAt(T, spin);
  const breathe = 1 + 0.01 * Math.sin(T * 0.45);

  const defs = useMemo(
    () => (
      <defs>
        <clipPath id="hg-sphereClip">
          <circle cx={CX} cy={CY} r={R - 1} />
        </clipPath>
        <radialGradient id="hg-ocean" cx="36%" cy="28%" r="78%">
          <stop offset="0%" stopColor="#2C6C99" />
          <stop offset="45%" stopColor="#13405F" />
          <stop offset="78%" stopColor="#0A2237" />
          <stop offset="100%" stopColor="#05101B" />
        </radialGradient>
        <radialGradient id="hg-landSheen" cx="32%" cy="18%" r="90%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.22} />
          <stop offset="55%" stopColor="#FFFFFF" stopOpacity={0.05} />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="hg-specular" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#EAF6FF" stopOpacity={0.4} />
          <stop offset="100%" stopColor="#EAF6FF" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="hg-terminator" cx="50%" cy="50%">
          <stop offset="55%" stopColor="#000814" stopOpacity={0} />
          <stop offset="88%" stopColor="#000814" stopOpacity={0.26} />
          <stop offset="100%" stopColor="#000814" stopOpacity={0.5} />
        </radialGradient>
        <radialGradient id="hg-halo" cx="50%" cy="50%">
          <stop offset="70%" stopColor="#6FA8D6" stopOpacity={0} />
          <stop offset="90%" stopColor="#9AD1F5" stopOpacity={0.14} />
          <stop offset="100%" stopColor="#9AD1F5" stopOpacity={0} />
        </radialGradient>
      </defs>
    ),
    [],
  );

  return (
    <div
      ref={hostRef}
      className={className}
      style={{ position: "relative", width: "100%", aspectRatio: `${W} / ${H}` }}
      aria-hidden
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: W,
          height: H,
          transformOrigin: "top left",
          transform: `scale(${scale})`,
          overflow: "hidden",
          // measured on first frame; painting at 1x first would flash a huge globe
          visibility: scale ? "visible" : "hidden",
        }}
      >
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          style={{
            position: "absolute",
            inset: 0,
            transform: `scale(${breathe})`,
            transformOrigin: `${CX}px ${CY}px`,
          }}
        >
          {defs}
          <circle cx={CX} cy={CY} r={R * 1.1} fill="url(#hg-halo)" />
          <circle cx={CX} cy={CY} r={R} fill="url(#hg-ocean)" />
          <g clipPath="url(#hg-sphereClip)">
            <Globe rot={rot} />
          </g>
          <ellipse
            cx={CX - R * 0.34}
            cy={CY - R * 0.4}
            rx={R * 0.5}
            ry={R * 0.4}
            fill="url(#hg-specular)"
            opacity={0.75}
          />
          <circle cx={CX} cy={CY} r={R} fill="url(#hg-terminator)" />
          <Flows T={T} rot={rot} />
          <circle
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            stroke="rgba(200,232,255,0.34)"
            strokeWidth={1.2}
          />
          <circle
            cx={CX}
            cy={CY}
            r={R - 3}
            fill="none"
            stroke="rgba(255,255,255,0.10)"
            strokeWidth={6}
          />
        </svg>

        {showBubbles ? <Bubbles T={T} rot={rot} /> : null}

        {showCaption ? (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 62,
              textAlign: "center",
              color: "#fff",
            }}
          >
            <div style={{ fontSize: 62, fontWeight: 700, letterSpacing: "-0.03em" }}>
              {headline}
            </div>
            <div
              style={{ fontSize: 24, color: "rgba(255,255,255,0.58)", marginTop: 14 }}
            >
              {subhead}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
