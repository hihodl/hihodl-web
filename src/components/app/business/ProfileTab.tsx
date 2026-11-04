"use client";

/**
 * Business › Profile: the public name, logo and website sponsors see in place
 * of a person, and the private legal and billing details invoices print.
 *
 * PUT /business replaces the whole profile: billing fields left out are
 * cleared, so the form always sends every one. The invoice tax note is the
 * exception (left out keeps it), and is sent every time too, so what is on
 * screen is what is stored.
 */

import { useEffect, useRef, useState } from "react";

import { saveBusiness, uploadLogo, useBusinessRefresh, type Billing, type BusinessProfile } from "@/lib/app/business";
import { useT } from "@/lib/app/i18n/react";

import { Notice } from "../hold";
import { Ion } from "../ion";
import { btnGlassPill, btnWhite, Card, Field, inputCls, SectionLabel, Tag } from "../spaces/kit";
import { businessErrorText } from "./parts";

const EMPTY_BILLING: Billing = { addressLine1: null, addressLine2: null, city: null, postcode: null, country: null, taxId: null, email: null };
const LOGO_MAX = 3 * 1024 * 1024;

type Form = {
  displayName: string;
  legalName: string;
  website: string;
  taxNote: string;
} & Record<keyof Billing, string>;

function formOf(p: BusinessProfile | null): Form {
  const b = p?.billing ?? EMPTY_BILLING;
  return {
    displayName: p?.displayName ?? "",
    legalName: p?.legalName ?? "",
    website: p?.website ?? "",
    taxNote: p?.invoicing?.taxNote ?? "",
    addressLine1: b.addressLine1 ?? "",
    addressLine2: b.addressLine2 ?? "",
    city: b.city ?? "",
    postcode: b.postcode ?? "",
    country: b.country ?? "",
    taxId: b.taxId ?? "",
    email: b.email ?? "",
  };
}

const orNull = (s: string) => (s.trim() ? s.trim() : null);

