"use client";

/**
 * Settings, as the app draws the person's menu (src/components/MenuContent)
 * and the screens under it: one GlassSurface card of rows, the quiet Sign Out
 * under it, and the help line and the company at the foot. Each row opens its
 * own screen with Back (`?screen=`, so the browser's Back works too).
 *
 *   Security           → ?screen=security   security.tsx: the rows the web has
 *                          (Link your phone, Passkeys)
 *   Account recovery   → ?screen=recovery   backup.tsx, the fintech "ways to
 *                          get back in": Passkey, Recovery codes
 *                          → ?screen=passkeys       passkeys.tsx
 *                          → ?screen=codes          recovery-codes.tsx
 *   Sign-in            → Account › Account (the AccountSheet)
 *   Appearance         → ?screen=personalization   settings/index.tsx's
 *                          Appearance section, with the web's own rows
 *                          (sidebar; a creator's pages → ?screen=pages)
 *   Help & Support     → an email to support
 *   About HOLD         → ?screen=about      about.tsx: Website, Follow us, Legal
 *
 * Left out on purpose, because the web has nothing real behind them yet:
 * notifications (the backend keeps an email switch nothing reads), sessions
 * (`/sessions` is the app's and not open to the web), PIN, Face ID, auto-lock
 * and the authenticator (the phone's), language and currency (the web is in
 * English and in dollars), statements and invite.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { describeCreatorError } from "@/lib/creator/api";
import { signOut } from "@/lib/creator/session";
import { chosenUsername, emailRecoveryCodes, recoveryCodesStatus } from "@/lib/app/me";
import { useMe } from "@/lib/app/spaces-data";
import { useHoldWallet } from "@/lib/app/hold-wallet";
import { listPasskeys, type RegisteredPasskey } from "@/lib/wallet/api";

import { useLinkedPhones } from "../account/PhoneScreen";
import { UserAvatar } from "../account/UserAvatar";
import { useProductHref, useSpacesBase } from "../base";
import { BackHeader, Column, ctaPrimary, ctaSecondary, holdCard, HoldCard, MenuRow, Notice, SectionTitle, Switch } from "../hold";
import { Ion, type IonName } from "../ion";
import { useShell, useShellPrefs } from "../Shell";
import { YourPagesCard, YourPagesScreen } from "../spaces/YourPages";
import { Skeleton } from "../ui";

/** The product's own host serves only the product; the website's pages live on the website. */
const WEBSITE = "https://hihodl.xyz";

type Screen = "home" | "security" | "recovery" | "passkeys" | "codes" | "personalization" | "about";

export function MenuScreen({ screen, item }: { screen?: string; item?: string } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const productHref = useProductHref();
  const open = useCallback((s: Screen) => router.push(s === "home" ? pathname : `${pathname}?screen=${s}`, { scroll: false }), [router, pathname]);
  const home = () => open("home");
  if (screen === "security") return <SecurityScreen onBack={home} open={open} />;
  if (screen === "recovery") return <RecoveryScreen onBack={home} open={open} />;
  if (screen === "passkeys") return <PasskeysScreen onBack={() => open("recovery")} />;
  if (screen === "codes") return <CodesScreen onBack={() => open("recovery")} />;
  if (screen === "personalization") return <PersonalizationScreen onBack={home} />;
  if (screen === "about") return <AboutScreen onBack={home} />;
  if (screen === "pages") {
    // Your pages, one level under Appearance (../spaces/YourPages).
    return (
      <YourPagesScreen
        base={productHref("/menu?screen=pages")}
        back={productHref("/menu?screen=personalization")}
        backLabel="Appearance"
        item={item}
      />
    );
  }
  return <MenuHome open={open} />;
}

/* ── Data ─────────────────────────────────────────────────────────── */

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

type CodesStatus = { hasActiveCodes: boolean; unusedCount: number; generatedAt: string | null };

function useCodes(): [CodesStatus | null | undefined, () => void] {
  const [codes, setCodes] = useState<CodesStatus | null | undefined>(undefined);
  const load = useCallback(() => {
    recoveryCodesStatus().then(setCodes, () => setCodes(null));
  }, []);
  useEffect(load, [load]);
  return [codes, load];
}

/* ── Home: the app's menu card ────────────────────────────────────── */

