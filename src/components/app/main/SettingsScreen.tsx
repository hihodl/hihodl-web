"use client";

/**
 * Settings, from the person's side: a few cards, each opening its own screen
 * with Back (`?screen=`, so the browser's Back works too). Nothing is a long
 * page. It mirrors the app's settings where the web has the same thing:
 *
 *   Profile & account   → Account (photo, name, username, email)
 *   X account           → Account › X (verified, 90 days, change, disconnect)
 *   Security            → ?screen=security: passkeys, recovery codes, the
 *                         phones that approve withdrawals, sign out
 *   Payout              → Account › Where you get paid (Solana on the web)
 *   Personalization     → ?screen=personalization: the sidebar, and "Your
 *                         pages" (→ ?screen=pages, ../spaces/YourPages: the
 *                         backgrounds of a creator's public pages)
 *
 * Help and legal are a row of small links at the foot, not cards.
 *
 * Left out on purpose, because the web has nothing real behind them yet:
 * notifications (the backend keeps an email switch nothing reads), sessions
 * (`/sessions` is the app's and not open to the web), language and currency
 * (the web is in English and in dollars).
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { describeCreatorError } from "@/lib/creator/api";
import { signOut } from "@/lib/creator/session";
import { emailRecoveryCodes, recoveryCodesStatus } from "@/lib/app/me";
import { useHoldWallet } from "@/lib/app/hold-wallet";
import { usePayout, useX } from "@/lib/app/spaces-data";
import { listPasskeys, type RegisteredPasskey } from "@/lib/wallet/api";

import { useUserPhoto, UserAvatar } from "../account/UserAvatar";
import { useLinkedPhones } from "../account/PhoneScreen";
import { useProductHref, useSpacesBase } from "../base";
import { btnGhost, btnLink, Note, ScreenHeader, shortAddress, Warn } from "../front/kit";
import { IconChevronRight, IconSignOut } from "../icons";
import { useShell, useShellPrefs } from "../Shell";
import { YourPagesCard, YourPagesScreen } from "../spaces/YourPages";
import { glass, Segmented, Skeleton } from "../ui";

/** The product's own host serves only the product; the website's pages live on the website. */
const WEBSITE = "https://hihodl.xyz";

type Screen = "home" | "security" | "personalization";

export function SettingsScreen({ screen, item }: { screen?: string; item?: string } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const productHref = useProductHref();
  const open = useCallback((s: Screen) => router.push(s === "home" ? pathname : `${pathname}?screen=${s}`, { scroll: false }), [router, pathname]);
  const back = () => open("home");
  if (screen === "security") return <Centred><SecurityScreen onBack={back} /></Centred>;
  if (screen === "personalization") return <Centred><PersonalizationScreen onBack={back} /></Centred>;
  if (screen === "pages") {
    // Your pages, one level under Personalization (../spaces/YourPages).
    return (
      <YourPagesScreen
        base={productHref("/settings?screen=pages")}
        back={productHref("/settings?screen=personalization")}
        backLabel="Personalization"
        item={item}
      />
    );
  }
  return <SettingsHome open={open} />;
}

function Centred({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col items-center py-2">{children}</div>;
}

/* ── Home ─────────────────────────────────────────────────────────── */

function SettingsHome({ open }: { open: (s: Screen) => void }) {
  const { session } = useShell();
  const productHref = useProductHref();
  const { name } = useUserPhoto();
  const x = useX();
  const payout = usePayout();
  const passkeys = usePasskeys();
  const linkedX = x.data?.linked ? x.data : null;
  const sol = payout.data?.solana.address ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SettingsCard
          href={productHref("/account")}
          title="Profile & account"
          sub={session.user.email ?? "Photo, name, username"}
          lead={<UserAvatar size={40} fallbackName={name ?? session.user.email} />}
          body={name ?? "Add your name"}
        />
        <SettingsCard
          href={productHref("/account?view=x")}
          title="X account"
          sub={linkedX ? (linkedX.canPublish ? "Verified, ready to publish" : "Not ready to publish yet") : "Listings publish under it"}
          body={x.data === undefined ? null : linkedX ? `@${linkedX.handle}` : "Not connected"}
          attention={!!x.data && !x.data.canPublish}
        />
        <SettingsCard
          onClick={() => open("security")}
          title="Security"
          sub="Passkeys, recovery codes, phones"
          body={passkeys === undefined ? null : passkeys === null ? "Passkeys" : `${passkeys.length} passkey${passkeys.length === 1 ? "" : "s"}`}
        />
        <SettingsCard
          href={productHref("/account?view=payout")}
          title="Payout"
          sub="Where sponsors pay you, in USDC on Solana"
          body={payout.data === undefined && !payout.error ? null : sol ? shortAddress(sol) : "Not set up"}
          attention={!!payout.data && !sol}
        />
        <SettingsCard onClick={() => open("personalization")} title="Personalization" sub="Sidebar, your pages" body="Look and feel" />
      </div>

      <FootRow />
    </div>
  );
}

