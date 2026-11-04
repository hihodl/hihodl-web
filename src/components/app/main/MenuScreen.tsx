"use client";

/**
 * Settings, as the app draws the person's menu (src/components/MenuContent)
 * and the screens under it: one GlassSurface card of rows, the quiet Sign Out
 * under it, and the help line and the company at the foot. Each row opens its
 * own screen with Back (`?screen=`, so the browser's Back works too).
 *
 *   Security           → ?screen=security   security.tsx: the row the web has
 *                          (Link your phone)
 *   Account recovery   → ?screen=recovery   backup.tsx, the fintech "ways to
 *                          get back in": Recovery codes (the web has no
 *                          passkey anywhere, Alex 2026-09-24)
 *                          → ?screen=codes          recovery-codes.tsx
 *   Statements         → ?screen=statements statements/index.tsx, drawn and
 *                          honest: the server issues the document and the app
 *                          asks it to (see the screen's own note)
 *   Sign-in            → Account › Account (the AccountSheet)
 *   Appearance         → ?screen=personalization   settings/index.tsx's
 *                          Appearance section: View (the app's display mode),
 *                          the sidebar, and a creator's pages → ?screen=pages
 *   Help & Support     → an email to support
 *   About HOLD         → ?screen=about      about.tsx: Website, Follow us, Legal
 *
 * The two tiles at the head are the app's: the plan, and Invite friends. The
 * plan tile says which plan this person is on and opens where the plan is
 * actually bought — hihodl.xyz — which is what the app's own tile does on
 * every platform but iOS.
 *
 *   Settings           → ?screen=settings   settings/index.tsx, what the web
 *                          can honour: Hide balances (this browser), Appearance,
 *                          Active sessions (read-only → ?screen=sessions),
 *                          Report a bug; notifications, the authenticator and
 *                          payment protection are named and sent to the app
 *
 *   Language           → ?screen=language   settings/language.tsx
 *   Currency           → ?screen=currency   settings/currency.tsx, both rows of
 *                          Settings › Appearance as in the app (PrefsScreens)
 *
 * Left out on purpose, because the web has nothing real behind them: PIN, Face
 * ID and auto-lock (the phone's).
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/appLinks";
import { describeCreatorError } from "@/lib/creator/api";
import { signOut } from "@/lib/creator/session";
import {
  DISPLAY_MODE_INTRO,
  DISPLAY_MODE_OPTIONS,
  DISPLAY_MODE_TITLE,
  type DisplayMode,
  type DisplayModeOption,
} from "@/lib/app/display-mode";
import { chosenUsername, emailRecoveryCodes, recoveryCodesStatus } from "@/lib/app/me";
import { useMe } from "@/lib/app/spaces-data";
import { thisDevice, type Phone } from "@/lib/link/ua";
import { listSessions, revokeSession, thisBrowserSessionId, type ActiveSession } from "@/lib/app/sessions";

import { useLinkedPhones } from "../account/PhoneScreen";
import { linkHref } from "../link/in-app";
import { UserAvatar } from "../account/UserAvatar";
import { useProductHref, useSpacesBase } from "../base";
import { BackHeader, Column, ctaPrimary, ctaSecondary, holdCard, HoldCard, MenuRow, Notice, SectionTitle, Switch } from "../hold";
import { Ion, type IonName } from "../ion";
import { useShell, useShellPrefs } from "../Shell";
import { YourPagesCard, YourPagesScreen } from "../spaces/YourPages";
import { Skeleton } from "../ui";
import { InviteScreen } from "./InviteScreen";
import { CurrencyScreen, LanguageScreen, languageName } from "./PrefsScreens";
import { t as tr } from "@/lib/app/i18n";
import { fmtNumber } from "@/lib/app/i18n/format";
import { useDisplayCurrency, useLocale, useT } from "@/lib/app/i18n/react";

/** The product's own host serves only the product; the website's pages live on the website. */
const WEBSITE = "https://hihodl.xyz";

type Screen = "home" | "plan" | "invite" | "security" | "recovery" | "codes" | "statements" | "settings" | "sessions" | "personalization" | "about" | "language" | "currency";

