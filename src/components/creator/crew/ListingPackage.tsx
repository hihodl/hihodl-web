/**
 * "Sell with other creators", on one listing: the listing becomes a package
 * that several creators sell together, and the brand's one payment pays each
 * of them their part.
 *
 * Everything happens here, without going to Spaces › Crew and back: make the
 * package (a crew, named after the listing), add creators by HOLD username or
 * X handle or by an invite link, set each share while the lead's own part
 * updates, and see why it can't sell yet. Or pick a crew this creator already
 * leads. The app's `ListingPackage` is this component, in the same order and
 * with the same words.
 *
 * ORDER OF CALLS
 *
 * It is only ever mounted on a listing that exists: the runner, and the
 * wizard's last card, which the draft reaches already saved. A new package is
 * `POST /crews` and then `PUT /spaces/:id/crew`; if the second fails the
 * listing and the crew both exist, unattached, and the card says so with
 * Retry. Only crews this creator leads are offered: the backend refuses the
 * rest (`crew_lead_only`).
 *
 * Solana only: on a crew listing the page offers no other network.
 */

"use client";

import { useCallback, useEffect, useState } from "react";

import { useHref, useProductHref } from "@/components/app/base";
import { ctaPrimary, ctaSecondary, Notice as HoldNotice } from "@/components/app/hold";
import { Ion } from "@/components/app/ion";
import { AddCreatorForm, EditableMember, fine, LinkCard, LinkForm, sheetCls, sheetTitle } from "@/components/app/spaces/CrewParts";
import { Body, Card, Divider, Empty, Field, inputCls, SheetRow, Tag } from "@/components/app/spaces/kit";
import {
  createCrew,
  CREW_LIMITS,
  describeCrewError,
  myCrews,
  notReadyText,
  othersBps,
  setListingCrew,
  whoText,
  type Crew,
} from "@/lib/creator/crew";
import { crewOfListing, defaultPackageName, roomFor } from "@/lib/creator/crew-package";
import { useT } from "@/lib/app/i18n/react";

type Adding = "none" | "creator" | "link";

