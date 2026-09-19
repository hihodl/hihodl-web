"use client";

/**
 * The HOLD product shell: what a signed-in person is inside of.
 *
 * Built on the KPI dashboard's structure: a glass sidebar with grouped
 * navigation, the signed-in person at its foot, a sticky top bar with the page
 * title, ⌘K and the one primary action, and the page under it. On a phone
 * the sidebar is a drawer.
 *
 * TWO LEVELS, LIKE THE APP
 *
 * The main column is HOLD: Dashboard, Wallet, Benefits and its products,
 * Account, Settings. Opening a product with web screens (Spaces today) swaps
 * the column for that product's menu, with a Back row at its top to the main
 * menu and the Dashboard. See nav.ts.
 *
 * Signed out, it is HOLD's door (front/Door: welcome, or welcome back) and
 * nothing else. An invitation link (`/spaces/team?seat=…`) is the one page
 * that renders without the shell, because the person holding it may have no
 * account yet.
 */

import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { SpacesGround } from "@/components/ad-space/ground";
import { Wordmark } from "@/components/site/Wordmark";
import { currentMethod, remember } from "@/lib/auth/remember";
import { describeCreatorError } from "@/lib/creator/api";
import type { SpaceCard } from "@/lib/creator/listing";
import { signOut, useCreatorSession } from "@/lib/creator/session";
import { creatorText, isSeatCode, pendingSeat, type TeamMember, type WorkListing } from "@/lib/creator/team";
import type { XAccountStatus } from "@/lib/creator/types";
import { useAgency, type Agency } from "@/lib/app/agency";
import { chosenUsername } from "@/lib/app/me";
import { useDoor } from "@/lib/app/onboarding";
import { roleOf, waitingOnYou, type ShellRole } from "@/lib/app/spaces-model";
import { useListings, useMe, useOffers, useSeats, useTeam, useWork, useX } from "@/lib/app/spaces-data";
import { useWalletEnabled } from "@/lib/wallet/enabled";

import { SpacesBaseProvider, useHref, useProductHref, useSpacesBase } from "./base";
import { CommandPalette, type PaletteEntry } from "./CommandPalette";
import { Door as SignInDoor } from "./front/Door";
import { Avatar } from "./front/kit";
import { IconArrowLeft, IconClose, IconCollapse, IconExpand, IconMenu, IconPlus, IconSearch, IconSignOut } from "./icons";
import {
  activeKey,
  hrefFor,
  itemsFor,
  LEVELS,
  levelOf,
  productPrefix,
  titleFor,
  visible,
  type Level,
  type NavItem,
  type NavKey,
} from "./nav";
import { Alert, glass } from "./ui";

/* ── What every page inside can read ──────────────────────────────── */

export interface ShellState {
  session: Session;
  role: ShellRole;
  listings: SpaceCard[];
  seats: TeamMember[];
  x: XAccountStatus | null;
  /** Listings on other creators' teams, with the role held on each. */
  work: WorkListing[];
  /** The listings this person sells for somebody else. */
  managed: WorkListing[];
  /** Creator or Creative Director (lib/app/agency). */
  agency: Agency;
  /** Whether there is a Team page for this person at all. */
  teamPage: boolean;
  /** Whether the Wallet module exists for this person (rollout gate); undefined while asking. */
  walletPage: boolean | undefined;
}

const ShellContext = createContext<ShellState | null>(null);

