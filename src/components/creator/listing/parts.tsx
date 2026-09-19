/**
 * The form pieces the wizard is built from.
 *
 * WHY A PROBLEM IS A PROPERTY OF A FIELD AND NOT A BANNER
 *
 * A listing is refused for reasons that each belong to one box — this price,
 * that countdown, those lines. Collected into a banner at the top they become
 * a list somebody has to match back to the form by hand, and the one that
 * matters is the one they scroll past. So every field takes its own sentences
 * and shows them under itself, and the banner is only ever for the refusals no
 * single field owns.
 *
 * COLOUR
 *
 * Amber is attention and green is done, and there is no red anywhere on this
 * site. Nothing a creator can type into this form is a disaster: a price out
 * of range is a price out of range, and telling them so in the colour of an
 * alarm would be the wrong sentence in the wrong voice.
 */

"use client";

import type { ReactNode } from "react";

import { Ion } from "@/components/app/ion";
import { Body, fieldLabel, inputCls, SectionLabel } from "@/components/app/spaces/kit";

/**
 * The app's Field (ui.tsx): a 12.5 label, the box, and under it either what
 * is wrong (amber) or the hint (dim).
 */
export function Field({
  label,
  hint,
  problems = [],
  htmlFor,
  children,
}: {
  label: string;
  hint?: ReactNode;
  problems?: readonly string[];
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className={fieldLabel}>
        {label}
      </label>
      {children}
      {problems.length ? <Problems list={problems} /> : hint ? <p className="text-[12px] leading-4 text-white/55">{hint}</p> : null}
    </div>
  );
}

/** What is wrong, said once per thing that is wrong. */
export function Problems({ list }: { list: readonly string[] }) {
  if (list.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1">
      {list.map((message) => (
        <li key={message} className="text-[12.5px] font-strong leading-[17px] text-amber">
          {message}
        </li>
      ))}
    </ul>
  );
}

export const inputClass = inputCls;

/** A box for words. */
export function Text({
  id,
  value,
  onChange,
  placeholder,
  maxLength,
  type = "text",
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  type?: "text" | "url" | "email" | "date" | "datetime-local";
}) {
  return (
    <input
      id={id}
      type={type}
      className={inputClass}
      value={value}
      placeholder={placeholder}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Paragraph({
  id,
  value,
  onChange,
  placeholder,
  maxLength,
  rows = 3,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
}) {
  return (
    <textarea
      id={id}
      className={`${inputClass} min-h-[84px] resize-y`}
      rows={rows}
      value={value}
      placeholder={placeholder}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/**
 * An amount, typed as dollars.
 *
 * `inputMode="decimal"` rather than `type="number"`: a number input on a phone
 * lets a stray scroll change a price, and it will not hold "1,300" while
 * somebody is still typing it.
 */
export function Money({
  id,
  value,
  onChange,
  placeholder = "0",
  disabled,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15.5px] text-white/55">$</span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        disabled={disabled}
        className={`${inputClass} !pl-7 disabled:cursor-not-allowed disabled:opacity-40`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function Count({
  id,
  value,
  onChange,
  min = 1,
  max = 40,
  disabled,
}: {
  id?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  return (
    <input
      id={id}
      type="number"
      min={min}
      max={max}
      disabled={disabled}
      className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-40`}
      value={Number.isFinite(value) ? value : ""}
      onChange={(e) => onChange(Math.trunc(Number(e.target.value)))}
    />
  );
}

export function Dropdown<T extends string>({
  id,
  value,
  onChange,
  options,
}: {
  id?: string;
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string }[];
}) {
  return (
    <div className="relative">
      <select id={id} className={`${inputClass} appearance-none pr-10`} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-night">
            {o.label}
          </option>
        ))}
      </select>
      <Ion name="chevron-down" size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-white/55" />
    </div>
  );
}

/**
 * One of several, each with a sentence saying what it means: the app's
 * `Option` (DetailsStep), a radio in a 16-radius card whose stroke turns the
 * select white when chosen.
 *
 * Selection changes a COLOUR and never a border width: on a card whose height
 * can change, growing the border by a pixel moves everything inside it.
 */
export function Choice<T extends string>({
  value,
  onChange,
  options,
  name,
}: {
  value: T;
  onChange: (v: T) => void;
  name: string;
  options: readonly { value: T; label: string; body?: string; disabled?: boolean; why?: string }[];
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <label
            key={o.value}
            className={`flex cursor-pointer items-start gap-3 rounded-[16px] border p-3.5 transition-colors ${
              on ? "border-[#F1F5F9] bg-[rgba(241,245,249,0.08)]" : "border-white/10 bg-white/[0.05] hover:bg-white/[0.08]"
            } ${o.disabled ? "cursor-not-allowed opacity-45" : ""}`}
          >
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={on}
              disabled={o.disabled}
              onChange={() => onChange(o.value)}
            />
            <span
              aria-hidden
              className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-[10px] border-[1.5px] ${on ? "border-[#F1F5F9]" : "border-white/40"}`}
            >
              {on ? <span className="h-2.5 w-2.5 rounded-[5px] bg-[#F1F5F9]" /> : null}
            </span>
            <span className="flex min-w-0 flex-col gap-[3px]">
              <span className="block text-[14.5px] font-strong text-white">{o.label}</span>
              {o.body ? <span className="block text-[13px] leading-[18px] text-white/[0.62]">{o.body}</span> : null}
              {o.disabled && o.why ? <span className="block text-[12.5px] font-strong leading-[17px] text-amber">{o.why}</span> : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** A box that is ticked or is not, with the sentence it is agreeing to. */
export function Tick({
  checked,
  onChange,
  label,
  body,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  body?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-1.5">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className={`mt-px flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] border peer-focus-visible:ring-2 peer-focus-visible:ring-white/40 ${
          checked ? "border-[#F1F5F9] bg-[#F1F5F9] text-[#0A1420]" : "border-white/35"
        }`}
      >
        {checked ? <Ion name="checkmark" size={15} /> : null}
      </span>
      <span className="min-w-0">
        <span className="block text-[14.5px] leading-5 text-white">{label}</span>
        {body ? <span className="mt-0.5 block text-[12px] leading-4 text-white/55">{body}</span> : null}
      </span>
    </label>
  );
}

/** Several of a set, as the app's Chips: selected is the white plate with navy ink. */
export function Toggles<T extends string>({
  values,
  onChange,
  options,
}: {
  values: readonly T[];
  onChange: (v: T[]) => void;
  options: readonly { value: T; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = values.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? values.filter((v) => v !== o.value) : [...values, o.value])}
            className={`inline-flex h-[34px] shrink-0 items-center whitespace-nowrap rounded-[17px] border px-[13px] text-[13.5px] font-strong transition-colors ${
              on ? "border-[#F1F5F9] bg-[#F1F5F9] text-[#0A1420]" : "border-white/[0.14] bg-white/[0.06] text-white/[0.62] hover:bg-white/10"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** A group inside a step, as the app's wizard draws one: a SectionLabel, an optional dim line, the fields. */
export function Block({ title, why, children }: { title: string; why?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3.5">
      <SectionLabel>{title}</SectionLabel>
      {why ? <Body dim>{why}</Body> : null}
      {children}
    </section>
  );
}