export function ProfileTab({ profile }: { profile: BusinessProfile | null }) {
  const t = useT();
  const refresh = useBusinessRefresh();
  const [form, setForm] = useState<Form>(() => formOf(profile));
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<{ tone: "good" | "caution"; text: string } | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  // A save elsewhere (the app) shows up when the profile is read again.
  const stamp = profile?.updatedAt ?? null;
  useEffect(() => setForm(formOf(profile)), [stamp]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    if (!form.displayName.trim()) {
      setNote({ tone: "caution", text: t("business.error.displayNameRequired") });
      return;
    }
    setSaving(true);
    setNote(null);
    try {
      await saveBusiness({
        displayName: form.displayName.trim(),
        legalName: orNull(form.legalName),
        website: orNull(form.website),
        billing: {
          addressLine1: orNull(form.addressLine1),
          addressLine2: orNull(form.addressLine2),
          city: orNull(form.city),
          postcode: orNull(form.postcode),
          country: orNull(form.country.toUpperCase()),
          taxId: orNull(form.taxId),
          email: orNull(form.email),
        },
        invoiceTaxNote: orNull(form.taxNote),
      });
      await refresh("profile");
      setNote({ tone: "good", text: t("business.profile.saved") });
    } catch (e) {
      setNote({ tone: "caution", text: businessErrorText(e) });
    } finally {
      setSaving(false);
    }
  }

  async function pickLogo(f: File | undefined) {
    if (!f) return;
    if (f.type !== "image/png" && f.type !== "image/jpeg") {
      setNote({ tone: "caution", text: t("business.error.imageType") });
      return;
    }
    if (f.size > LOGO_MAX) {
      setNote({ tone: "caution", text: t("business.error.imageTooLarge") });
      return;
    }
    setLogoBusy(true);
    setNote(null);
    try {
      await uploadLogo(f);
      await refresh("profile");
    } catch (e) {
      setNote({ tone: "caution", text: businessErrorText(e) });
    } finally {
      setLogoBusy(false);
      if (file.current) file.current.value = "";
    }
  }

  const verified = profile?.verification.status === "verified";

  return (
    <div className="flex flex-col gap-2.5">
      {!profile ? <Notice tone="calm">{t("business.profile.intro")}</Notice> : null}

      <SectionLabel right={profile ? <Tag label={verified ? t("business.profile.verified") : t("business.profile.unverified")} tone={verified ? "good" : "dim"} /> : null}>
        {t("business.profile.public")}
      </SectionLabel>
      <Card className="gap-4">
        {profile ? (
          <div className="flex items-center gap-3">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-white/10 bg-white/[0.06]">
              {profile.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.logoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <Ion name="business-outline" size={22} className="text-white/55" />
              )}
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <button type="button" className={btnGlassPill} disabled={logoBusy} onClick={() => file.current?.click()}>
                {logoBusy ? t("business.profile.uploading") : profile.logoUrl ? t("business.profile.changeLogo") : t("business.profile.addLogo")}
              </button>
              <span className="text-[12px] text-white/55">{t("business.profile.logoHint")}</span>
            </div>
            <input ref={file} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => void pickLogo(e.target.files?.[0])} />
          </div>
        ) : null}
        <Field label={t("business.profile.displayName")} htmlFor="b-display" hint={t("business.profile.displayNameHint")}>
          <input id="b-display" className={inputCls} maxLength={80} value={form.displayName} onChange={set("displayName")} />
        </Field>
        <Field label={t("business.profile.website")} htmlFor="b-web" hint={t("business.profile.websiteHint")}>
          <input id="b-web" className={inputCls} inputMode="url" placeholder="https://" maxLength={200} value={form.website} onChange={set("website")} />
        </Field>
        {profile && !verified ? <p className="text-[12.5px] leading-[18px] text-white/55">{t("business.profile.verifyHint")}</p> : null}
      </Card>

      <SectionLabel>{t("business.profile.private")}</SectionLabel>
      <Card className="gap-4">
        <p className="text-[12.5px] leading-[18px] text-white/55">{t("business.profile.privateHint")}</p>
        <Field label={t("business.profile.legalName")} htmlFor="b-legal">
          <input id="b-legal" className={inputCls} maxLength={160} value={form.legalName} onChange={set("legalName")} />
        </Field>
        <Field label={t("business.profile.address1")} htmlFor="b-a1">
          <input id="b-a1" className={inputCls} maxLength={160} value={form.addressLine1} onChange={set("addressLine1")} />
        </Field>
        <Field label={t("business.profile.address2")} htmlFor="b-a2">
          <input id="b-a2" className={inputCls} maxLength={160} value={form.addressLine2} onChange={set("addressLine2")} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label={t("business.profile.city")} htmlFor="b-city">
            <input id="b-city" className={inputCls} maxLength={80} value={form.city} onChange={set("city")} />
          </Field>
          <Field label={t("business.profile.postcode")} htmlFor="b-post">
            <input id="b-post" className={inputCls} maxLength={20} value={form.postcode} onChange={set("postcode")} />
          </Field>
          <Field label={t("business.profile.country")} htmlFor="b-country" hint={t("business.profile.countryHint")}>
            <input id="b-country" className={`${inputCls} uppercase`} maxLength={2} value={form.country} onChange={set("country")} />
          </Field>
        </div>
        <Field label={t("business.profile.taxId")} htmlFor="b-tax">
          <input id="b-tax" className={inputCls} maxLength={40} value={form.taxId} onChange={set("taxId")} />
        </Field>
        <Field label={t("business.profile.billingEmail")} htmlFor="b-email" hint={t("business.profile.billingEmailHint")}>
          <input id="b-email" className={inputCls} type="email" maxLength={254} value={form.email} onChange={set("email")} />
        </Field>
        <Field label={t("business.profile.taxNote")} htmlFor="b-note" hint={t("business.profile.taxNoteHint")}>
          <textarea id="b-note" className={`${inputCls} min-h-[88px]`} maxLength={500} value={form.taxNote} onChange={set("taxNote")} />
        </Field>
        {profile?.invoicing?.prefix ? (
          <p className="text-[12.5px] text-white/55">{t("business.profile.prefix", { prefix: profile.invoicing.prefix })}</p>
        ) : null}
      </Card>

      {note ? (
        <Notice tone={note.tone} icon={note.tone === "good" ? "checkmark-circle-outline" : "alert-circle-outline"}>
          {note.text}
        </Notice>
      ) : null}
      <button type="button" className={`${btnWhite} self-start`} disabled={saving} onClick={() => void save()}>
        {saving ? t("business.saving") : profile ? t("business.profile.save") : t("business.profile.create")}
      </button>
    </div>
  );
}
