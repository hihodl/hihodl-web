"use client";

/**
 * Your phone: the phones linked to this account, which approve every
 * withdrawal (documentation/link-your-phone-and-approved-withdrawals.md).
 *
 *   rows     how many, on Settings › Security (where the app keeps "Link
 *            with the web")
 *   screen   each phone, when it was linked, Remove     → Account ?view=phone
 *
 * With none, "Link your phone" goes to onboarding's link step (a full load:
 * /welcome carries the wallet pages' strict CSP, and on Android the wallet's
 * secret is sealed there).
 */

import { useCallback, useEffect, useState } from "react";

import { activeLinkedDevices, revokeLinkedDevice, type LinkedDevice } from "@/lib/link/api";
import { explain } from "@/lib/wallet/explain";

import { BackHeader, Column, ctaCommit, HoldCard, Notice, SectionTitle } from "../hold";
import { Ion } from "../ion";
import { Skeleton } from "../ui";

const PLATFORM: Record<LinkedDevice["platform"], string> = { android: "Android phone", ios: "iPhone", other: "Phone" };
const HOW: Record<LinkedDevice["platform"], string> = {
  android: "Approves withdrawals in the HOLD app",
  ios: "Approves withdrawals with your passkey",
  other: "Approves withdrawals",
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
            Your phone approves every withdrawal from your wallet. An Android phone approves in the HOLD app; an iPhone approves on the web with your passkey.
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
              Once removed, that phone approves nothing. With no phone linked, you link one again before your next withdrawal.
            </p>
          ) : null}
          {error ? (
            <div className="mt-4">
              <Notice>{explain(error)}</Notice>
            </div>
          ) : null}
          {devices && devices.length === 0 ? (
            <div className="mt-6">
              {/* A full load: the link step lives on /welcome, under the wallet pages' strict CSP. */}
              <a href={linkHref} className={ctaCommit}>
                <Ion name="qr-code-outline" size={16} />
                Link your phone
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