/** A card that opens its own screen: a link to another page, or a button for one of this page's screens. */
function SettingsCard({
  title,
  sub,
  body,
  lead,
  href,
  onClick,
  attention,
}: {
  title: string;
  sub: string;
  body: ReactNode;
  lead?: ReactNode;
  href?: string;
  onClick?: () => void;
  attention?: boolean;
}) {
  const inner = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="text-small font-medium text-text">{title}</span>
        <IconChevronRight className="h-4 w-4 shrink-0 text-[#9FB7C2]" />
      </span>
      <span className="flex min-w-0 items-center gap-3">
        {lead}
        <span className="min-w-0">
          {body === null ? (
            <Skeleton className="h-5 w-28" />
          ) : (
            <span className={`block truncate text-body ${attention ? "text-amber" : "text-text"}`}>{body}</span>
          )}
          <span className="mt-0.5 block truncate text-tiny text-[#9FB7C2]">{sub}</span>
        </span>
      </span>
    </>
  );
  const cls = `${glass} flex min-h-[120px] w-full min-w-0 flex-col justify-between gap-4 p-5 text-left transition-colors hover:bg-white/[0.06]`;
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

/** Signed in as, sign out, and help and legal: one small row. */
function FootRow() {
  const { session } = useShell();
  // On app.hihodl.xyz a bare /terms would be read as a page of the product.
  const site = useSpacesBase().startsWith("/app") ? "" : WEBSITE;
  const links = [
    { label: "Support", href: "mailto:support@hihodl.xyz" },
    { label: "Terms", href: `${site}/terms` },
    { label: "Privacy", href: `${site}/privacy` },
  ];
  return (
    <footer className="flex flex-col gap-3 border-t border-white/10 px-1 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <nav aria-label="Help and legal" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-tiny">
        {links.map((l) => (
          <a
            key={l.label}
            href={l.href}
            target={l.href.startsWith("mailto:") ? undefined : "_blank"}
            rel="noopener noreferrer"
            className="text-[#9FB7C2] hover:text-text"
          >
            {l.label}
          </a>
        ))}
      </nav>
      <div className="flex min-w-0 items-center gap-3">
        <span className="min-w-0 truncate text-tiny text-[#9FB7C2]">{session.user.email ?? "Signed in"}</span>
        <button type="button" onClick={() => void signOut()} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] px-2 text-tiny text-[#CFE3EC] hover:bg-white/10 hover:text-text">
          <IconSignOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </footer>
  );
}

/* ── Security ─────────────────────────────────────────────────────── */

/** undefined while reading, null when it could not be read. */
function usePasskeys(): RegisteredPasskey[] | null | undefined {
  const [list, setList] = useState<RegisteredPasskey[] | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    listPasskeys().then(
      (l) => alive && setList(l),
      () => alive && setList(null),
    );
    return () => {
      alive = false;
    };
  }, []);
  return list;
}

function day(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
}

