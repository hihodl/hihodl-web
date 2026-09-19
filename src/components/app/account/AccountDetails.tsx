"use client";

/**
 * Account › Account: the app's AccountSheet (profile/_components), as a
 * screen. The sign-in method and the login email, which copies on a tap.
 *
 * The app's Phone number and Password rows are not here: the web has no
 * phone capture, and a password is changed where the app changes it.
 */

import { useState } from "react";

import { currentMethod } from "@/lib/auth/remember";
import { useMe } from "@/lib/app/spaces-data";

import { BackHeader, Column } from "../hold";
import { Ion, type IonName } from "../ion";
import { useShell } from "../Shell";

const PROVIDER: Record<"apple" | "google" | "email", { icon: IonName; label: string }> = {
  google: { icon: "logo-google", label: "Google" },
  apple: { icon: "logo-apple", label: "Apple" },
  email: { icon: "mail-outline", label: "Email" },
};

const rowCls = "flex w-full items-center gap-3.5 rounded-[16px] border border-white/[0.08] bg-white/[0.06] p-4 text-left";

function IconWrap({ name }: { name: IonName }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[rgba(143,211,227,0.10)] text-[#8FD3E3]">
      <Ion name={name} size={20} />
    </span>
  );
}

export function AccountDetails({ onBack }: { onBack: () => void }) {
  const { session } = useShell();
  const me = useMe();
  const [copied, setCopied] = useState(false);
  const email = me.data?.email ?? session.user.email ?? null;
  const provider = PROVIDER[currentMethod(session.user.app_metadata?.provider)];

  const copy = () => {
    if (!email) return;
    // No clipboard outside a secure context: the email is on screen either way.
    const done = navigator.clipboard?.writeText(email);
    if (!done) return;
    void done.then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      },
      () => setCopied(false),
    );
  };

  return (
    <Column>
      <BackHeader title="Account" onBack={onBack} />
      <p className="mb-4 px-0.5 text-[14px] leading-5 text-white/65">Your sign-in details. Tap your email to copy it.</p>
      <div className="flex flex-col gap-3">
        <div className={rowCls}>
          <IconWrap name={provider.icon} />
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-strong text-white">Sign-in method</span>
            <span className="mt-[3px] block truncate text-[14px] text-white/65">{provider.label}</span>
          </span>
        </div>
        <button type="button" onClick={copy} aria-label="Login email. Tap to copy" className={`${rowCls} transition-colors hover:bg-white/10`}>
          <IconWrap name="mail-outline" />
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-strong text-white">Login email</span>
            <span className="mt-[3px] block truncate text-[14px] text-white/65">{email ?? "Not set"}</span>
          </span>
          <Ion name={copied ? "checkmark-circle" : "copy-outline"} size={18} className={copied ? "text-[#22C55E]" : "text-white/45"} />
        </button>
      </div>
    </Column>
  );
}
