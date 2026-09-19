"use client";

/**
 * The HOLD app's step screen, piece by piece, for the web's sign-in and
 * onboarding. Every value here is read from the app, not invented:
 *
 *   hihodl-wallet/app/onboarding/setup.tsx   the frame, the step row, the
 *                                            input, the glass action, Ready
 *   hihodl-wallet/app/onboarding/email.tsx   the same frame for email, and
 *                                            its "Check your inbox" view
 *
 * Two departures, both house rules: small text is at least 4.5:1 (the app's
 * 15 to 40 % white greys are 50 to 60 % here), and nothing is red (the app's
 * "Connection error" is amber).
 *
 * documentation/web-copies-the-app-onboarding.md has the map.
 */

import { useEffect, type ReactNode, type SVGProps } from "react";

/* ── The step's colours (setup.tsx STEP_GRADIENTS / STEP_ACCENTS) ─── */

export type StepTone = "username" | "passkey" | "recovery" | "ready";

const GRADIENTS: Record<StepTone, [string, string]> = {
  username: ["#1a5276", "#0f3555"],
  passkey: ["#0077E6", "#004DAA"],
  recovery: ["#7C3AED", "#5B21B6"],
  ready: ["#059669", "#047857"],
};

export const ACCENTS: Record<StepTone, string> = {
  username: "#FFB703",
  passkey: "#00C2FF",
  recovery: "#A78BFA",
  ready: "#34D399",
};

/** The app's green for "done" (setup.tsx `#20D690`). */
export const DONE_GREEN = "#20D690";

/**
 * The whole screen: the step's gradient (y 0 to 0.75, then the app's
 * `#0a1929`), the accent's glow over the top 40 %, and one phone-wide
 * column with the header on top and the step anchored to the foot.
 */
export function StepScreen({
  tone,
  title,
  onClose,
  closeIcon = "close",
  closeLabel = "Close",
  children,
}: {
  tone: StepTone;
  title: string;
  onClose?: () => void;
  closeIcon?: "close" | "back";
  closeLabel?: string;
  children: ReactNode;
}) {
  const [top, mid] = GRADIENTS[tone];
  return (
    <div className="relative min-h-[100dvh] w-full bg-[#0a1929]">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 transition-[background] duration-500"
        style={{ background: `linear-gradient(180deg, ${top} 0%, ${mid} 37.5%, #0a1929 75%, #0a1929 100%)` }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[40vh]"
        style={{ background: `linear-gradient(180deg, ${ACCENTS[tone]}18, transparent)` }}
      />
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[440px] flex-col px-6 pb-[max(14px,env(safe-area-inset-bottom))] pt-[max(20px,env(safe-area-inset-top))]">
        <header className="flex items-start justify-between gap-4">
          <h1 className="whitespace-pre-line text-[22px] font-bold leading-[28px] tracking-[-0.4px] text-white/70">{title}</h1>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[14px] bg-white/[0.06] text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              {closeIcon === "back" ? <Ion name="arrow-back" size={16} /> : <Ion name="close" size={16} />}
            </button>
          ) : null}
        </header>
        {/* The gradient breathes; the step sits at the foot. */}
        <div className="min-h-10 flex-1" />
        <div className="flex flex-col">{children}</div>
      </div>
    </div>
  );
}

/** The previous step: one quiet row with a green check. Tapping it goes back. */
export function CompletedRow({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="mb-3 flex w-full items-center gap-2 rounded-[10px] px-1 py-2 text-left transition-colors hover:bg-white/[0.04]"
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-[12px] border border-[rgba(32,214,144,0.15)] bg-[rgba(32,214,144,0.08)]">
        <Ion name="checkmark" size={12} style={{ color: DONE_GREEN }} />
      </span>
      <span className="min-w-0 truncate text-[14px] font-semibold text-white/[0.55]">{title}</span>
      <Ion name="chevron-back" size={12} className="ml-auto text-white/30" />
    </button>
  );
}

/** Icon in the accent's circle, the title, and (i) when there is more to read. */
export function StepTitle({
  icon,
  title,
  accent,
  onInfo,
}: {
  icon: IonName;
  title: string;
  accent: string;
  onInfo?: () => void;
}) {
  return (
    <div className="mb-3.5 flex items-center gap-2.5">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[18px] border-[1.5px]"
        style={{ backgroundColor: `${accent}15`, borderColor: `${accent}35`, color: accent }}
      >
        <Ion name={icon} size={20} />
      </span>
      <h2 className="text-[18px] font-bold tracking-[-0.3px] text-white">{title}</h2>
      {onInfo ? (
        <button type="button" onClick={onInfo} aria-label={`About ${title}`} className="ml-1 rounded-[10px] p-0.5 text-white/50 transition-colors hover:text-white">
          <Ion name="information-circle-outline" size={20} />
        </button>
      ) : null}
    </div>
  );
}

