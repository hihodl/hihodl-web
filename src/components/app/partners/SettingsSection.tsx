"use client";

/**
 * Settings: the terms HOLD set (read only), the partner's profile (the
 * owner edits it), the signed in person's billing details, and leaving the
 * team.
 *
 * Billing details are who a payout goes to: a company with its tax ID, or a
 * person. HOLD checks them once before the first payout, and again after any
 * change. They go on every statement PDF.
 */

import { useEffect, useState, type FormEvent } from "react";
import { useSWRConfig } from "swr";

import { COUNTRY_CODES } from "@/lib/ad-space/billing-rules";
import { leaveTeam, partnerErrorText, saveBilling, useBilling, type Billing, type Me, type Partner, type PartnerMe } from "@/lib/app/partners";

import { ctaCommit } from "../hold";
import { ReadFailed } from "../money/kit";
import { Alert, Skeleton } from "../ui";
import { DeskPanel, smallBtn } from "./desk";
import { ChoicePills, Field, inputCls, Pill } from "./kit";
import { SettingsTab } from "./SettingsTab";

export function SettingsSection({ partner, me, onSaved, onLeft }: { partner: Partner; me: Me; onSaved: (me: PartnerMe) => void; onLeft: () => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-4">
        <SettingsTab partner={partner} onSaved={onSaved} canEdit={me.role === "owner"} />
        {me.role !== "owner" ? <LeavePanel partnerName={partner.name} onLeft={onLeft} /> : null}
      </div>
      <BillingPanel />
    </div>
  );
}

function BillingPanel() {
  const billing = useBilling(true);
  const { mutate } = useSWRConfig();
  if (billing.error && billing.data === undefined) {
    return (
      <DeskPanel title="Billing details">
        <ReadFailed compact title="Could not load your billing details" onRetry={() => void billing.mutate()} />
      </DeskPanel>
    );
  }
  if (billing.data === undefined) return <Skeleton className="h-[420px]" />;
  return (
    <BillingForm
      current={billing.data}
      onSaved={(b) => {
        void billing.mutate(b, { revalidate: false });
        // The Overview and Payouts notices read billing from the dashboard: read it again.
        void mutate((key) => Array.isArray(key) && key[0] === "partners" && key[2] === "dashboard");
      }}
    />
  );
}

type Draft = Omit<Billing, "verified" | "verifiedAt" | "updatedAt">;

const EMPTY: Draft = { entity: "company", legalName: "", taxId: "", vatId: "", address: "", country: "", email: "", payoutCurrency: "USD" };