function MenuHome({ open }: { open: (s: Screen) => void }) {
  const productHref = useProductHref();
  const [codes] = useCodes();
  // The app's badge on Account recovery: recovery codes never made.
  const recoveryBadge = codes && !codes.hasActiveCodes ? 1 : 0;
  return (
    <Column>
      <MenuHero />
      <MenuTiles />
      <HoldCard className="mt-1.5">
        <MenuRow icon="person-outline" label="Account" sub="Profile, X account, where you get paid" href={productHref("/account")} />
        <MenuRow icon="shield-checkmark-outline" label="Security" onClick={() => open("security")} />
        <MenuRow icon="key-outline" label="Account recovery" badge={recoveryBadge} onClick={() => open("recovery")} />
        <MenuRow icon="log-in-outline" label="Sign-in" href={productHref("/account?view=account")} />
        <MenuRow icon="contrast-outline" label="Appearance" onClick={() => open("personalization")} />
        <MenuRow icon="help-circle-outline" label="Help & Support" href="mailto:support@hihodl.xyz" external />
        <MenuRow icon="information-circle-outline" label="About HOLD" onClick={() => open("about")} />
      </HoldCard>

      {/* Sign Out: quieter than a row, on purpose (the app's signOutRow). */}
      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-[18px] flex items-center justify-center gap-2 rounded-[12px] px-4 py-3.5 text-[15px] font-strong text-white/55 transition-colors hover:text-white/80"
      >
        <Ion name="log-out-outline" size={16} />
        Sign Out
      </button>

      <p className="mt-[18px] text-center text-[12px] text-[#9FB7C2]">Need something else? We&apos;re here to help.</p>
      <p className="mt-8 text-center text-[11px] font-strong tracking-[1.2px] text-white/55">HIHODL TECHNOLOGIES OÜ</p>
    </Column>
  );
}

/* ── The menu's head (MenuContent's hero and tiles) ───────────────── */

/**
 * The app's hero: the avatar big and centred, the username under it, the whole
 * thing a door to the profile. No chips, no switcher — the app dropped those.
 */
function MenuHero() {
  const me = useMe();
  const { session } = useShell();
  const productHref = useProductHref();
  const username = chosenUsername(me.data);
  const name = username ? `@${username}` : me.data?.profile.displayName?.trim() || session.user.email || "You";
  return (
    <Link href={productHref("/account")} className="mt-1 flex flex-col items-center gap-3 rounded-[18px] py-5 transition-opacity hover:opacity-80">
      <UserAvatar size={96} fallbackName={name} />
      <span className="max-w-full truncate text-[22px] font-extrabold leading-7 text-white">{name}</span>
    </Link>
  );
}

/** The app's two tiles. Plan is the app's; Invite friends lives in Benefits. */
function MenuTiles() {
  const productHref = useProductHref();
  return (
    <div className="mt-1 grid grid-cols-2 gap-2.5">
      <Tile icon="person-add-outline" title="Invite friends" sub="Earn rewards together" href={productHref("/benefits")} />
      <Tile icon="phone-portrait-outline" title="Link your phone" sub="Approve from the app" href={productHref("/account?view=phone")} />
    </div>
  );
}

