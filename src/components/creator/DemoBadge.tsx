/**
 * The DEMO badge: the one control surface of the web demo, on every page.
 *
 * It changes nothing about the screens under it (those are the real
 * components talking to the in-browser demo backend), it only says who you
 * are, which account you are looking at, and whether the next call should be
 * refused, so every state is one click away. "All screens" opens the index.
 *
 * Also driven from the address bar, for links that land on a state (see
 * lib/creator/demo `applyDemoParams`), plus:
 *   ?demo-fail=<code>              the next call answers that code
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { card } from "@/components/ad-space/ui";
import {
  DEFAULT_DEMO,
  DEMO_API_BASE,
  DEMO_INVITE_CODE,
  DEMO_PEOPLE,
  DEMO_PHONES,
  DEMO_ROLES,
  DEMO_WALLET_KINDS,
  DEMO_XS,
  demoState,
  subscribeDemo,
  updateDemo,
  type DemoPhone,
  type DemoRole,
  type DemoState,
  type DemoWallet,
  type DemoX,
} from "@/lib/creator/demo";
import { resetAccount } from "@/lib/demo/account";

interface Preset {
  label: string;
  code: string;
  status: number;
  /** Which call it lands on: a regular expression over "<METHOD> <path>". */
  match: string;
  details?: Record<string, unknown>;
}

const PRESETS: readonly Preset[] = [
  { label: "Publish: X account too new", code: "x_account_too_new", status: 422, match: "/publish$" },
  { label: "Publish: X not verified", code: "x_not_verified", status: 422, match: "/publish$" },
  { label: "Publish: no Base/Polygon address", code: "no_evm_address", status: 422, match: "/publish$" },
  { label: "Publish: no USDC account on Solana", code: "creator_cannot_receive_usdc", status: 422, match: "/publish$" },
  { label: "Save listing: bidding rung sells one", code: "bid_tier_sells_one", status: 422, match: "^(POST|PATCH) ad-space/spaces(/[^/]+)?$" },
  { label: "Save listing: closes too soon", code: "closes_too_soon", status: 422, match: "^(POST|PATCH) ad-space/spaces(/[^/]+)?$" },
  { label: "Open a listing: not found", code: "not_found", status: 404, match: "^GET ad-space/spaces/[^/]+$" },
  { label: "Answer an offer: it changed", code: "offer_changed", status: 409, match: "ad-space/offers/[^/]+/(accept|counter|decline)$" },
  { label: "Answer an offer: it expired", code: "offer_expired", status: 409, match: "ad-space/offers/[^/]+/(accept|counter|decline)$" },
  { label: "Series: too many events", code: "series_too_large", status: 422, match: "^POST ad-space/spaces/[^/]+/series$", details: { max: 10 } },
  { label: "Give a share: over 100%", code: "shares_over_a_hundred", status: 422, match: "^PUT ad-space/spaces/[^/]+/team$" },
  { label: "Invite: team is full", code: "team_too_large", status: 422, match: "^POST ad-space/team$", details: { max: 25 } },
  { label: "Accept a seat: invitation ran out", code: "invite_expired", status: 410, match: "team/accept$" },
  { label: "Accept a seat: already on this team", code: "already_on_this_team", status: 409, match: "team/accept$" },
  { label: "Payout address: signature refused", code: "payout_signature_invalid", status: 422, match: "^POST ad-space/payout-address$" },
  { label: "Mark delivered: spot not sold", code: "position_not_sold", status: 409, match: "/delivered$" },
  { label: "Any next call: rate limited", code: "rate_limited", status: 429, match: "" },
  { label: "Any next call: sign-in expired", code: "UNAUTHORIZED", status: 401, match: "" },
  { label: "Any next call: server error", code: "server", status: 500, match: "" },
];

const ROLE_LABEL: Record<DemoRole, string> = {
  owner: "Creator",
  manager: "Manager",
  rep: "Rep",
  invitee: "Invitee",
};

const WALLET_LABEL: Record<DemoWallet, string> = { web: "Web wallet", app: "App wallet", none: "No wallet", other: "On another account" };
const PHONE_LABEL: Record<DemoPhone, string> = { none: "None linked", android: "Android", ios: "iPhone" };
const X_LABEL: Record<DemoX, string> = { linked: "Linked", none: "Not linked", unverified: "Not verified", "too-new": "Too new", relink: "Link again" };

interface Status {
  seed: "seeded" | "empty";
  armed: { code: string; match: string } | null;
  seatCode: string | null;
  shortcuts: { label: string; href: string }[];
}

