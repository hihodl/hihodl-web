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
import { t as tNow } from "@/lib/app/i18n";
import { fmtNumber } from "@/lib/app/i18n/format";
import { Rich, useT } from "@/lib/app/i18n/react";

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
  return sentenceStart ? tNow("offers.booking.theCreatorStart") : tNow("offers.booking.theCreator");
}

function creatorPossessive(handle: string | null | undefined): string {
  return handle ? tNow("offers.booking.handlePossessive", { handle }) : tNow("offers.booking.theCreatorPossessive");
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
  const t = useT();
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
      <p className="text-body text-sp-ink">{t("offers.booking.link.save")}</p>
      <p className="text-small text-sp-ink/85">{t("offers.booking.link.body")}</p>
      <p className="break-all rounded-input border border-[color:var(--color-hairline-strong)] bg-sp-ink/[0.04] px-3 py-2 font-mono text-tiny text-sp-ink">
        {link}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnSmallSecondary} onClick={() => void copy()}>
          {copied ? t("common.copied") : t("offers.link.copy")}
        </button>
        <a href={`/b/${token}`} target="_blank" rel="noreferrer" className={btnSmallSecondary}>
          {t("offers.link.open")}
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
  const t = useT();
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
    if (!brief.trim()) return setNotice(t("offers.booking.contact.briefEmpty"));
    if (brief.trim().length > SESSION_TEXT_MAX) return setNotice(t("offers.booking.contact.briefMax", { max: SESSION_TEXT_MAX }));

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
        <h3 className="text-body text-sp-ink">{sent ? t("offers.booking.contact.titleSent") : t("offers.booking.contact.title", { who })}</h3>
        <p className="mt-1 text-small text-sp-ink/85">
          {t("offers.booking.contact.private", { who })}
        </p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-small text-sp-ink/85">{t("offers.booking.contact.reachMeOn")}</legend>
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
        <span className="text-small text-sp-ink/85">{t("offers.booking.contact.your", { kind: CONTACT_KIND_LABEL[kind] })}</span>
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
          <span>{t("offers.booking.contact.briefLabel")}</span>
          <span className={`text-tiny ${brief.length > SESSION_TEXT_MAX ? "text-sp-amber" : "text-sp-ink/80"}`}>
            {fmtNumber(brief.length)}/{fmtNumber(SESSION_TEXT_MAX)}
          </span>
        </span>
        <textarea
          className={`${input} min-h-[96px] resize-y`}
          value={brief}
          maxLength={SESSION_TEXT_MAX}
          onChange={(e) => setBrief(e.target.value)}
          placeholder={t("offers.booking.contact.briefPlaceholder")}
        />
      </label>

      {notice && (
        <p className="rounded-card border border-amber/30 bg-amber/[0.05] px-4 py-3 text-small text-sp-ink/85" role="status">
          {notice}
        </p>
      )}
      {saved && !notice && (
        <p className="rounded-card border border-success/30 bg-success/[0.06] px-4 py-3 text-small text-sp-ink/85" role="status">
          {t("offers.booking.contact.sent", { who: creatorRef(creatorHandle, true) })}
        </p>
      )}

      <div>
        <button type="submit" className={btnPrimary} disabled={busy}>
          {busy ? t("offers.sheet.sending") : sent ? t("offers.booking.contact.saveChanges") : t("offers.booking.contact.sendTo", { who })}
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
  const t = useT();
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
          <span className="text-sp-ink/80"> {t("offers.booking.yourTimeInline", { time: local })}</span>
        ) : (
          <span className="mt-1 block text-tiny text-sp-ink/80">{t("offers.booking.yourTime", { time: local })}</span>
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
  const t = useT();
  const [booking, setBooking] = useState(initial);
  // The server's clock until the browser's takes over, so the first paint
  // already knows whether the window to answer has closed.
  const [now, setNow] = useState<number>(renderedAt);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
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
      <section className={`${card} flex flex-col gap-4 p-5 md:p-6`} aria-label={t("offers.booking.aria")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={`${eyebrow} text-sp-ink/80`}>{t("offers.booking.eyebrow")}</p>
            <h1 className="mt-2 break-words font-display text-h4 font-light text-sp-ink [overflow-wrap:anywhere] md:text-h3">
              {space.templateName
                ? t("offers.booking.titleWith", { what: space.templateName, who })
                : t("offers.booking.titleSession", { who })}
            </h1>
            <p className="mt-1 break-words text-small text-sp-ink/85 [overflow-wrap:anywhere]">
              {[space.event?.name, space.title, booking.positionLabel].filter(Boolean).join(" · ")}
            </p>
          </div>
          {paid ? (
            <span className={STATE_PILL[s.state]}>{SESSION_STATE_LABEL[s.state]}</span>
          ) : (
            <span className={pill.neutral}>{t("offers.booking.paymentNotConfirmed")}</span>
          )}
        </div>
        <dl className="grid grid-cols-1 gap-3 border-t border-[color:var(--color-hairline)] pt-4 text-small sm:grid-cols-2">
          <div>
            <dt className="text-tiny text-sp-ink/80">{t("offers.booking.youPaid")}</dt>
            <dd className="mt-1 font-mono text-sp-ink">{order.sponsorPaysUsdc} USDC</dd>
          </div>
          <div>
            <dt className="text-tiny text-sp-ink/80">{t("offers.booking.received", { who: creatorRef(handle, true) })}</dt>
            <dd className="mt-1 font-mono text-sp-ink">{order.creatorReceivesUsdc} USDC</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2">
          {order.explorerUrl && (
            <a href={order.explorerUrl} target="_blank" rel="noopener noreferrer" className={btnSmallSecondary}>
              {t("offers.booking.viewTx")}
            </a>
          )}
          {space.path && (
            <a href={space.path} className={btnSmallSecondary}>
              {t("offers.booking.seeSpace", { whose: creatorPossessive(handle) })}
            </a>
          )}
        </div>
      </section>

      {!paid ? (
        <p className={`${card} p-5 text-small text-sp-ink/85`}>
          {t("offers.booking.notConfirmed")}
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
              <h2 className={`${eyebrow} text-sp-ink/80`}>{t("offers.booking.whatYouSent")}</h2>
              <p className="text-sp-ink/85">
                {CONTACT_KIND_LABEL[s.contact.kind]}: <span className="text-sp-ink">{s.contact.value}</span>
              </p>
              {s.brief && <p className="whitespace-pre-line break-words text-sp-ink/85 [overflow-wrap:anywhere]">{s.brief}</p>}
            </section>
          )}

          <section className={`${card} flex flex-col gap-2 p-5 md:p-6`}>
            <h2 className={`${eyebrow} text-sp-ink/80`}>{t("offers.booking.fallbackTitle")}</h2>
            <p className="text-small text-sp-ink/85">{SESSION_FALLBACK_TEXT[space.fallback]}</p>
            {space.fallbackNote && (
              <p className="border-l-2 border-amber/40 pl-3 text-small text-sp-ink">
                <span className="sr-only">{t("offers.booking.creatorAdds")} </span>
                {space.fallbackNote}
              </p>
            )}
            <p className="text-small text-sp-ink/85">
              {t("offers.booking.paidDirectly", { who })}
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
  const t = useT();
  return (
    <section className={`${card} flex flex-col gap-3 p-5 md:p-6`} aria-label={t("offers.booking.whenWhere")}>
      <h2 className={`${eyebrow} text-sp-ink/80`}>{t("offers.booking.whenWhere")}</h2>
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
              {t("offers.booking.canChange", { who: creatorRef(handle, true) })}
            </p>
          )}
        </>
      ) : ANSWERABLE.has(s.state) ? (
        <p className="text-small text-sp-ink/85">{t("offers.booking.noTimeSet")}</p>
      ) : (
        <>
          {s.state === "awaiting_contact" ? (
            <p className="text-small text-sp-ink/85">
              {t("offers.booking.sendContact", { who: creatorRef(handle) })}
            </p>
          ) : (
            <p className="text-small text-sp-ink/85">
              {t("offers.booking.noTimeYet", { who: creatorRef(handle, true) })}
            </p>
          )}
          <p className="text-tiny text-sp-ink/80">
            {t("offers.booking.neverSet")}
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
  const t = useT();
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
      return setNotice(t("offers.booking.noteMax", { max: SESSION_TEXT_MAX }));
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

  const confirmBy = s.confirmBy;
  const byTag = { time: () => (confirmBy ? <EventInstant iso={confirmBy} timeZone={timeZone} inline /> : null) };

  if (s.state === "delivered") {
    return (
      <section className="rounded-card border border-success/30 bg-success/[0.06] p-5 md:p-6" aria-label={t("offers.booking.outcome")}>
        <p className="text-body text-sp-ink">{t("offers.booking.delivered")}</p>
        <p className="mt-1 text-small text-sp-ink/85">{t("offers.booking.deliveredBody", { whose: creatorPossessive(handle) })}</p>
        {notice && <p className="mt-3 text-small text-sp-ink/85">{notice}</p>}
      </section>
    );
  }

  if (s.state === "disputed") {
    return (
      <section className={`${card} flex flex-col gap-3 p-5 md:p-6`} aria-label={t("offers.booking.outcome")}>
        <h2 className="text-body text-sp-ink">{t("offers.booking.disputedTitle")}</h2>
        <p className="text-small text-sp-ink/85">{t("offers.booking.disputedBody", { whose: creatorPossessive(handle) })}</p>
        {s.disputeNote && (
          <p className="whitespace-pre-line break-words border-l-2 border-[color:var(--color-hairline-strong)] pl-3 text-small text-sp-ink/85 [overflow-wrap:anywhere]">
            <span className="text-sp-ink/80">{t("offers.booking.yourNote")} </span>
            {s.disputeNote}
          </p>
        )}
        {s.creatorReply && (
          <p className="whitespace-pre-line break-words border-l-2 border-amber/40 pl-3 text-small text-sp-ink [overflow-wrap:anywhere]">
            <span className="text-sp-ink/80">{t("offers.booking.replied", { who: creatorRef(handle, true) })} </span>
            {s.creatorReply}
          </p>
        )}
        {windowOpen && (
          <div className="flex flex-col gap-2 border-t border-[color:var(--color-hairline)] pt-4">
            <p className="text-small text-sp-ink/85">
              {confirmBy ? (
                <Rich k="offers.booking.gotItWrongBy" tags={byTag} />
              ) : (
                t("offers.booking.gotItWrong")
              )}
            </p>
            <div>
              <button type="button" className={btnSecondary} disabled={busy} onClick={() => void answer("delivered")}>
                {busy ? t("offers.sheet.sending") : t("offers.booking.itDidHappen")}
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
      <section className={`${card} p-5 text-small text-sp-ink/85 md:p-6`} aria-label={t("offers.booking.outcome")}>
        {t("offers.booking.windowPassed", { whose: creatorPossessive(handle) })}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-card border border-amber/40 bg-amber/[0.06] p-5 md:p-6" aria-label={t("offers.booking.outcome")}>
      <div>
        <h2 className="text-body text-sp-ink">{t("offers.booking.didItHappen", { who })}</h2>
        <p className="mt-1 text-small text-sp-ink/85">
          {confirmBy ? (
            <Rich k="offers.booking.answerBy" vars={{ whose: creatorPossessive(handle) }} tags={byTag} />
          ) : (
            t("offers.booking.answer", { whose: creatorPossessive(handle) })
          )}
        </p>
      </div>

      {!disputing ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" className={btnPrimary} disabled={busy} onClick={() => void answer("delivered")}>
            {busy ? t("offers.sheet.sending") : t("offers.booking.yesHappened")}
          </button>
          <button type="button" className={btnSecondary} disabled={busy} onClick={() => setDisputing(true)}>
            {t("offers.booking.didntHappen")}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-small text-sp-ink/85">
            {t("offers.booking.disputeWarning", { whose: creatorPossessive(handle), who })}
          </p>
          <label className="flex flex-col gap-2">
            <span className="flex items-baseline justify-between gap-3 text-small text-sp-ink/85">
              <span>{t("offers.booking.whatHappened")}</span>
              <span className={`text-tiny ${note.length > SESSION_TEXT_MAX ? "text-sp-amber" : "text-sp-ink/80"}`}>
                {fmtNumber(note.length)}/{fmtNumber(SESSION_TEXT_MAX)}
              </span>
            </span>
            <textarea
              className={`${input} min-h-[96px] resize-y`}
              value={note}
              maxLength={SESSION_TEXT_MAX}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("offers.booking.notePlaceholder")}
            />
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" className={btnPrimary} disabled={busy} onClick={() => void answer("didnt_happen")}>
              {busy ? t("offers.sheet.sending") : t("offers.booking.sayDidntHappen")}
            </button>
            <button type="button" className={btnSecondary} disabled={busy} onClick={() => setDisputing(false)}>
              {t("common.back")}
            </button>
          </div>
        </div>
      )}

      <p className="text-tiny text-sp-ink/80">
        {t("offers.booking.finalNote")}
      </p>
      {notice && <p className="text-small text-sp-ink/85">{notice}</p>}
    </section>
  );
}