function Tile({ icon, title, sub, href }: { icon: IonName; title: string; sub: string; href: string }) {
  return (
    <Link href={href} className={`${holdCard} flex flex-col gap-2 p-3.5 transition-colors hover:bg-white/[0.06]`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-white/[0.08] text-white">
        <Ion name={icon} size={18} />
      </span>
      <span className="block truncate text-[14px] font-bold leading-5 text-white">{title}</span>
      <span className="block truncate text-[12px] leading-4 text-white/55">{sub}</span>
    </Link>
  );
}

/* ── Security (security.tsx) ──────────────────────────────────────── */

function SecurityScreen({ onBack, open }: { onBack: () => void; open: (s: Screen) => void }) {
  const productHref = useProductHref();
  const passkeys = usePasskeys();
  const phones = useLinkedPhones();
  const n = phones.devices?.length ?? 0;
  const phoneValue = phones.error ? "Unavailable" : phones.devices === undefined ? undefined : n === 0 ? "Not linked" : n === 1 ? "Linked" : `${n} phones`;
  return (
    <Column>
      <BackHeader title="Security" onBack={onBack} />
      <HoldCard className="mt-4">
        {/* The app's "Link with the web", from this side: the phones that approve withdrawals. */}
        <MenuRow icon="qr-code-outline" label="Link your phone" value={phoneValue} href={productHref("/account?view=phone")} />
        <MenuRow
          icon="finger-print-outline"
          label="Passkeys"
          value={passkeys === undefined ? undefined : passkeys === null ? "Unavailable" : String(passkeys.length)}
          onClick={() => open("passkeys")}
        />
      </HoldCard>
    </Column>
  );
}

/* ── Account recovery (backup.tsx, the fintech "ways to get back in") ─ */

function FactorRow({ icon, title, subtitle, active, divider, onClick }: { icon: IonName; title: string; subtitle: string; active: boolean | null; divider: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3.5 px-4 py-4 text-left transition-colors hover:bg-white/[0.03] ${divider ? "border-t border-white/[0.08]" : ""}`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-white/[0.08] text-white">
        <Ion name={icon} size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-strong leading-5 text-white">{title}</span>
        <span className="mt-[3px] block text-[13px] leading-[18px] text-white/55">{subtitle}</span>
      </span>
      {active === null ? (
        <Skeleton className="h-6 w-10" />
      ) : active ? (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[12px] bg-[#3ED598] text-[#0A1A24]" aria-label="On">
          <Ion name="checkmark" size={15} />
        </span>
      ) : (
        <span className="shrink-0 text-[13px] font-strong text-amber">Set up</span>
      )}
    </button>
  );
}

function RecoveryScreen({ onBack, open }: { onBack: () => void; open: (s: Screen) => void }) {
  const passkeys = usePasskeys();
  const [codes] = useCodes();
  const [info, setInfo] = useState(false);
  return (
    <Column>
      <BackHeader title="Account recovery" onBack={onBack} />
      <div className="mt-4 flex items-start gap-2 px-1">
        <p className="flex-1 text-[15px] font-medium leading-[21px] text-white/[0.72]">If you ever lose your phone, any of these brings your account back.</p>
        <button type="button" aria-label="How recovery works" aria-expanded={info} onClick={() => setInfo((v) => !v)} className="mt-px text-amber">
          <Ion name="information-circle-outline" size={20} />
        </button>
      </div>

      {info ? (
        <HoldCard className="mt-4 flex flex-col items-center gap-3 px-5 py-6 text-center">
          <span className="flex h-[54px] w-[54px] items-center justify-center rounded-[27px] bg-amber/[0.12] text-amber">
            <Ion name="shield-checkmark" size={24} />
          </span>
          <p className="text-[19px] font-strong text-white">How you get back in</p>
          <p className="text-[14px] leading-5 text-white/[0.72]">
            Your money lives in your wallet, not with us, so we can never move it on our own. To make sure you can always get back in, set up at least two
            ways below.
          </p>
          <p className="text-[14px] leading-5 text-white/[0.72]">
            Recovery codes are one-time backups. Save them somewhere that is not your email, like your password manager.
          </p>
          <p className="text-[13px] text-white/55">The more ways you set up, the safer you are.</p>
        </HoldCard>
      ) : null}

      <HoldCard className="mt-[18px]">
        <FactorRow
          icon="finger-print-outline"
          title="Passkey"
          subtitle="Unlock with your face. Works on your new phone automatically."
          active={passkeys === undefined ? null : !!passkeys && passkeys.length > 0}
          divider={false}
          onClick={() => open("passkeys")}
        />
        <FactorRow
          icon="grid-outline"
          title="Recovery codes"
          subtitle="One-time codes. Save them somewhere that is not your email."
          active={codes === undefined ? null : !!codes?.hasActiveCodes}
          divider
          onClick={() => open("codes")}
        />
      </HoldCard>
      <p className="mt-4 px-4 text-center text-[13px] leading-[18px] text-[#9FB7C2]">Set up at least two. You can change these anytime.</p>
    </Column>
  );
}

/* ── Passkeys (passkeys.tsx) ──────────────────────────────────────── */

function added(iso: string): string {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (!Number.isFinite(days)) return "";
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1mo ago" : `${months}mo ago`;
}

function PasskeysScreen({ onBack }: { onBack: () => void }) {
  const productHref = useProductHref();
  const w = useHoldWallet();
  const passkeys = usePasskeys();
  const [info, setInfo] = useState(false);
  // Adding a passkey happens in the Wallet, which carries a strict CSP only a full page load can set.
  const add = w.walletPage ? (
    <a href={productHref("/wallet")} className={passkeys && passkeys.length > 0 ? ctaSecondary : ctaPrimary}>
      <Ion name="add" size={18} />
      {passkeys && passkeys.length > 0 ? "Add another device" : "Add a passkey"}
    </a>
  ) : null;
  return (
    <Column>
      <BackHeader
        title="Passkeys"
        onBack={onBack}
        right={
          <button type="button" aria-label="What are passkeys?" aria-expanded={info} onClick={() => setInfo((v) => !v)} className="flex h-9 w-9 items-center justify-center text-white/70 hover:text-white">
            <Ion name="information-circle-outline" size={24} />
          </button>
        }
      />
      {info ? (
        <HoldCard className="mb-4 mt-2 flex flex-col items-center gap-3 px-5 py-6 text-center">
          <span className="flex h-[60px] w-[60px] items-center justify-center rounded-[30px] bg-amber/[0.12] text-amber">
            <Ion name="finger-print" size={30} />
          </span>
          <p className="text-[20px] font-strong text-white">What are passkeys?</p>
          <p className="text-[14px] leading-[21px] text-white/65">Passkeys let you sign in with Face ID or your fingerprint — no password and no recovery phrase to type.</p>
          <p className="text-[14px] leading-[21px] text-white/65">
            Each device you sign in from registers its own passkey, so you can add or remove them independently here.
          </p>
        </HoldCard>
      ) : null}

      {passkeys === undefined ? (
        <div className="mt-4 flex flex-col gap-3">
          <Skeleton className="h-[74px] rounded-[16px]" />
          <Skeleton className="h-[74px] rounded-[16px]" />
        </div>
      ) : passkeys === null ? (
        <div className="mt-4">
          <Notice icon="alert-circle-outline" tone="calm">
            Failed to load passkeys
          </Notice>
        </div>
      ) : passkeys.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-[18px] border border-amber/[0.22] bg-amber/[0.06] p-5 text-center">
          <span className="mb-0.5 flex h-[54px] w-[54px] items-center justify-center rounded-[27px] bg-amber/[0.12] text-amber">
            <Ion name="finger-print" size={26} />
          </span>
          <p className="text-[17px] font-strong text-white">Protect this device</p>
          <p className="mb-2 px-1 text-[13px] leading-[19px] text-white/60">
            This device doesn&apos;t have a passkey yet. Add one to sign in with Face ID or your fingerprint — no password needed.
          </p>
          {add ? <div className="w-full">{add}</div> : null}
        </div>
      ) : (
        <>
          <p className="mb-3 mt-4 px-0.5 text-[12px] font-strong uppercase tracking-[0.6px] text-white/55">All passkeys</p>
          <div className="mb-4 flex flex-col gap-3">
            {passkeys.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-[16px] border border-white/[0.08] bg-white/[0.05] p-3.5">
                <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-amber/10 text-amber">
                  <Ion name={p.deviceType === "singleDevice" ? "phone-portrait-outline" : "key-outline"} size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-strong text-white">{p.name || "Passkey"}</span>
                  <span className="mt-[3px] block text-[12px] font-medium text-white/55">Added {added(p.createdAt)}</span>
                </span>
              </div>
            ))}
          </div>
          {add}
        </>
      )}

      <div className="flex items-start gap-2.5 px-1 pt-[18px]">
        <Ion name="shield-checkmark-outline" size={18} className="shrink-0 text-white/55" />
        <p className="flex-1 text-[12px] leading-[17px] text-white/55">
          Removing the last passkey is not allowed. To replace it, add a new one first, then remove the old.
        </p>
      </div>
    </Column>
  );
}

/* ── Recovery codes (recovery-codes.tsx, the email flow) ──────────── */

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return email;
  return `${email.slice(0, Math.min(2, at))}•••@${email.slice(at + 1)}`;
}

function ago(iso: string | null): string {
  if (!iso) return "previously";
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (!Number.isFinite(days)) return "previously";
  if (days < 1) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

function Box({ icon, children, tone }: { icon: IonName; children: ReactNode; tone: "warn" | "info" }) {
  return (
    <div className={`flex items-start gap-3 rounded-[12px] p-4 ${tone === "warn" ? "border border-amber/30 bg-amber/10" : "bg-white/[0.05]"}`}>
      <Ion name={icon} size={20} className={tone === "warn" ? "shrink-0 text-amber" : "shrink-0 text-white/60"} />
      <p className={`flex-1 text-[14px] leading-5 ${tone === "warn" ? "text-white/90" : "text-[13px] leading-[18px] text-white/60"}`}>{children}</p>
    </div>
  );
}

function CodesScreen({ onBack }: { onBack: () => void }) {
  const { session } = useShell();
  const [codes, reload] = useCodes();
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const email = session.user.email ?? null;
  const masked = email ? maskEmail(email) : "your email";
  const has = !!codes?.hasActiveCodes;

  const send = async () => {
    if (!email) return;
    setSending(true);
    setNotice(null);
    try {
      await emailRecoveryCodes(email);
      setConfirm(false);
      setSent(true);
      reload();
    } catch (e) {
      setNotice(describeCreatorError(e));
    } finally {
      setSending(false);
    }
  };

  const badge = (icon: IonName, good: boolean) => (
    <span
      className={`mx-auto mb-6 flex h-[72px] w-[72px] items-center justify-center rounded-[36px] border ${
        good ? "border-[rgba(76,175,80,0.28)] bg-[rgba(76,175,80,0.12)] text-[#4CAF50]" : "border-amber/[0.28] bg-amber/[0.12] text-amber"
      }`}
    >
      <Ion name={icon} size={34} />
    </span>
  );

  return (
    <Column>
      <BackHeader title="Recovery Codes" onBack={onBack} />
      {codes === undefined ? (
        <Skeleton className="mt-4 h-72 rounded-[28px]" />
      ) : sent ? (
        <div className="mt-4 flex flex-col">
          {badge("mail-open-outline", true)}
          <p className="mb-3 text-center text-[24px] font-strong text-white">Check your email</p>
          <p className="mb-5 text-center text-[15px] leading-[22px] text-white/70">
            We just sent your recovery codes to {masked}. Keep that email somewhere safe — you&apos;ll need a code to get back into your account.
          </p>
          <div className="mb-6 flex justify-center">
            <span className="inline-flex h-9 items-center gap-2 rounded-[18px] border border-[rgba(76,175,80,0.28)] bg-[rgba(76,175,80,0.1)] px-3.5 text-[14px] font-strong text-[#4CAF50]">
              <Ion name="mail-outline" size={16} />
              {masked}
            </span>
          </div>
          <Box icon="information-circle-outline" tone="info">
            Each code can only be used once. After using a code, generate new ones if needed.
          </Box>
          <div className="mt-5 flex flex-col gap-3">
            <button type="button" className={ctaPrimary} onClick={onBack}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col">
          {badge(has ? "shield-checkmark-outline" : "key-outline", has)}
          <p className="mb-3 text-center text-[24px] font-strong text-white">{has ? "Recovery Codes Active" : "Recovery Codes"}</p>
          <p className="mb-5 text-center text-[15px] leading-[22px] text-white/70">
            {codes === null
              ? "We could not read your recovery codes right now."
              : has
                ? `You generated recovery codes ${ago(codes.generatedAt)}. They're valid until you regenerate or use them.${codes.unusedCount ? ` ${codes.unusedCount} unused.` : ""}`
                : "Recovery codes are backup codes that can be used to recover your account if you lose access to your device or forget your password."}
          </p>
          <div className="mx-auto mb-6 flex max-w-[340px] items-start gap-2 px-1">
            <Ion name="mail-outline" size={16} className="mt-px shrink-0 text-white/55" />
            <p className="flex-1 text-[13px] leading-[18px] text-white/55">
              We&apos;ll send them to {masked}. Generate new ones here anytime — it replaces the old set.
            </p>
          </div>
          <Box icon={has ? "refresh-outline" : "warning-outline"} tone="warn">
            {has
              ? "Regenerating will invalidate your existing codes immediately. Only do this if you have lost or compromised the old ones."
              : "Keep the email somewhere safe. Anyone with these codes can recover your account, so don't forward or share them."}
          </Box>
          {notice ? (
            <div className="mt-4">
              <Notice>{notice}</Notice>
            </div>
          ) : null}
          {confirm ? (
            <HoldCard className="mt-5 flex flex-col gap-3 p-5">
              <p className="text-[17px] font-strong text-white">{has ? "Regenerate Recovery Codes?" : "Generate Recovery Codes?"}</p>
              <p className="text-[14px] leading-5 text-white/[0.72]">
                {has
                  ? "Your existing recovery codes will be invalidated immediately. We'll email a fresh set to your inbox. Only do this if you've lost or compromised the old ones."
                  : "We'll create your recovery codes and email them straight to you. Use them to get back into your account if you ever lose access."}
              </p>
              <button type="button" className={ctaPrimary} disabled={sending} onClick={() => void send()}>
                {sending ? "Sending…" : has ? "Regenerate" : "Generate"}
              </button>
              <button type="button" className="h-11 text-[15px] font-strong text-white/80 hover:text-white" disabled={sending} onClick={() => setConfirm(false)}>
                Cancel
              </button>
            </HoldCard>
          ) : email ? (
            <div className="mt-5">
              <button type="button" className={ctaPrimary} onClick={() => setConfirm(true)}>
                {has ? "Regenerate Recovery Codes" : "Generate & email my codes"}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </Column>
  );
}

/* ── Appearance (settings/index.tsx › Appearance, the web's rows) ──── */

function PersonalizationScreen({ onBack }: { onBack: () => void }) {
  const { role } = useShell();
  const { collapsed, setCollapsed } = useShellPrefs();
  const productHref = useProductHref();
  return (
    <Column>
      <BackHeader title="Appearance" onBack={onBack} />
      <SectionTitle>Sidebar</SectionTitle>
      <HoldCard>
        <div className="flex items-center gap-3 px-3 py-5">
          <Ion name="contrast-outline" size={18} className="shrink-0 text-white" />
          <span className="min-w-0 flex-1 pr-3">
            <span className="block text-[16px] font-strong leading-[21px] tracking-[0.1px] text-white">Icons only</span>
            <span className="mt-0.5 block text-[13px] leading-[17px] text-white/[0.62]">Keep the sidebar narrow on a wide screen. Remembered in this browser.</span>
          </span>
          <Switch checked={collapsed} onChange={setCollapsed} label="Icons only" />
        </div>
      </HoldCard>

      {/* Your pages: what a creator's public pages stand on (../spaces/YourPages). */}
      {role === "creator" ? (
        <>
          <SectionTitle>Your pages</SectionTitle>
          <YourPagesCard href={productHref("/menu?screen=pages")} />
        </>
      ) : null}
    </Column>
  );
}

/* ── About (about.tsx) ────────────────────────────────────────────── */

function AboutScreen({ onBack }: { onBack: () => void }) {
  // On app.hihodl.xyz a bare /terms would be read as a page of the product.
  const site = useSpacesBase().startsWith("/app") ? "" : WEBSITE;
  const social = (label: string, icon: IonName, href: string) => (
    <a
      key={label}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-1 flex-col items-center gap-2 rounded-[16px] py-3.5 text-white transition-colors hover:bg-white/[0.04]"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-[22px] bg-white/[0.08]">
        <Ion name={icon} size={20} />
      </span>
      <span className="text-[12px] font-strong text-white/[0.72]">{label}</span>
    </a>
  );
  return (
    <Column>
      <BackHeader title="About" onBack={onBack} />
      <SectionTitle>Connect</SectionTitle>
      <HoldCard>
        <MenuRow icon="globe-outline" label="Website" href={`${WEBSITE}`} external />
      </HoldCard>

      <SectionTitle>Follow us</SectionTitle>
      <HoldCard className="flex px-2 py-1">
        {social("X", "fa6:x-twitter", "https://x.com/hiihodl")}
        {social("LinkedIn", "fa6:linkedin", "https://www.linkedin.com/company/hihodl")}
        {social("Telegram", "fa6:telegram", "https://t.me/HiHODLchat")}
      </HoldCard>

      <SectionTitle>Legal</SectionTitle>
      <HoldCard>
        <MenuRow icon="document-text-outline" label="Terms of Service" href={`${site}/terms`} external />
        <MenuRow icon="shield-outline" label="Privacy Policy" href={`${site}/privacy`} external />
      </HoldCard>

      <p className="mt-6 text-center text-[12px] text-[#9FB7C2]">Made for freelancers around the world.</p>
    </Column>
  );
}
