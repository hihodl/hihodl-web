"use client";

/**
 * Pieces the Partners screens share: the link name field with its live
 * availability check, the form inputs, the status pills and the QR card.
 *
 * Never red: a refusal is amber, a good answer is green, a quiet one is white.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";

import { qrModules } from "@/components/ad-space/qr";
import { checkSlug, linkText, normaliseSlug, PARTNER_TERMS_URL, partnerErrorText, SLUG_MAX, SLUG_MIN, type SlugAnswer } from "@/lib/app/partners";

import { Ion, type IonName } from "../ion";

export const inputCls =
  "h-12 w-full min-w-0 rounded-[14px] border border-white/10 bg-white/[0.05] px-4 text-[15px] text-white outline-none transition-colors placeholder:text-white/35 focus:border-amber/60 disabled:opacity-60";

export const labelCls = "mb-1.5 block text-[13px] font-strong text-[#9FB7C2]";

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-[12.5px] leading-[18px] text-white/55">{hint}</span> : null}
    </label>
  );
}

/* ── The link name ────────────────────────────────────────────────── */

export type SlugState =
  | { state: "idle" }
  | { state: "checking"; slug: string }
  | { state: "done"; answer: SlugAnswer }
  | { state: "failed"; slug: string };

/**
 * Asks the server whether a link name is free, 350ms after the last key.
 * `current` is the partner's own slug: asking for it again is not a clash.
 */
export function useSlugCheck(raw: string, current?: string): SlugState {
  const [result, setResult] = useState<SlugState>({ state: "idle" });
  const slug = normaliseSlug(raw);
  const last = useRef<AbortController | null>(null);

  useEffect(() => {
    last.current?.abort();
    if (!slug || slug === current) {
      setResult({ state: "idle" });
      return;
    }
    if (slug.length < SLUG_MIN || slug.length > SLUG_MAX) {
      setResult({ state: "done", answer: { slug, available: false, problem: slug.length < SLUG_MIN ? "slug_too_short" : "slug_too_long" } });
      return;
    }
    setResult({ state: "checking", slug });
    const ctrl = new AbortController();
    last.current = ctrl;
    const timer = setTimeout(() => {
      checkSlug(slug, ctrl.signal).then(
        (answer) => {
          if (!ctrl.signal.aborted) setResult({ state: "done", answer });
        },
        () => {
          if (!ctrl.signal.aborted) setResult({ state: "failed", slug });
        },
      );
    }, 350);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [slug, current]);

  return result;
}

/** Whether a form may send this link name: free, or the partner's own. */
export function slugReady(check: SlugState, raw: string, current?: string): boolean {
  const slug = normaliseSlug(raw);
  if (current && slug === current) return true;
  return check.state === "done" && check.answer.available && check.answer.slug === slug;
}

/** The line under the field: the link as it will read, and whether it is free. */
export function SlugLine({ raw, check, current }: { raw: string; check: SlugState; current?: string }) {
  const slug = normaliseSlug(raw);
  const shown = check.state === "done" ? check.answer.slug : slug;
  let tone: "good" | "warn" | "quiet" = "quiet";
  let words = "";
  if (current && slug === current) words = "Your current link";
  else if (check.state === "checking") words = "Checking";
  else if (check.state === "failed") words = "Could not check right now";
  else if (check.state === "done") {
    if (check.answer.available) {
      tone = "good";
      words = "Available";
    } else {
      tone = "warn";
      words = partnerErrorText({ code: check.answer.problem ?? "slug_taken" });
    }
  }
  const ink = tone === "good" ? "text-[#4ADE80]" : tone === "warn" ? "text-amber" : "text-white/55";
  return (
    <span className="mt-1.5 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[12.5px] leading-[18px]">
      <span className="truncate font-strong text-white/80">{linkText(shown)}</span>
      {words ? <span className={ink}>{words}</span> : null}
    </span>
  );
}

/* ── The partner's logo ───────────────────────────────────────────── */

/** "ST" from "Superteam Spain". */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const s = words.length > 1 ? `${words[0][0]}${words[1][0]}` : (words[0] ?? "").slice(0, 2);
  return s.toUpperCase() || "?";
}