function BillingForm({ current, onSaved }: { current: Billing | null; onSaved: (b: Billing) => void }) {
  const [d, setD] = useState<Draft>(current ? { ...current, taxId: current.taxId ?? "", vatId: current.vatId ?? "", payoutCurrency: current.payoutCurrency ?? "USD" } : EMPTY);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setSaved(false), [d]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const company = d.entity === "company";
  // Nothing changed, nothing to send. A change to who you are sends the details
  // back to HOLD for a check; a change of currency alone does not.
  const detailsChanged =
    !current ||
    (["entity", "legalName", "taxId", "vatId", "address", "country", "email"] as const).some(
      (k) => String(d[k] ?? "").trim() !== String(current[k] ?? "").trim(),
    );
  const changed = detailsChanged || d.payoutCurrency !== (current?.payoutCurrency ?? "USD");
  const ready =
    changed && !busy && d.legalName.trim().length >= 2 && d.address.trim().length >= 5 && /^[A-Z]{2}$/.test(d.country) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim()) && (!company || !!d.taxId?.trim());

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const { billing } = await saveBilling({
        entity: d.entity,
        legalName: d.legalName.trim(),
        taxId: d.taxId?.trim() || null,
        vatId: d.vatId?.trim() || null,
        address: d.address.trim(),
        country: d.country,
        email: d.email.trim(),
        payoutCurrency: d.payoutCurrency,
      });
      onSaved(billing);
      setSaved(true);
    } catch (err) {
      setError(partnerErrorText(err));
    } finally {
      setBusy(false);
    }
  }

  const state = !current ? <Pill tone="quiet">Not added</Pill> : current.verified ? <Pill tone="green">Checked by HOLD</Pill> : <Pill tone="blue">In review</Pill>;

  return (
    <DeskPanel title="Billing details" meta="Who your payouts go to, and in what. Shown on every invoice." actions={state}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <ChoicePills
          label="Paid as"
          value={d.entity}
          onChange={(v) => set("entity", v)}
          options={[
            { value: "company", label: "A company" },
            { value: "individual", label: "A person" },
          ]}
        />
        <Field label={company ? "Company legal name" : "Full legal name"}>
          <input className={inputCls} value={d.legalName} onChange={(e) => set("legalName", e.target.value)} maxLength={160} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={company ? "Tax ID" : "Tax ID (optional)"}>
            <input className={inputCls} value={d.taxId ?? ""} onChange={(e) => set("taxId", e.target.value)} maxLength={40} />
          </Field>
          <Field label="VAT number (optional)">
            <input className={inputCls} value={d.vatId ?? ""} onChange={(e) => set("vatId", e.target.value)} maxLength={40} />
          </Field>
        </div>
        <Field label="Address">
          <input className={inputCls} value={d.address} onChange={(e) => set("address", e.target.value)} maxLength={300} placeholder="Street, number, postcode, city" />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Country">
            <select className={`${inputCls} [color-scheme:dark]`} value={d.country} onChange={(e) => set("country", e.target.value)}>
              <option value="">Pick a country</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Billing email">
            <input className={inputCls} type="email" value={d.email} onChange={(e) => set("email", e.target.value)} maxLength={200} />
          </Field>
        </div>
        <ChoicePills
          label="Paid in"
          value={d.payoutCurrency}
          onChange={(v) => set("payoutCurrency", v)}
          options={[
            { value: "USD", label: "US dollars" },
            { value: "EUR", label: "Euros" },
          ]}
        />
        <p className="-mt-2 text-[12.5px] leading-[18px] text-white/55">
          Commissions are counted in dollars. In euros, each payout is converted at the rate of the day it is sent.
        </p>
        {current && current.verified ? (
          <p className="text-[12.5px] leading-[18px] text-white/55">Changing your details sends them back to HOLD for a check, and payouts wait until it is done. Changing the currency does not.</p>
        ) : (
          <p className="text-[12.5px] leading-[18px] text-white/55">HOLD checks these once before your first payout, usually within two working days.</p>
        )}
        {error ? <Alert>{error}</Alert> : null}
        <button type="submit" className={ctaCommit} disabled={!ready}>
          {busy ? "Saving" : saved ? "Saved" : current ? "Save changes" : "Save billing details"}
        </button>
      </form>
    </DeskPanel>
  );
}

const COUNTRIES = (() => {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    names = null;
  }
  return [...new Set(COUNTRY_CODES.map((c) => c.toUpperCase()))]
    .filter((c) => /^[A-Z]{2}$/.test(c))
    .map((code) => ({ code, name: names?.of(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name));
})();

function LeavePanel({ partnerName, onLeft }: { partnerName: string; onLeft: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <DeskPanel title="Leave the team">
      <p className="text-[13px] leading-[19px] text-white/60">
        You stop seeing {partnerName}&rsquo;s desk. What you already earned stays yours and is still paid to you. Travellers you brought keep counting for
        the team.
      </p>
      {error ? (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      ) : null}
      <button
        type="button"
        className={`${smallBtn} mt-3`}
        disabled={busy}
        onClick={async () => {
          if (!window.confirm(`Leave ${partnerName}?`)) return;
          setBusy(true);
          setError(null);
          try {
            await leaveTeam();
            onLeft();
          } catch (e) {
            setError(partnerErrorText(e));
            setBusy(false);
          }
        }}
      >
        {busy ? "Leaving" : "Leave the team"}
      </button>
    </DeskPanel>
  );
}