/** How the shell is drawn, which Settings can change: only the sidebar, for now. */
export interface ShellPrefs {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

const PrefsContext = createContext<ShellPrefs | null>(null);

export function useShellPrefs(): ShellPrefs {
  const p = useContext(PrefsContext);
  if (!p) throw new Error("useShellPrefs outside the product shell");
  return p;
}

export function useShell(): ShellState {
  const s = useContext(ShellContext);
  if (!s) throw new Error("useShell outside the product shell");
  return s;
}

/* ── The root ─────────────────────────────────────────────────────── */

export function SpacesApp({ base, badge, children }: { base: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <SpacesBaseProvider base={base}>
      <SpacesGround>
        <Gate>{children}</Gate>
      </SpacesGround>
      {/* The local demo's badge (preview/spaces-demo) goes here. */}
      {badge}
    </SpacesBaseProvider>
  );
}

/** The path relative to the product: `/spaces/listings`, `/wallet`, `` for the Dashboard. */
export function productRel(pathname: string, base: string): string {
  const prefix = productPrefix(base);
  const rest = prefix && (pathname === prefix || pathname.startsWith(`${prefix}/`)) ? pathname.slice(prefix.length) : pathname;
  return rest === "/" ? "" : rest;
}

function Gate({ children }: { children: ReactNode }) {
  const { session, configured } = useCreatorSession();
  const pathname = usePathname();
  const params = useSearchParams();
  const base = useSpacesBase();
  const rel = productRel(pathname, base);

  // An invitation opens on its own: the page handles signing in with the
  // invitation beside the form.
  if (/^\/spaces\/team\/?$/.test(rel) && isSeatCode(params.get("seat"))) {
    return <Centered>{children}</Centered>;
  }
  if (session === undefined) return <Centered><Wordmark className="h-5 w-auto text-text" /></Centered>;
  if (session === null) return <SignInDoor configured={configured} />;
  // Coming back from X finishes that trip first; onboarding can wait a page.
  return (
    <Onboarded session={session} skip={/^\/spaces\/x\/?$/.test(rel)}>
      <SignedIn session={session}>{children}</SignedIn>
    </Onboarded>
  );
}

/**
 * Onboarding before the product, once: a person without a username, a
 * passkey or recovery codes (or a web wallet they can make) is sent to
 * /welcome, which brings them back here. Everybody else never sees it.
 * A full load, not a client navigation: /welcome carries the wallet pages'
 * strict CSP, which only a response can set.
 */
function Onboarded({ session, skip, children }: { session: Session; skip: boolean; children: ReactNode }) {
  const door = useDoor(session, skip);
  const base = useSpacesBase();
  useEffect(() => {
    if (door !== "onboarding") return;
    const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.replace(`${productPrefix(base)}/welcome?next=${encodeURIComponent(here)}`);
  }, [door, base]);
  if (door !== "in") return <Centered><Wordmark className="h-5 w-auto text-text" /></Centered>;
  return <>{children}</>;
}

export function Centered({ children }: { children: ReactNode }) {
  return <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center gap-6 px-4 py-10">{children}</div>;
}

/* ── Signed in ────────────────────────────────────────────────────── */

const COLLAPSE_KEY = "hold-shell-collapsed";

function SignedIn({ session, children }: { session: Session; children: ReactNode }) {
  const listings = useListings();
  const seats = useSeats();
  const x = useX();
  const work = useWork();
  const team = useTeam();
  const me = useMe();
  const agency = useAgency(session.user.id, team.data);
  // Asked alongside, never waited for: the shell draws without it.
  const walletPage = useWalletEnabled(session.user.id);

  // Who signed in here, for the next visit's "Welcome back" (lib/auth/remember).
  useEffect(() => {
    const m = me.data;
    remember({
      method: currentMethod(session.user.app_metadata?.provider),
      email: session.user.email ?? null,
      name: m?.profile.displayName?.trim() || (chosenUsername(m) ? `@${chosenUsername(m)}` : null),
    });
  }, [me.data, session.user.app_metadata?.provider, session.user.email]);

  // The team is read before the first paint so a Creative Director's Team item
  // is there from the start; a failed read only means no team is shown.
  const ready =
    listings.data !== undefined &&
    seats.data !== undefined &&
    (x.data !== undefined || x.error) &&
    (team.data !== undefined || team.error);
  const failed = listings.error ?? seats.error;

  const state = useMemo<ShellState | null>(() => {
    if (!ready || !listings.data || !seats.data) return null;
    const role = roleOf(listings.data, seats.data, x.data ?? null);
    const w = work.data ?? [];
    const onTeams = seats.data.some((s) => s.status === "active");
    return {
      session,
      role,
      listings: listings.data,
      seats: seats.data,
      x: x.data ?? null,
      work: w,
      managed: w.filter((l) => l.role === "manager"),
      agency,
      teamPage: role !== "creator" || agency.on || onTeams,
      walletPage,
    };
  }, [ready, listings.data, seats.data, x.data, work.data, session, agency, walletPage]);

  if (failed && !state) {
    return (
      <Centered>
        <div className={`${glass} flex w-full max-w-[440px] flex-col gap-4 p-6`}>
          <Wordmark className="h-5 w-auto text-text" />
          <Alert>{describeCreatorError(failed)}</Alert>
          <div className="flex gap-2">
            <button type="button" className={btnGhost} onClick={() => window.location.reload()}>
              Try again
            </button>
            <button type="button" className={btnGhost} onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </div>
      </Centered>
    );
  }
  if (!state) return <Centered><Wordmark className="h-5 w-auto text-text" /></Centered>;

  return (
    <ShellContext.Provider value={state}>
      <Frame>{children}</Frame>
    </ShellContext.Provider>
  );
}

const btnGhost =
  "inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border border-white/10 bg-white/[0.05] px-3 text-tiny font-medium text-[#CFE3EC] transition-colors hover:bg-white/10 hover:text-text";

function Frame({ children }: { children: ReactNode }) {
  const shell = useShell();
  const pathname = usePathname();
  const router = useRouter();
  const base = useSpacesBase();
  const rel = productRel(pathname, base);
  const level = levelOf(rel);
  const active = activeKey(rel);

  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* the sidebar opens expanded */
    }
  }, []);

  const saveCollapsed = useCallback((v: boolean) => {
    setCollapsed(v);
    try {
      window.localStorage.setItem(COLLAPSE_KEY, v ? "1" : "0");
    } catch {
      /* remembered for this page only */
    }
  }, []);
  const toggleCollapsed = () => saveCollapsed(!collapsed);
  const prefs = useMemo(() => ({ collapsed, setCollapsed: saveCollapsed }), [collapsed, saveCollapsed]);

  // Closing the drawer on every navigation, so a tap on a link is the whole gesture.
  useEffect(() => setDrawer(false), [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // A page this person cannot open sends them to the first one of its level
  // they can (a rep's Spaces is Deliveries), or the Dashboard.
  const allowed = itemsFor(level, shell.role, shell.teamPage, shell.walletPage === true);
  // While the wallet gate is still being asked, the Wallet page waits blank
  // rather than being sent away and back.
  const deciding = active === "wallet" && shell.walletPage === undefined;
  const here = active ? deciding || allowed.some((i) => i.key === active) : true;
  useEffect(() => {
    if (here) return;
    router.replace(level === "spaces" && allowed[0] ? hrefFor(allowed[0], base) : hrefFor({ path: "" }, base));
  }, [here, router, allowed, base, level]);

  const badges = useBadges();
  const entries = usePaletteEntries();
  const scale = useUiScale();

  return (
    <div
      className="w-full px-[clamp(12px,1.6vw,28px)] py-3 lg:py-4"
      // The dashboard's way to big screens: the whole product drawn larger,
      // and anything sized by the viewport divided back (--app-vh).
      style={{ zoom: scale, ["--ui-scale" as string]: scale, ["--app-vh" as string]: `calc(100dvh / ${scale})` }}
    >
      <PrefsContext.Provider value={prefs}>
        {palette ? <CommandPalette entries={entries} onClose={() => setPalette(false)} /> : null}

        <div
          className={`grid grid-cols-[minmax(0,1fr)] gap-4 ${
            collapsed ? "lg:grid-cols-[60px_minmax(0,1fr)]" : "lg:grid-cols-[248px_minmax(0,1fr)]"
          }`}
        >
          <div className="hidden lg:block">
            <div className="sticky top-4 h-[calc(var(--app-vh,100dvh)-2rem)]">
              <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} level={level} active={active} badges={badges} />
            </div>
          </div>

          {/* As tall as the sidebar at least, so a screen that fills it ends where the sidebar ends. */}
          <div className="flex min-w-0 flex-col gap-4 lg:min-h-[calc(var(--app-vh,100dvh)-2rem)]">
            <TopBar title={titleFor(rel)} level={level} onMenu={() => setDrawer(true)} onSearch={() => setPalette(true)} />
            <main className="flex min-w-0 flex-1 flex-col">{here && !deciding ? children : null}</main>
          </div>
        </div>

        {drawer ? (
          <div className="fixed inset-0 z-[65] lg:hidden">
            <button aria-label="Close menu" className="absolute inset-0 bg-[#030b13]/70 backdrop-blur-sm" onClick={() => setDrawer(false)} />
            <div className="absolute inset-y-0 left-0 w-[min(86vw,300px)] p-3">
              <Sidebar collapsed={false} level={level} active={active} badges={badges} onClose={() => setDrawer(false)} />
            </div>
          </div>
        ) : null}
      </PrefsContext.Provider>
    </div>
  );
}

