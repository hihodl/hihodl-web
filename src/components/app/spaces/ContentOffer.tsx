"use client";

/**
 * "Offer them content": what the creator sends a brand that just paid for a
 * spot.
 *
 * What creators learned selling at TOKEN2049: the product is the hook, and
 * what the brand really buys is the creator's reach and the content they
 * make. Three of the brands that took a spot on one creator's suitcase asked
 * her for content too. So once a brand has paid, the sale carries a message
 * the creator can copy: what the brand bought, and content made for the
 * brand's own channels at the same event, linked to the creator's Content
 * production listing there when there is one.
 *
 * A template and nothing more: nothing is sent, nothing is stored. The
 * creator copies it and sends it where they already talk to the brand.
 */

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { SITE_URL } from "@/lib/ad-space/config";
import { eventDates } from "@/lib/ad-space/format";
import type { SpaceCard } from "@/lib/creator/listing";
import { useTemplates } from "@/lib/app/spaces-data";
import { t } from "@/lib/app/i18n";
import { useT } from "@/lib/app/i18n/react";

import { useHref } from "../base";
import { CopyButton } from "../front/kit";
import { Notice } from "../hold";
import { useShell } from "../Shell";
import { DrillBar } from "./cards";
import { Empty, emptyBtn, Group as Panel, Pills as FilterPills } from "./kit";

/** The app's Chip as the copy button: 34 high, radius half of it. */
const copyCls =
  "inline-flex h-[34px] shrink-0 items-center justify-center whitespace-nowrap rounded-[17px] border border-[#F1F5F9] bg-[#F1F5F9] px-[13px] text-[13.5px] font-bold text-[#0A1420] transition-opacity hover:opacity-90";

/** The catalog's Content production template. */
export const PRODUCTION_TEMPLATE = "content-production";

/** One brand that paid, and what for. */
export interface ContentLead {
  /** Unique per sale: the order, or the position that holds it. */
  key: string;
  brand: string;
  /** The spot or slot as the creator named it: "Front headline", "One dedicated video". */
  bought: string;
  /** A spot on a product, or a slot of a service. */
  kind: "placement" | "service";
  /** What it is on, in plain words: "carry-on suitcase", "short video". */
  product: string;
  /** The listing's own title, for the screen (never the message: it is the creator's headline, not a noun). */
  listing: string;
  event: { slug: string; name: string; city: string | null; startsOn: string | null; endsOn: string | null } | null;
}

/** Which templates are a production, and which are a session: neither gets the offer. And each one's name. */
export function useTemplateFormats(): {
  isProduction: (templateId: string) => boolean;
  isSession: (templateId: string) => boolean;
  nameOf: (templateId: string) => string | null;
} {
  const templates = useTemplates();
  return useMemo(() => {
    const list = templates.data?.templates ?? [];
    const format = new Map(list.map((t) => [t.id, t.service?.format ?? null]));
    const names = new Map(list.map((t) => [t.id, t.name]));
    return {
      isProduction: (id: string) => id === PRODUCTION_TEMPLATE || format.get(id) === "production",
      isSession: (id: string) => format.get(id) === "session",
      nameOf: (id: string) => names.get(id) ?? null,
    };
  }, [templates.data]);
}

/** "Front headline" → "front headline": a label read mid-sentence. */
export function midSentence(label: string): string {
  return /^[A-Z][a-z]/.test(label) ? label[0].toLowerCase() + label.slice(1) : label;
}

/** A sale on this listing can lead to content: not a production itself, not a session. */
export function useOffersContent(): (l: Pick<SpaceCard, "templateId"> | null | undefined) => boolean {
  const { isProduction, isSession } = useTemplateFormats();
  return useCallback((l) => !!l && !isProduction(l.templateId) && !isSession(l.templateId), [isProduction, isSession]);
}

/** The creator's own live Content production listing at this event, and its public link. */
export function useProductionAt(eventSlug: string | null): { listing: SpaceCard; url: string | null } | null {
  const { listings, x } = useShell();
  const { isProduction } = useTemplateFormats();
  const handle = x && x.linked ? x.handle : null;
  return useMemo(() => {
    if (!eventSlug) return null;
    const found = listings.find((l) => l.status === "live" && isProduction(l.templateId) && l.event?.slug === eventSlug) ?? null;
    if (!found) return null;
    return { listing: found, url: handle ? `${SITE_URL}/s/${encodeURIComponent(handle)}/${encodeURIComponent(found.slug)}` : null };
  }, [listings, eventSlug, handle, isProduction]);
}

