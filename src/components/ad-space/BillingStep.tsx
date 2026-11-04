"use client";

import { useMemo, useState, type FormEvent } from "react";

import {
  BILLING_MAX,
  COUNTRY_CODES,
  EMPTY_BILLING,
  type BillingDetails,
  type BillingProblem,
  billingProblem,
} from "@/lib/ad-space/billing-rules";
import { useLocale, useT } from "@/lib/app/i18n/react";

import { ExtraRow, ctaGlass, fieldLabel, sheetInput } from "./pay-sheet";

/**
 * The optional step before paying: who the seller's invoice names. Closed, it
 * is one row (or the details already chosen, with Edit and Remove); open, a
 * short form whose Skip is always there. Nothing here is sent: the checkout
 * sends the chosen details once the order exists (lib/ad-space/billing.ts).
 */
export function BillingStep({
  value,
  open,
  disabled,
  onOpen,
  onChange,
}: {
  value: BillingDetails | null;
  open: boolean;
  disabled: boolean;
  onOpen: (open: boolean) => void;
  onChange: (d: BillingDetails | null) => void;
}) {
  const t = useT();

  if (open) {
    return (
      <BillingForm
        initial={value ?? EMPTY_BILLING}
        onSave={(d) => {
          onChange(d);
          onOpen(false);
        }}
        onSkip={() => onOpen(false)}
      />
    );
  }

  if (!value) {
    return (
      <ExtraRow
        title={t("sponsor.checkout.billing.add")}
        sub={t("sponsor.checkout.billing.addSub")}
        icon={<DocIcon />}
        onClick={disabled ? undefined : () => onOpen(true)}
      />
    );
  }

  const name = value.companyName.trim() || value.email.trim() || value.taxId.trim();
  const detail = [value.taxId.trim(), value.country.trim().toUpperCase()].filter(Boolean).join(" · ");
  return (
    <div className="flex items-center justify-between gap-3 rounded-[16px] px-4 py-3 ring-1 ring-inset ring-sp-ink/[0.08]">
      <span className="min-w-0">
        <span className="block truncate text-small font-medium text-sp-ink">{t("sponsor.checkout.billing.invoiceTo", { name })}</span>
        {detail && <span className="block truncate text-tiny text-white/85">{detail}</span>}
      </span>
      <span className="flex shrink-0 gap-2">
        <button type="button" className="text-tiny font-medium text-sp-amber hover:text-amber-glow disabled:opacity-40" disabled={disabled} onClick={() => onOpen(true)}>
          {t("common.edit")}
        </button>
        <button type="button" className="text-tiny font-medium text-white/85 hover:text-sp-ink disabled:opacity-40" disabled={disabled} onClick={() => onChange(null)}>
          {t("common.remove")}
        </button>
      </span>
    </div>
  );
}

function BillingForm({
  initial,
  onSave,
  onSkip,
}: {
  initial: BillingDetails;
  onSave: (d: BillingDetails) => void;
  onSkip: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const [d, setD] = useState<BillingDetails>(initial);
  const [problem, setProblem] = useState<BillingProblem | null>(null);
  const countries = useCountries(locale);
  const set = (k: keyof BillingDetails) => (v: string) => {
    setProblem(null);
    setD((cur) => ({ ...cur, [k]: v }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const p = billingProblem(d);
    if (p) return setProblem(p);
    onSave(d);
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3 rounded-[16px] p-4 ring-1 ring-inset ring-sp-ink/[0.08]">
      <div className="flex items-baseline justify-between gap-3">
        <p className={fieldLabel}>{t("sponsor.checkout.billing.title")}</p>
        <span className="text-tiny text-white/85">{t("common.optional")}</span>
      </div>
      <Field label={t("sponsor.checkout.billing.company")} value={d.companyName} max={BILLING_MAX.companyName} autoComplete="organization" onChange={set("companyName")} />
      <Field label={t("sponsor.checkout.billing.address")} value={d.addressLine1} max={BILLING_MAX.addressLine1} autoComplete="address-line1" onChange={set("addressLine1")} />
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("sponsor.checkout.billing.city")} value={d.city} max={BILLING_MAX.city} autoComplete="address-level2" onChange={set("city")} />
        <Field label={t("sponsor.checkout.billing.postcode")} value={d.postcode} max={BILLING_MAX.postcode} autoComplete="postal-code" onChange={set("postcode")} />
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-tiny text-white/85">{t("sponsor.checkout.billing.country")}</span>
        <select
          className={sheetInput}
          value={d.country.toUpperCase()}
          autoComplete="country"
          onChange={(e) => set("country")(e.target.value)}
        >
          <option value="">{t("sponsor.checkout.billing.countryPick")}</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <Field label={t("sponsor.checkout.billing.taxId")} value={d.taxId} max={BILLING_MAX.taxId} onChange={set("taxId")} />
      <Field
        label={t("sponsor.checkout.billing.email")}
        hint={t("sponsor.checkout.billing.emailHint")}
        value={d.email}
        max={BILLING_MAX.email}
        type="email"
        autoComplete="email"
        onChange={set("email")}
      />
      {problem && (
        <p className="rounded-[12px] bg-amber/[0.09] px-3 py-2 text-small text-[#FFE3A3]" role="status">
          {t(`sponsor.checkout.billing.problem.${problem}`)}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button type="submit" className={ctaGlass}>
          {t("sponsor.checkout.billing.use")}
        </button>
        <button type="button" className="text-small font-medium text-white/85 hover:text-sp-ink" onClick={onSkip}>
          {t("sponsor.checkout.billing.skip")}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  value,
  max,
  type = "text",
  autoComplete,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  max: number;
  type?: string;
  autoComplete?: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-tiny text-white/85">{label}</span>
      <input
        className={sheetInput}
        type={type}
        value={value}
        maxLength={max}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <span className="text-tiny text-white/85">{hint}</span>}
    </label>
  );
}

/** Every country, named in the reader's language and sorted by that name. */
function useCountries(locale: string): { code: string; name: string }[] {
  return useMemo(() => {
    let dn: Intl.DisplayNames | null = null;
    try {
      dn = new Intl.DisplayNames([locale, "en"], { type: "region" });
    } catch {
      dn = null;
    }
    const named = COUNTRY_CODES.map((code) => {
      let name = code;
      try {
        name = dn?.of(code) ?? code;
      } catch {
        name = code;
      }
      return { code, name };
    });
    let collator: Intl.Collator | null = null;
    try {
      collator = new Intl.Collator([locale, "en"]);
    } catch {
      collator = null;
    }
    return named.sort((a, b) => (collator ? collator.compare(a.name, b.name) : a.name < b.name ? -1 : 1));
  }, [locale]);
}

function DocIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4 1.75h5.5L12.25 4.5v9.75H4V1.75z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M6 7.5h4M6 10h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
