"use client";

/**
 * The partner's link: the text, Copy, the QR with PNG and SVG downloads, and
 * renaming the link in place. A rename keeps every older link working
 * (previousSlugs on the server), which the card says, so nobody hesitates to
 * fix a name on printed flyers.
 */

import { useState } from "react";

import { QrCode } from "@/components/ad-space/qr";
import { normaliseSlug, partnerErrorText, updatePartner, type Partner, type PartnerMe } from "@/lib/app/partners";

import { CopyButton } from "../front/kit";
import { HoldCard } from "../hold";
import { Ion } from "../ion";
import { Alert } from "../ui";
import { inputCls, QrDownloads, SlugLine, slugReady, useSlugCheck } from "./kit";

const smallBtn =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-[20px] border border-white/[0.14] bg-white/[0.08] px-4 text-[14px] font-bold text-white transition-colors hover:bg-white/[0.14] disabled:cursor-not-allowed disabled:opacity-50";

export function LinkCard({ partner, link, onSaved, canEdit = true }: { partner: Partner; link: string; onSaved: (me: PartnerMe) => void; canEdit?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(partner.slug);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const check = useSlugCheck(editing ? raw : "", partner.slug);
  const changed = normaliseSlug(raw) !== partner.slug;
  const canSave = editing && changed && slugReady(check, raw, partner.slug) && !busy;

  async function save() {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      const me = await updatePartner({ slug: normaliseSlug(raw) });
      onSaved(me);
      setEditing(false);
    } catch (e) {
      setError(partnerErrorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <HoldCard className="p-5">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold uppercase tracking-[0.6px] text-white/55">Your link</p>
          {editing ? (
            <div className="mt-2">
              <div className="flex items-center gap-2">
                <span className="hidden shrink-0 text-[14px] text-white/55 sm:inline">hihodl.xyz/invite/</span>
                <input
                  className={inputCls}
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                  maxLength={40}
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-label="Link name"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void save();
                    if (e.key === "Escape") setEditing(false);
                  }}
                />
              </div>
              <SlugLine raw={raw} check={check} current={partner.slug} />
              {error ? (
                <div className="mt-3">
                  <Alert>{error}</Alert>
                </div>
              ) : null}
              <div className="mt-3 flex gap-2">
                <button type="button" className={`${smallBtn} border-amber bg-amber text-[#0F0F1A] hover:bg-amber`} disabled={!canSave} onClick={() => void save()}>
                  {busy ? "Saving" : "Save"}
                </button>
                <button
                  type="button"
                  className={smallBtn}
                  onClick={() => {
                    setEditing(false);
                    setRaw(partner.slug);
                    setError(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="mt-2 break-all text-[17px] font-bold text-white">{link.replace(/^https?:\/\//, "")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <CopyButton value={link} className={smallBtn} />
                {canEdit ? (
                <button
                  type="button"
                  className={smallBtn}
                  onClick={() => {
                    setRaw(partner.slug);
                    setEditing(true);
                  }}
                >
                  <Ion name="create-outline" size={16} />
                  Edit link name
                </button>
                ) : null}
              </div>
            </>
          )}
          <p className="mt-3 text-[12.5px] leading-[18px] text-white/55">
            Old links keep working when you rename it. Everyone who signs up through any of them counts for you for{" "}
            {partner.attributionMonths} months.
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-center gap-3 sm:w-[168px]">
          <div className="w-[168px] overflow-hidden rounded-[16px] bg-white p-1.5">
            <QrCode text={link} title={`QR code for ${link}`} className="block h-auto w-full" />
          </div>
          <QrDownloads text={link} name={`hold-${link.split("/").pop() || partner.slug}-qr`} />
        </div>
      </div>
    </HoldCard>
  );
}