export function contentOfferText(input: { lead: ContentLead; handle: string | null; productionUrl: string | null }): string {
  const { lead, handle, productionUrl } = input;
  const event = lead.event;
  const lines: string[] = [];
  const dates = event?.startsOn && event.endsOn ? eventDates(event.startsOn, event.endsOn) : "";
  // Where the content is made: nowhere named, at the event, or at the event on its dates.
  const vars = {
    brand: lead.brand,
    spot: midSentence(lead.bought),
    product: lead.product,
    event: event?.name ?? "",
    dates,
    hasEvent: event ? "yes" : "no",
    where: event ? (dates ? "dates" : "event") : "none",
  };
  lines.push(t("creator.content.msg.greeting", vars), "");
  if (lead.kind === "placement") {
    lines.push(t("creator.content.msg.placementThanks", vars));
    lines.push("");
    lines.push(t("creator.content.msg.placementOffer", vars));
  } else {
    lines.push(t("creator.content.msg.serviceThanks", vars));
    lines.push("");
    lines.push(t("creator.content.msg.serviceOffer", vars));
  }
  lines.push(productionUrl ? t("creator.content.msg.included", { url: productionUrl }) : t("creator.content.msg.tellMe"));
  if (handle) lines.push("", `@${handle}`);
  return lines.join("\n");
}

/**
 * The screen: which brand on the left, the message on the right, one Copy.
 * Opened from a sale (Sales) or from a listing's hub, each with its own Back.
 */
export function ContentOfferScreen({
  back,
  crumb,
  leads,
  initial,
}: {
  back: string;
  crumb: string;
  leads: readonly ContentLead[];
  initial?: string | null;
}) {
  const t = useT();
  const href = useHref();
  const { x } = useShell();
  // What was opened stays chosen even when the sales arrive after the screen does.
  const [picked, setKey] = useState<string | null>(null);
  const key = picked ?? initial ?? null;
  const lead = leads.find((l) => l.key === key) ?? leads[0] ?? null;
  const production = useProductionAt(lead?.event?.slug ?? null);
  const handle = x && x.linked ? x.handle : null;
  const text = lead ? contentOfferText({ lead, handle, productionUrl: production?.url ?? null }) : "";

  return (
    <div className="flex flex-col gap-3.5">
      <DrillBar back={back} crumb={crumb} title={t("creator.content.title")} right={text ? <CopyButton value={text} label={t("creator.content.copyMessage")} className={copyCls} /> : null} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:items-start">
        <Panel title={leads.length > 1 ? t("creator.content.whichBrand") : t("creator.content.theBrand")}>
          {leads.length > 1 ? (
            <FilterPills label={t("creator.brand.title")} value={lead?.key ?? ""} onChange={setKey} options={leads.slice(0, 12).map((l) => ({ value: l.key, label: l.brand }))} />
          ) : lead ? (
            <p className="text-[16px] font-strong tracking-[-0.2px] text-white">{lead.brand}</p>
          ) : null}
          {lead ? (
            <p className="text-[12.5px] font-strong text-white/55">
              {lead.bought} · {lead.listing}
            </p>
          ) : null}
          <div className="flex flex-col gap-3 border-t border-white/[0.08] pt-3 text-[13px] leading-[18px] text-white/[0.82]">
            {production ? (
              <p>
                {production.url
                  ? t("creator.content.linksYour", { event: lead?.event?.name ?? "" })
                  : t("creator.content.linkXToAdd", { event: lead?.event?.name ?? "" })}
              </p>
            ) : (
              <div className="flex flex-col items-start gap-3">
                <p>
                  {lead?.event
                    ? t("creator.content.noProductionAt", { event: lead.event.name })
                    : t("creator.content.withProduction")}
                </p>
                <Link href={href(`/listings/new?template=${PRODUCTION_TEMPLATE}`)} className={emptyBtn}>
                  {t("creator.content.createOne")}
                </Link>
              </div>
            )}
            <Notice tone="calm" icon="chatbubble-ellipses-outline">
              {t("creator.content.nothingSent")}
            </Notice>
          </div>
        </Panel>
        <Panel title={lead ? t("creator.content.forBrand", { brand: lead.brand }) : t("creator.content.yourMessage")}>
          {lead ? (
            <pre className="max-h-[calc(var(--app-vh,100dvh)-260px)] overflow-y-auto whitespace-pre-wrap break-words font-sans text-[14.5px] leading-5 text-white">
              {text}
            </pre>
          ) : (
            <Empty icon="chatbubble-outline" title={t("creator.content.noBrandYet")} />
          )}
        </Panel>
      </div>
    </div>
  );
}
