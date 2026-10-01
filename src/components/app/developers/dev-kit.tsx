"use client";

/**
 * Small parts shared by Settings › Developers and a pay link's "Button for
 * your site": the app's choice pills and a code block with a copy button.
 *
 *   Pills      unselected graphite #272B2E with white ink, selected white
 *              with dark ink; 34 high with a radius of half that. Selecting
 *              changes a colour, never a border width.
 *   CodeBlock  monospace on near-black, scrolls sideways inside itself so the
 *              page never does.
 */

import { useState } from "react";

export function Pills<T extends string>({ value, options, onChange, label }: { value: T; options: readonly { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`inline-flex h-[34px] items-center rounded-[17px] px-4 text-[13.5px] font-bold transition-colors ${on ? "bg-white text-[#0A1420]" : "bg-[#272B2E] text-white hover:bg-[#30353A]"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function CodeBlock({ code, copyLabel, copiedLabel }: { code: string; copyLabel: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const p = navigator.clipboard?.writeText(code);
    if (!p) return;
    void p.then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      },
      () => setCopied(false),
    );
  };
  return (
    <div className="relative min-w-0 overflow-hidden rounded-[14px] border border-white/[0.08] bg-black/[0.35]">
      <pre className="max-w-full overflow-x-auto px-3.5 py-3 pr-20 text-[12px] leading-[18px] text-[#D7E6EE]">
        <code className="font-mono">{code}</code>
      </pre>
      <button
        type="button"
        onClick={copy}
        className="absolute right-2 top-2 inline-flex h-8 items-center rounded-[16px] border border-white/[0.26] bg-white/[0.14] px-3 text-[12.5px] font-bold text-white hover:bg-white/[0.2]"
      >
        {copied ? copiedLabel : copyLabel}
      </button>
    </div>
  );
}

/** A glass plate for a secret shown once: the value, and a copy button. */
export function SecretOnce({ title, body, secret, copyLabel, copiedLabel, doneLabel, onDone }: { title: string; body: string; secret: string; copyLabel: string; copiedLabel: string; doneLabel: string; onDone: () => void }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-[18px] border border-[#2FBE8A]/30 bg-[rgba(14,155,104,0.10)] p-3.5">
      <p className="text-[14px] font-bold text-white">{title}</p>
      <p className="text-[12.5px] leading-[17px] text-[#CFE3EC]">{body}</p>
      <CodeBlock code={secret} copyLabel={copyLabel} copiedLabel={copiedLabel} />
      <button type="button" onClick={onDone} className="self-start text-[13px] font-bold text-white/70 underline-offset-4 hover:text-white hover:underline">
        {doneLabel}
      </button>
    </div>
  );
}
