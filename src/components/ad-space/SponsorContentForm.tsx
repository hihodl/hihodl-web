"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import {
  CheckoutError,
  describeError,
  putContent,
  spaceForCheckout,
  uploadMedia,
  type ContentBody,
} from "@/lib/ad-space/checkout-client";
import { CONTENT_KIND_LABEL } from "@/lib/ad-space/format";
import { ImageProblem, prepareImage } from "@/lib/ad-space/image";
import type { ContentKind, Order, Position, Sponsor } from "@/lib/ad-space/types";

import { btnPrimary, input } from "./ui";

/**
 * What goes on the spot, handed over after the payment.
 *
 * The image is uploaded first (raw bytes, re-encoded upright in the browser),
 * then the content is PUT with the returned path. Nothing appears on the
 * public board until the creator approves it, and the form can be sent again
 * while it is pending or after a rejection.
 *
 * Where it stands is read back from `GET /public/spaces/:id` with the checkout
 * key: only this browser's own position carries `content` there, plus the
 * pending sponsor block. Until the creator approves it the image is private,
 * and its `imageUrl` is a signed link that dies within the hour. So the URL is
 * never kept: the space is read again on mount, after each send, when the tab
 * comes back into view, and once if the image fails to load.
 */

type Review = NonNullable<Position["content"]>;

const KIND_HINT: Record<ContentKind, string> = {
  logo: "Your logo, printed on the spot. PNG with a transparent background works best.",
  qr: "A QR code that opens your link. We draw the code; you give us the link.",
  text: "A short line printed on the spot, like a promo code.",
  photo: "A photo printed on the spot.",
};

// TODO(contract): no maximum lengths are published for sponsorName or
// contentText. These are generous guesses; the server's validation is the
// real limit.
const NAME_MAX = 60;
const TEXT_MAX = 140;

