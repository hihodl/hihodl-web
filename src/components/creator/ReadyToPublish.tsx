/**
 * What is still missing before you can publish.
 *
 * WHY THIS EXISTS AS ITS OWN THING
 *
 * The three cards above each answer their own question and none of them
 * answers the one the creator actually has. This one does, in the order the
 * publish gate checks them (`publishRefusal` in the backend's ad-space rules),
 * so nothing here can say "ready" about a space the server would refuse.
 *
 * WHY THE SOLANA LINE IS NOT A TICK OR A CROSS
 *
 * Nothing this console can call knows whether a USDC account exists at an
 * address: the backend reads the chain at publish and refuses with
 * `creator_cannot_receive_usdc`. Rather than guess, or leave it out and let a
 * creator meet it for the first time as a refusal, it is stated here as a
 * condition with what to do about it. Publishing on Base and Polygon works
 * today for exactly the creator it catches, and saying so is more use than a
 * promise that it will be handled later. It will not be: the relayer is never
 * allowed to pay rent for somebody else's token account, and that is a rule we
 * keep on purpose.
 */

"use client";

import { MIN_X_ACCOUNT_AGE_DAYS, type PayoutAddressView, type XAccountStatus } from "@/lib/creator/types";

import { Section, Status } from "./parts";

export function ReadyToPublish({
  x,
  payout,
}: {
  x: XAccountStatus | null;
  payout: PayoutAddressView | null;
}) {
  const hasX = x?.canPublish === true;
  const solana = payout?.solana.address ?? null;
  const evm = payout?.evm.address ?? null;
  const hasAddress = !!solana || !!evm;

  return (
    <Section label="Before you publish" title="What is still missing">
      <ul className="flex flex-col gap-6">
        <Item
          done={hasX}
          title={`A verified X account, at least ${MIN_X_ACCOUNT_AGE_DAYS} days old`}
          body={
            hasX
              ? "Your X account can front a space."
              : `A space is published under a verified X account that has existed for at least ${MIN_X_ACCOUNT_AGE_DAYS} days. Until X shows a check mark on an account that old, a space cannot go live under it.`
          }
        />

        <Item
          done={hasAddress}
          title="An address to be paid at"
          body={
            hasAddress
              ? chainsYouCanSellOn(solana, evm)
              : "A space accepts USDC on the chain the sponsor pays from, and pays it to your own address on that chain. Nothing can be published until there is one."
          }
        />

        <Item
          done={null}
          title="On Solana, a USDC account that already exists"
          body="Publishing on Solana needs your wallet to hold a USDC account already, and a brand-new wallet does not have one: on Solana that account is opened the first time somebody sends you USDC, and our relayer is never allowed to pay for somebody else's. We read the chain when you publish and refuse there rather than letting it fail at the first sponsor's checkout. If that is you, two things are true and both are useful: you can publish on Base and Polygon today, and any amount of USDC sent to you on Solana opens the account for good."
        />
      </ul>

      <p className="mt-8 text-small text-text-muted">
        None of this asks you to sign anything on chain. A sponsor&apos;s wallet pays yours in one transaction they
        sign; you publish, approve their artwork, answer offers and mark the work delivered, and every one of those is
        this page talking to HOLD.
      </p>
    </Section>
  );
}

/** Which chains this creator could sell on right now, named rather than counted. */
function chainsYouCanSellOn(solana: string | null, evm: string | null): string {
  if (solana && evm) return "You can be paid on Solana, Base and Polygon.";
  if (evm) return "You can be paid on Base and Polygon. Add a Solana address to sell there too.";
  return "You can be paid on Solana. Add a Base or Polygon address to sell there too.";
}

/** `done: null` is a condition we genuinely cannot check from here. */
function Item({ done, title, body }: { done: boolean | null; title: string; body: string }) {
  return (
    <li className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Status state={done === true ? "done" : done === false ? "todo" : "neutral"}>
          {done === true ? "Done" : done === false ? "Missing" : "Check this one"}
        </Status>
        <span className="text-body text-text">{title}</span>
      </div>
      <p className="text-small text-text-muted">{body}</p>
    </li>
  );
}