/** The logo as a small rounded square, or the initials when there is none (or it fails to load). */
export function PartnerLogo({ name, url, size = 28 }: { name: string; url: string | null | undefined; size?: number }) {
  const [broken, setBroken] = useState<string | null>(null);
  const radius = Math.round(size * 0.28);
  if (url && broken !== url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a small public bucket image of any host; next/image would need every host listed
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        onError={() => setBroken(url)}
        className="shrink-0 bg-white/[0.06] object-cover"
        style={{ width: size, height: size, borderRadius: radius }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center bg-white/[0.08] font-extrabold text-white/70"
      style={{ width: size, height: size, borderRadius: radius, fontSize: Math.max(10, Math.round(size * 0.36)) }}
    >
      {initialsOf(name)}
    </span>
  );
}

/* ── Pills ────────────────────────────────────────────────────────── */

export type PillTone = "amber" | "green" | "blue" | "quiet";

const PILL: Record<PillTone, string> = {
  amber: "bg-amber/[0.16] text-amber",
  green: "bg-[rgba(74,222,128,0.16)] text-[#4ADE80]",
  blue: "bg-[rgba(142,202,230,0.16)] text-[#8ECAE6]",
  quiet: "bg-white/[0.08] text-white/60",
};

export function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return (
    <span className={`inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-[11.5px] font-bold ${PILL[tone]}`}>
      {children}
    </span>
  );
}

/** Pills you choose one of. Choosing changes a colour, never a border width. */
export function ChoicePills<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`inline-flex h-10 items-center rounded-full border px-4 text-[14px] font-bold transition-colors ${
              on ? "border-white bg-white text-[#0A1420]" : "border-white/10 bg-white/10 text-white hover:bg-white/[0.14]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── A booking's kind ─────────────────────────────────────────────── */

export const KIND: Record<"stay" | "flight" | "esim", { label: string; icon: IonName }> = {
  stay: { label: "Stay", icon: "bed-outline" },
  flight: { label: "Flight", icon: "airplane-outline" },
  esim: { label: "eSIM", icon: "cellular-outline" },
};

/* ── QR ───────────────────────────────────────────────────────────── */

/** A QR code as a standalone SVG document: white ground, dark modules, a quiet zone. */
export function qrSvg(text: string, px = 1024): string | null {
  const qr = qrModules(text, "M");
  if (!qr) return null;
  const quiet = 4;
  const full = qr.size + quiet * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="${-quiet} ${-quiet} ${full} ${full}" shape-rendering="crispEdges"><rect x="${-quiet}" y="${-quiet}" width="${full}" height="${full}" fill="#FFFFFF"/><path d="${qr.d}" fill="#0A0500"/></svg>`;
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

export function downloadQrSvg(text: string, name: string) {
  const svg = qrSvg(text);
  if (svg) save(new Blob([svg], { type: "image/svg+xml" }), `${name}.svg`);
}

/** Drawn from the SVG onto a canvas, so the PNG is exactly the same code. */
export function downloadQrPng(text: string, name: string, px = 1024) {
  const svg = qrSvg(text, px);
  if (!svg) return;
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, px, px);
    canvas.toBlob((blob) => {
      if (blob) save(blob, `${name}.png`);
    }, "image/png");
  };
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function QrDownloads({ text, name }: { text: string; name: string }) {
  const btn =
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-white/[0.14] bg-white/[0.08] px-3.5 text-[13px] font-bold text-white transition-colors hover:bg-white/[0.14]";
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className={btn} onClick={() => downloadQrPng(text, name)}>
        <Ion name="download-outline" size={15} />
        PNG
      </button>
      <button type="button" className={btn} onClick={() => downloadQrSvg(text, name)}>
        <Ion name="download-outline" size={15} />
        SVG
      </button>
    </div>
  );
}


/** The app's own tick box (as on the listing form), not the browser's white square. Put it first inside a <label>. */
export function CheckBox({ checked, onChange, small }: { checked: boolean; onChange: (v: boolean) => void; small?: boolean }) {
  return (
    <>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className={`flex shrink-0 items-center justify-center border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-white/40 ${
          small ? "h-[18px] w-[18px] rounded-[6px]" : "h-[22px] w-[22px] rounded-[7px]"
        } ${checked ? "border-[#F1F5F9] bg-[#F1F5F9] text-[#0A1420]" : "border-white/35"}`}
      >
        {checked ? <Ion name="checkmark" size={small ? 13 : 15} /> : null}
      </span>
    </>
  );
}

/** "I agree to the HOLD Partners terms". Applying and joining a team both need it ticked. */
export function TermsCheck({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-[13.5px] leading-[20px] text-white/75">
      <CheckBox checked={checked} onChange={onChange} />
      <span>
        I agree to the{" "}
        <a href={PARTNER_TERMS_URL} target="_blank" rel="noopener noreferrer" className="font-bold text-[#8ECAE6] hover:text-white">
          HOLD Partners terms
        </a>
        , including how commissions are earned, paid and taken back when a booking is cancelled.
      </span>
    </label>
  );
}
