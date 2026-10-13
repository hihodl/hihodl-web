"use client";

/**
 * Not a partner yet: what HOLD Partners pays, and the form to apply.
 *
 * The link name is checked as it is typed (GET /partners/slug-available) and
 * previewed as the link it will be. Applying reserves it: the partner is
 * `pending` until HOLD approves the account.
 */

import { useState, type FormEvent } from "react";

import { applyAsPartner, normaliseSlug, partnerErrorText, type PartnerKind, type PartnerMe } from "@/lib/app/partners";

import { ctaCommit, HoldCard } from "../hold";
import { Ion, type IonName } from "../ion";
import { Alert } from "../ui";
import { ChoicePills, Field, inputCls, SlugLine, slugReady, useSlugCheck } from "./kit";

const KINDS: readonly { value: PartnerKind; label: string }[] = [
  { value: "agency", label: "Travel agency" },
  { value: "creator", label: "Creator" },
  { value: "events", label: "Events" },
  { value: "other", label: "Other" },
];

const PITCH: readonly { icon: IonName; title: string; body: string }[] = [
  {
    icon: "trending-up-outline",
    title: "Earn on every booking",
    body: "A share of HOLD's margin on every stay, flight and eSIM your travellers book. Your travellers pay HOLD's prices, never more.",
  },
  {
    icon: "wallet-outline",
    title: "Paid monthly into your Savings",
    body: "In USDC, straight into your HOLD Savings, where it earns from the day it lands.",
  },
  {
    icon: "qr-code-outline",
    title: "Your own link and QR",
    body: "Put it on your site, your bio and your flyers. Everyone who signs up through it is yours.",
  },
  {
    icon: "chatbubbles-outline",
    title: "Trip group chats",
    body: "Make a chat per trip. Travellers join with one link, and you can collect deposits in the same place.",
  },
];

export function ApplyScreen({ onApplied }: { onApplied: (me: PartnerMe) => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [kind, setKind] = useState<PartnerKind | null>(null);
  const [instagram, setInstagram] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Until the link name is typed, it follows the name.
  const slugRaw = slugTouched ? slug : normaliseSlug(name).slice(0, 20);
  const check = useSlugCheck(slugRaw);
  const ready = name.trim().length >= 2 && kind !== null && slugReady(check, slugRaw) && !busy;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready || !kind) return;
    setBusy(true);
    setError(null);
    try {
      const me = await applyAsPartner({
        name: name.trim(),
        slug: normaliseSlug(slugRaw),
        kind,
        ...(instagram.trim() ? { instagram: instagram.trim().replace(/^@/, "") } : {}),
        ...(website.trim() ? { website: website.trim() } : {}),
      });
      onApplied(me);
    } catch (err) {
      setError(partnerErrorText(err));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,#15202C,#0C1620_55%,#0A121A)] p-5 sm:p-6">
        <p className="text-[12.5px] font-bold uppercase tracking-[0.6px] text-white/55">HOLD Partners</p>
        <h2 className="mt-2 text-[26px] font-extrabold leading-[1.15] tracking-[-0.5px] text-white sm:text-[30px]">
          Bring your travellers. Earn on what they book.
        </h2>
        <p className="mt-2 text-[14px] leading-[21px] text-white/[0.72]">
          For travel agencies, creators and event organisers who run group trips.
        </p>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2">
          {PITCH.map((p) => (
            <li key={p.title} className="flex gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber/[0.14] text-amber">
                <Ion name={p.icon} size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-bold text-white">{p.title}</span>
                <span className="mt-0.5 block text-[13px] leading-[19px] text-white/60">{p.body}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <HoldCard className="p-5 sm:p-6">
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <h2 className="text-[17px] font-bold text-white">Apply</h2>

          <Field label="Name travellers know you by">
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder="Dream Life Getaways"
              autoComplete="organization"
            />
          </Field>

          <Field label="Link name">
            <input
              className={inputCls}
              value={slugRaw}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              maxLength={40}
              placeholder="dreamlife"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <SlugLine raw={slugRaw} check={check} />
          </Field>

          <div>
            <span className="mb-2 block text-[13px] font-strong text-[#9FB7C2]">What you do</span>
            <ChoicePills options={KINDS} value={kind} onChange={setKind} label="What you do" />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Instagram (optional)">
              <input
                className={inputCls}
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                maxLength={60}
                placeholder="@yourname"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </Field>
            <Field label="Website (optional)">
              <input
                className={inputCls}
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                maxLength={200}
                placeholder="https://"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </Field>
          </div>

          {error ? <Alert>{error}</Alert> : null}

          <button type="submit" className={ctaCommit} disabled={!ready}>
            {busy ? "Sending" : "Apply to HOLD Partners"}
          </button>
          <p className="text-center text-[12.5px] leading-[18px] text-white/50">
            We review every application by hand. Your link name is yours from the moment you apply.
          </p>
        </form>
      </HoldCard>
    </div>
  );
}
