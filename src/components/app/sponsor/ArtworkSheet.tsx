"use client";

/**
 * Spaces › Your spots › what goes on the spot you bought.
 *
 * ── THE GAP THIS CLOSES ──
 *
 * Paying was never the last step. A spot is a promise to print something, and
 * until the brand hands that something over and the creator approves it, the
 * board shows an empty square that somebody has already been charged for.
 *
 * The console used to end at the payment and send the brand out to the
 * listing's own public page to finish. That page is built for a stranger: it
 * proves the spot is yours with a checkout key in one browser's localStorage,
 * so a brand that paid on their laptop could not finish on their phone, and a
 * cleared browser could not finish at all. With an account, the order is the
 * proof and it follows the account.
 *
 * ── WHY THE RULES ARE NOT IN THIS FILE ──
 *
 * `@/lib/ad-space/content-form` holds what is valid, what the body looks like
 * and what to say when it is not, and the public form reads the same module.
 * The two screens cannot share markup — this one is the app's dark ground, the
 * other is the creator's own — but a brand must not be told a QR needs a real
 * link on one and not the other.
 *
 * ── THE SIGNED LINK ──
 *
 * An uploaded image stays private until the creator approves it, and the `url`
 * the upload answers is signed and dies within the hour. So it is shown and
 * never stored: what is kept is the `path`, which is the only thing the
 * content body wants.
 */

import { useEffect, useState, type FormEvent } from "react";

import {
  KIND_HINT,
  NAME_MAX,
  TEXT_MAX,
  buildContentBody,
  describeImageProblem,
  needsImage,
  validateContent,
} from "@/lib/ad-space/content-form";
import { ImageProblem, prepareImage } from "@/lib/ad-space/image";
import type { ContentKind } from "@/lib/ad-space/types";
import { sendArtwork, uploadOrderImage, type MyOrder } from "@/lib/app/sponsor";
import { listingSpots } from "@/lib/app/storefront";
import { CreatorApiError } from "@/lib/creator/api";

import { Ion } from "../ion";
import { Chip, ChipRow, Divider, Field, fieldLabel, inputCls } from "../spaces/kit";
import { Sheet } from "./SponsorFlow";

const KIND_LABEL: Record<ContentKind, string> = { logo: "Logo", qr: "QR code", text: "Text", photo: "Photo" };

/** What the creator has done with what was sent, in the brand's words. */
function reviewLine(status: MyOrder["contentStatus"], creator: string): string | null {
  if (status === "approved") return "Approved. It is on the board.";
  if (status === "pending") return `Waiting for ${creator} to approve it. You can send a new version while you wait.`;
  if (status === "rejected") return `${creator} asked for a change. Send a new version below.`;
  return null;
}

