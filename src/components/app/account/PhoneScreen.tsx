"use client";

/**
 * Your phone: the phones linked to this account. A linked Android phone
 * approves and signs the payments started on the web; an iPhone is recorded,
 * and the passkey keeps approving (documentation/one-wallet-every-device.md).
 *
 *   rows     how many, on Settings › Security (where the app keeps "Link
 *            with the web")
 *   screen   each phone, when it was linked, Remove     → Account ?view=phone
 *
 * "Link your phone" opens the link screen, /wallet/link (a full load: it
 * carries the wallet pages' strict CSP, and on Android with a web wallet the
 * wallet's secret is sealed there). It is there whatever is linked already:
 * an iPhone linked first does not stop an Android phone joining.
 *
 * REMOVING A PHONE NEEDS THE PASSKEY. A linked Android phone approves every
 * payment the web starts, so the session alone does not remove it: the
 * server's challenge (sha256("hihodl/unlink/v1" ‖ deviceId ‖ nonce)) is
 * fetched when Remove is first tapped, and the second tap, "Remove with
 * passkey", opens the passkey prompt as its very first step (Safari keeps the
 * user activation only until the first network round trip, so the challenge
 * must already be here, as in Withdraw). An account with no passkey removes
 * the phone from the HOLD app on that phone. documentation/one-wallet-every-device.md.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { t as tr, type MessageKey } from "@/lib/app/i18n";
import { fmtDate } from "@/lib/app/i18n/format";
import { useT } from "@/lib/app/i18n/react";
import { activeLinkedDevices, removalChallenge, removeLinkedDevice, type LinkedDevice, type RemovalChallenge } from "@/lib/link/api";
import { WalletApiError } from "@/lib/wallet/api";
import { explain } from "@/lib/wallet/explain";
import { assertChallenge, PasskeyError } from "@/lib/wallet/passkey";

import { BackHeader, Column, ctaCommit, ctaSecondary, HoldCard, Notice, SectionTitle } from "../hold";
import { Ion } from "../ion";
import { Skeleton } from "../ui";

const PLATFORM: Record<LinkedDevice["platform"], MessageKey> = { android: "account.phone.android", ios: "account.phone.iphone", other: "account.phone.other" };
const HOW: Record<LinkedDevice["platform"], MessageKey> = {
  android: "account.phone.howAndroid",
  ios: "account.phone.howIos",
  other: "account.phone.howOther",
};

/** The server keeps a removal's nonce five minutes; a fresh one is fetched well before that. */
const FRESH_MS = 3 * 60 * 1000;

/** Removal refusals in the person's words. Never red; each says nothing was removed. */
function removalProblem(e: unknown): string {
  if (e instanceof PasskeyError && e.code === "cancelled") return tr("account.phone.errCancelled");
  if (e instanceof WalletApiError) {
    switch (e.code) {
      case "UNLINK_NEEDS_PASSKEY":
        return tr("account.phone.errNeedsPasskey");
      case "UNLINK_PROOF_NOT_ALLOWED":
        return tr("account.phone.errProofNotAllowed");
      case "PASSKEY_VERIFICATION_FAILED":
      case "PASSKEY_NOT_REGISTERED":
        return tr("account.phone.errVerifyFailed");
      case "UNLINK_CHALLENGE_EXPIRED":
        return tr("account.phone.errExpired");
      case "not_found":
        return tr("account.phone.errNotFound");
    }
  }
  return explain(e);
}

function when(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : fmtDate(d, { day: "numeric", month: "short", year: "numeric" });
}

export function useLinkedPhones() {
  const [devices, setDevices] = useState<LinkedDevice[] | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      setDevices(await activeLinkedDevices());
    } catch (e) {
      setError(e);
    }
  }, []);
  useEffect(() => void load(), [load]);
  return { devices, error, reload: load };
}