export function MenuScreen({ screen, item }: { screen?: string; item?: string } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const productHref = useProductHref();
  const t = useT();
  const open = useCallback((s: Screen) => router.push(s === "home" ? pathname : `${pathname}?screen=${s}`, { scroll: false }), [router, pathname]);
  const home = () => open("home");
  if (screen === "plan") return <PlanScreen onBack={home} />;
  if (screen === "invite") return <InviteScreen onBack={home} />;
  if (screen === "security") return <SecurityScreen onBack={home} />;
  if (screen === "recovery") return <RecoveryScreen onBack={home} open={open} />;
  if (screen === "codes") return <CodesScreen onBack={() => open("recovery")} />;
  if (screen === "statements") return <StatementsScreen onBack={home} />;
  if (screen === "settings") return <SettingsScreen onBack={home} open={open} />;
  if (screen === "sessions") return <SessionsScreen onBack={() => open("settings")} />;
  // Appearance is a row of Settings, as in the app.
  if (screen === "personalization") return <PersonalizationScreen onBack={() => open("settings")} />;
  if (screen === "about") return <AboutScreen onBack={home} />;
  if (screen === "language") return <LanguageScreen onBack={() => open("settings")} />;
  if (screen === "currency") return <CurrencyScreen onBack={() => open("settings")} />;
  if (screen === "pages") {
    // Your pages, one level under Appearance (../spaces/YourPages).
    return (
      <YourPagesScreen
        base={productHref("/menu?screen=pages")}
        back={productHref("/menu?screen=personalization")}
        backLabel={t("menu.appearance.title")}
        item={item}
      />
    );
  }
  return <MenuHome open={open} />;
}

/* ── Data ─────────────────────────────────────────────────────────── */


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
  const { walletPage } = useShell();
  const t = useT();
  const [codes] = useCodes();
  // The app's badge on Account recovery: recovery codes never made.
  const recoveryBadge = codes && !codes.hasActiveCodes ? 1 : 0;
  return (
    <Column>
      <MenuHero />
      <MenuTiles open={open} />
      <HoldCard className="mt-1.5">
        {/*
          Wallet sits here and no longer in the side column. Beside Home it
          read as a second money screen; it is not one. It is where the wallet
          made in the HOLD app is read and sent from, approved on the phone —
          which is this list's subject, next to Security and Account recovery.
        */}
        {walletPage === true ? (
          <MenuRow icon="wallet-outline" label={t("menu.home.wallet")} sub={t("menu.home.walletSubPhone")} href={productHref("/wallet")} reload />
        ) : null}
        <MenuRow icon="shield-checkmark-outline" label={t("menu.home.security")} onClick={() => open("security")} />
        <MenuRow icon="key-outline" label={t("menu.home.recovery")} badge={recoveryBadge} onClick={() => open("recovery")} />
        <MenuRow icon="document-text-outline" label={t("menu.home.statements")} onClick={() => open("statements")} />
        <MenuRow icon="log-in-outline" label={t("menu.home.signIn")} href={productHref("/account?view=account")} />
        <MenuRow icon="settings-outline" label={t("menu.home.settings")} onClick={() => open("settings")} />
        <MenuRow icon="help-circle-outline" label={t("menu.home.help")} href="mailto:support@hihodl.xyz" external />
        <MenuRow icon="information-circle-outline" label={t("menu.home.about")} onClick={() => open("about")} />
        {/* The app's last settings row, in its calm words. Closing is done on
            the website's page, which says what closing does before it asks. */}
        <MenuRow icon="heart-dislike-outline" label={t("menu.home.closeAccount")} href={`${WEBSITE}/delete-account`} external />
      </HoldCard>

      {/* Sign Out: quieter than a row, on purpose (the app's signOutRow). */}
      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-[18px] flex items-center justify-center gap-2 rounded-[12px] px-4 py-3.5 text-[15px] font-strong text-white/55 transition-colors hover:text-white/80"
      >
        <Ion name="log-out-outline" size={16} />
        {t("menu.home.signOut")}
      </button>

      <p className="mt-[18px] text-center text-[12px] text-[#9FB7C2]">{t("menu.home.helpLine")}</p>
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
  const t = useT();
  const username = chosenUsername(me.data);
  const name = username ? `@${username}` : me.data?.profile.displayName?.trim() || session.user.email || t("common.you");
  return (
    <Link href={productHref("/account")} className="mt-1 flex flex-col items-center gap-3 rounded-[18px] py-5 transition-opacity hover:opacity-80">
      <UserAvatar size={96} fallbackName={name} />
      <span className="max-w-full truncate text-[22px] font-extrabold leading-7 text-white">{name}</span>
      {/* The hero IS the Account row. There was one in the list below as well,
          under the photograph that opens the same page — so the list now
          starts at Wallet and this line says where the photograph goes. */}
      <span className="flex items-center gap-1 text-[12.5px] text-[#9FB7C2]">
        {t("menu.hero.sub")}
        <Ion name="chevron-forward" size={12} className="text-white/45" />
      </span>
    </Link>
  );
}

/**
 * The app's tiles: the plan, and Invite friends — plus the web's own third,
 * Link your phone, which is how a browser gets an approval onto a device that
 * holds keys.
 *
 * The plan tile carries the app's own words (`menu:tiles.standard` /
 * `menu:tiles.pro`) over the plan this person is actually on, read from `GET
 * /me`. Tapping it opens the one thing the web can honestly say about it:
 * which plan, and nothing to upgrade to. It names no rate —
 * each of those belongs to the one product page that charges it
 * (rates.config), and a tile that collected them would be the aggregate fee
 * page this product has decided not to have.
 */