/* ── Big screens ──────────────────────────────────────────────────── */

/**
 * How much larger to draw everything, as the KPI dashboard does: at least the
 * 1470 × 820 the screens are laid out for, never below 1 (a laptop and a phone
 * draw at their own size) and at most 1.75, in 5% steps so a window being
 * dragged does not re-lay out on every pixel.
 */
export function uiScaleFor(width: number, height: number): number {
  if (width < 1470) return 1;
  const s = Math.min(width / 1470, height / 820);
  return Math.max(1, Math.min(1.75, Math.floor(s * 20) / 20));
}

function useUiScale(): number {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const read = () => setScale(uiScaleFor(window.innerWidth, window.innerHeight));
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);
  return scale;
}

/* ── Sidebar ──────────────────────────────────────────────────────── */

function useBadges(): Partial<Record<NavKey, number>> {
  const { role } = useShell();
  const offers = useOffers(role === "creator");
  return useMemo(() => {
    const out: Partial<Record<NavKey, number>> = {};
    const waiting = offers.data ? waitingOnYou(offers.data).length : 0;
    if (waiting) {
      out.offers = waiting;
      out.spaces = waiting;
    }
    return out;
  }, [offers.data]);
}

/**
 * The Wallet page carries a strict Content-Security-Policy that only a
 * response can set, so the way in and the way out are full page loads, never
 * a client-side navigation.
 */