async function demoCall(path: string, json?: unknown): Promise<Status | null> {
  try {
    const res = await fetch(`${DEMO_API_BASE}/demo/${path}`, {
      method: json === undefined ? "GET" : "POST",
      headers: json === undefined ? undefined : { "content-type": "application/json" },
      body: json === undefined ? undefined : JSON.stringify(json),
      cache: "no-store",
    });
    const body = (await res.json()) as { data?: Status };
    return body.data ?? null;
  } catch {
    return null;
  }
}

/* Pills and buttons: fixed height, radius exactly half of it, and selection
   changes a colour — never a border width. */
const chip =
  "inline-flex h-8 items-center justify-center whitespace-nowrap rounded-[16px] border px-3 text-tiny transition-colors duration-180";
const chipIdle = `${chip} border-[color:var(--color-hairline-strong)] text-text hover:bg-white/5`;
const chipOn = `${chip} border-amber bg-amber text-text-on-amber`;

export function DemoBadge() {
  const [open, setOpen] = useState(false);
  const [demo, setDemo] = useState<DemoState>(DEFAULT_DEMO);
  const role = demo.role;
  const [status, setStatus] = useState<Status | null>(null);
  const [preset, setPreset] = useState(0);
  const [custom, setCustom] = useState("");

  const refresh = useCallback(async () => setStatus(await demoCall("state")), []);

  // The address bar, once: `?demo-fail=` arms a refusal (the other `demo-*` were read as the page loaded).
  useEffect(() => {
    const sync = () => setDemo(demoState());
    sync();
    const off = subscribeDemo(sync);
    const fail = new URL(window.location.href).searchParams.get("demo-fail");
    if (fail) void demoCall("arm", { code: fail, status: 422, match: "" }).then(setStatus);
    else void refresh();
    return off;
  }, [refresh]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const reload = () => window.location.reload();
  /** Change the account's state and read everything again, from the state (what this tab did is forgotten). */
  const change = (patch: Partial<DemoState>) => {
    updateDemo({ signedIn: true, ...patch });
    resetAccount();
    // A link from the index carries its own state in the address: drop it, so the change sticks.
    const url = new URL(window.location.href);
    for (const k of [...url.searchParams.keys()]) if (k === "demo" || k.startsWith("demo-")) url.searchParams.delete(k);
    window.location.replace(url.toString());
  };

  return (
    <div
      className="fixed right-4 z-[60] flex flex-col items-end gap-2"
      style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
    >
      {open ? (
        <div
          className={`${card} flex max-h-[72vh] w-[min(360px,calc(100vw-2rem))] flex-col gap-5 overflow-y-auto bg-abyss/95 p-4 shadow-2xl backdrop-blur`}
          role="dialog"
          aria-label="Demo controls"
        >
          <div className="flex flex-col gap-1">
            <p className="text-small text-text">Demo</p>
            <p className="text-tiny text-text-muted">
              No backend, no sign-in. Every call is answered in this browser, from demo data; what you change is kept
              in this tab until you reset it.
            </p>
            <a href="/app/screens" className="mt-2 inline-flex h-8 w-fit items-center rounded-[16px] bg-amber px-3 text-tiny font-medium text-text-on-amber">
              All screens
            </a>
          </div>

          <section className="flex flex-col gap-2">
            <p className="text-tiny uppercase tracking-wider text-text-faint">Viewing as</p>
            <div className="flex flex-wrap gap-2">
              {DEMO_ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={r === role ? chipOn : chipIdle}
                  onClick={() => change({ role: r })}
                >
                  {ROLE_LABEL[r]}
                </button>
              ))}
            </div>
            <p className="text-tiny text-text-muted">{DEMO_PEOPLE[role].name}</p>
          </section>

          <section className="flex flex-col gap-2">
            <p className="text-tiny uppercase tracking-wider text-text-faint">Wallet</p>
            <div className="flex flex-wrap gap-2">
              {DEMO_WALLET_KINDS.map((w) => (
                <button key={w} type="button" className={w === demo.wallet ? chipOn : chipIdle} onClick={() => change({ wallet: w })}>
                  {WALLET_LABEL[w]}
                </button>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <p className="text-tiny uppercase tracking-wider text-text-faint">Linked phone</p>
            <div className="flex flex-wrap gap-2">
              {DEMO_PHONES.map((ph) => (
                <button key={ph} type="button" className={ph === demo.phone ? chipOn : chipIdle} onClick={() => change({ phone: ph })}>
                  {PHONE_LABEL[ph]}
                </button>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <p className="text-tiny uppercase tracking-wider text-text-faint">X account</p>
            <div className="flex flex-wrap gap-2">
              {DEMO_XS.map((x) => (
                <button key={x} type="button" className={x === demo.x ? chipOn : chipIdle} onClick={() => change({ x })}>
                  {X_LABEL[x]}
                </button>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <p className="text-tiny uppercase tracking-wider text-text-faint">Session</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={chipIdle} onClick={() => change({ signedIn: !demo.signedIn })}>
                {demo.signedIn ? "Sign out" : "Sign in"}
              </button>
              <button type="button" className={chipIdle} onClick={() => change({ ...DEFAULT_DEMO })}>
                Everything back to default
              </button>
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <p className="text-tiny uppercase tracking-wider text-text-faint">
              Account · {status?.seed === "empty" ? "empty" : "mid-life"}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={chipIdle}
                onClick={() => {
                  updateDemo({ seed: "seeded" });
                  void demoCall("reset", { seed: "seeded" }).then(reload);
                }}
              >
                Reset to mid-life
              </button>
              <button
                type="button"
                className={chipIdle}
                onClick={() => {
                  updateDemo({ seed: "empty" });
                  void demoCall("reset", { seed: "empty" }).then(reload);
                }}
              >
                Reset to empty
              </button>
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <p className="text-tiny uppercase tracking-wider text-text-faint">Make the next call fail</p>
            {status?.armed ? (
              <div className="flex flex-col gap-2 rounded-input border border-amber/40 bg-amber/10 px-3 py-2">
                <p className="text-tiny text-text">
                  Armed: <span className="font-mono">{status.armed.code}</span>
                  {status.armed.match ? (
                    <>
                      {" "}
                      on <span className="font-mono">{status.armed.match}</span>
                    </>
                  ) : (
                    " on the next call"
                  )}
                </p>
                <div>
                  <button type="button" className={chipIdle} onClick={() => void demoCall("arm", {}).then(setStatus)}>
                    Disarm
                  </button>
                </div>
              </div>
            ) : null}
            <select
              className="h-10 w-full rounded-input border border-[color:var(--color-hairline-strong)] bg-abyss px-3 text-tiny text-text"
              value={preset}
              onChange={(e) => setPreset(Number(e.target.value))}
              aria-label="Which refusal"
            >
              {PRESETS.map((p, i) => (
                <option key={p.code + p.match} value={i}>
                  {p.label}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={chipIdle}
                onClick={() => {
                  const p = PRESETS[preset];
                  void demoCall("arm", { code: p.code, status: p.status, match: p.match, details: p.details }).then(setStatus);
                }}
              >
                Arm it
              </button>
            </div>
            <div className="flex gap-2">
              <input
                className="h-8 min-w-0 flex-1 rounded-[16px] border border-[color:var(--color-hairline-strong)] bg-transparent px-3 font-mono text-tiny text-text placeholder:text-text-faint"
                placeholder="or any code, e.g. space_closed"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
              />
              <button
                type="button"
                className={chipIdle}
                disabled={!custom.trim()}
                onClick={() => void demoCall("arm", { code: custom.trim(), status: 422, match: "" }).then(setStatus)}
              >
                Arm
              </button>
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <p className="text-tiny uppercase tracking-wider text-text-faint">Go to</p>
            <ul className="flex flex-col gap-1 text-tiny">
              {[
                { label: "Account home", href: "/app/spaces" },
                { label: "New listing", href: "/app/spaces/listings/new" },
                ...(status?.shortcuts ?? []),
                { label: "Team", href: "/app/spaces/team" },
                { label: "What you deliver (team member)", href: "/app/spaces/deliveries" },
                ...(status?.seatCode
                  ? [{ label: "Pending invitation link", href: `/invite/${DEMO_INVITE_CODE}?seat=${status.seatCode}` }]
                  : []),
                { label: "Public: creator page", href: "/s/demo_creator" },
                { label: "Public: TOKEN2049 event", href: "/events/token2049-singapore-2026" },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-text-muted underline decoration-dotted underline-offset-4 hover:text-text">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-[16px] border border-amber/60 bg-abyss/90 px-3 text-tiny text-amber shadow-lg backdrop-blur transition-colors duration-180 hover:bg-amber/10"
      >
        <span className="font-medium tracking-wider">DEMO</span>
        <span className="text-text-muted">
          {ROLE_LABEL[role]} · {WALLET_LABEL[demo.wallet]}
        </span>
        {status?.armed ? <span className="text-amber">· armed</span> : null}
      </button>
    </div>
  );
}