export function PhoneScreenView({
  devices,
  error,
  confirming,
  busy,
  canUsePasskey,
  linkHref,
  onBack,
  onAsk,
  onKeep,
  onRemove,
}: {
  devices: LinkedDevice[] | undefined;
  error: unknown;
  confirming: string | null;
  busy: boolean;
  /** Whether the passkey can confirm the removal being asked; null while the challenge loads. */
  canUsePasskey: boolean | null;
  linkHref: string;
  onBack: () => void;
  onAsk: (id: string) => void;
  onKeep: () => void;
  onRemove: (id: string) => void;
}) {
  const t = useT();
  const small =
    "inline-flex h-8 shrink-0 items-center rounded-[16px] border border-white/[0.22] bg-white/10 px-3 text-[13px] font-strong text-white transition-colors hover:bg-white/[0.14] disabled:opacity-50";
  return (
    <Column>
      <BackHeader title={t("account.phone.title")} onBack={onBack} />
      {devices === undefined && !error ? (
        <Skeleton className="h-40 rounded-[28px]" />
      ) : (
        <>
          <p className="mb-2 px-1 text-[15px] font-medium leading-[21px] text-white/[0.72]">
            {t("account.phone.intro")}
          </p>
          {devices && devices.length > 0 ? (
            <>
              <SectionTitle>{t("account.phone.linked")}</SectionTitle>
              <HoldCard>
                {devices.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 px-[18px] py-[18px]">
                    <Ion name="phone-portrait-outline" size={18} className="mt-[2px] self-start text-white" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-strong leading-5 text-white">{t(PLATFORM[d.platform])}</p>
                      <p className="mt-0.5 text-[12px] leading-4 text-[#9FB7C2]">
                        {d.linkedAt ? t("account.phone.howLinked", { how: t(HOW[d.platform]), date: when(d.linkedAt) }) : t(HOW[d.platform])}
                      </p>
                    </div>
                    {confirming === d.id ? (
                      <div className="flex gap-1.5">
                        {canUsePasskey !== false ? (
                          <button type="button" className={small} disabled={busy || canUsePasskey === null} onClick={() => onRemove(d.id)}>
                            {busy ? t("account.phone.removing") : canUsePasskey === null ? t("account.phone.preparing") : t("account.phone.removeWithPasskey")}
                          </button>
                        ) : null}
                        <button type="button" className={small} disabled={busy} onClick={onKeep}>
                          {t("account.phone.keep")}
                        </button>
                      </div>
                    ) : (
                      <button type="button" className={small} onClick={() => onAsk(d.id)}>
                        {t("common.remove")}
                      </button>
                    )}
                  </div>
                ))}
              </HoldCard>
            </>
          ) : null}
          {confirming ? (
            <p className="mt-3 px-1 text-[12px] leading-[17px] text-[#9FB7C2]">
              {canUsePasskey === false
                ? t("account.phone.noPasskey")
                : t("account.phone.passkeyConfirms")}
            </p>
          ) : null}
          {error ? (
            <div className="mt-4">
              <Notice>{explain(error)}</Notice>
            </div>
          ) : null}
          {devices ? (
            <div className="mt-6">
              {/* A full load: the link screen carries the wallet pages' strict CSP. */}
              <a href={linkHref} className={devices.length === 0 ? ctaCommit : ctaSecondary}>
                <Ion name="qr-code-outline" size={16} />
                {devices.length === 0 ? t("account.phone.link") : devices.some((d) => d.platform === "android") ? t("account.phone.linkAnother") : t("account.phone.linkAndroid")}
              </a>
            </div>
          ) : null}
        </>
      )}
    </Column>
  );
}

export function PhoneScreen({ onBack, linkHref }: { onBack: () => void; linkHref: string }) {
  const { devices, error, reload } = useLinkedPhones();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [canUsePasskey, setCanUsePasskey] = useState<boolean | null>(null);
  // The removal's challenge, fetched BEFORE the tap that uses it.
  const prepared = useRef<{ id: string; challenge: RemovalChallenge } | null>(null);

  const prepare = useCallback(async (id: string) => {
    try {
      const challenge = await removalChallenge(id);
      prepared.current = { id, challenge };
      setCanUsePasskey(challenge.proofs.includes("passkey") && !!challenge.options);
      if (!challenge.proofs.includes("passkey")) setActionError(null);
    } catch (e) {
      prepared.current = null;
      // No passkey on the account: the button goes. Anything else: it stays, and its tap asks again.
      setCanUsePasskey(e instanceof WalletApiError && e.code === "UNLINK_NEEDS_PASSKEY" ? false : true);
      setActionError(removalProblem(e));
    }
  }, []);

  // While Remove waits for its second tap, keep the challenge fresh.
  useEffect(() => {
    if (!confirming) return;
    const t = setInterval(() => {
      const p = prepared.current;
      if (!busy && p && p.id === confirming && Date.now() - p.challenge.fetchedAt > FRESH_MS) void prepare(confirming);
    }, 15_000);
    return () => clearInterval(t);
  }, [confirming, busy, prepare]);

  const ask = (id: string) => {
    setConfirming(id);
    setActionError(null);
    setCanUsePasskey(null);
    prepared.current = null;
    void prepare(id);
  };

  const keep = () => {
    setConfirming(null);
    setActionError(null);
    prepared.current = null;
  };

  const remove = async (id: string) => {
    const p = prepared.current;
    if (!p || p.id !== id || !p.challenge.options) {
      setActionError(tr("account.phone.stillPreparing"));
      if (!p) void prepare(id);
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      // The prompt first, before any network: Safari's user activation.
      const assertion = await assertChallenge(p.challenge.options);
      await removeLinkedDevice(id, { nonce: p.challenge.nonce, assertion });
      prepared.current = null;
      setConfirming(null);
      await reload();
    } catch (e) {
      setActionError(removalProblem(e));
      // The nonce was spent (or is about to lapse): the next tap needs a new one.
      prepared.current = null;
      void prepare(id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PhoneScreenView
      devices={devices}
      error={actionError ? new RemovalNotice(actionError) : error}
      confirming={confirming}
      busy={busy}
      canUsePasskey={canUsePasskey}
      linkHref={linkHref}
      onBack={onBack}
      onAsk={ask}
      onKeep={keep}
      onRemove={(id) => void remove(id)}
    />
  );
}

/** A removal's words, already written for the person: shown as they are. */
class RemovalNotice extends Error {}