export function ListingPackage({
  spaceId,
  title,
  offersSolana = true,
  onChanged,
}: {
  spaceId: string;
  /** The listing's title: the new package's name until the lead types another. */
  title: string;
  /** False when the listing is not offered on Solana, the one network a crew is paid on. */
  offersSolana?: boolean;
  onChanged?: () => void;
}) {
  const t = useT();
  const href = useHref();
  const productHref = useProductHref();
  const [crews, setCrews] = useState<Crew[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** An attach that failed, kept so Retry sends the same call again. */
  const [unattached, setUnattached] = useState<{ crewId: string | null } | null>(null);
  const [making, setMaking] = useState(false);
  const [adding, setAdding] = useState<Adding>("none");
  const [link, setLink] = useState<{ url: string; code: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const { crews: list } = await myCrews();
      setCrews(list.filter((c) => c.youAreLead));
    } catch (e) {
      setCrews((c) => c ?? []);
      setNotice(describeCrewError(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const current = crews ? crewOfListing(crews, spaceId) : null;
  const patch = (next: Crew) => setCrews((list) => (list ?? []).map((c) => (c.id === next.id ? next : c)));

  const attach = async (crewId: string | null) => {
    setBusy(crewId ?? "none");
    setNotice(null);
    setUnattached(null);
    try {
      await setListingCrew(spaceId, crewId);
      await load();
      onChanged?.();
    } catch (e) {
      setUnattached({ crewId });
      setNotice(describeCrewError(e));
    } finally {
      setBusy(null);
    }
  };

  if (crews === null) return <Empty icon="hourglass-outline" title={t("common.loading")} />;

  const others = current ? othersBps(current.members) : 0;
  const room = current ? roomFor(current.members) : 0;

  return (
    <div className="flex flex-col gap-2.5">
      <Card>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[16px] font-strong tracking-[-0.2px] text-white">{t("creator.package.title")}</p>
          <Tag label={t("creator.package.solanaOnly")} tone="dim" />
        </div>
        <Body dim>{t("creator.package.body")}</Body>
      </Card>

      {notice ? <HoldNotice>{notice}</HoldNotice> : null}
      {unattached ? (
        <div className={sheetCls}>
          <Body dim>
            {unattached.crewId
              ? t("creator.package.notAttached")
              : t("creator.package.stillAttached")}
          </Body>
          <button type="button" className={ctaSecondary} disabled={busy !== null} onClick={() => void attach(unattached.crewId)}>
            {busy !== null ? t("creator.package.trying") : t("common.retry")}
          </button>
        </div>
      ) : null}

      {current ? (
        <>
          <Card>
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[15px] font-strong text-white">{current.name}</p>
              <Tag label={current.ready ? t("creator.package.selling") : t("creator.package.notSelling")} tone={current.ready ? "good" : "caution"} />
            </div>
            {!current.ready && current.notReady ? <p className="text-[12px] font-strong leading-[17px] text-amber">{notReadyText(current.notReady)}</p> : null}
            {current.members.map((m) => (
              <div key={m.id} className="flex flex-col gap-2.5">
                <Divider />
                <EditableMember crew={current} member={m} othersBps={others} onChanged={patch} />
              </div>
            ))}
          </Card>

          {!offersSolana ? (
            <HoldNotice>{t("creator.package.noSolana")}</HoldNotice>
          ) : null}

          {link ? (
            <LinkCard url={link.url} code={link.code} onClose={() => setLink(null)} />
          ) : adding === "creator" ? (
            <AddCreatorForm
              crew={current}
              othersBps={others}
              onCancel={() => setAdding("none")}
              onAdded={(c) => {
                patch(c);
                setAdding("none");
              }}
            />
          ) : adding === "link" ? (
            <LinkForm
              crew={current}
              othersBps={others}
              onCancel={() => setAdding("none")}
              onMade={(c, url, code) => {
                patch(c);
                setAdding("none");
                setLink({ url, code });
              }}
            />
          ) : room > 0 ? (
            <div className="flex gap-2">
              <button type="button" className={`${ctaPrimary} flex-1`} onClick={() => setAdding("creator")}>
                <Ion name="person-add-outline" size={18} />
                {t("spaces.crew.addCreator")}
              </button>
              <button type="button" className={`${ctaSecondary} flex-1`} onClick={() => setAdding("link")}>
                <Ion name="link-outline" size={18} />
                {t("creator.package.inviteLink")}
              </button>
            </div>
          ) : (
            <HoldNotice tone="calm">{t("creator.package.full", { max: CREW_LIMITS.MAX_MEMBERS })}</HoldNotice>
          )}

          {current.groupId ? (
            <SheetRow
              icon="chatbubbles-outline"
              title={t("spaces.crew.groupRow")}
              meta={t("spaces.crew.groupLine")}
              href={productHref(`/payments/groups/${encodeURIComponent(current.groupId)}?crew=${current.id}`)}
            />
          ) : (
            <p className={fine}>{t("spaces.crew.groupLine")}</p>
          )}

          <div className="flex items-center justify-between gap-3 px-1">
            <button type="button" className="text-[13px] font-strong text-white/[0.62] underline" disabled={busy !== null} onClick={() => void attach(null)}>
              {busy === "none" ? t("common.saving") : t("creator.package.onMyOwn")}
            </button>
            <a href={`${href("/crew")}?crew=${current.id}`} className="text-[13px] font-strong text-white/[0.62] underline">
              {t("creator.package.openInCrew")}
            </a>
          </div>
        </>
      ) : (
        <>
          {crews.length ? (
            <Card>
              <p className="text-[12px] font-strong text-white/55">{t("spaces.crew.yourCrews")}</p>
              {crews.map((c, i) => (
                <div key={c.id} className="flex flex-col gap-2.5">
                  {i > 0 ? <Divider /> : null}
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void attach(c.id)}
                    className="flex items-center gap-3 text-left"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-[15px] font-strong text-white">{c.name}</span>
                      <span className={`${fine} truncate`}>{c.members.map((m) => `${whoText(m)} ${m.share}`).join(" · ")}</span>
                    </span>
                    {busy === c.id ? <span className={fine}>{t("common.saving")}</span> : <Ion name="add-circle-outline" size={20} className="shrink-0 text-white/55" />}
                  </button>
                </div>
              ))}
            </Card>
          ) : null}

          {making ? (
            <NewPackage
              title={title}
              onCancel={() => setMaking(false)}
              onMade={async (crew) => {
                setCrews((list) => [crew, ...(list ?? []).filter((c) => c.id !== crew.id)]);
                setMaking(false);
                await attach(crew.id);
                setAdding("creator");
              }}
            />
          ) : (
            <button type="button" className={crews.length ? ctaSecondary : ctaPrimary} onClick={() => setMaking(true)}>
              <Ion name="add" size={18} />
              {t("creator.package.new")}
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** A crew made on the spot, named after the listing, with what the lead brings. */
function NewPackage({ title, onCancel, onMade }: { title: string; onCancel: () => void; onMade: (c: Crew) => Promise<void> }) {
  const t = useT();
  const [name, setName] = useState(() => defaultPackageName(title));
  const [service, setService] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <div className={sheetCls}>
      <p className={sheetTitle}>{t("creator.package.new")}</p>
      <Field label={t("creator.package.nameLabel")} hint={t("spaces.crew.nameHint")} htmlFor="pkg-name">
        <input id="pkg-name" className={inputCls} value={name} maxLength={CREW_LIMITS.NAME_MAX} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label={t("spaces.crew.youBringLabel")} hint={t("creator.package.youBringHint")} htmlFor="pkg-service">
        <input
          id="pkg-service"
          className={inputCls}
          autoFocus
          value={service}
          maxLength={CREW_LIMITS.SERVICE_MAX}
          onChange={(e) => setService(e.target.value)}
          placeholder={t("spaces.crew.youBringPlaceholder")}
        />
      </Field>
      {notice ? <HoldNotice>{notice}</HoldNotice> : null}
      <div className="flex gap-2">
        <button type="button" className={`${ctaSecondary} flex-1`} disabled={busy} onClick={onCancel}>
          {t("common.cancel")}
        </button>
        <button
          type="button"
          className={`${ctaPrimary} flex-1`}
          disabled={busy || !name.trim() || !service.trim()}
          onClick={() => {
            setBusy(true);
            setNotice(null);
            void createCrew(name.trim(), service.trim())
              .then(({ crew }) => onMade(crew))
              .catch((e) => {
                setNotice(describeCrewError(e));
                setBusy(false);
              });
          }}
        >
          {busy ? t("creator.package.making") : t("creator.package.make")}
        </button>
      </div>
    </div>
  );
}