/** The step's one line of explanation (setup.tsx `stepDesc`). */
export function StepDesc({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-[14px] font-medium leading-5 text-white/60">{children}</p>;
}

/** The faint row naming the step after this one. */
export function NextHint({ icon, title }: { icon: IonName; title: string }) {
  return (
    <div className="mt-4 flex items-center gap-2" aria-hidden>
      <span className="flex h-6 w-6 items-center justify-center rounded-[12px] border border-white/[0.04] bg-white/[0.03] text-white/40">
        <Ion name={icon} size={14} />
      </span>
      <span className="text-[14px] font-medium text-white/50">{title}</span>
    </div>
  );
}

/** The app's input row: 50 high, radius 14, dark fill, a prefix. */
export function InputRow({ prefix, children }: { prefix?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-[50px] items-center rounded-[14px] border border-white/10 bg-black/[0.18] px-4 transition-colors focus-within:border-white/25">
      {prefix}
      {children}
    </div>
  );
}

export const inputFieldCls =
  "h-full min-w-0 flex-1 bg-transparent text-[17px] font-medium text-white outline-none placeholder:text-white/[0.35] disabled:opacity-60";

/** The status line under an input: 13 px. */
export function StatusLine({ tone, children }: { tone: "muted" | "ok" | "warn"; children: ReactNode }) {
  const color = tone === "ok" ? DONE_GREEN : tone === "warn" ? "#FB8500" : "rgba(255,255,255,0.55)";
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-semibold" style={{ color }} role="status">
      {tone === "ok" ? <Ion name="checkmark-circle" size={16} /> : null}
      {children}
    </p>
  );
}

/** Soft amber, never red (setup.tsx `errorBanner`). */
export function ErrorBanner({ children, onDismiss }: { children: ReactNode; onDismiss?: () => void }) {
  return (
    <div role="status" className="mb-2 flex items-center gap-2 rounded-[14px] border border-[rgba(245,158,11,0.15)] bg-[rgba(245,158,11,0.08)] p-3">
      <Ion name="information-circle" size={16} className="shrink-0 text-[#F59E0B]" />
      <p className="flex-1 text-[13px] font-medium leading-[18px] text-white/75">{children}</p>
      {onDismiss ? (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="shrink-0 rounded-[8px] p-0.5 text-white/40 hover:text-white">
          <Ion name="close" size={14} />
        </button>
      ) : null}
    </div>
  );
}

/** The CTA area under the step (setup.tsx `ctaArea`). */
export function Cta({ children }: { children: ReactNode }) {
  return <div className="flex flex-col pt-4">{children}</div>;
}

/** The app's onboarding action: glass, 54 high, radius half its height, an optional icon. */
export function ActionButton({
  title,
  onClick,
  disabled,
  icon,
  type = "button",
}: {
  title: string;
  onClick?: () => void;
  disabled?: boolean;
  icon?: IonName;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="flex h-[54px] w-full items-center justify-center gap-2 rounded-[27px] border border-white/10 bg-white/[0.05] text-[16px] font-bold text-white/[0.85] transition-[background-color,transform] hover:bg-white/[0.09] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/[0.05] disabled:active:scale-100"
    >
      {icon ? <Ion name={icon} size={18} /> : null}
      {title}
    </button>
  );
}

/** The app's quiet second choice: "Skip", "Not now". */
export function SkipButton({ label = "Skip", onClick, disabled }: { label?: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="self-center rounded-[10px] px-5 py-3 text-[14px] font-semibold text-white/[0.55] transition-colors hover:text-white/80 disabled:opacity-50"
    >
      {label}
    </button>
  );
}

/** The app's spinner row ("Setting up your wallet..."). */
export function Working({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-5" role="status">
      <Spinner color={DONE_GREEN} />
      <span className="text-[16px] font-semibold text-white/60">{label}</span>
    </div>
  );
}

export function Spinner({ color = "rgba(255,255,255,0.85)", size = 20 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className="animate-spin" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeOpacity={0.25} strokeWidth={2.5} />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
    </svg>
  );
}

/** Setup.tsx's Ready: the green check, the title, one line. */
export function ReadyBox({ title, line }: { title: string; line: string }) {
  return (
    <div className="flex flex-col items-center gap-3.5 py-5 text-center">
      <span className="flex h-[72px] w-[72px] items-center justify-center rounded-[36px] text-white" style={{ backgroundColor: DONE_GREEN }}>
        <Ion name="checkmark" size={36} strokeWidth={2.6} />
      </span>
      <h2 className="text-[24px] font-extrabold leading-8 text-white">{title}</h2>
      <p className="text-[15px] leading-[22px] text-white/60">{line}</p>
    </div>
  );
}

/**
 * The app's info sheet (BottomKeyboardModal, tone "ink"): pinned to the foot
 * on a phone, a card on a wide screen. Escape closes it.
 */
