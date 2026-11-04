import type { Metadata } from "next";
import { headers } from "next/headers";

import { API_BASE } from "@/lib/ad-space/config";
import { upstreamHeaders } from "@/lib/ad-space/server";
import { groupCardOf, invitePreview, isGroupCode } from "@/lib/invite/card";

import InviteRedirect from "./InviteRedirect";

/**
 * /invite/<code>: a friend's invite, a Partner's link, a creator's seat or
 * crew, or a group's join link (`?group=<code>`). The page is InviteRedirect;
 * this server half only gives a group's join link its own link card
 * ("Join 🏝️ Lisbon trip on HOLD"), so the people in the chat it lands in see
 * which group it is before they tap. Every other invite keeps the site's card.
 */

const BANNER = { url: "/banner-social.png", width: 1200, height: 630, alt: "HOLD", type: "image/png" };

export async function generateMetadata({ searchParams }: { searchParams: { group?: string | string[] } }): Promise<Metadata> {
  const group = searchParams.group;
  if (!isGroupCode(group)) return {};
  let card = null;
  try {
    const res = await fetch(`${API_BASE}/group-cards/${encodeURIComponent(group)}`, {
      headers: upstreamHeaders(headers()),
      // A rename shows within minutes; a chat app reads a card once per share.
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(3000),
    });
    card = res.ok ? groupCardOf(await res.json()) : null;
  } catch {
    card = null;
  }
  if (!card) return {};
  const preview = invitePreview(card);
  return {
    // Absolute: the layout's "%s | HOLD" would say HOLD twice.
    title: { absolute: preview.title },
    description: preview.description,
    // A group's link is a secret for joining: never in a search engine.
    robots: { index: false, follow: false },
    alternates: { canonical: null },
    openGraph: { type: "website", siteName: "HOLD", title: preview.title, description: preview.description, images: [BANNER] },
    twitter: { card: "summary_large_image", site: "@hiihodl", title: preview.title, description: preview.description, images: [BANNER.url] },
  };
}

export default function InvitePage() {
  return <InviteRedirect />;
}