function Row({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-small font-medium text-text">{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

function SecurityScreen({ onBack }: { onBack: () => void }) {
  const { session } = useShell();
  const productHref = useProductHref();
  const w = useHoldWallet();
  const passkeys = usePasskeys();
  const phones = useLinkedPhones();

  const [codes, setCodes] = useState<{ hasActiveCodes: boolean; unusedCount: number; generatedAt: string | null } | null | undefined>(undefined);
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const loadCodes = useCallback(() => {
    recoveryCodesStatus().then(setCodes, () => setCodes(null));
  }, []);
  useEffect(loadCodes, [loadCodes]);
  const email = session.user.email ?? null;

  const sendCodes = async () => {
    if (!email) return;
    setSending(true);
    setNotice(null);
    try {
      await emailRecoveryCodes(email);
      setConfirm(false);
      setNotice(`New codes are on their way to ${email}.`);
      loadCodes();
    } catch (e) {
      setNotice(describeCreatorError(e));
    } finally {
      setSending(false);
    }
  };

  const phoneCount = phones.devices?.length ?? 0;

  return (
    <section className={`${glass} flex w-full max-w-[600px] flex-col gap-4 p-5 sm:p-6`}>
      <ScreenHeader title="Security" onBack={onBack} />

      <Row
        title="Passkeys"
        action={
          w.walletPage ? (
            // The Wallet page carries a strict CSP that only a full page load can set.
            <a href={productHref("/wallet")} className="text-tiny text-amber hover:text-[#FFE2A1]">
              Manage in Wallet
            </a>
          ) : null
        }
      >
        {passkeys === undefined ? (
          <Skeleton className="h-10" />
        ) : passkeys === null ? (
          <Note>We could not read your passkeys right now.</Note>
        ) : passkeys.length === 0 ? (
          <Note>No passkey yet. Your wallet asks for one when you make it.</Note>
        ) : (
          <ul className="flex flex-col gap-2">
            {passkeys.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-small text-text">{p.name || "Passkey"}</span>
                <span className="shrink-0 text-tiny text-[#9FB7C2]">Added {day(p.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Row>

      <Row title="Recovery codes">
        {codes === undefined ? (
          <Skeleton className="h-10" />
        ) : codes === null ? (
          <Note>We could not read your recovery codes right now.</Note>
        ) : (
          <p className="text-small text-[#CFE3EC]">
            {codes.hasActiveCodes
              ? `${codes.unusedCount} unused${codes.generatedAt ? `, sent ${day(codes.generatedAt)}` : ""}. Each one gets you back in once if you lose your passkeys.`
              : "None yet. They get you back in if you lose your passkeys."}
          </p>
        )}
        {confirm ? (
          <div className="flex flex-col gap-2">
            <p className="text-small text-text">
              Eight new codes go to {email}. The ones you have now stop working as soon as they arrive.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnGhost} disabled={sending} onClick={() => void sendCodes()}>
                {sending ? "Sending…" : "Send new codes"}
              </button>
              <button type="button" className={btnLink} disabled={sending} onClick={() => setConfirm(false)}>
                Not now
              </button>
            </div>
          </div>
        ) : email && codes !== undefined ? (
          <div>
            <button type="button" className={btnGhost} onClick={() => setConfirm(true)}>
              {codes?.hasActiveCodes ? "Email me new codes" : "Email me codes"}
            </button>
          </div>
        ) : null}
        {notice ? <Warn>{notice}</Warn> : null}
      </Row>

      <Row
        title="Phones that approve withdrawals"
        action={
          <Link href={productHref("/account?view=phone")} className="text-tiny text-amber hover:text-[#FFE2A1]">
            Manage
          </Link>
        }
      >
        {phones.devices === undefined && !phones.error ? (
          <Skeleton className="h-6 w-1/2" />
        ) : (
          <p className="text-small text-[#CFE3EC]">
            {phones.error ? "We could not read your phones right now." : phoneCount === 0 ? "None linked yet." : `${phoneCount} linked`}
          </p>
        )}
      </Row>

      <div>
        <button type="button" className={btnGhost} onClick={() => void signOut()}>
          <IconSignOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </section>
  );
}

/* ── Personalization ──────────────────────────────────────────────── */

function PersonalizationScreen({ onBack }: { onBack: () => void }) {
  const { role } = useShell();
  const { collapsed, setCollapsed } = useShellPrefs();
  const productHref = useProductHref();
  return (
    <section className={`${glass} flex w-full max-w-[600px] flex-col gap-4 p-5 sm:p-6`}>
      <ScreenHeader title="Personalization" onBack={onBack} />

      <Row title="Sidebar">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-tiny text-[#9FB7C2]">On a wide screen. Remembered in this browser.</p>
          <Segmented
            label="Sidebar"
            value={collapsed ? "icons" : "full"}
            onChange={(v) => setCollapsed(v === "icons")}
            options={[
              { value: "full", label: "Full" },
              { value: "icons", label: "Icons only" },
            ]}
          />
        </div>
      </Row>

      {/* Your pages: what a creator's public pages stand on (../spaces/YourPages). */}
      {role === "creator" ? <YourPagesCard href={productHref("/settings?screen=pages")} /> : null}
    </section>
  );
}