export function InfoSheet({ title, body, onClose, children }: { title: string; body?: ReactNode; onClose: () => void; children?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-[440px] rounded-t-[24px] border border-white/10 bg-[#0D1820] px-6 pb-8 pt-3 shadow-[0_-20px_40px_rgba(0,0,0,0.35)] sm:rounded-[24px]">
        <span className="mx-auto block h-1 w-10 rounded-[2px] bg-white/[0.22]" aria-hidden />
        <h2 className="mt-4 text-[20px] font-bold text-white">{title}</h2>
        {body ? <p className="mt-3 text-[15px] leading-[22px] text-white/[0.65]">{body}</p> : null}
        {children}
      </div>
    </div>
  );
}

/* ── Icons: the Ionicons outline set the app draws with ──────────── */

export type IonName =
  | "person-outline"
  | "person-circle-outline"
  | "key-outline"
  | "mail-outline"
  | "mail-unread-outline"
  | "lock-closed-outline"
  | "wallet-outline"
  | "phone-portrait-outline"
  | "keypad-outline"
  | "checkmark"
  | "checkmark-circle"
  | "close"
  | "arrow-back"
  | "chevron-back"
  | "information-circle"
  | "information-circle-outline"
  | "copy-outline"
  | "warning-outline";

export function Ion({
  name,
  size = 20,
  strokeWidth = 1.9,
  ...rest
}: { name: IonName; size?: number; strokeWidth?: number } & Omit<SVGProps<SVGSVGElement>, "name">) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  let body: ReactNode;
  switch (name) {
    case "person-outline":
      body = (
        <g {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4.5 20.5c.9-3.6 3.9-5.5 7.5-5.5s6.6 1.9 7.5 5.5" />
        </g>
      );
      break;
    case "person-circle-outline":
      body = (
        <g {...common}>
          <circle cx="12" cy="12" r="9.5" />
          <circle cx="12" cy="10" r="3.2" />
          <path d="M6.3 18.4c1.2-2 3.2-3.1 5.7-3.1s4.5 1.1 5.7 3.1" />
        </g>
      );
      break;
    case "key-outline":
      body = (
        <g {...common}>
          <circle cx="7.5" cy="15.5" r="4.5" />
          <path d="M10.7 12.3 20.5 2.5M17 6l2.5 2.5M14.5 8.5 17 11" />
        </g>
      );
      break;
    case "mail-outline":
      body = (
        <g {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <path d="m6.5 8.5 5.5 4.2 5.5-4.2" />
        </g>
      );
      break;
    case "mail-unread-outline":
      body = (
        <g {...common}>
          <path d="M14 5H5.5A2.5 2.5 0 0 0 3 7.5v9A2.5 2.5 0 0 0 5.5 19h13a2.5 2.5 0 0 0 2.5-2.5V11" />
          <path d="m6.5 8.5 5.5 4.2 3-2.3" />
          <circle cx="19" cy="5.5" r="2.5" />
        </g>
      );
      break;
    case "lock-closed-outline":
      body = (
        <g {...common}>
          <rect x="4.5" y="10" width="15" height="11" rx="2.5" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </g>
      );
      break;
    case "wallet-outline":
      body = (
        <g {...common}>
          <rect x="3" y="6.5" width="18" height="13" rx="2.5" />
          <path d="M17.5 6.5V5a2 2 0 0 0-2.5-1.9L5 5.8A2.6 2.6 0 0 0 3 8.3" />
          <path d="M16.5 13.5h.01" strokeWidth={strokeWidth + 1.2} />
        </g>
      );
      break;
    case "phone-portrait-outline":
      body = (
        <g {...common}>
          <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
          <path d="M10.5 5h3" />
        </g>
      );
      break;
    case "keypad-outline":
      body = (
        <g {...common}>
          {[6, 12, 18].flatMap((x) => [5, 11, 17].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.6" />))}
        </g>
      );
      break;
    case "checkmark":
      body = <path {...common} d="M5 12.5 10 17.5 19 7" />;
      break;
    case "checkmark-circle":
      body = (
        <g>
          <circle cx="12" cy="12" r="10" fill="currentColor" />
          <path d="m7.5 12.3 3 3 6-6.3" fill="none" stroke="#0a1929" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
      break;
    case "close":
      body = <path {...common} d="M6.5 6.5l11 11M17.5 6.5l-11 11" />;
      break;
    case "arrow-back":
      body = <path {...common} d="M19.5 12h-15M11 5.5 4.5 12l6.5 6.5" />;
      break;
    case "chevron-back":
      body = <path {...common} d="M15 5 8 12l7 7" />;
      break;
    case "information-circle":
      body = (
        <g>
          <circle cx="12" cy="12" r="10" fill="currentColor" />
          <path d="M12 11v5.5" stroke="#0a1929" strokeWidth={2} strokeLinecap="round" />
          <circle cx="12" cy="7.8" r="1.2" fill="#0a1929" />
        </g>
      );
      break;
    case "information-circle-outline":
      body = (
        <g {...common}>
          <circle cx="12" cy="12" r="9.5" />
          <path d="M12 11v5.5" />
          <circle cx="12" cy="7.8" r="0.6" fill="currentColor" />
        </g>
      );
      break;
    case "warning-outline":
      body = (
        <g {...common}>
          <path d="M10.3 4.2 2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9.5v4.5" />
          <circle cx="12" cy="17" r="0.6" fill="currentColor" />
        </g>
      );
      break;
    case "copy-outline":
      body = (
        <g {...common}>
          <rect x="8.5" y="8.5" width="12" height="12" rx="2.5" />
          <path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5" />
        </g>
      );
      break;
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden {...rest}>
      {body}
    </svg>
  );
}
