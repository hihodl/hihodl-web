"use client";

/**
 * The partner's profile (name, Instagram, website), and the terms HOLD set on
 * approval, read only: the share of HOLD's margin and how long a traveller
 * counts for the partner. The link name is edited on its own card (Overview).
 */

import { useState, type FormEvent } from "react";

import { PARTNER_TERMS_URL, partnerErrorText, updatePartner, type Partner, type PartnerMe } from "@/lib/app/partners";

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
      setSaved(true);
    } catch (err) {
      setError(partnerErrorText(err));
    } finally {
      setBusy(false);
    }
  }

  const share = partner.shareBps / 100;

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
        </dl>
        <p className="mt-3 text-[12.5px] leading-[18px] text-white/55">
          On every stay, flight and eSIM they book in that time, from the day they sign up or join one of your trips. Your
          travellers always pay HOLD&rsquo;s own prices.{" "}
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
    </div>
  );
}
