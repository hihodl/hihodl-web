"use client";

import { useEffect, useState, type FormEvent } from "react";

import {
  CheckoutError,
  confirmSession,
  describeError,
  describeSessionError,
  getBookingClient,
  putSessionContact,
} from "@/lib/ad-space/checkout-client";
import {
  CONTACT_KIND_LABEL,
  SESSION_FALLBACK_TEXT,
  SESSION_STATE_LABEL,
  SESSION_TEXT_MAX,
  instantIn,
  instantUtc,
  knownTimeZone,
} from "@/lib/ad-space/format";
import { CONTACT_KINDS, CONTACT_PLACEHOLDER, contactProblem, normaliseContact } from "@/lib/ad-space/contact";
import type { Booking, ContactKind, SessionState, SessionView } from "@/lib/ad-space/types";

import { btnPrimary, btnSecondary, btnSmallSecondary, card, eyebrow, input, pill } from "./ui";

/**
 * A booked session, from the buyer's side (hispace-in-the-room-v0.md).
 *
 * The buyer of a session has no account on the web. Their manage link,
 * `/b/<token>`, is the only thing that proves the booking is theirs, so the
 * token is handled like a password: it is put in the page's own links and the
 * API path and nowhere else. Nothing here logs it, and every call made with it
 * sends no Referer.
 *
 * The server decides every state and window. The buttons below only appear
 * where the contract says an answer is possible, and a refusal still gets a
 * plain sentence.
 */

/**
 * "@dana", or "the creator" when the server has no handle to give, so a
 * sentence never ends up with a bare "@".
 */
function creatorRef(handle: string | null | undefined, sentenceStart = false): string {
  if (handle) return `@${handle}`;
  return sentenceStart ? "The creator" : "the creator";
}

function creatorPossessive(handle: string | null | undefined): string {
  return handle ? `@${handle}\u2019s` : "the creator\u2019s";
}

/**
 * Refusals that mean the page is showing an old state: the server has settled
 * the session since. The page asks for the booking again instead of guessing.
 */
const STALE_CODES: ReadonlySet<string> = new Set(["already_confirmed", "confirm_window_closed", "order_not_paid"]);

function isStale(e: unknown): boolean {
  return e instanceof CheckoutError && STALE_CODES.has(e.code);
}

/** States in which the buyer can still change their contact and brief. */
const CONTACT_EDITABLE: ReadonlySet<SessionState> = new Set([
  "awaiting_contact",
  "awaiting_schedule",
  "scheduled",
  "awaiting_confirmation",
]);

/* ── The manage link ───────────────────────────────────────────────── */

export function manageLinkFor(token: string): string {
  const origin = typeof window === "undefined" ? "https://hihodl.xyz" : window.location.origin;
  return `${origin}/b/${token}`;
}

/**
 * The link, shown in full, with a copy button. Said plainly because a buyer
 * without an account has no other way back to their booking.
 */
export function ManageLinkBox({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState(`https://hihodl.xyz/b/${token}`);
  useEffect(() => setLink(manageLinkFor(token)), [token]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-amber/40 bg-amber/[0.06] p-4">
      <p className="text-body text-sp-ink">Save this link, it is how you confirm your session.</p>
      <p className="text-small text-sp-ink/85">
        You have no account here, so this link is your booking: it shows the time and place, and it is where you say
        whether the session happened. Anyone with it can manage the booking, so keep it to yourself.
      </p>
      <p className="break-all rounded-input border border-[color:var(--color-hairline-strong)] bg-sp-ink/[0.04] px-3 py-2 font-mono text-tiny text-sp-ink">
        {link}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnSmallSecondary} onClick={() => void copy()}>
          {copied ? "Copied" : "Copy the link"}
        </button>
        <a href={`/b/${token}`} target="_blank" rel="noreferrer" className={btnSmallSecondary}>
          Open it
        </a>
      </div>
    </div>
  );
}

/* ── Contact and brief ─────────────────────────────────────────────── */

