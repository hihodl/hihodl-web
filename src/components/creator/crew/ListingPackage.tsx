/**
 * "Sell as a crew", on one listing: which of the creator's crews this listing
 * is sold as, or none.
 *
 * Sold as a crew, the brand's one payment is split among everyone in it, each
 * to their own wallet, and the page shows who is in the crew and what each
 * brings. Only crews this creator leads are offered: the backend refuses the
 * rest (`crew_lead_only`). A crew still agreeing can be chosen; brands simply
 * cannot buy until everybody has said yes, and this card says so.
 *
 * Solana only: on a crew listing the page offers no other network.
 */

"use client";

import { useCallback, useEffect, useState } from "react";

import { useHref } from "@/components/app/base";
import { ctaSecondary, Notice as HoldNotice } from "@/components/app/hold";
import { Ion } from "@/components/app/ion";
import { Body, Card, Divider, Empty, SheetRow } from "@/components/app/spaces/kit";
import { describeCrewError, myCrews, notReadyText, setListingCrew, whoText, type Crew } from "@/lib/creator/crew";

const fine = "text-[12px] leading-[17px] text-white/55";

export function ListingCrew({ spaceId, onChanged }: { spaceId: string; onChanged: () => void }) {
  const href = useHref();
  const [crews, setCrews] = useState<Crew[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { crews: list } = await myCrews();
      setCrews(list.filter((c) => c.youAreLead));
    } catch (e) {
      setCrews([]);
      setNotice(describeCrewError(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const current = crews?.find((c) => c.spaces.some((s) => s.id === spaceId)) ?? null;

  const choose = (crewId: string | null) => {
    setBusy(crewId ?? "none");
    setNotice(null);
    void setListingCrew(spaceId, crewId)
      .then(async () => {
        await load();
        onChanged();
      })
      .catch((e) => setNotice(describeCrewError(e)))
      .finally(() => setBusy(null));
  };

  if (crews === null) return <Empty icon="hourglass-outline" title="Loading…" />;

  return (
    <div className="flex flex-col gap-2.5">
      <Card>
        <p className="text-[16px] font-strong tracking-[-0.2px] text-white">One package, one payment, everyone paid</p>
        <Body dim>
          Sold as a crew, the brand pays once and each person in the crew gets their part in their own wallet, in that same payment. The page
          shows who is in it and what each brings. Crew listings are paid on Solana.
        </Body>
      </Card>

      {notice ? <HoldNotice>{notice}</HoldNotice> : null}

      {crews.length === 0 ? (
        <Empty
          icon="people-outline"
          title="You don't lead a crew yet"
          body="Start one in Crew, add the creators you work with, then come back here."
          action={
            <a href={href("/crew")} className={ctaSecondary}>
              Go to Crew
            </a>
          }
        />
      ) : (
        <Card>
          {crews.map((c, i) => {
            const on = current?.id === c.id;
            return (
              <div key={c.id} className="flex flex-col gap-2.5">
                {i > 0 ? <Divider /> : null}
                <button
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={busy !== null}
                  onClick={() => choose(on ? null : c.id)}
                  className="flex items-center gap-3 text-left"
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[10px] border ${on ? "border-[#F1F5F9] bg-[#F1F5F9] text-[#0A1420]" : "border-white/35"}`}
                  >
                    {on ? <Ion name="checkmark" size={13} /> : null}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[15px] font-strong text-white">{c.name}</span>
                    <span className={fine}>{c.members.map((m) => `${whoText(m)} ${m.share}`).join(" · ")}</span>
                    {!c.ready ? <span className="text-[12px] font-strong text-amber">{notReadyText(c.notReady)}</span> : null}
                  </span>
                  {busy === c.id ? <span className={fine}>Saving…</span> : null}
                </button>
              </div>
            );
          })}
        </Card>
      )}

      {current ? (
        <SheetRow icon="people-outline" title={`Manage ${current.name}`} meta="Shares, who's in, and the expenses group" href={`${href("/crew")}?crew=${current.id}`} />
      ) : null}
      {current ? (
        <p className={fine}>Tap the chosen crew again to sell this listing on your own. Sales already paid keep the split they were paid with.</p>
      ) : null}
    </div>
  );
}