function hardLink(key: NavKey, active: NavKey | null): boolean {
  return key === "wallet" || active === "wallet";
}

function Sidebar({
  collapsed,
  onToggle,
  onClose,
  level,
  active,
  badges,
}: {
  collapsed: boolean;
  onToggle?: () => void;
  onClose?: () => void;
  level: Level;
  active: NavKey | null;
  badges: Partial<Record<NavKey, number>>;
}) {
  const { role, teamPage, walletPage } = useShell();
  const productHref = useProductHref();
  const wallet = walletPage === true;
  const nav = LEVELS[level];
  const groups = nav.groups
    .map((g) => ({ ...g, items: g.items.filter((i) => visible(i, role, teamPage, wallet)) }))
    .filter((g) => g.items.length > 0);
  const foot = nav.foot.filter((i) => visible(i, role, teamPage, wallet));
  const home = productHref();

  const toggle = onClose ? (
    <button type="button" aria-label="Close menu" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#9FB7C2] hover:bg-white/10 hover:text-text">
      <IconClose />
    </button>
  ) : onToggle ? (
    <button
      type="button"
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      onClick={onToggle}
      className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#9FB7C2] hover:bg-white/10 hover:text-text"
    >
      {collapsed ? <IconExpand /> : <IconCollapse />}
    </button>
  ) : null;

  return (
    <aside
      className={`flex h-full flex-col rounded-[18px] border border-white/10 bg-[linear-gradient(160deg,rgba(5,17,28,0.9),rgba(4,12,20,0.84))] shadow-[0_20px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl ${
        collapsed ? "items-center px-2 py-3" : "p-3"
      }`}
    >
      <div className={`flex w-full items-center ${collapsed ? "flex-col gap-3" : "justify-between gap-2 px-1.5 pb-3 pt-1"}`}>
        {level === "main" ? (
          <Link href={home} aria-label="Dashboard" className="flex min-w-0 items-center">
            {collapsed ? (
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/10 bg-white/[0.06] text-[13px] font-semibold text-amber">H</span>
            ) : (
              <Wordmark className="h-4 w-auto text-text" />
            )}
          </Link>
        ) : (
          // A product's column: its name, and the way back to HOLD's.
          <Link
            href={home}
            aria-label="Back to HOLD"
            title="Back to HOLD"
            className={
              collapsed
                ? "flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/10 bg-white/[0.06] text-[#CFE3EC] hover:bg-white/10"
                : "flex h-9 min-w-0 items-center gap-2 rounded-[10px] px-1.5 text-small text-[#CFE3EC] transition-colors hover:bg-white/[0.07] hover:text-text"
            }
          >
            <IconArrowLeft />
            {collapsed ? null : <span className="truncate">Back</span>}
          </Link>
        )}
        {toggle}
      </div>

      {level === "spaces" && !collapsed ? (
        <div className="mb-3 flex items-center gap-2 border-b border-white/10 px-2.5 pb-3">
          <Wordmark className="h-3 w-auto text-text" />
          <span className="h-3.5 w-px bg-white/20" aria-hidden />
          <span className="text-small font-medium text-amber">Spaces</span>
        </div>
      ) : null}

      <nav aria-label={level === "main" ? "HOLD" : "Spaces"} className={`flex w-full flex-1 flex-col overflow-y-auto ${collapsed ? "items-center gap-1 pt-2" : "gap-4"}`}>
        {groups.map((g) => (
          <div key={g.title ?? "main"} className={collapsed ? "flex flex-col items-center gap-1" : "flex flex-col gap-1"}>
            {collapsed ? (
              g.title ? <div className="my-1 h-px w-8 bg-white/10" /> : null
            ) : g.title ? (
              <p className="px-2.5 pb-1 text-[10px] font-medium uppercase tracking-wider text-[#6B8A99]">{g.title}</p>
            ) : null}
            {g.items.map((i) => (
              <NavLink key={i.key} item={i} active={active === i.key} badge={badges[i.key]} collapsed={collapsed} hard={hardLink(i.key, active)} />
            ))}
          </div>
        ))}
      </nav>

      <div className={`mt-3 flex w-full flex-col gap-2 border-t border-white/10 pt-3 ${collapsed ? "items-center" : ""}`}>
        <div className={`flex w-full flex-col gap-1 ${collapsed ? "items-center" : ""}`}>
          {foot.map((i) => (
            <NavLink key={i.key} item={i} active={active === i.key} collapsed={collapsed} hard={hardLink(i.key, active)} />
          ))}
        </div>
        <UserCard collapsed={collapsed} />
      </div>
    </aside>
  );
}

