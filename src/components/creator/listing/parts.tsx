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

import { input } from "@/components/ad-space/ui";

/** A field with its label, its reason for existing, and whatever is wrong with it. */
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
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={htmlFor} className="text-small text-text">
        {label}
      </label>
      {hint ? <p className="text-tiny text-text-muted">{hint}</p> : null}
      {children}
      <Problems list={problems} />
    </div>
  );
}

/** What is wrong, said once per thing that is wrong. */
export function Problems({ list }: { list: readonly string[] }) {
  if (list.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1">
      {list.map((message) => (
        <li key={message} className="text-tiny text-amber">
          {message}
        </li>
      ))}
    </ul>
  );
}

export const inputClass = input;

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
      className={`${inputClass} resize-y`}
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
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-body text-text-faint">$</span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        disabled={disabled}
        className={`${inputClass} pl-8 disabled:cursor-not-allowed disabled:opacity-40`}
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
    <select id={id} className={inputClass} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-night">
          {o.label}
        </option>
      ))}
    </select>
  );
}

/**
 * One of several, each with a sentence saying what it means.
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
            className={`flex cursor-pointer items-start gap-3 rounded-input border px-4 py-3 transition-colors duration-180 ${
              on ? "border-amber bg-amber/10" : "border-[color:var(--color-hairline-strong)] hover:bg-white/5"
            } ${o.disabled ? "cursor-not-allowed opacity-40" : ""}`}
          >
            <input
              type="radio"
              name={name}
              className="mt-1 accent-amber"
              checked={on}
              disabled={o.disabled}
              onChange={() => onChange(o.value)}
            />
            <span className="min-w-0">
              <span className="block text-small text-text">{o.label}</span>
              {o.body ? <span className="mt-1 block text-tiny text-text-muted">{o.body}</span> : null}
              {o.disabled && o.why ? <span className="mt-1 block text-tiny text-amber">{o.why}</span> : null}
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
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" className="mt-1 accent-amber" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="min-w-0">
        <span className="block text-small text-text">{label}</span>
        {body ? <span className="mt-1 block text-tiny text-text-muted">{body}</span> : null}
      </span>
    </label>
  );
}

/** Several of a set, as pills that can be on or off. */
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
            className={`inline-flex h-10 items-center whitespace-nowrap rounded-[20px] border px-4 text-small transition-colors duration-180 ${
              on ? "border-amber bg-amber text-text-on-amber" : "border-[color:var(--color-hairline-strong)] text-text-muted hover:bg-white/5"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** A block inside a step: its own heading and the reason it is being asked. */
export function Block({ title, why, children }: { title: string; why?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-[color:var(--color-hairline)] pt-8 first:border-0 first:pt-0">
      <div className="flex flex-col gap-2">
        <h3 className="text-body text-text">{title}</h3>
        {why ? <p className="text-small text-text-muted">{why}</p> : null}
      </div>
      {children}
    </section>
  );
}
