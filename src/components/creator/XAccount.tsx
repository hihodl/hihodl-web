/**
 * Your X account.
 *
 * WHY IT IS A REQUIREMENT AND NOT A NICETY
 *
 * An X account is how a sponsor decides whether to pay a stranger: the handle,
 * its age, its check mark and the track record beside it. One X account
 * belongs to one HOLD user, and once it has fronted a published space it stays
 * theirs. So this is not a profile field; it is the thing the board's promise
 * is read off.
 *
 * WHY THE TRIP IS A REDIRECT AND NOT A POPUP
 *
 * `POST /x-account/link` with `{ surface: "web" }` is what makes the backend
 * send X's callback back to `<site>/creator/x` instead of into the app's deep
 * link. A popup would be blocked by half the browsers a creator reads this in,
 * and a blocked popup looks like a dead button.
 *
 * Coming back is /creator/x, which finishes the link and returns here.
 */

"use client";

import { useCallback, useEffect, useState } from "react";

import { btnPrimary, btnSmallSecondary } from "@/components/ad-space/ui";
import { describeCreatorError, getXAccount, startXLink } from "@/lib/creator/api";
import { MIN_X_ACCOUNT_AGE_DAYS, type XAccountStatus } from "@/lib/creator/types";

import { Loading, Notice, Section, Status } from "./parts";

export function XAccount({ onChange }: { onChange?: (status: XAccountStatus | null) => void }) {
  const [status, setStatus] = useState<XAccountStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await getXAccount();
      setStatus(next);
      setNotice(null);
      onChange?.(next);
    } catch (e) {
      setNotice(describeCreatorError(e));
      onChange?.(null);
    } finally {
      setLoading(false);
    }
  }, [onChange]);

  useEffect(() => {
    void load();
  }, [load]);

  async function link() {
    setBusy(true);
    setNotice(null);
    try {
      const { authorizeUrl } = await startXLink();
      // Assigned rather than opened: this tab goes to X and X brings it back.
      window.location.href = authorizeUrl;
    } catch (e) {
      setNotice(describeCreatorError(e));
      setBusy(false);
    }
  }

  return (
    <Section label="Step three" title="X account">
      <p className="text-tiny text-text-muted">Listings publish under this handle.</p>

      {loading ? (
        <div className="mt-6">
          <Loading what="your X account" />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {status?.configured === false ? (
            <Notice>Linking X is not set up on this deployment yet.</Notice>
          ) : status?.linked ? (
            <Linked status={status} onRelink={() => void link()} busy={busy} />
          ) : (
            <>
              <p className="text-small text-text-muted">Read-only: handle, check mark, account age. HOLD can’t post.</p>
              <div>
                <button type="button" className={btnPrimary} disabled={busy} onClick={() => void link()}>
                  {busy ? "Taking you to X…" : "Connect X"}
                </button>
              </div>
            </>
          )}

          {notice ? <Notice>{notice}</Notice> : null}
        </div>
      )}
    </Section>
  );
}

function Linked({
  status,
  onRelink,
  busy,
}: {
  status: Extract<XAccountStatus, { linked: true }>;
  onRelink: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-body text-text">@{status.handle}</p>
          {status.name ? <p className="text-tiny text-text-faint">{status.name}</p> : null}
        </div>
        <Status state={status.canPublish ? "done" : "todo"}>
          {status.canPublish ? "Ready to publish" : "Not ready yet"}
        </Status>
      </div>

      {status.refusal ? <p className="text-small text-text-muted">{refusalText(status.refusal)}</p> : null}

      {status.refusal === "x_relink_needed" || status.refusal === "x_not_verified" ? (
        <div>
          <button type="button" className={btnSmallSecondary} disabled={busy} onClick={onRelink}>
            {busy ? "Taking you to X…" : "Connect X again"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Each refusal in its own words.
 *
 * `x_account_too_new` is the one worth being careful with: it also covers an
 * account whose creation date X did not give us, and "we could not see how old
 * it is" is not "it is too new". Both end the same way, so the sentence says
 * the age we need rather than asserting anything about their account.
 */
export function refusalText(refusal: NonNullable<Extract<XAccountStatus, { linked: true }>["refusal"]>): string {
  switch (refusal) {
    case "x_not_verified":
      return "Needs a verified X account (Premium, business or government). Connect again once X shows the check mark.";
    case "x_account_too_new":
      return `Needs an X account at least ${MIN_X_ACCOUNT_AGE_DAYS} days old. We can’t see that age on yours yet.`;
    case "x_relink_needed":
      return "X needs to confirm this account again. Connect again.";
    case "x_not_linked":
      return "No X account is linked yet.";
  }
}
