"use client";

/**
 * The partner's profile (name, Instagram, website), and the terms HOLD set on
 * approval, read only: the share of HOLD's margin and how long a traveller
 * counts for the partner. The link name is edited on its own card (Overview).
 * The owner also sets how much of the share is given back to travellers.
 */

import { useState, type FormEvent } from "react";

import { bpsOfPct, PARTNER_TERMS_URL, partnerErrorText, pct, pctInput, updatePartner, type Partner, type PartnerMe } from "@/lib/app/partners";

import { ctaCommit, HoldCard } from "../hold";
import { Alert } from "../ui";
import { Field, inputCls } from "./kit";

const KIND_LABEL: Record<Partner["kind"], string> = {
  agency: "Travel agency",
  creator: "Creator",
  events: "Events",
  other: "Other",
};

export function SettingsTab({ partner, onSaved, canEdit = true }: { partner: Partner; onSaved: (me: PartnerMe) => void; canEdit?: boolean }) {
  const [name, setName] = useState(partner.name);
  const [instagram, setInstagram] = useState(partner.instagram ?? "");
  const [website, setWebsite] = useState(partner.website ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changed =
    name.trim() !== partner.name || instagram.trim() !== (partner.instagram ?? "") || website.trim() !== (partner.website ?? "");
  const ready = changed && name.trim().length >= 2 && !busy;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const me = await updatePartner({
        name: name.trim(),
        instagram: instagram.trim().replace(/^@/, ""),
        website: website.trim(),
      });
      onSaved(me);
      // Show what the server kept ("@foo" → "foo", "site.com" → "https://site.com/"), so the form reads as saved.
      if (me.partner) {
        setName(me.partner.name);
        setInstagram(me.partner.instagram ?? "");
        setWebsite(me.partner.website ?? "");
      }
      setSaved(true);
    } catch (err) {
      setError(partnerErrorText(err));
    } finally {
      setBusy(false);
    }
  }

  const share = partner.shareBps / 100;
  const giveBack = partner.giveBackBps ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <HoldCard className="p-5">
        <h2 className="text-[16px] font-bold text-white">Your terms</h2>
        <dl className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <dt className="text-[12.5px] text-white/55">Your share of HOLD&rsquo;s margin</dt>
            <dd className="mt-1 text-[22px] font-extrabold tabular-nums text-white">{Number.isInteger(share) ? share : share.toFixed(2)}%</dd>
          </div>
          <div>
            <dt className="text-[12.5px] text-white/55">A traveller counts for you</dt>
            <dd className="mt-1 text-[22px] font-extrabold tabular-nums text-white">{partner.attributionMonths} months</dd>
          </div>
          {!canEdit && giveBack > 0 ? (
            <div>
              <dt className="text-[12.5px] text-white/55">Given back to travellers</dt>
              <dd className="mt-1 text-[22px] font-extrabold tabular-nums text-white">{pct(giveBack)} of the share</dd>
            </div>
          ) : null}
        </dl>
        <p className="mt-3 text-[12.5px] leading-[18px] text-white/55">
          On every stay, flight and eSIM they book in that time, from the day they sign up or join one of your trips.{" "}
          {giveBack > 0
            ? "Your travellers pay HOLD\u2019s own prices, less what you give back."
            : "Your travellers always pay HOLD\u2019s own prices."}{" "}
          <a href={PARTNER_TERMS_URL} target="_blank" rel="noopener noreferrer" className="font-bold text-[#8ECAE6] hover:text-white">
            Read the full terms
          </a>
        </p>
      </HoldCard>

      {canEdit ? (
      <HoldCard className="p-5">
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <h2 className="text-[16px] font-bold text-white">Profile</h2>
          <Field label="Name travellers know you by">
            <input
              className={inputCls}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
              maxLength={80}
            />
          </Field>
          <Field label="Instagram">
            <input
              className={inputCls}
              value={instagram}
              onChange={(e) => {
                setInstagram(e.target.value);
                setSaved(false);
              }}
              maxLength={60}
              placeholder="@yourname"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </Field>
          <Field label="Website">
            <input
              className={inputCls}
              type="url"
              value={website}
              onChange={(e) => {
                setWebsite(e.target.value);
                setSaved(false);
              }}
              maxLength={200}
              placeholder="https://"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </Field>
          <p className="text-[12.5px] text-white/55">Listed as: {KIND_LABEL[partner.kind] ?? "Other"}</p>
          {error ? <Alert>{error}</Alert> : null}
          <button type="submit" className={ctaCommit} disabled={!ready}>
            {busy ? "Saving" : saved && !changed ? "Saved" : "Save"}
          </button>
        </form>
      </HoldCard>
      ) : null}

      {canEdit ? <GiveBackCard partner={partner} onSaved={onSaved} /> : null}
    </div>
  );
}

/** The owner's give back: part of the partner's share taken off its travellers' price at checkout. */
function GiveBackCard({ partner, onSaved }: { partner: Partner; onSaved: (me: PartnerMe) => void }) {
  const current = partner.giveBackBps ?? 0;
  const [value, setValue] = useState(pctInput(current));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bps = bpsOfPct(value);
  const changed = bps !== current;
  const ready = changed && !busy;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    if (bps == null) {
      setError(partnerErrorText({ code: "give_back_invalid" }));
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const me = await updatePartner({ giveBackBps: bps });
      onSaved(me);
      if (me.partner) setValue(pctInput(me.partner.giveBackBps ?? 0));
      setSaved(true);
    } catch (err) {
      setError(partnerErrorText(err));
    } finally {
      setBusy(false);
    }
  }

  const share = partner.shareBps / 100;
  return (
    <HoldCard className="p-5">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <div>
          <h2 className="text-[16px] font-bold text-white">Give back to travellers</h2>
          <p className="mt-1.5 text-[12.5px] leading-[18px] text-white/55">
            What you give back comes off your travellers&rsquo; price at checkout, and is not paid to you. It is a part of your{" "}
            {Number.isInteger(share) ? share : share.toFixed(2)}% share. A link can have its own (Links).
          </p>
        </div>
        <Field label="Percentage of your share" hint="0% keeps all of it for you. 100% gives all of it to your travellers.">
          <span className="relative block max-w-[180px]">
            <input
              className={`${inputCls} pr-9`}
              type="text"
              inputMode="decimal"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setSaved(false);
                setError(null);
              }}
              placeholder="0"
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[15px] text-white/55">%</span>
          </span>
        </Field>
        {error ? <Alert>{error}</Alert> : null}
        <button type="submit" className={ctaCommit} disabled={!ready}>
          {busy ? "Saving" : saved && !changed ? "Saved" : "Save"}
        </button>
      </form>
    </HoldCard>
  );
}
