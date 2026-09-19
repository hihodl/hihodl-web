/**
 * Back from X.
 *
 * X sends the browser to the backend's callback, which has no session of ours
 * and so links nothing: it files X's code and 302s here with
 * `?result=<result>` and, on the one success, `&ticket=<ticket>`. The ticket is
 * redeemable only by the user who started the trip, which is why finishing the
 * link is a second call — `POST /x-account/complete` with the session.
 *
 * EVERY RESULT GETS ITS OWN SENTENCE
 *
 * Seven of them, and one generic "something went wrong" would be wrong for six.
 * `taken` and `busy` in particular are not errors at all: they are rules about
 * one X account belonging to one HOLD account, and a creator who reads
 * "failed" goes round the loop again instead of doing the one thing that would
 * fix it.
 */

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useHref, useProductHref } from "@/components/app/base";
import { ctaPrimary, ctaSecondary } from "@/components/app/hold";
import { Ion } from "@/components/app/ion";
import { completeXLink, describeCreatorError } from "@/lib/creator/api";
import { useCreatorSession } from "@/lib/creator/session";
import { isLinkResult, isTicket, type LinkResult } from "@/lib/creator/types";

import { Notice } from "./parts";

/** What each ending means, said once and said plainly. */
const RESULT_TEXT: Record<Exclude<LinkResult, "signed_in">, { title: string; body: string }> = {
  ok: {
    title: "Your X account is linked",
    body: "Spaces you publish will be published under it, and its handle is what sponsors see on the page.",
  },
  denied: {
    title: "You said no at X",
    body: "Nothing was linked and nothing on your account changed. You can start again whenever you like.",
  },
  expired: {
    title: "That sign-in ran out",
    body: "A trip to X is good for ten minutes and this one took longer. Nothing changed. Start again and it will go through.",
  },
  taken: {
    title: "That X account belongs to another HOLD account",
    body: "One X account can only be linked to one HOLD account, because it is what a sponsor checks before paying a stranger. Sign in to the account that already has it, or link a different X account here.",
  },
  busy: {
    title: "Your current X account is on a live space",
    body: "A published board promises a verified creator, and that promise is read off the account fronting it — so it cannot be swapped while that space is open. Once it closes, this will work.",
  },
  failed: {
    title: "That did not go through",
    body: "Something went wrong between here and X. Nothing was linked and nothing on your account changed. Trying again usually settles it.",
  },
  unavailable: {
    title: "Linking X is not available right now",
    body: "Nothing was linked and nothing on your account changed. Try again in a little while.",
  },
};

type State =
  | { kind: "working" }
  | { kind: "needs-session" }
  | { kind: "result"; result: Exclude<LinkResult, "signed_in"> }
  | { kind: "error"; message: string };

/**
 * Six of the seven endings are known before anything runs, so they are decided
 * here rather than in an effect: a creator who said no at X should read that on
 * the first paint, not watch "Finishing up with X…" for a moment first.
 */
function initialState(result?: string, ticket?: string): State {
  const incoming = result ?? null;
  if (!isLinkResult(incoming)) return { kind: "result", result: "failed" };
  if (incoming !== "signed_in") return { kind: "result", result: incoming };
  // A success with no usable ticket is not a success: nothing can be redeemed.
  if (!isTicket(ticket ?? null)) return { kind: "result", result: "failed" };
  return { kind: "working" };
}

export function XReturn({ result, ticket }: { result?: string; ticket?: string }) {
  const { session } = useCreatorSession();
  const href = useHref();
  const productHref = useProductHref();
  const [state, setState] = useState<State>(() => initialState(result, ticket));
  // A ticket is single use. React runs an effect twice in development, and a
  // reload would present a spent one, so it is redeemed at most once per load.
  const redeemed = useRef(false);

  useEffect(() => {
    if (initialState(result, ticket).kind !== "working") return;
    // The session is read from storage a tick after mount; wait for it rather
    // than telling a signed-in creator to sign in.
    if (session === undefined) return;
    if (session === null) {
      setState({ kind: "needs-session" });
      return;
    }
    if (redeemed.current) return;
    redeemed.current = true;

    void (async () => {
      try {
        const answer = await completeXLink(ticket!);
        const done = isLinkResult(answer.result) && answer.result !== "signed_in" ? answer.result : "failed";
        setState({ kind: "result", result: done });
      } catch (e) {
        setState({ kind: "error", message: describeCreatorError(e) });
      } finally {
        // Take the ticket out of the address bar either way: it is spent, and
        // a link somebody copies out of here should not carry a credential.
        window.history.replaceState(null, "", href("/x"));
      }
    })();
  }, [result, ticket, session, href]);

  const ok = state.kind === "result" && state.result === "ok";
  const title =
    state.kind === "working"
      ? "Finishing up with X…"
      : state.kind === "needs-session"
        ? "Sign in to finish linking X"
        : state.kind === "error"
          ? "We could not finish linking X"
          : RESULT_TEXT[state.result].title;
  const body =
    state.kind === "needs-session" ? "Sign in and connect X again." : state.kind === "result" ? RESULT_TEXT[state.result].body : null;

  // TravelEmpty: the icon in its disc, the title, the sentence, and the one way on.
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-2.5 px-6 py-10 text-center">
      <span className="mb-1 flex h-14 w-14 items-center justify-center rounded-[28px] border border-white/10 bg-white/[0.04] text-white/[0.62]">
        <Ion name={ok ? "checkmark-circle-outline" : "logo-x"} size={24} className={ok ? "text-[#2FBE8A]" : undefined} />
      </span>
      <h1 className="text-[17px] font-bold tracking-[-0.3px] text-white">{title}</h1>
      {body ? <p className="max-w-[400px] text-[14px] leading-5 text-white/[0.62]">{body}</p> : null}
      {state.kind === "error" ? (
        <div className="w-full text-left">
          <Notice>{state.message}</Notice>
        </div>
      ) : null}
      {state.kind !== "working" ? (
        <Link href={productHref("/account?view=x")} className={`${ok ? ctaPrimary : ctaSecondary} mt-3 !w-auto`}>
          Open Account
        </Link>
      ) : null}
    </div>
  );
}