function NavLink({ item, active, badge, collapsed, hard }: { item: NavItem; active: boolean; badge?: number; collapsed: boolean; hard: boolean }) {
  const base = useSpacesBase();
  const Icon = item.icon;
  const href = hrefFor(item, base);
  const current = active ? ("page" as const) : undefined;
  const go = (className: string, children: ReactNode, label?: string) =>
    hard ? (
      <a href={href} aria-current={current} aria-label={label} title={label} className={className}>
        {children}
      </a>
    ) : (
      <Link href={href} aria-current={current} aria-label={label} title={label} className={className}>
        {children}
      </Link>
    );

  if (collapsed) {
    return go(
      `relative flex h-9 w-9 items-center justify-center rounded-[10px] transition-colors ${
        active ? "bg-amber/25 text-[#FFE2A1]" : "text-[#9FB7C2] hover:bg-white/10 hover:text-text"
      }`,
      <>
        <Icon />
        {badge ? <span className="absolute right-1 top-1 h-2 w-2 rounded-[4px] bg-amber" aria-hidden /> : null}
      </>,
      item.label,
    );
  }
  return go(
    `flex items-center gap-2.5 rounded-[10px] border px-2.5 transition-colors ${item.child ? "ml-4 h-9 w-[calc(100%-1rem)] text-tiny" : "h-10 w-full text-small"} ${
      active
        ? "border-amber/45 bg-[linear-gradient(140deg,rgba(255,183,3,0.26),rgba(255,183,3,0.12))] text-text"
        : "border-transparent text-[#CFE3EC] hover:bg-white/[0.07]"
    }`,
    <>
      <span className={active ? "text-amber" : "text-[#9FB7C2]"}>
        <Icon />
      </span>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {badge ? (
        <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-[10px] bg-amber px-1.5 text-[11px] font-medium text-text-on-amber">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </>,
  );
}

const ROLE_LABEL: Record<ShellRole, string> = { creator: "Creator", manager: "Manager", rep: "Rep" };

function UserCard({ collapsed }: { collapsed: boolean }) {
  const { session, x, role, seats, agency } = useShell();
  const me = useMe();
  const productHref = useProductHref();
  const linked = x?.linked ? x : null;
  const username = chosenUsername(me.data);
  const name = me.data?.profile.displayName?.trim() || (username ? `@${username}` : linked ? `@${linked.handle}` : session.user.email ?? "Signed in");
  const seat = role !== "creator" ? seats.find((s) => s.status === "active" && s.role === role) : null;
  const title = role === "creator" && agency.on ? "Creative Director" : ROLE_LABEL[role];
  const sub = seat ? `${title} · ${creatorText(seat) ?? "a creator"}` : username && me.data?.profile.displayName ? `@${username}` : title;
  const photo = me.data?.profile.avatarUrl ?? linked?.avatarUrl ?? null;

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1">
        <Link href={productHref("/account")} title={name}>
          <Avatar src={photo} name={name} size={36} />
        </Link>
        <button type="button" aria-label="Sign out" title="Sign out" onClick={() => void signOut()} className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#9FB7C2] hover:bg-white/10 hover:text-text">
          <IconSignOut />
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2.5 rounded-[12px] border border-white/10 bg-white/[0.04] p-2">
      <Link href={productHref("/account")} className="flex min-w-0 flex-1 items-center gap-2.5" title="Account">
        <Avatar src={photo} name={name} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-small text-text">{name}</p>
          <p className="truncate text-[11px] text-[#9FB7C2]">{sub}</p>
        </div>
      </Link>
      <button
        type="button"
        aria-label="Sign out"
        title="Sign out"
        onClick={() => void signOut()}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#9FB7C2] hover:bg-white/10 hover:text-text"
      >
        <IconSignOut />
      </button>
    </div>
  );
}

/* ── Top bar ──────────────────────────────────────────────────────── */

function TopBar({ title, level, onMenu, onSearch }: { title: string; level: Level; onMenu: () => void; onSearch: () => void }) {
  const { role } = useShell();
  const href = useHref();
  return (
    <header className="sticky top-2 z-40 rounded-[18px] border border-white/10 bg-[linear-gradient(145deg,rgba(8,23,36,0.9),rgba(6,16,27,0.88))] p-2 shadow-[0_18px_35px_rgba(0,0,0,0.32)] backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            aria-label="Open menu"
            onClick={onMenu}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-white/10 bg-white/[0.05] text-[#CFE3EC] lg:hidden"
          >
            <IconMenu />
          </button>
          <h1 className="truncate pl-1 text-body font-medium text-text sm:text-[18px]">{title}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={onSearch} aria-label="Search" className={`${btnGhost} sm:w-[180px] sm:justify-start xl:w-[220px]`}>
            <IconSearch className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="ml-auto hidden rounded-[4px] border border-white/15 px-1 py-0.5 text-[9px] sm:inline">⌘K</kbd>
          </button>
          {level === "spaces" && role === "creator" ? (
            <Link
              href={href("/listings/new")}
              className="inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] bg-amber px-3 text-tiny font-medium text-text-on-amber transition-colors hover:bg-amber-glow"
            >
              <IconPlus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New listing</span>
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}

/* ── ⌘K entries ───────────────────────────────────────────────────── */

/** The same two levels as the sidebar: HOLD's pages, then Spaces' pages and what is in them. */
function usePaletteEntries(): PaletteEntry[] {
  const { role, listings, managed, teamPage, walletPage } = useShell();
  const href = useHref();
  const base = useSpacesBase();
  const offers = useOffers(role === "creator");

  return useMemo(() => {
    const out: PaletteEntry[] = [];
    const wallet = walletPage === true;
    for (const i of itemsFor("main", role, teamPage, wallet)) {
      out.push({ id: `main-${i.key}`, group: "HOLD", label: i.label, href: hrefFor(i, base), keywords: i.keywords });
    }
    if (role === "creator") out.push({ id: "new", group: "Spaces", label: "New listing", href: href("/listings/new"), keywords: "create start" });
    for (const i of itemsFor("spaces", role, teamPage, wallet)) {
      out.push({ id: `spaces-${i.key}`, group: "Spaces", label: i.label, href: hrefFor(i, base), keywords: i.keywords });
    }
    for (const l of listings) {
      out.push({
        id: `l-${l.id}`,
        group: "Listings",
        label: l.serviceName || l.title,
        sub: `${l.status}${l.event ? ` · ${l.event.name}` : ""}`,
        href: href(`/listings/${l.id}`),
        keywords: l.event?.name,
      });
    }
    for (const m of managed) {
      out.push({ id: `m-${m.spaceId}`, group: "Listings", label: m.title, sub: m.eventName ?? m.status, href: href(`/listings/${m.spaceId}`) });
    }
    for (const o of offers.data ?? []) {
      out.push({
        id: `o-${o.id}`,
        group: "Offers",
        label: `${o.sponsor.name} · ${o.amountUsdc} USDC`,
        sub: `${o.kind === "bid" ? "Bid" : "Offer"} · ${o.serviceName || o.spaceTitle} · ${o.status}`,
        href: href(`/offers?id=${o.id}`),
      });
    }
    // A remembered invitation is reachable from anywhere.
    const seat = typeof window !== "undefined" ? pendingSeat() : null;
    if (seat) out.push({ id: "seat", group: "Spaces", label: "Open team invitation", href: href(`/team?seat=${encodeURIComponent(seat.seat)}`) });
    return out;
  }, [role, listings, managed, offers.data, href, base, teamPage, walletPage]);
}
