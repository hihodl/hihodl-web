"use client";

/**
 * Your phone: the phones linked to this account, which approve every
 * withdrawal (documentation/link-your-phone-and-approved-withdrawals.md).
 *
 *   card     how many, and which kind          (Account home)
 *   screen   each phone, when it was linked, Remove     → ?view=phone
 *
 * With none, "Link your phone" goes to onboarding's link step (a full load:
 * /welcome carries the wallet pages' strict CSP, and on Android the wallet's
 * secret is sealed there).
 */

import { useCallback, useEffect, useState } from "react";

import { activeLinkedDevices, revokeLinkedDevice, type LinkedDevice } from "@/lib/link/api";
import { explain } from "@/lib/wallet/explain";

import { btnPrimary, btnSmallGhost, Note, ScreenHeader, Warn } from "../front/kit";
import { glass, Skeleton } from "../ui";
import { Chip } from "./XScreen";

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

export function PhoneCardView({ devices, failed, onOpen }: { devices: LinkedDevice[] | undefined; failed: boolean; onOpen: () => void }) {
  const n = devices?.length ?? 0;
  const first = devices?.[0] ?? null;
  const chip = failed ? { tone: "neutral" as const, text: "Unavailable" } : devices === undefined ? null : n > 0 ? { tone: "done" as const, text: "Linked" } : { tone: "todo" as const, text: "Not linked" };
  return (
    <button type="button" onClick={onOpen} className={`${glass} flex min-h-[180px] w-full min-w-0 flex-col justify-between gap-4 p-5 text-left transition-colors hover:bg-white/[0.06] sm:p-6`}>
      <span className="flex items-center justify-between gap-2">
        <span className="text-small font-medium text-text">Your phone</span>
        {chip ? <Chip tone={chip.tone}>{chip.text}</Chip> : null}
      </span>
      {devices === undefined && !failed ? (
        <Skeleton className="h-10 w-2/3" />
      ) : n > 0 ? (
        <span className="flex flex-col gap-1">
          <span className="text-[20px] font-medium text-text">{n === 1 && first ? PLATFORM[first.platform] : `${n} phones`}</span>
          <span className="text-tiny text-[#9FB7C2]">{n === 1 && first ? `Linked ${when(first.linkedAt)}` : "Each one approves withdrawals"}</span>
        </span>
      ) : (
        <span className="text-small text-[#9FB7C2]">Link your phone. It approves every withdrawal from your wallet.</span>
      )}
    </button>
  );
}

export function PhoneCard({ onOpen }: { onOpen: () => void }) {
  const { devices, error } = useLinkedPhones();
  return <PhoneCardView devices={devices} failed={!!error} onOpen={onOpen} />;
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
  return (
    <section className={`${glass} flex w-full max-w-[600px] flex-col gap-5 p-5 sm:p-6`}>
      <ScreenHeader title="Your phone" onBack={onBack} />
      {devices === undefined && !error ? (
        <Skeleton className="h-32" />
      ) : (
        <>
          <Note>
            Your phone approves every withdrawal from your wallet. An Android phone approves in the HOLD app; an iPhone
            approves on the web with your passkey.
          </Note>
          {devices && devices.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {devices.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-white/10 bg-white/[0.04] p-4">
                  <div className="min-w-0">
                    <p className="text-small font-medium text-text">{PLATFORM[d.platform]}</p>
                    <p className="text-tiny text-[#9FB7C2]">
                      {HOW[d.platform]}
                      {d.linkedAt ? ` · linked ${when(d.linkedAt)}` : ""}
                    </p>
                  </div>
                  {confirming === d.id ? (
                    <div className="flex gap-1.5">
                      <button type="button" className={btnSmallGhost} disabled={busy} onClick={() => onRemove(d.id)}>
                        {busy ? "Removing…" : "Remove"}
                      </button>
                      <button type="button" className={btnSmallGhost} disabled={busy} onClick={onKeep}>
                        Keep
                      </button>
                    </div>
                  ) : (
                    <button type="button" className={btnSmallGhost} onClick={() => onAsk(d.id)}>
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
          {confirming ? (
            <p className="text-tiny text-[#9FB7C2]">
              Once removed, that phone approves nothing. With no phone linked, you link one again before your next withdrawal.
            </p>
          ) : null}
          {error ? <Warn>{explain(error)}</Warn> : null}
          {devices && devices.length === 0 ? (
            <div>
              {/* A full load: the link step lives on /welcome, under the wallet pages' strict CSP. */}
              <a href={linkHref} className={btnPrimary}>
                Link your phone
              </a>
            </div>
          ) : null}
        </>
      )}
    </section>
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