export function SessionContactForm({
  token,
  session,
  creatorHandle,
  onSaved,
}: {
  token: string;
  session: SessionView | null;
  creatorHandle: string | null;
  onSaved: (booking: Booking) => void;
}) {
  const who = creatorRef(creatorHandle);
  const [kind, setKind] = useState<ContactKind>(session?.contact?.kind ?? "telegram");
  const [value, setValue] = useState(session?.contact?.value ?? "");
  const [brief, setBrief] = useState(session?.brief ?? "");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const sent = Boolean(session?.contact);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setNotice(null);
    setSaved(false);
    const problem = contactProblem(kind, value);
    if (problem) return setNotice(problem);
    if (!brief.trim()) return setNotice("Say in a line or two what the session is for.");
    if (brief.trim().length > SESSION_TEXT_MAX) return setNotice(`Keep it to ${SESSION_TEXT_MAX} characters.`);

    setBusy(true);
    try {
      const booking = await putSessionContact(token, {
        contact: { kind, value: normaliseContact(kind, value) },
        brief: brief.trim(),
      });
      setSaved(true);
      onSaved(booking);
    } catch (err) {
      setNotice(describeSessionError(err) ?? describeError(err, null, "session"));
      if (isStale(err)) {
        try {
          onSaved(await getBookingClient(token));
        } catch {
          // Keep what the page shows; the sentence above already says why.
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <div>
        <h3 className="text-body text-sp-ink">{sent ? "Your contact and brief" : `How ${who} reaches you`}</h3>
        <p className="mt-1 text-small text-sp-ink/85">
          Only {who} sees these. They never appear on a public page. You can change them until you confirm
          the session.
        </p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-small text-sp-ink/85">Reach me on</legend>
        <div className="flex flex-wrap gap-2">
          {CONTACT_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKind(k);
                setNotice(null);
              }}
              aria-pressed={kind === k}
              className={`inline-flex h-10 items-center whitespace-nowrap rounded-[20px] border px-4 text-small transition-colors duration-180 ${
                kind === k
                  ? "border-amber bg-amber/10 text-sp-ink"
                  : "border-[color:var(--color-hairline-strong)] text-sp-ink/85 hover:text-sp-ink"
              }`}
            >
              {CONTACT_KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-2">
        <span className="text-small text-sp-ink/85">Your {CONTACT_KIND_LABEL[kind]}</span>
        <input
          className={input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={CONTACT_PLACEHOLDER[kind]}
          inputMode={kind === "email" ? "email" : "text"}
          autoComplete={kind === "email" ? "email" : "off"}
          autoCapitalize="none"
          spellCheck={false}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="flex items-baseline justify-between gap-3 text-small text-sp-ink/85">
          <span>What the session is for</span>
          <span className={`text-tiny ${brief.length > SESSION_TEXT_MAX ? "text-sp-amber" : "text-sp-ink/80"}`}>
            {brief.length}/{SESSION_TEXT_MAX}
          </span>
        </span>
        <textarea
          className={`${input} min-h-[96px] resize-y`}
          value={brief}
          maxLength={SESSION_TEXT_MAX}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="We launch on day 2 and want our pitch reviewed before the demo stage."
        />
      </label>

      {notice && (
        <p className="rounded-card border border-amber/30 bg-amber/[0.05] px-4 py-3 text-small text-sp-ink/85" role="status">
          {notice}
        </p>
      )}
      {saved && !notice && (
        <p className="rounded-card border border-success/30 bg-success/[0.06] px-4 py-3 text-small text-sp-ink/85" role="status">
          Sent. {creatorRef(creatorHandle, true)} can see it now.
        </p>
      )}

      <div>
        <button type="submit" className={btnPrimary} disabled={busy}>
          {busy ? "Sending…" : sent ? "Save changes" : `Send to ${who}`}
        </button>
      </div>
    </form>
  );
}

/* ── Times ─────────────────────────────────────────────────────────── */

/**
 * An instant in the event's own clock, since that is where the session
 * happens: "Wed 7 Oct, 10:00 GMT+8". The zone is fixed, so the server and the
 * browser write the same words. Once in the browser, the reader's own clock is
 * added in small text when it reads differently.
 *
 * With no zone, or one this runtime doesn't know, it is UTC on the server and
 * the reader's clock once in the browser, as before.
 */
export function EventInstant({
  iso,
  timeZone,
  inline = false,
}: {
  iso: string;
  timeZone?: string | null;
  /** Inside a sentence: the reader's time goes in brackets, not on its own line. */
  inline?: boolean;
}) {
  const zone = knownTimeZone(timeZone);
  const inEvent = zone ? instantIn(iso, zone) : null;
  const [local, setLocal] = useState<string | null>(null);
  useEffect(() => setLocal(instantIn(iso)), [iso]);

  if (!inEvent) return <time dateTime={iso}>{local ?? instantUtc(iso)}</time>;

  const differs = local !== null && local !== inEvent;
  return (
    <>
      <time dateTime={iso} suppressHydrationWarning>
        {inEvent}
      </time>
      {differs &&
        (inline ? (
          <span className="text-sp-ink/80"> ({local} your time)</span>
        ) : (
          <span className="mt-1 block text-tiny text-sp-ink/80">Your time: {local}</span>
        ))}
    </>
  );
}

const STATE_PILL: Record<SessionState, string> = {
  awaiting_contact: pill.attention,
  awaiting_schedule: pill.neutral,
  scheduled: pill.open,
  awaiting_confirmation: pill.attention,
  delivered: pill.done,
  disputed: pill.neutral,
};

/* ── The whole booking, for /b/<token> ─────────────────────────────── */

export function BookingPanel({ token, initial, renderedAt }: { token: string; initial: Booking; renderedAt: number }) {
  const [booking, setBooking] = useState(initial);
  // The server's clock until the browser's takes over, so the first paint
  // already knows whether the window to answer has closed.
  const [now, setNow] = useState<number>(renderedAt);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const { order, space } = booking;
  const s = order.session;
  const handle = space.creator.xHandle;
  const who = creatorRef(handle);
  const paid = order.status === "paid";
  const windowOpen = !s.confirmBy || Date.parse(s.confirmBy) > now;
  // The zone frozen on the session when it was sold, else the event's.
  const zone = s.event?.timeZone ?? space.event?.timeZone ?? null;

  return (
    <div className="flex flex-col gap-6">
      <section className={`${card} flex flex-col gap-4 p-5 md:p-6`} aria-label="Booking">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={`${eyebrow} text-sp-ink/80`}>Your booking</p>
            <h1 className="mt-2 break-words font-display text-h4 font-light text-sp-ink [overflow-wrap:anywhere] md:text-h3">
              {space.templateName ? `${space.templateName} with ${who}` : `Your session with ${who}`}
            </h1>
            <p className="mt-1 break-words text-small text-sp-ink/85 [overflow-wrap:anywhere]">
              {[space.event?.name, space.title, booking.positionLabel].filter(Boolean).join(" · ")}
            </p>
          </div>
          {paid ? (
            <span className={STATE_PILL[s.state]}>{SESSION_STATE_LABEL[s.state]}</span>
          ) : (
            <span className={pill.neutral}>Payment not confirmed</span>
          )}
        </div>
        <dl className="grid grid-cols-1 gap-3 border-t border-[color:var(--color-hairline)] pt-4 text-small sm:grid-cols-2">
          <div>
            <dt className="text-tiny text-sp-ink/80">You paid</dt>
            <dd className="mt-1 font-mono text-sp-ink">{order.sponsorPaysUsdc} USDC</dd>
          </div>
          <div>
            <dt className="text-tiny text-sp-ink/80">{creatorRef(handle, true)} received</dt>
            <dd className="mt-1 font-mono text-sp-ink">{order.creatorReceivesUsdc} USDC</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2">
          {order.explorerUrl && (
            <a href={order.explorerUrl} target="_blank" rel="noopener noreferrer" className={btnSmallSecondary}>
              View the transaction
            </a>
          )}
          {space.path && (
            <a href={space.path} className={btnSmallSecondary}>
              See {creatorPossessive(handle)} space
            </a>
          )}
        </div>
      </section>

      {!paid ? (
        <p className={`${card} p-5 text-small text-sp-ink/85`}>
          This payment hasn&rsquo;t confirmed. Once it does, this page lets you send your contact and confirm the
          session.
        </p>
      ) : (
        <>
          <Schedule session={s} handle={handle} timeZone={zone} />

          <Outcome
            token={token}
            booking={booking}
            windowOpen={windowOpen}
            timeZone={zone}
            onChange={setBooking}
          />

          {CONTACT_EDITABLE.has(s.state) && (
            <section className={`${card} p-5 md:p-6`}>
              <SessionContactForm token={token} session={s} creatorHandle={handle} onSaved={setBooking} />
            </section>
          )}
          {!CONTACT_EDITABLE.has(s.state) && s.contact && (
            <section className={`${card} flex flex-col gap-2 p-5 text-small md:p-6`}>
              <h2 className={`${eyebrow} text-sp-ink/80`}>What you sent</h2>
              <p className="text-sp-ink/85">
                {CONTACT_KIND_LABEL[s.contact.kind]}: <span className="text-sp-ink">{s.contact.value}</span>
              </p>
              {s.brief && <p className="whitespace-pre-line break-words text-sp-ink/85 [overflow-wrap:anywhere]">{s.brief}</p>}
            </section>
          )}

          <section className={`${card} flex flex-col gap-2 p-5 md:p-6`}>
            <h2 className={`${eyebrow} text-sp-ink/80`}>If the session can&rsquo;t happen</h2>
            <p className="text-small text-sp-ink/85">{SESSION_FALLBACK_TEXT[space.fallback]}</p>
            {space.fallbackNote && (
              <p className="border-l-2 border-amber/40 pl-3 text-small text-sp-ink">
                <span className="sr-only">The creator adds: </span>
                {space.fallbackNote}
              </p>
            )}
            <p className="text-small text-sp-ink/85">
              You paid {who} directly. HOLD never held the money and can&rsquo;t refund it or rule on it.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

/** States in which the buyer's window to answer has opened (or already closed). */
const ANSWERABLE: ReadonlySet<SessionState> = new Set(["awaiting_confirmation", "delivered", "disputed"]);

function Schedule({
  session: s,
  handle,
  timeZone,
}: {
  session: SessionView;
  handle: string | null;
  timeZone: string | null;
}) {
  return (
    <section className={`${card} flex flex-col gap-3 p-5 md:p-6`} aria-label="When and where">
      <h2 className={`${eyebrow} text-sp-ink/80`}>When and where</h2>
      {s.sessionAt ? (
        <>
          <p className="text-body text-sp-ink">
            <EventInstant iso={s.sessionAt} timeZone={timeZone} />
          </p>
          {s.sessionPlace && (
            <p className="break-words text-small text-sp-ink/85 [overflow-wrap:anywhere]">{s.sessionPlace}</p>
          )}
          {s.state === "scheduled" && (
            <p className="text-tiny text-sp-ink/80">
              {creatorRef(handle, true)} can still change this until the session starts. Check back here before you go.
              Once it starts, this page asks you whether it happened.
            </p>
          )}
        </>
      ) : ANSWERABLE.has(s.state) ? (
        <p className="text-small text-sp-ink/85">No time was set for this session.</p>
      ) : (
        <>
          {s.state === "awaiting_contact" ? (
            <p className="text-small text-sp-ink/85">
              Send {creatorRef(handle)} your contact below, and they set a time and place with you.
            </p>
          ) : (
            <p className="text-small text-sp-ink/85">
              {creatorRef(handle, true)} hasn&rsquo;t set a time yet. It shows here as soon as they do.
            </p>
          )}
          <p className="text-tiny text-sp-ink/80">
            If no time is ever set, this page asks you whether the session happened once the event is over.
          </p>
        </>
      )}
    </section>
  );
}

function Outcome({
  token,
  booking,
  windowOpen,
  timeZone,
  onChange,
}: {
  token: string;
  booking: Booking;
  windowOpen: boolean;
  timeZone: string | null;
  onChange: (b: Booking) => void;
}) {
  const s = booking.order.session;
  const handle = booking.space.creator.xHandle;
  const who = creatorRef(handle);
  const [disputing, setDisputing] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function answer(outcome: "delivered" | "didnt_happen") {
    setNotice(null);
    if (outcome === "didnt_happen" && note.trim().length > SESSION_TEXT_MAX) {
      return setNotice(`Keep the note to ${SESSION_TEXT_MAX} characters.`);
    }
    setBusy(true);
    try {
      const next = await confirmSession(token, {
        outcome,
        ...(outcome === "didnt_happen" && note.trim() ? { note: note.trim() } : {}),
      });
      setDisputing(false);
      onChange(next);
    } catch (e) {
      setNotice(describeSessionError(e) ?? describeError(e, null, "session"));
      // The server has settled the session since this page loaded (the week
      // ran out, or it was already answered): show what it holds now, not a
      // guess. A dispute whose week ran out stays a dispute.
      if (isStale(e)) {
        try {
          setDisputing(false);
          onChange(await getBookingClient(token));
        } catch {
          // Keep what the page shows; the sentence above already says why.
        }
      }
    } finally {
      setBusy(false);
    }
  }

  const confirmBy = s.confirmBy ? (
    <>
      {" "}
      by <EventInstant iso={s.confirmBy} timeZone={timeZone} inline />
    </>
  ) : null;

  if (s.state === "delivered") {
    return (
      <section className="rounded-card border border-success/30 bg-success/[0.06] p-5 md:p-6" aria-label="Outcome">
        <p className="text-body text-sp-ink">Delivered.</p>
        <p className="mt-1 text-small text-sp-ink/85">
          Nothing more to do here. A session its buyer confirms shows as delivered on {creatorPossessive(handle)} public
          track record.
        </p>
        {notice && <p className="mt-3 text-small text-sp-ink/85">{notice}</p>}
      </section>
    );
  }

  if (s.state === "disputed") {
    return (
      <section className={`${card} flex flex-col gap-3 p-5 md:p-6`} aria-label="Outcome">
        <h2 className="text-body text-sp-ink">You said this session didn&rsquo;t happen.</h2>
        <p className="text-small text-sp-ink/85">
          It shows on {creatorPossessive(handle)} public track record as one disputed session. Your note isn&rsquo;t public.
        </p>
        {s.disputeNote && (
          <p className="whitespace-pre-line break-words border-l-2 border-[color:var(--color-hairline-strong)] pl-3 text-small text-sp-ink/85 [overflow-wrap:anywhere]">
            <span className="text-sp-ink/80">Your note: </span>
            {s.disputeNote}
          </p>
        )}
        {s.creatorReply && (
          <p className="whitespace-pre-line break-words border-l-2 border-amber/40 pl-3 text-small text-sp-ink [overflow-wrap:anywhere]">
            <span className="text-sp-ink/80">{creatorRef(handle, true)} replied: </span>
            {s.creatorReply}
          </p>
        )}
        {windowOpen && (
          <div className="flex flex-col gap-2 border-t border-[color:var(--color-hairline)] pt-4">
            <p className="text-small text-sp-ink/85">
              Got it wrong? You can still say it happened{confirmBy}. After that you can&rsquo;t change it back.
            </p>
            <div>
              <button type="button" className={btnSecondary} disabled={busy} onClick={() => void answer("delivered")}>
                {busy ? "Sending…" : "It did happen"}
              </button>
            </div>
          </div>
        )}
        {notice && <p className="text-small text-sp-ink/85">{notice}</p>}
      </section>
    );
  }

  if (s.state !== "awaiting_confirmation") return null;

  if (!windowOpen) {
    return (
      <section className={`${card} p-5 text-small text-sp-ink/85 md:p-6`} aria-label="Outcome">
        The 7 days to answer have passed, so this booking is closed as delivered. Only a session you confirm shows as
        delivered on {creatorPossessive(handle)} public track record.
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-card border border-amber/40 bg-amber/[0.06] p-5 md:p-6" aria-label="Outcome">
      <div>
        <h2 className="text-body text-sp-ink">Did your session with {who} happen?</h2>
        <p className="mt-1 text-small text-sp-ink/85">
          Answer{confirmBy}. Saying yes is what puts it on {creatorPossessive(handle)} public track record; if you say
          nothing, the booking closes as delivered but doesn&rsquo;t count there.
        </p>
      </div>

      {!disputing ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" className={btnPrimary} disabled={busy} onClick={() => void answer("delivered")}>
            {busy ? "Sending…" : "Yes, it happened"}
          </button>
          <button type="button" className={btnSecondary} disabled={busy} onClick={() => setDisputing(true)}>
            It didn&rsquo;t happen
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-small text-sp-ink/85">
            This counts as one disputed session on {creatorPossessive(handle)} public track record. Only the number is
            public; your note is seen by {who} and HOLD, nobody else. HOLD doesn&rsquo;t move or refund money either way.
          </p>
          <label className="flex flex-col gap-2">
            <span className="flex items-baseline justify-between gap-3 text-small text-sp-ink/85">
              <span>What happened (optional)</span>
              <span className={`text-tiny ${note.length > SESSION_TEXT_MAX ? "text-sp-amber" : "text-sp-ink/80"}`}>
                {note.length}/{SESSION_TEXT_MAX}
              </span>
            </span>
            <textarea
              className={`${input} min-h-[96px] resize-y`}
              value={note}
              maxLength={SESSION_TEXT_MAX}
              onChange={(e) => setNote(e.target.value)}
              placeholder="They didn't turn up at the time we agreed."
            />
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" className={btnPrimary} disabled={busy} onClick={() => void answer("didnt_happen")}>
              {busy ? "Sending…" : "Say it didn't happen"}
            </button>
            <button type="button" className={btnSecondary} disabled={busy} onClick={() => setDisputing(false)}>
              Back
            </button>
          </div>
        </div>
      )}

      <p className="text-tiny text-sp-ink/80">
        Once you say it happened, you can&rsquo;t change that. If you say it didn&rsquo;t, you can still change it to
        delivered within the same 7 days.
      </p>
      {notice && <p className="text-small text-sp-ink/85">{notice}</p>}
    </section>
  );
}
