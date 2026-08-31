"use client";

/**
 * /statements/verify/[code] — where a stranger checks that one of our
 * statements is real.
 *
 * ── WHO THIS PAGE IS FOR ──
 *
 * Not a customer. A consular officer, a landlord, an immigration desk: somebody
 * holding a printed PDF, deciding whether to believe it, with a queue behind
 * them. Everything here follows from that. No marketing, no navigation away, no
 * sign-up, no cookie banner in the way of the answer. The verdict is the first
 * thing on the page and it is legible from arm's length.
 *
 * ── THE PAGE NEVER REVEALS ANYTHING ──
 *
 * Verification is a challenge, not a lookup. The backend stores a digest of the
 * document's facts and no personal data at all; the reader supplies what their
 * copy says and is told whether it matches. So this page NEVER displays a
 * holder name or a balance it was not given. A code on its own gets "issued" —
 * confirmation that a document exists — and nothing about whom or for how much.
 *
 * The QR on the document carries the facts in the URL, so scanning it verifies
 * in one step. That URL is therefore as sensitive as the paper it is printed
 * on, and no more: anyone who can read the link is already holding the
 * document. We echo none of it back into the page.
 *
 * ── WHY EVERY OUTCOME IS A NORMAL RENDER ──
 *
 * There is no error state here, only answers. "We have no record of this
 * document" is a result an officer can act on. A 404 page, a stack trace or a
 * spinner that never resolves all read as "the link is broken", which is the
 * one impression that makes a genuine statement look forged.
 */

import React from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Wordmark } from "@/components/site/Wordmark";

type Outcome =
  | { status: "match"; issuedAt: string }
  | { status: "mismatch"; issuedAt: string }
  | {
      status: "issued";
      issuedAt: string;
      periodStart: string;
      periodEnd: string;
      tokenId: string;
      movementCount: number;
    }
  | { status: "revoked"; issuedAt: string }
  | { status: "expired"; issuedAt: string; expiredAt: string }
  | { status: "unknown" }
  | { status: "unreachable" };

const FACT_KEYS = [
  "holderLine",
  "opening",
  "totalIn",
  "totalOut",
  "closing",
  "movementCount",
  "periodStart",
  "periodEnd",
  "tokenId",
] as const;

/** Colour carries the verdict for the person glancing at a phone screen; the
 *  words carry it for everyone else. Neither is load-bearing alone. */
const TONE: Record<Outcome["status"], { bar: string; text: string; title: string }> = {
  match: { bar: "bg-emerald-500", text: "text-emerald-700", title: "This document is genuine" },
  mismatch: { bar: "bg-red-500", text: "text-red-700", title: "This does not match our record" },
  issued: { bar: "bg-emerald-500", text: "text-emerald-700", title: "We issued this document" },
  revoked: { bar: "bg-amber-500", text: "text-amber-700", title: "This document was withdrawn" },
  expired: { bar: "bg-amber-500", text: "text-amber-700", title: "This document has expired" },
  unknown: { bar: "bg-neutral-400", text: "text-neutral-700", title: "No record of this document" },
  unreachable: {
    bar: "bg-neutral-400",
    text: "text-neutral-700",
    title: "We could not check right now",
  },
};

/**
 * What each verdict MEANS for the decision in front of the reader.
 *
 * Written for somebody who has never heard of us and does not care how it
 * works. The mismatch wording is the one that matters most and the one easiest
 * to get wrong: a mismatch is not proof of forgery — a transcription slip
 * produces the same answer — so it says what to do rather than what to
 * conclude.
 */
const EXPLANATION: Record<Outcome["status"], string> = {
  match:
    "Every figure you entered matches the statement we issued. The document has not been altered since we produced it.",
  mismatch:
    "At least one figure differs from the statement we issued. That can mean the document was altered, or simply that something was mistyped — check the entries against the page and try again.",
  issued:
    "A statement with this code was issued by HIHODL and is current. To confirm the figures on your copy have not been altered, enter them below.",
  revoked:
    "The account holder withdrew this document. It was genuine when issued; they have asked that it no longer be relied on.",
  expired:
    "This document is past the date we vouch for it. It was genuine when issued. Ask the holder for a current statement.",
  unknown:
    "We have no statement under this code. Check the code was copied correctly — it is 26 characters, and the letters I, L, O and U never appear in it.",
  unreachable:
    "We could not reach our records just now. This does not mean the document is invalid. Please try again in a moment.",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-6 border-b border-neutral-200 py-2 text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className="font-medium text-neutral-900">{value}</span>
    </div>
  );
}

