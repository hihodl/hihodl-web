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
 */

import { useCallback, useEffect, useState } from "react";

import { activeLinkedDevices, revokeLinkedDevice, type LinkedDevice } from "@/lib/link/api";
import { explain } from "@/lib/wallet/explain";

import { BackHeader, Column, ctaCommit, ctaSecondary, HoldCard, Notice, SectionTitle } from "../hold";
import { Ion } from "../ion";
import { Skeleton } from "../ui";

const PLATFORM: Record<LinkedDevice["platform"], string> = { android: "Android phone", ios: "iPhone", other: "Phone" };
const HOW: Record<LinkedDevice["platform"], string> = {
  android: "Approves and signs payments in the HOLD app",
  ios: "On your account. Your passkey approves payments",
  other: "On your account",
};

function when(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
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
  linkHref: string;
  onBack: () => void;
  onAsk: (id: string) => void;
  onKeep: () => void;
  onRemove: (id: string) => void;
}) {
  const small =
    "inline-flex h-8 shrink-0 items-center rounded-[16px] border border-white/[0.22] bg-white/10 px-3 text-[13px] font-strong text-white transition-colors hover:bg-white/[0.14] disabled:opacity-50";
  return (
    <Column>
      <BackHeader title="Your phone" onBack={onBack} />
      {devices === undefined && !error ? (
        <Skeleton className="h-40 rounded-[28px]" />
      ) : (
        <>
          <p className="mb-2 px-1 text-[15px] font-medium leading-[21px] text-white/[0.72]">
            A linked Android phone approves and signs, in the HOLD app, the payments you start on the web. Without one, your passkey approves them here.
          </p>
          {devices && devices.length > 0 ? (
            <>
              <SectionTitle>Linked</SectionTitle>
              <HoldCard>
                {devices.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 px-[18px] py-[18px]">
                    <Ion name="phone-portrait-outline" size={18} className="mt-[2px] self-start text-white" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-strong leading-5 text-white">{PLATFORM[d.platform]}</p>
                      <p className="mt-0.5 text-[12px] leading-4 text-[#9FB7C2]">
                        {HOW[d.platform]}
                        {d.linkedAt ? ` · linked ${when(d.linkedAt)}` : ""}
                      </p>
                    </div>
                    {confirming === d.id ? (
                      <div className="flex gap-1.5">
                        <button type="button" className={small} disabled={busy} onClick={() => onRemove(d.id)}>
                          {busy ? "Removing…" : "Remove"}
                        </button>
                        <button type="button" className={small} disabled={busy} onClick={onKeep}>
                          Keep
                        </button>
                      </div>
                    ) : (
                      <button type="button" className={small} onClick={() => onAsk(d.id)}>
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </HoldCard>
            </>
          ) : null}
          {confirming ? (
            <p className="mt-3 px-1 text-[12px] leading-[17px] text-[#9FB7C2]">
              Once removed, that phone approves nothing. A wallet made on the web goes back to your passkey. A wallet made in the app needs a phone linked again to pay from the web.
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
                {devices.length === 0 ? "Link your phone" : devices.some((d) => d.platform === "android") ? "Link another phone" : "Link an Android phone"}
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
  const [actionError, setActionError] = useState<unknown>(null);

  const remove = async (id: string) => {
    setBusy(true);
    setActionError(null);
    try {
      await revokeLinkedDevice(id);
      setConfirming(null);
      await reload();
    } catch (e) {
      setActionError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PhoneScreenView
      devices={devices}
      error={actionError ?? error}
      confirming={confirming}
      busy={busy}
      linkHref={linkHref}
      onBack={onBack}
      onAsk={setConfirming}
      onKeep={() => setConfirming(null)}
      onRemove={(id) => void remove(id)}
    />
  );
}