export function ArtworkSheet({
  order,
  onClose,
  onSent,
}: {
  order: MyOrder;
  onClose: () => void;
  /** So the list behind the sheet can show the new state without re-reading everything. */
  onSent: (status: NonNullable<MyOrder["contentStatus"]>) => void;
}) {
  /*
   * Which kinds this spot takes lives on the POSITION, not on the order, so it
   * is read from the listing. A read that fails is not a reason to block the
   * hand-over: `logo` is what every space accepts, and the server refuses
   * anything it does not, which is the honest fallback.
   */
  const [accepts, setAccepts] = useState<ContentKind[] | null>(null);
  /* Read from the same listing as `accepts`, so the copy names a person rather than "the creator". */
  const [creatorName, setCreatorName] = useState("The creator");
  const [kind, setKind] = useState<ContentKind>("logo");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [xHandle, setXHandle] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [status, setStatus] = useState(order.contentStatus);

  useEffect(() => {
    let alive = true;
    listingSpots(order.spaceId).then(
      (space) => {
        if (!alive) return;
        const mine = space.positions.find((p) => p.id === order.positionId);
        const kinds = mine?.accepts?.length ? mine.accepts : (["logo"] as ContentKind[]);
        setAccepts(kinds);
        setKind(kinds[0]);
        if (space.creator?.xHandle) setCreatorName(`@${space.creator.xHandle}`);
      },
      () => alive && setAccepts(["logo"]),
    );
    return () => {
      alive = false;
    };
  }, [order.spaceId, order.positionId]);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const draft = { kind, name, url, xHandle, text, hasFile: file !== null };
  const wantsImage = needsImage(kind);
  const kinds = accepts ?? ["logo"];

  async function submit(e: FormEvent) {
    e.preventDefault();
    setNotice(null);
    const problem = validateContent(draft);
    if (problem) {
      setNotice(problem);
      return;
    }

    setBusy(true);
    try {
      let imagePath: string | undefined;
      if (wantsImage && file) {
        const blob = await prepareImage(file, { keepTransparency: kind === "logo" });
        imagePath = (await uploadOrderImage(order.id, blob)).path;
      }
      const res = await sendArtwork(order.id, buildContentBody(draft, imagePath));
      const next = res.content?.status ?? "pending";
      setStatus(next);
      onSent(next);
    } catch (err) {
      if (err instanceof ImageProblem) {
        setNotice(describeImageProblem(err.reason));
      } else if (err instanceof CreatorApiError && err.status === 422) {
        setNotice("Something in the form was not accepted. Check the name, link and image, then send it again.");
      } else if (err instanceof CreatorApiError && err.status === 0) {
        setNotice("We could not reach HOLD. Check your connection and send it again.");
      } else {
        setNotice("That did not go through. Try again in a moment.");
      }
    } finally {
      setBusy(false);
    }
  }

  const line = reviewLine(status, creatorName);

  return (
    <Sheet title="What goes on your spot" crumb={order.spaceTitle} onBack={null} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4 pb-2" noValidate>
        {line ? (
          <p
            role="status"
            className={`flex items-start gap-2 rounded-[14px] border px-3.5 py-3 text-[13px] leading-[18px] ${
              status === "approved"
                ? "border-white/[0.14] bg-white/[0.06] text-white/[0.82]"
                : "border-amber/30 bg-amber/[0.06] text-white/[0.82]"
            }`}
          >
            <Ion
              name={status === "approved" ? "checkmark-circle-outline" : "time-outline"}
              size={15}
              className={`mt-[1px] shrink-0 ${status === "approved" ? "text-white/60" : "text-amber"}`}
            />
            {line}
          </p>
        ) : (
          <p className="text-[13px] leading-[18px] text-white/65">
            {creatorName} approves it before it shows on the board. You can send a new version at any time.
          </p>
        )}

        <Field label="Name to credit">
          <input
            className={inputCls}
            value={name}
            maxLength={NAME_MAX}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme"
            autoComplete="organization"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Link (optional)">
            <input
              className={inputCls}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://acme.xyz"
              inputMode="url"
              autoComplete="url"
            />
          </Field>
          <Field label="X handle (optional)">
            <input
              className={inputCls}
              value={xHandle}
              onChange={(e) => setXHandle(e.target.value)}
              placeholder="@acme"
              autoCapitalize="none"
              spellCheck={false}
            />
          </Field>
        </div>

        {kinds.length > 1 ? (
          <ChipRow label="What to print">
            {kinds.map((k) => (
              <Chip key={k} label={KIND_LABEL[k]} selected={kind === k} onClick={() => setKind(k)} />
            ))}
          </ChipRow>
        ) : null}
        <p className="text-[12px] leading-[17px] text-white/55">{KIND_HINT[kind]}</p>

        {wantsImage ? (
          <div className="flex flex-col gap-2">
            <span className={fieldLabel}>{kind === "logo" ? "Logo" : "Photo"}</span>
            <div className="flex items-center gap-3">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-white">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                  <img src={preview} alt="" className="h-full w-full object-contain" />
                ) : (
                  <Ion name="image-outline" size={20} className="text-[#0A1420]/35" />
                )}
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="min-w-0 text-[12.5px] text-white/70 file:mr-3 file:h-9 file:rounded-[17px] file:border file:border-solid file:border-white/[0.14] file:bg-white/[0.06] file:px-3.5 file:text-[12.5px] file:font-bold file:text-white"
              />
            </div>
            <span className="text-[12px] leading-[17px] text-white/55">
              PNG, JPEG or WebP. We straighten and shrink it before sending.
            </span>
          </div>
        ) : null}

        {kind === "qr" ? (
          <Field label="Link the QR code opens">
            <input
              className={inputCls}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="https://acme.xyz/r/coin"
              inputMode="url"
            />
          </Field>
        ) : null}

        {kind === "text" ? (
          <Field label="Line to print">
            <input
              className={inputCls}
              value={text}
              maxLength={TEXT_MAX}
              onChange={(e) => setText(e.target.value)}
              placeholder="CODE10"
            />
          </Field>
        ) : null}

        {notice ? (
          <p role="status" className="rounded-[14px] border border-amber/30 bg-amber/[0.06] px-3.5 py-3 text-[13px] leading-[18px] text-white/[0.82]">
            {notice}
          </p>
        ) : null}

        <Divider />

        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-12 items-center justify-center rounded-[14px] bg-amber text-[15px] font-bold text-text-on-amber transition-colors hover:bg-amber-glow disabled:bg-white/[0.12] disabled:text-white/50"
        >
          {busy ? "Sending…" : status ? "Send a new version" : "Send for approval"}
        </button>
      </form>
    </Sheet>
  );
}
