/**
 * The way into the team from the account page, and an invitation left waiting.
 *
 * The team is its own page because inviting somebody and settling up with
 * them are sittings, not glances — but a creator who never scrolls to it never
 * learns it exists, so the account page says what it is in one line.
 *
 * The waiting invitation is the other half of `rememberSeat` in
 * lib/creator/team: somebody who signed in by clicking the link in the email
 * lands here, on /creator, with the seat they were sent no longer in the
 * address bar. This offers it back instead of losing it.
 */

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { btnPrimary, btnSmallSecondary } from "@/components/ad-space/ui";
import { pendingSeat, seatHref, type PendingSeat } from "@/lib/creator/team";

import { Section } from "../parts";

export function WaitingSeat() {
  const [seat, setSeat] = useState<PendingSeat | null>(null);

  // Read after mount: storage does not exist on the server, and reading it in
  // render would paint something different there than here.
  useEffect(() => setSeat(pendingSeat()), []);

  if (!seat) return null;
  return (
    <div className="flex flex-col gap-3 rounded-card border border-amber/40 bg-amber/10 p-5">
      <p className="text-body text-text">You have an invitation to join somebody’s team</p>
      <p className="text-small text-text-muted">You opened it before you signed in. It is still waiting for your answer.</p>
      <div>
        <Link href={seatHref(seat.seat)} className={btnPrimary}>
          Open the invitation
        </Link>
      </div>
    </div>
  );
}

export function TeamEntry() {
  return (
    <Section label="Your team" title="The people who do the work with you">
      <div className="flex flex-col gap-5">
        <p className="text-body text-text-muted">
          If somebody else turns up and does the work, invite them, put them on the listings they work, and keep track
          of the share you owe each of them. Brands still pay you directly and you pay your team yourself — we never
          move that money.
        </p>
        <div>
          <Link href="/creator/team" className={btnSmallSecondary}>
            Open your team
          </Link>
        </div>
      </div>
    </Section>
  );
}