export function SponsorContentForm({
  order,
  checkoutKey,
  accepts,
  creatorHandle,
}: {
  order: Order;
  checkoutKey: string;
  accepts: ContentKind[];
  creatorHandle: string;
}) {
  const kinds = accepts.length ? accepts : (["logo"] as ContentKind[]);
  const [kind, setKind] = useState<ContentKind>(kinds[0]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [xHandle, setXHandle] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [sentAs, setSentAs] = useState<Sponsor | null>(null);
  const [imageRetried, setImageRetried] = useState(false);

  const loadReview = useCallback(async () => {
    try {
      const space = await spaceForCheckout(order.spaceId, checkoutKey);
      const mine = space.positions.find((p) => p.id === order.positionId);
      setReview(mine?.content ?? null);
      setSentAs(mine?.sponsor ?? null);
    } catch {
      // Not knowing the review state is fine; the form still works.
    }
  }, [order.spaceId, order.positionId, checkoutKey]);

  useEffect(() => {
    void loadReview();
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadReview();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loadReview]);

  const needsImage = kind === "logo" || kind === "photo";

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  function validate(): string | null {
    if (!name.trim()) return "Add the name the creator should credit.";
    if (url.trim() && !/^https?:\/\/\S+\.\S+/i.test(url.trim())) {
      return "The link should start with https:// and be a full web address.";
    }
    if (xHandle.trim() && !/^@?[A-Za-z0-9_]{1,15}$/.test(xHandle.trim())) {
      return "An X handle is up to 15 letters, numbers or underscores.";
    }
    if (needsImage && !file) return `Choose the ${kind === "logo" ? "logo" : "photo"} to print.`;
    if (kind === "qr" && !/^https?:\/\/\S+\.\S+/i.test(text.trim())) {
      return "Give the QR code a full link that starts with https://.";
    }
    if (kind === "text" && !text.trim()) return "Write the line to print.";
    return null;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setNotice(null);
    const problem = validate();
    if (problem) {
      setNotice(problem);
      return;
    }

    setBusy(true);
    try {
      let imagePath: string | undefined;
      if (needsImage && file) {
        const blob = await prepareImage(file, { keepTransparency: kind === "logo" });
        // The response's `url` is a signed preview that expires; only the
        // path is kept. The preview comes back through `loadReview`.
        imagePath = (await uploadMedia(order.id, checkoutKey, blob)).path;
      }
      const body: ContentBody = {
        sponsorName: name.trim(),
        contentKind: kind,
        ...(url.trim() ? { sponsorUrl: url.trim() } : {}),
        ...(xHandle.trim() ? { xHandle: xHandle.trim().replace(/^@/, "") } : {}),
        ...(kind === "qr" || kind === "text" ? { contentText: text.trim() } : {}),
        ...(imagePath ? { imagePath } : {}),
      };
      const res = await putContent(order.id, checkoutKey, body);
      setReview({ status: res.content?.status ?? "pending", rejectedReason: res.content?.rejectedReason ?? null });
      setImageRetried(false);
      void loadReview();
    } catch (err) {
      if (err instanceof ImageProblem) {
        setNotice(
          err.reason === "type"
            ? "Use a PNG, JPEG or WebP image."
            : err.reason === "too_big"
              ? "That image is too large even after shrinking it. Try a smaller one."
              : "We couldn't read that image. Try another file.",
        );
      } else if (err instanceof CheckoutError && err.status === 422) {
        // TODO(contract): content validation codes are not listed in the
        // contract. Until they are, a 422 here gets one honest sentence.
        setNotice("Something in the form wasn't accepted. Check the name, link and image, then send it again.");
      } else {
        setNotice(describeError(err, order.chain));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <div>
        <h3 className="text-body text-text">What goes on your spot</h3>
        <p className="mt-1 text-small text-text-muted">
          @{creatorHandle} approves it before it shows on the board. Come back in this same browser to check on it
          or send a new version: this browser is what proves the spot is yours.
        </p>
      </div>

      {review?.status === "approved" && (
        <p className="rounded-card border border-success/30 bg-success/[0.06] px-4 py-3 text-small text-text-muted" role="status">
          Approved. It&rsquo;s on the board.
        </p>
      )}
      {review?.status === "pending" && (
        <p className="rounded-card border border-[color:var(--color-hairline-strong)] bg-white/[0.03] px-4 py-3 text-small text-text-muted" role="status">
          Waiting for @{creatorHandle}&rsquo;s approval. It appears on the board once they approve it, and you can send
          a new version while you wait.
        </p>
      )}
      {review && sentAs && (
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-tight bg-white">
            {sentAs.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived preview link
              <img
                src={sentAs.imageUrl}
                alt=""
                className="h-full w-full object-contain"
                onError={() => {
                  // The signed link has probably expired: read the space once more.
                  if (imageRetried) return;
                  setImageRetried(true);
                  void loadReview();
                }}
              />
            ) : (
              <span className="text-body font-medium text-text-on-amber">{sentAs.name.slice(0, 1).toUpperCase()}</span>
            )}
          </span>
          <p className="min-w-0 text-small text-text-muted">
            You sent <span className="text-text">{sentAs.name}</span>
            {sentAs.contentText ? <span className="font-mono"> · {sentAs.contentText}</span> : null}
          </p>
        </div>
      )}
      {review?.status === "rejected" && (
        <p className="rounded-card border border-amber/30 bg-amber/[0.05] px-4 py-3 text-small text-text-muted" role="status">
          @{creatorHandle} asked for a change
          {review.rejectedReason ? (
            <>
              : <span className="text-text">&ldquo;{review.rejectedReason}&rdquo;</span>
            </>
          ) : null}
          . Send a new version below.
        </p>
      )}

      <label className="flex flex-col gap-2">
        <span className="text-small text-text-muted">Name to credit</span>
        <input
          className={input}
          value={name}
          maxLength={NAME_MAX}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme"
          autoComplete="organization"
        />
      </label>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-small text-text-muted">Link (optional)</span>
          <input
            className={input}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://acme.xyz"
            inputMode="url"
            autoComplete="url"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-small text-text-muted">X handle (optional)</span>
          <input
            className={input}
            value={xHandle}
            onChange={(e) => setXHandle(e.target.value)}
            placeholder="@acme"
            autoCapitalize="none"
            spellCheck={false}
          />
        </label>
      </div>

      {kinds.length > 1 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-small text-text-muted">What to print</legend>
          <div className="flex flex-wrap gap-2">
            {kinds.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                className={`inline-flex h-10 items-center whitespace-nowrap rounded-[20px] border px-4 text-small transition-colors duration-180 ${
                  kind === k
                    ? "border-amber bg-amber/10 text-text"
                    : "border-[color:var(--color-hairline-strong)] text-text-muted hover:text-text"
                }`}
              >
                {CONTENT_KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <p className="-mt-2 text-tiny text-text-faint">{KIND_HINT[kind]}</p>

      {needsImage && (
        <label className="flex flex-col gap-2">
          <span className="text-small text-text-muted">{kind === "logo" ? "Logo" : "Photo"}</span>
          <span className="flex items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-tight bg-white">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                <img src={preview} alt="" className="h-full w-full object-contain" />
              ) : (
                <span className="text-tiny text-text-on-amber/50">None</span>
              )}
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="min-w-0 text-small text-text-muted file:mr-3 file:h-10 file:rounded-[20px] file:border file:border-solid file:border-[color:var(--color-hairline-strong)] file:bg-transparent file:px-4 file:text-small file:text-text"
            />
          </span>
          <span className="text-tiny text-text-faint">PNG, JPEG or WebP. We straighten and shrink it before sending.</span>
        </label>
      )}

      {kind === "qr" && (
        <label className="flex flex-col gap-2">
          <span className="text-small text-text-muted">Link the QR code opens</span>
          <input
            className={input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="https://acme.xyz/r/coin"
            inputMode="url"
          />
        </label>
      )}

      {kind === "text" && (
        <label className="flex flex-col gap-2">
          <span className="text-small text-text-muted">Line to print</span>
          <input
            className={input}
            value={text}
            maxLength={TEXT_MAX}
            onChange={(e) => setText(e.target.value)}
            placeholder="CODE10"
          />
        </label>
      )}

      {notice && (
        <p className="rounded-card border border-amber/30 bg-amber/[0.05] px-4 py-3 text-small text-text-muted" role="status">
          {notice}
        </p>
      )}

      <div>
        <button type="submit" className={btnPrimary} disabled={busy}>
          {busy ? "Sending…" : review ? "Send a new version" : "Send for approval"}
        </button>
      </div>
    </form>
  );
}