export default function VerifyStatementPage() {
  const params = useParams<{ code: string }>();
  const search = useSearchParams();
  const code = String(params?.code ?? "");

  const [outcome, setOutcome] = React.useState<Outcome | null>(null);
  const [checking, setChecking] = React.useState(true);
  // Seeded from the URL so a scanned QR verifies with no typing, and so a
  // reader who then corrects a field is editing what the link claimed.
  const [facts, setFacts] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(FACT_KEYS.map((k) => [k, search?.get(k) ?? ""])),
  );

  const check = React.useCallback(
    async (withFacts: Record<string, string> | null) => {
      setChecking(true);
      const qs = new URLSearchParams({ code });
      if (withFacts && FACT_KEYS.every((k) => withFacts[k])) {
        for (const k of FACT_KEYS) qs.set(k, withFacts[k]);
      }
      try {
        const res = await fetch(`/api/statements/verify?${qs.toString()}`, { cache: "no-store" });
        setOutcome((await res.json()) as Outcome);
      } catch {
        setOutcome({ status: "unreachable" });
      } finally {
        setChecking(false);
      }
    },
    [code],
  );

  React.useEffect(() => {
    const seeded = Object.fromEntries(FACT_KEYS.map((k) => [k, search?.get(k) ?? ""]));
    void check(FACT_KEYS.every((k) => seeded[k]) ? seeded : null);
    // The code is the identity of this page; re-running on every keystroke in
    // the form would verify a half-typed challenge and flash "mismatch".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const tone = outcome ? TONE[outcome.status] : null;
  const canChallenge =
    outcome !== null && ["issued", "match", "mismatch"].includes(outcome.status);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <Wordmark />
        <h1 className="text-2xl font-semibold text-neutral-900">Statement verification</h1>
        <p className="text-sm text-neutral-500">
          Confirm that an account statement was issued by HIHODL and has not been altered.
        </p>
      </header>

      <section aria-live="polite" className="flex flex-col gap-4">
        {checking && !outcome ? (
          <p className="text-sm text-neutral-500">Checking…</p>
        ) : outcome && tone ? (
          <div className="flex gap-4">
            <div className={`w-1 shrink-0 rounded ${tone.bar}`} aria-hidden />
            <div className="flex flex-col gap-2">
              <h2 className={`text-xl font-semibold ${tone.text}`}>{tone.title}</h2>
              <p className="text-sm leading-relaxed text-neutral-700">
                {EXPLANATION[outcome.status]}
              </p>
            </div>
          </div>
        ) : null}

        {outcome && "issuedAt" in outcome ? (
          <div className="flex flex-col">
            <Row label="Reference" value={code.toUpperCase()} />
            <Row label="Issued" value={outcome.issuedAt.slice(0, 10)} />
            {outcome.status === "issued" ? (
              <>
                <Row label="Period" value={`${outcome.periodStart} to ${outcome.periodEnd}`} />
                <Row label="Currency" value={outcome.tokenId} />
                <Row label="Movements" value={String(outcome.movementCount)} />
              </>
            ) : null}
            {outcome.status === "expired" ? (
              <Row label="Valid until" value={outcome.expiredAt.slice(0, 10)} />
            ) : null}
          </div>
        ) : null}
      </section>

      {canChallenge ? (
        <section className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-5">
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-semibold text-neutral-900">
              Check the figures on your copy
            </h3>
            <p className="text-sm text-neutral-500">
              Type what the statement in front of you says. We compare it against what we issued and
              tell you whether it matches. We do not show you the figures — if we did, this page
              would hand a stranger somebody&apos;s balance.
            </p>
          </div>

          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void check(facts);
            }}
          >
            {(
              [
                ["holderLine", "Account holder line, exactly as printed"],
                ["periodStart", "Period start (YYYY-MM-DD)"],
                ["periodEnd", "Period end (YYYY-MM-DD)"],
                ["tokenId", "Currency"],
                ["opening", "Opening balance"],
                ["totalIn", "Total in"],
                ["totalOut", "Total out"],
                ["closing", "Closing balance"],
                ["movementCount", "Number of movements listed"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex flex-col gap-1 text-sm">
                <span className="text-neutral-600">{label}</span>
                <input
                  className="rounded border border-neutral-300 px-3 py-2 text-neutral-900"
                  value={facts[key] ?? ""}
                  onChange={(e) => setFacts((f) => ({ ...f, [key]: e.target.value }))}
                  // Not `required`: the browser would block submission with its
                  // own message, and the answer this page owes an empty form is
                  // "all of them or none", not a tooltip.
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
            ))}

            <button
              type="submit"
              disabled={checking || !FACT_KEYS.every((k) => facts[k])}
              className="mt-2 rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {checking ? "Checking…" : "Check this document"}
            </button>
            {!FACT_KEYS.every((k) => facts[k]) ? (
              <p className="text-xs text-neutral-500">
                Every field is needed. A partial check would report a mismatch on a document that is
                perfectly genuine.
              </p>
            ) : null}
          </form>
        </section>
      ) : null}

      <footer className="mt-auto border-t border-neutral-200 pt-6 text-xs leading-relaxed text-neutral-500">
        <p>
          HIHODL TECHNOLOGIES OÜ, Estonia. This page confirms whether a statement was issued by us
          and whether the figures presented match what we issued. It is not a credit reference and
          it does not disclose any account information.
        </p>
      </footer>
    </main>
  );
}
