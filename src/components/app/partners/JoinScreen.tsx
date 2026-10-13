"use client";

/**
 * app.hihodl.xyz/partners/join/<code>: an invite to a partner's team.
 *
 * By the time this draws, the shell's Gate has signed the person in with
 * their own HOLD account (Apple, Google or email) and checked they have a
 * wallet made in the app, which is where they are paid. Here they see who
 * invited them and as what, pick the name of their own link, and join.
 */

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";

import { acceptInvite, describeInvite, normaliseSlug, partnerErrorText, pct, usePartnerMe } from "@/lib/app/partners";
import { productHref } from "@/lib/app/paths";

import { BackHeader, Column, ctaCommit, HoldCard, Notice } from "../hold";
import { Ion } from "../ion";
import { ReadFailed } from "../money/kit";
import { Alert, Skeleton } from "../ui";
import { Field, inputCls, SlugLine, slugReady, useSlugCheck } from "./kit";

export function JoinScreen({ code }: { code: string }) {
  const info = useSWR(["partners", "invite", code], () => describeInvite(code), { revalidateOnFocus: false });
  const me = usePartnerMe();
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState<string | null>(null);
  const check = useSlugCheck(raw);
  const custom = normaliseSlug(raw).length > 0;
  const ready = !busy && (!custom || slugReady(check, raw));
  const desk = productHref("/partners");

  const header = <BackHeader title="Partners" subtitle="Team invite" />;

  if (info.error && !info.data) {
    const missing = (info.error as { status?: number })?.status === 404;
    return (
      <Column>
        {header}
        <HoldCard>
          {missing ? (
            <div className="px-6 py-10 text-center">
              <p className="text-[16px] font-bold text-white">This invite does not exist</p>
              <p className="mt-2 text-[13.5px] text-white/60">Ask whoever sent it for a new link.</p>
            </div>
          ) : (
            <ReadFailed title="Could not open this invite" onRetry={() => void info.mutate()} />
          )}
        </HoldCard>
      </Column>
    );
  }
  if (!info.data || !me.data) {
    return (
      <Column>
        {header}
        <Skeleton className="h-[320px]" />
      </Column>
    );
  }

  const i = info.data;
  const already = me.data.partner;

  if (joined) {
    return (
      <Column>
        {header}
        <HoldCard className="p-6 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(74,222,128,0.16)] text-[#4ADE80]">
            <Ion name="checkmark-circle-outline" size={28} />
          </span>
          <h2 className="mt-4 text-[22px] font-extrabold text-white">You are on {i.partner.name}</h2>
          <p className="mx-auto mt-2 max-w-[380px] text-[14px] leading-[21px] text-white/70">Your own link is ready. Everyone who signs up through it counts for you.</p>
          <p className="mt-3 break-all font-mono text-[14px] text-white">{joined.replace(/^https?:\/\//, "")}</p>
          <Link href={desk} className={`${ctaCommit} mt-5`}>
            Open the desk
          </Link>
        </HoldCard>
      </Column>
    );
  }

  return (
    <Column>
      {header}
      <HoldCard className="p-6">
        <p className="text-[12px] font-bold uppercase tracking-[0.6px] text-white/55">HOLD Partners</p>
        <h2 className="mt-2 text-[24px] font-extrabold tracking-[-0.4px] text-white">
          {i.invitedBy ? `${i.invitedBy} invited you to ${i.partner.name}` : `Join ${i.partner.name}`}
        </h2>
        <p className="mt-2 text-[14px] leading-[21px] text-white/70">
          As {i.role === "admin" ? "an admin" : "a member"}. You get your own link, and you see the travellers you bring and what they earn
          {i.splitBps ? `. You are paid ${pct(i.splitBps)} of the commission on your travellers, straight into your HOLD Savings` : ""}.
        </p>

        {i.status !== "open" ? (
          <div className="mt-5">
            <Notice>
              {i.status === "accepted" ? "This invite was already used." : i.status === "expired" ? "This invite has expired." : "This invite was cancelled."} Ask for a new
              link.
            </Notice>
          </div>
        ) : already ? (
          <div className="mt-5 flex flex-col gap-3">
            <Notice>
              Your HOLD account is already on {already.name}. Leave it in its Settings first to join {i.partner.name}.
            </Notice>
            <Link href={desk} className="text-[14px] font-bold text-[#8ECAE6] hover:text-white">
              Go to your desk
            </Link>
          </div>
        ) : (
          <form
            className="mt-5 flex flex-col gap-4"
            noValidate
            onSubmit={async (e) => {
              e.preventDefault();
              if (!ready) return;
              setBusy(true);
              setError(null);
              try {
                const out = await acceptInvite(code, custom ? normaliseSlug(raw) : undefined);
                void me.mutate();
                setJoined(out.link ?? out.links?.[0]?.url ?? "");
              } catch (err) {
                setError(partnerErrorText(err));
                setBusy(false);
              }
            }}
          >
            <Field label="Your link name (optional)" hint="Leave it empty and we make one from the team's name and yours.">
              <input
                className={inputCls}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                maxLength={40}
                placeholder={`${i.partner.slug}yourname`}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              {custom ? <SlugLine raw={raw} check={check} /> : null}
            </Field>
            {error ? <Alert>{error}</Alert> : null}
            <button type="submit" className={ctaCommit} disabled={!ready}>
              {busy ? "Joining" : `Join ${i.partner.name}`}
            </button>
          </form>
        )}
      </HoldCard>
    </Column>
  );
}