function MenuTiles({ open }: { open: (s: Screen) => void }) {
  const productHref = useProductHref();
  const me = useMe();
  const pro = me.data?.profile.plan === "pro";
  const t = useT();
  return (
    <div className="mt-1 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      <Tile
        icon="card-outline"
        title={me.data ? (pro ? t("menu.tiles.pro") : t("menu.tiles.standard")) : t("menu.tiles.yourPlan")}
        sub={me.data ? (pro ? t("menu.tiles.proSub") : t("menu.tiles.yourPlan")) : t("common.loading")}
        onClick={() => open("plan")}
      />
      <Tile icon="person-add-outline" title={t("menu.tiles.invite")} sub={t("menu.tiles.inviteSub")} onClick={() => open("invite")} />
      {/* The link screen itself: a full load, it carries the wallet pages' CSP. */}
      <Tile icon="phone-portrait-outline" title={t("menu.tiles.link")} sub={t("menu.tiles.linkSubEvery")} href={linkHref(productHref, productHref("/menu"))} reload />
    </div>
  );
}

function Tile({ icon, title, sub, href, reload, onClick }: { icon: IonName; title: string; sub: string; href?: string; reload?: boolean; onClick?: () => void }) {
  const cls = `${holdCard} flex flex-col gap-2 p-3.5 text-left transition-colors hover:bg-white/[0.06]`;
  const inner = (
    <>
      <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-white/[0.08] text-white">
        <Ion name={icon} size={18} />
      </span>
      <span className="block truncate text-[14px] font-bold leading-5 text-white">{title}</span>
      <span className="block truncate text-[12px] leading-4 text-white/55">{sub}</span>
    </>
  );
  if (href) {
    return reload ? (
      <a href={href} className={cls}>
        {inner}
      </a>
    ) : (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

/* ── Plan ((paywall)/plans, as much of it as the web can say) ─────── */

/**
 * Which plan, and nothing to buy.
 *
 * The plan is stated from `GET /me`. HOLD Pro does not launch now (decision
 * of 24-sep-2026), so this screen offers no upgrade, no way into the app's
 * plans screen and no line about what Pro would add. An account already on
 * Pro still reads its own plan here, because that is a fact about the
 * account, not an offer.
 *
 * No rates here, deliberately. Every take we charge belongs to the one product
 * page that charges it (lib/rates.config, rule 2: no aggregated fee page), so
 * a plan screen listing them would be exactly the index that rule exists to
 * prevent.
 */
function PlanScreen({ onBack }: { onBack: () => void }) {
  const me = useMe();
  const pro = me.data?.profile.plan === "pro";
  const t = useT();
  return (
    <Column>
      <BackHeader title={t("menu.plan.title")} onBack={onBack} />
      <HoldCard className="mt-4 flex flex-col items-center gap-3 px-5 py-7 text-center">
        <span className="flex h-[60px] w-[60px] items-center justify-center rounded-[30px] bg-amber/[0.12] text-amber">
          <Ion name="card-outline" size={28} />
        </span>
        {me.data === undefined ? (
          <Skeleton className="h-7 w-32" />
        ) : (
          <p className="text-[24px] font-strong text-white">{pro ? t("menu.tiles.pro") : t("menu.tiles.standard")}</p>
        )}
        <p className="text-[14px] leading-[21px] text-white/[0.72]">
          {pro ? t("menu.plan.proBody") : t("menu.plan.standardBody")}
        </p>
      </HoldCard>
    </Column>
  );
}

/* ── Statements (statements/index.tsx) ────────────────────────────── */

/**
 * A document somebody else will read — a landlord, a consulate, a bank.
 *
 * The SERVER issues it: only there can a verification code be recorded before
 * the page is rendered, and only there can it be REFUSED when the journal does
 * not reconcile. The app asks for it and saves the bytes. A browser could
 * download a file, but it cannot hold the account's key material or the share
 * sheet the app finishes this in — so this screen says what a statement is,
 * where it is requested, and how the one you already hold is checked.
 *
 * Drawn rather than omitted, because a menu that silently lacks a row a person
 * remembers from their phone reads as a product that lost it.
 */
function StatementsScreen({ onBack }: { onBack: () => void }) {
  const t = useT();
  return (
    <Column>
      <BackHeader title={t("menu.statements.title")} onBack={onBack} />
      <HoldCard className="mt-4 flex flex-col items-center gap-3 px-5 py-7 text-center">
        <span className="flex h-[60px] w-[60px] items-center justify-center rounded-[30px] bg-amber/[0.12] text-amber">
          <Ion name="document-text-outline" size={28} />
        </span>
        <p className="text-[20px] font-strong text-white">{t("menu.statements.heading")}</p>
        <p className="text-[14px] leading-[21px] text-white/[0.72]">
          {t("menu.statements.body")}
        </p>
      </HoldCard>
      <div className="mt-4">
        <Notice icon="phone-portrait-outline" tone="calm">
          {t("menu.statements.inApp")}
        </Notice>
      </div>
      <p className="mt-4 px-4 text-center text-[13px] leading-[18px] text-[#9FB7C2]">
        {t("menu.statements.verify")}
      </p>
    </Column>
  );
}

/* ── Security (security.tsx) ──────────────────────────────────────── */

function SecurityScreen({ onBack }: { onBack: () => void }) {
  const productHref = useProductHref();
  const phones = useLinkedPhones();
  const n = phones.devices?.length ?? 0;
  const t = useT();
  const phoneValue = phones.error ? t("common.unavailable") : phones.devices === undefined ? undefined : t("menu.security.phones", { count: n });
  return (
    <Column>
      <BackHeader title={t("menu.security.title")} onBack={onBack} />
      <HoldCard className="mt-4">
        {/* The app's "Link with the web", from this side. With nothing linked it opens
            the link screen itself (a full load, for the wallet pages' CSP); with a phone
            linked, the list of phones, which links another from there. */}
        <MenuRow
          icon="qr-code-outline"
          label={t("menu.security.linkPhone")}
          value={phoneValue}
          href={phones.devices && n === 0 ? linkHref(productHref, productHref("/menu?screen=security")) : productHref("/account?view=phone")}
          reload={!!phones.devices && n === 0}
        />
      </HoldCard>
    </Column>
  );
}

/* ── Account recovery (backup.tsx, the fintech "ways to get back in") ─ */

function FactorRow({ icon, title, subtitle, active, divider, onClick }: { icon: IonName; title: string; subtitle: string; active: boolean | null; divider: boolean; onClick: () => void }) {
  const t = useT();
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
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[12px] bg-[#3ED598] text-[#0A1A24]" aria-label={t("common.on")}>
          <Ion name="checkmark" size={15} />
        </span>
      ) : (
        <span className="shrink-0 text-[13px] font-strong text-amber">{t("menu.recovery.setUp")}</span>
      )}
    </button>
  );
}

function RecoveryScreen({ onBack, open }: { onBack: () => void; open: (s: Screen) => void }) {
  const [codes] = useCodes();
  const [info, setInfo] = useState(false);
  const t = useT();
  return (
    <Column>
      <BackHeader title={t("menu.recovery.title")} onBack={onBack} />
      <div className="mt-4 flex items-start gap-2 px-1">
        <p className="flex-1 text-[15px] font-medium leading-[21px] text-white/[0.72]">{t("menu.recovery.introCodes")}</p>
        <button type="button" aria-label={t("menu.recovery.infoAria")} aria-expanded={info} onClick={() => setInfo((v) => !v)} className="mt-px text-amber">
          <Ion name="information-circle-outline" size={20} />
        </button>
      </div>

      {info ? (
        <HoldCard className="mt-4 flex flex-col items-center gap-3 px-5 py-6 text-center">
          <span className="flex h-[54px] w-[54px] items-center justify-center rounded-[27px] bg-amber/[0.12] text-amber">
            <Ion name="shield-checkmark" size={24} />
          </span>
          <p className="text-[19px] font-strong text-white">{t("menu.recovery.infoTitle")}</p>
          <p className="text-[14px] leading-5 text-white/[0.72]">
            {t("menu.recovery.infoBody1Codes")}
          </p>
          <p className="text-[14px] leading-5 text-white/[0.72]">
            {t("menu.recovery.infoBody2")}
          </p>
        </HoldCard>
      ) : null}

      <HoldCard className="mt-[18px]">
        <FactorRow
          icon="grid-outline"
          title={t("menu.recovery.codes")}
          subtitle={t("menu.recovery.codesSub")}
          active={codes === undefined ? null : !!codes?.hasActiveCodes}
          divider={false}
          onClick={() => open("codes")}
        />
      </HoldCard>
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
  if (!iso) return tr("menu.codes.agoPreviously");
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (!Number.isFinite(days)) return tr("menu.codes.agoPreviously");
  if (days < 1) return tr("menu.codes.agoToday");
  if (days < 30) return tr("menu.codes.agoDays", { count: days });
  return tr("menu.codes.agoMonths", { count: Math.floor(days / 30) });
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
  const t = useT();
  const email = session.user.email ?? null;
  const masked = email ? maskEmail(email) : t("menu.codes.yourEmail");
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
      <BackHeader title={t("menu.codes.title")} onBack={onBack} />
      {codes === undefined ? (
        <Skeleton className="mt-4 h-72 rounded-[28px]" />
      ) : sent ? (
        <div className="mt-4 flex flex-col">
          {badge("mail-open-outline", true)}
          <p className="mb-3 text-center text-[24px] font-strong text-white">{t("menu.codes.checkEmail")}</p>
          <p className="mb-5 text-center text-[15px] leading-[22px] text-white/70">
            {t("menu.codes.sentBody", { email: masked })}
          </p>
          <div className="mb-6 flex justify-center">
            <span className="inline-flex h-9 items-center gap-2 rounded-[18px] border border-[rgba(76,175,80,0.28)] bg-[rgba(76,175,80,0.1)] px-3.5 text-[14px] font-strong text-[#4CAF50]">
              <Ion name="mail-outline" size={16} />
              {masked}
            </span>
          </div>
          <Box icon="information-circle-outline" tone="info">
            {t("menu.codes.onceOnly")}
          </Box>
          <div className="mt-5 flex flex-col gap-3">
            <button type="button" className={ctaPrimary} onClick={onBack}>
              {t("common.done")}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col">
          {badge(has ? "shield-checkmark-outline" : "key-outline", has)}
          <p className="mb-3 text-center text-[24px] font-strong text-white">{has ? t("menu.codes.activeTitle") : t("menu.codes.title")}</p>
          <p className="mb-5 text-center text-[15px] leading-[22px] text-white/70">
            {codes === null
              ? t("menu.codes.readFailed")
              : has
                ? `${t("menu.codes.activeBody", { ago: ago(codes.generatedAt) })}${codes.unusedCount ? ` ${t("menu.codes.unused", { count: fmtNumber(codes.unusedCount) })}` : ""}`
                : t("menu.codes.intro")}
          </p>
          <div className="mx-auto mb-6 flex max-w-[340px] items-start gap-2 px-1">
            <Ion name="mail-outline" size={16} className="mt-px shrink-0 text-white/55" />
            <p className="flex-1 text-[13px] leading-[18px] text-white/55">
              {t("menu.codes.sendTo", { email: masked })}
            </p>
          </div>
          <Box icon={has ? "refresh-outline" : "warning-outline"} tone="warn">
            {has ? t("menu.codes.regenWarn") : t("menu.codes.keepWarn")}
          </Box>
          {notice ? (
            <div className="mt-4">
              <Notice>{notice}</Notice>
            </div>
          ) : null}
          {confirm ? (
            <HoldCard className="mt-5 flex flex-col gap-3 p-5">
              <p className="text-[17px] font-strong text-white">{has ? t("menu.codes.confirmRegenTitle") : t("menu.codes.confirmGenTitle")}</p>
              <p className="text-[14px] leading-5 text-white/[0.72]">
                {has ? t("menu.codes.confirmRegenBody") : t("menu.codes.confirmGenBody")}
              </p>
              <button type="button" className={ctaPrimary} disabled={sending} onClick={() => void send()}>
                {sending ? t("menu.codes.sending") : has ? t("menu.codes.regenerate") : t("menu.codes.generate")}
              </button>
              <button type="button" className="h-11 text-[15px] font-strong text-white/80 hover:text-white" disabled={sending} onClick={() => setConfirm(false)}>
                {t("common.cancel")}
              </button>
            </HoldCard>
          ) : email ? (
            <div className="mt-5">
              <button type="button" className={ctaPrimary} onClick={() => setConfirm(true)}>
                {has ? t("menu.codes.regenerateCta") : t("menu.codes.generateCta")}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </Column>
  );
}

/* ── Appearance (settings/index.tsx › Appearance) ─────────────────── */

/**
 * One row of the display-mode picker — the app's DisplayModeSheet row.
 *
 * Choosing changes a COLOUR and nothing structural: the border is a hairline
 * in both states, because a border that thickens on selection is how a pill
 * ends up square. The selected ink is the amber TINT (attention), never the
 * filled amber plate, which is reserved for the one action that commits.
 */
function ViewOption({
  option,
  selected,
  onChoose,
}: {
  option: DisplayModeOption;
  selected: boolean;
  onChoose: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={option.title}
      onClick={onChoose}
      className={`flex w-full items-start gap-3.5 rounded-[16px] border px-4 py-[18px] text-left transition-colors ${
        selected ? "border-amber/[0.28] bg-amber/[0.06]" : "border-white/[0.08] bg-white/[0.06] hover:bg-white/[0.10]"
      }`}
    >
      <span
        className={`mt-px flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${
          selected ? "bg-amber/[0.12] text-amber" : "bg-[rgba(143,211,227,0.10)] text-[#8FD3E3]"
        }`}
      >
        <Ion name={option.icon} size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-bold leading-5 text-white">{option.title}</span>
        <span className="mt-[5px] block text-[14px] leading-5 text-white/[0.72]">{option.body}</span>
      </span>
      <Ion
        name={selected ? "radio-button-on" : "radio-button-off"}
        size={20}
        className={`mt-0.5 shrink-0 ${selected ? "text-amber" : "text-white/45"}`}
      />
    </button>
  );
}

function PersonalizationScreen({ onBack }: { onBack: () => void }) {
  const { role } = useShell();
  const { collapsed, setCollapsed, displayMode, setDisplayMode } = useShellPrefs();
  const productHref = useProductHref();
  const t = useT();
  return (
    <Column>
      <BackHeader title={t("menu.appearance.title")} onBack={onBack} />

      {/* The app's "View" row, opened out: on the phone it is a sheet, and a
          page has the room to simply show the three and their reasons. Words
          are the app's own (settings:displayMode.*), unchanged. */}
      <SectionTitle first>{t("menu.appearance.view")}</SectionTitle>
      <p className="mb-3 px-1 text-[14px] leading-5 text-white/[0.72]">{DISPLAY_MODE_INTRO()}</p>
      <div className="flex flex-col gap-2.5" role="radiogroup" aria-label={DISPLAY_MODE_TITLE()}>
        {DISPLAY_MODE_OPTIONS().map((o) => (
          <ViewOption
            key={o.id}
            option={o}
            selected={displayMode === o.id}
            onChoose={() => setDisplayMode(o.id as DisplayMode)}
          />
        ))}
      </div>
      <p className="mt-3 px-1 text-[12px] leading-[17px] text-[#9FB7C2]">
        {t("menu.appearance.remembered")}
      </p>

      <SectionTitle>{t("menu.appearance.sidebar")}</SectionTitle>
      <HoldCard>
        <div className="flex items-center gap-3 px-3 py-5">
          <Ion name="contrast-outline" size={18} className="shrink-0 text-white" />
          <span className="min-w-0 flex-1 pr-3">
            <span className="block text-[16px] font-strong leading-[21px] tracking-[0.1px] text-white">{t("menu.appearance.iconsOnly")}</span>
            <span className="mt-0.5 block text-[13px] leading-[17px] text-white/[0.62]">{t("menu.appearance.iconsOnlySub")}</span>
          </span>
          <Switch checked={collapsed} onChange={setCollapsed} label={t("menu.appearance.iconsOnly")} />
        </div>
      </HoldCard>

      {/* Your pages: what a creator's public pages stand on (../spaces/YourPages). */}
      {role === "creator" ? (
        <>
          <SectionTitle>{t("menu.appearance.yourPages")}</SectionTitle>
          <YourPagesCard href={productHref("/menu?screen=pages")} />
        </>
      ) : null}
    </Column>
  );
}

/* ── Settings (settings/index.tsx) ────────────────────────────────── */

/**
 * The app's Settings, with what a browser can honour and the rest named.
 *
 * Hide balances is real here: the same switch, kept in this browser like the
 * view, and Home's figures go to dots. Active sessions is read from the same
 * `GET /sessions` the app lists, read-only. Notifications, the authenticator
 * and payment protection act on the phone (a push token, a TOTP factor asked
 * for at send time, guards evaluated before a send is signed), so they are
 * said to be there and opened there, never drawn as switches that do nothing.
 */
function SettingsScreen({ onBack, open }: { onBack: () => void; open: (s: Screen) => void }) {
  const { hideBalances, setHideBalances } = useShellPrefs();
  const t = useT();
  const locale = useLocale();
  const { currency } = useDisplayCurrency();
  const [sessions] = useSessions();
  const sessionsValue = sessions === undefined ? undefined : sessions === null ? t("common.unavailable") : fmtNumber(sessions.length);
  return (
    <Column>
      <BackHeader title={t("menu.settings.title")} onBack={onBack} />

      <SectionTitle>{t("menu.settings.privacy")}</SectionTitle>
      <HoldCard>
        <div className="flex items-center gap-3 px-[18px] py-[18px]">
          <Ion name="eye-off-outline" size={18} className="mt-[2px] shrink-0 self-start text-white" />
          <span className="min-w-0 flex-1 pr-3">
            <span className="block text-[14px] font-bold leading-5 text-white">{t("menu.settings.hideBalances")}</span>
            <span className="mt-0.5 block text-[12px] leading-4 text-[#9FB7C2]">{t("menu.settings.hideBalancesSub")}</span>
          </span>
          <Switch checked={hideBalances} onChange={setHideBalances} label={t("menu.settings.hideBalances")} />
        </div>
      </HoldCard>

      <SectionTitle>{t("menu.settings.appearance")}</SectionTitle>
      <HoldCard>
        <MenuRow icon="cash-outline" label={t("prefs.currency")} value={currency} onClick={() => open("currency")} />
        <MenuRow icon="language-outline" label={t("prefs.language")} value={languageName(locale)} onClick={() => open("language")} />
        <MenuRow icon="contrast-outline" label={t("menu.settings.appearance")} sub={t("menu.settings.appearanceSub")} chevron onClick={() => open("personalization")} />
      </HoldCard>

      <SectionTitle>{t("menu.settings.security")}</SectionTitle>
      <HoldCard>
        <MenuRow icon="phone-portrait-outline" label={t("menu.settings.sessions")} value={sessionsValue} chevron={sessionsValue === undefined} onClick={() => open("sessions")} />
      </HoldCard>

      <SectionTitle>{t("menu.settings.inTheApp")}</SectionTitle>
      <InTheApp
        items={[
          { icon: "notifications-outline", label: t("menu.settings.notifications"), where: t("menu.settings.notificationsWhere"), to: "notifications" },
          { icon: "keypad-outline", label: t("menu.settings.twoFactor"), where: t("menu.settings.twoFactorWhere"), to: "security" },
          { icon: "shield-outline", label: t("menu.settings.protection"), where: t("menu.settings.protectionWhere"), to: "send-protection" },
        ]}
      />

      <SectionTitle>{t("menu.settings.support")}</SectionTitle>
      <HoldCard>
        <MenuRow icon="bug-outline" label={t("menu.settings.reportBug")} sub={t("menu.settings.reportBugSub")} href={bugReportHref()} external />
      </HoldCard>
    </Column>
  );
}

/**
 * Settings that live on the phone. On a phone each opens its screen in the
 * app (`hihodl://<to>` through /open, which falls back to the store). A
 * computer cannot open an app on a phone, so the rows say where each one is,
 * drawn as text rather than as buttons, and the stores follow.
 */
function InTheApp({ items }: { items: { icon: IonName; label: string; where: string; to: string }[] }) {
  const [phone, setPhone] = useState<Phone | null>(null);
  const t = useT();
  useEffect(() => setPhone(thisDevice().phone), []);
  if (phone) {
    return (
      <HoldCard>
        {items.map((i) => (
          <MenuRow key={i.to} icon={i.icon} label={i.label} value={t("common.openInApp")} href={`${WEBSITE}/open?to=${i.to}`} external />
        ))}
      </HoldCard>
    );
  }
  return (
    <HoldCard>
      {items.map((i) => (
        <div key={i.to} className="flex w-full min-w-0 items-center gap-3 px-[18px] py-[18px]">
          <Ion name={i.icon} size={18} className="mt-[2px] shrink-0 self-start text-white" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-bold leading-5 text-white">{i.label}</span>
            <span className="mt-0.5 block text-[12px] leading-4 text-[#9FB7C2]">{t("menu.settings.onYourPhone", { where: i.where })}</span>
          </span>
        </div>
      ))}
      <MenuRow icon="logo-apple" label={t("menu.stores.appStore")} href={APP_STORE_URL} external chevron />
      <MenuRow icon="logo-google" label={t("menu.stores.googlePlay")} href={PLAY_STORE_URL} external chevron />
    </HoldCard>
  );
}

/**
 * The app's Report a bug writes a row to its own table from the phone. The
 * web has no route for that, so it is an email to the same support inbox,
 * with the page and the browser already written in.
 */
function bugReportHref(): string {
  const where = typeof window === "undefined" ? "" : window.location.href;
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const body = tr("menu.bug.body", { page: where, browser: ua });
  return `mailto:support@hihodl.xyz?subject=${encodeURIComponent(tr("menu.bug.subject"))}&body=${encodeURIComponent(body)}`;
}

/** undefined while reading, null when it could not be read. `reload` reads again. */
function useSessions(): [ActiveSession[] | null | undefined, () => void] {
  const [list, setList] = useState<ActiveSession[] | null | undefined>(undefined);
  const [round, setRound] = useState(0);
  useEffect(() => {
    const ctl = new AbortController();
    listSessions(ctl.signal).then(setList, () => !ctl.signal.aborted && setList(null));
    return () => ctl.abort();
  }, [round]);
  return [list, useCallback(() => setRound((n) => n + 1), [])];
}

function lastSeen(iso: string): string {
  const mins = Math.floor((Date.now() - Date.parse(iso)) / 60_000);
  if (!Number.isFinite(mins)) return "";
  if (mins < 5) return tr("menu.sessions.activeNow");
  if (mins < 60) return tr("menu.sessions.minAgo", { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return tr("menu.sessions.hoursAgo", { count: hours });
  return ago(iso).replace(/^./, (c) => c.toUpperCase());
}

/** The app's deviceIcon, from the glyphs this kit carries: a phone, or a browser on a computer. */
function sessionIcon(type: ActiveSession["deviceType"]): IonName {
  return type === "desktop" ? "globe-outline" : "phone-portrait-outline";
}

/**
 * Security › Active sessions, as the app's (app/(drawer)/(internal)/sessions.tsx):
 * this browser first, marked, and a trash on every other device that asks
 * "Remove this device?" before `DELETE /sessions/:id`. This browser's own row
 * has no trash; ending it is Sign out.
 */
function SessionsScreen({ onBack }: { onBack: () => void }) {
  const [sessions, reload] = useSessions();
  const mine = thisBrowserSessionId();
  const isCurrent = (x: ActiveSession) => x.id === mine;
  const ordered = sessions ? [...sessions].sort((a, b) => Number(isCurrent(b)) - Number(isCurrent(a))) : sessions;
  const [pending, setPending] = useState<ActiveSession | null>(null);
  const [removing, setRemoving] = useState(false);
  const [failed, setFailed] = useState(false);
  const t = useT();

  const remove = async () => {
    if (!pending || removing) return;
    setRemoving(true);
    setFailed(false);
    try {
      await revokeSession(pending.id);
      setPending(null);
    } catch {
      setFailed(true);
    } finally {
      setRemoving(false);
      reload();
    }
  };

  return (
    <Column>
      <BackHeader title={t("menu.sessions.title")} onBack={onBack} />
      <p className="mt-4 px-1 text-[14px] leading-5 text-white/[0.72]">
        {t("menu.sessions.intro")}
      </p>
      <HoldCard className="mt-3">
        {ordered === undefined ? (
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : ordered === null ? (
          <div className="p-4">
            <Notice tone="calm">{t("menu.sessions.readFailed")}</Notice>
          </div>
        ) : ordered.length === 0 ? (
          <p className="px-[18px] py-[18px] text-[14px] text-white/[0.72]">{t("menu.sessions.none")}</p>
        ) : (
          ordered.map((x) => {
            const current = isCurrent(x);
            const place = [x.city, x.country].filter(Boolean).join(", ");
            const sub = [current ? t("menu.sessions.thisBrowser") : lastSeen(x.lastActiveAt), place].filter(Boolean).join(" · ");
            const asking = pending?.id === x.id;
            return (
              <div key={x.id} className="flex w-full min-w-0 flex-col px-[18px] py-[18px]">
                <div className="flex w-full min-w-0 items-center gap-3">
                  <Ion name={sessionIcon(x.deviceType)} size={18} className="mt-[2px] shrink-0 self-start text-white" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-bold leading-5 text-white">{x.deviceName}</span>
                    {sub ? <span className="mt-0.5 block truncate text-[12px] leading-4 text-[#9FB7C2]">{sub}</span> : null}
                  </span>
                  {current ? (
                    <span className="shrink-0 rounded-[10px] bg-white/10 px-2 py-1 text-[11px] font-extrabold tracking-[0.4px] text-white">
                      {t("menu.sessions.thisBrowserBadge")}
                    </span>
                  ) : (
                    <button
                      type="button"
                      aria-label={t("menu.sessions.removeAria", { device: x.deviceName })}
                      onClick={() => {
                        setFailed(false);
                        setPending(asking ? null : x);
                      }}
                      disabled={removing}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[18px] text-[#9FB7C2] transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
                    >
                      <Ion name="trash-outline" size={19} />
                    </button>
                  )}
                </div>
                {asking ? (
                  <div className="mt-3 flex flex-col gap-3 rounded-[14px] bg-white/[0.04] p-3.5">
                    <p className="text-[15px] font-extrabold leading-5 text-white">{t("menu.sessions.removeTitle")}</p>
                    <p className="text-[13px] leading-[18px] text-white/[0.72]">
                      {t("menu.sessions.removeBody")}
                    </p>
                    {failed ? <Notice>{t("menu.sessions.removeFailed")}</Notice> : null}
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button type="button" className={ctaPrimary} disabled={removing} onClick={() => void remove()}>
                        {removing ? t("menu.sessions.removing") : t("menu.sessions.removeDevice")}
                      </button>
                      <button type="button" className={ctaSecondary} disabled={removing} onClick={() => setPending(null)}>
                        {t("common.cancel")}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </HoldCard>
    </Column>
  );
}

/* ── About (about.tsx) ────────────────────────────────────────────── */

function AboutScreen({ onBack }: { onBack: () => void }) {
  // On app.hihodl.xyz a bare /terms would be read as a page of the product.
  const site = useSpacesBase().startsWith("/app") ? "" : WEBSITE;
  const t = useT();
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
      <BackHeader title={t("menu.about.title")} onBack={onBack} />
      <SectionTitle>{t("menu.about.connect")}</SectionTitle>
      <HoldCard>
        <MenuRow icon="globe-outline" label={t("menu.about.website")} href={`${WEBSITE}`} external />
      </HoldCard>

      <SectionTitle>{t("menu.about.followUs")}</SectionTitle>
      <HoldCard className="flex px-2 py-1">
        {social("X", "fa6:x-twitter", "https://x.com/hiihodl")}
        {social("LinkedIn", "fa6:linkedin", "https://www.linkedin.com/company/hihodl")}
        {social("Telegram", "fa6:telegram", "https://t.me/HiHODLchat")}
      </HoldCard>

      <SectionTitle>{t("menu.about.legal")}</SectionTitle>
      <HoldCard>
        <MenuRow icon="document-text-outline" label={t("menu.about.terms")} href={`${site}/terms`} external />
        <MenuRow icon="shield-outline" label={t("menu.about.privacy")} href={`${site}/privacy`} external />
      </HoldCard>

      <p className="mt-6 text-center text-[12px] text-[#9FB7C2]">{t("menu.about.tagline")}</p>
    </Column>
  );
}
