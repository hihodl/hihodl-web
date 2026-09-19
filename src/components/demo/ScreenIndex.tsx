"use client";

/**
 * Every screen of the web, and every state of it, one link each: the review
 * map of the demo (preview/web-together-demo).
 *
 * Each link is a full page load that carries the demo state it needs
 * (`demo-role`, `demo-wallet`, `demo-phone`, `demo-account`, `demo-signed`,
 * `demo-remembered`, `demo-x`) and, where one address has several states, the
 * screen's own `?state=` (or `step`, `screen`, `view`, `tab`, `pane`), so it
 * lands on exactly that state whatever was clicked before. Ids of the seeded
 * listings are read from the demo store as the page opens.
 */

import { useEffect, useMemo, useState } from "react";

import { clientProductBase } from "@/lib/app/paths";
import { DEMO_API_BASE, DEMO_INVITE_CODE, DEMO_SEAT_CODE } from "@/lib/creator/demo";

interface Entry {
  label: string;
  href: string;
  note?: string;
}

interface Group {
  title: string;
  intro?: string;
  entries: Entry[];
}

type State = Partial<Record<"role" | "wallet" | "phone" | "account" | "signed" | "remembered" | "x", string>>;

const BASE_STATE: Required<State> = {
  role: "owner",
  wallet: "web",
  phone: "android",
  account: "done",
  signed: "in",
  remembered: "none",
  x: "linked",
};

/** A path with the whole demo state on it, then its own query. */
function at(path: string, state: State = {}, query: Record<string, string> = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...BASE_STATE, ...state })) q.set(`demo-${k}`, v);
  // The seeded Spaces account too, unless the link asks for the empty one.
  q.set("demo", "seeded");
  for (const [k, v] of Object.entries(query)) q.set(k, v);
  return `${path}${path.includes("?") ? "&" : "?"}${q.toString()}`;
}

interface Ids {
  listings: Record<string, string>;
  positions: Record<string, string[]>;
  productionItems: Record<string, string>;
  contentOrder: string | null;
  offerId: string | null;
}

async function demoGet<T>(path: string, role = "owner"): Promise<T | null> {
  try {
    const res = await fetch(`${DEMO_API_BASE}/${path}`, { headers: { authorization: `Bearer demo-${role}` } });
    const body = (await res.json()) as { data?: T };
    return body.data ?? null;
  } catch {
    return null;
  }
}

async function readIds(): Promise<Ids> {
  const mine = await demoGet<{ spaces: { id: string; slug: string }[] }>("ad-space/spaces/mine");
  const listings: Record<string, string> = {};
  for (const s of mine?.spaces ?? []) listings[s.slug] = s.id;
  const productionItems: Record<string, string> = {};
  const positions: Record<string, string[]> = {};
  const prodId = listings["token2049-content-production"];
  if (prodId) {
    const one = await demoGet<{ space: { positions: { id: string; production?: { state: string } | null }[] } }>(`ad-space/spaces/${prodId}`);
    for (const p of one?.space.positions ?? []) if (p.production) productionItems[p.production.state] = `production:${p.id}`;
    positions.production = (one?.space.positions ?? []).map((p) => p.id);
  }
  const sales = await demoGet<{ sales: { recent: { orderId: string; spaceId: string; sponsorName?: string | null }[] } }>(
    listings["breakpoint-london-suitcase"] ? `ad-space/sales?spaceId=${listings["breakpoint-london-suitcase"]}` : "ad-space/sales",
  );
  const offers = await demoGet<{ offers: { id: string; status: string }[] }>("ad-space/offers/received");
  return {
    listings,
    positions,
    productionItems,
    contentOrder: sales?.sales.recent.find((r) => r.sponsorName === "Mesa")?.orderId ?? sales?.sales.recent[0]?.orderId ?? null,
    offerId: offers?.offers.find((o) => o.status === "pending")?.id ?? null,
  };
}

function groups(p: string, ids: Ids | null): Group[] {
  const L = ids?.listings ?? {};
  const listing = (slug: string) => L[slug] ?? "unknown";
  const S = `${p}/spaces`;
  const T = "event=token2049-singapore-2026";
  const out: Group[] = [];

  out.push({
    title: "Sign in",
    intro: "Signed out. The door is the same on every product page.",
    entries: [
      { label: "Welcome", href: at(`${p}/`, { signed: "out" }) },
      { label: "Welcome: the Continue with sheet", href: at(`${p}/`, { signed: "out" }, { "demo-open": "let" }) },
      { label: "Welcome: Continue with email", href: at(`${p}/`, { signed: "out" }, { "demo-open": "let>email" }) },
      { label: "Welcome back (last time: Google)", href: at(`${p}/`, { signed: "out", remembered: "google" }) },
      { label: "Welcome back (last time: email)", href: at(`${p}/`, { signed: "out", remembered: "email" }) },
      { label: "Email code: type any six digits", href: at(`${p}/`, { signed: "out", remembered: "email" }, { "demo-open": "email me a code" }) },
      { label: "Auth callback (signs in and goes on)", href: at(`${p}/auth/callback`, { signed: "out" }) },
    ],
  });

  const onb = (step: string, extra: State = {}, q: Record<string, string> = {}) =>
    at(`${p}/welcome`, { account: "new", wallet: "none", phone: "none", ...extra }, { step, ...q });
  out.push({
    title: "Onboarding",
    intro: "Every step, one link each. The first link runs the whole flow for a new account.",
    entries: [
      { label: "The whole flow, from the start (a new account)", href: at(`${p}/welcome`, { account: "new", wallet: "none", phone: "none" }) },
      { label: "1. Username", href: onb("username") },
      { label: "2. Name and photo", href: onb("profile") },
      { label: "3. Passkey", href: onb("passkey") },
      { label: "4. Recovery codes", href: onb("recovery", { account: "half" }) },
      { label: "5. Create your wallet", href: onb("wallet", { account: "half" }) },
      { label: "5. Your wallet is in the app (app wallet note)", href: onb("app-wallet", { account: "half", wallet: "app" }) },
      { label: "6. Link your phone: live (an Android phone joins after 5 s)", href: onb("link", { account: "half", wallet: "web" }) },
      { label: "6. Link your phone: QR", href: onb("link", {}, { state: "qr" }) },
      { label: "6. Link your phone: on an iPhone", href: onb("link", {}, { state: "qr-iphone" }) },
      { label: "6. Link your phone: on an Android phone", href: onb("link", {}, { state: "qr-android" }) },
      { label: "6. Link your phone: the six-digit code (SAS)", href: onb("link", {}, { state: "sas" }) },
      { label: "6. Link your phone: the code, no web wallet", href: onb("link", {}, { state: "sas-no-wallet" }) },
      { label: "6. Link your phone: sending", href: onb("link", {}, { state: "sending" }) },
      { label: "6. Link your phone: done, Android", href: onb("link", {}, { state: "done-android" }) },
      { label: "6. Link your phone: done, iPhone", href: onb("link", {}, { state: "done-ios" }) },
      { label: "6. Link your phone: the codes did not match", href: onb("link", {}, { state: "mismatch" }) },
      { label: "6. Link your phone: code expired", href: onb("link", {}, { state: "expired" }) },
      { label: "6. Link your phone: could not start", href: onb("link", {}, { state: "failed" }) },
    ],
  });

  out.push({
    title: "Link your phone: the phone's page",
    intro: "What the QR opens, on each device.",
    entries: [
      { label: "Android: open in HOLD", href: at(`${p}/link/demo-session`, {}, { phone: "android" }) },
      { label: "iPhone: link this iPhone", href: at(`${p}/link/demo-session`, {}, { phone: "ios" }) },
      { label: "iPhone: linked", href: at(`${p}/link/demo-done`, {}, { phone: "ios" }) },
      { label: "iPhone: code expired", href: at(`${p}/link/demo-expired`, {}, { phone: "ios" }) },
      { label: "iPhone: another account", href: at(`${p}/link/demo-other`, {}, { phone: "ios" }) },
      { label: "iPhone: signed out (the door)", href: at(`${p}/link/demo-session`, { signed: "out" }, { phone: "ios" }) },
      { label: "Opened on a computer", href: at(`${p}/link/demo-session`, {}, { phone: "computer" }) },
    ],
  });

  out.push({
    title: "Dashboard and Benefits",
    entries: [
      { label: "Dashboard: web wallet", href: at(`${p}/`) },
      { label: "Dashboard: app wallet", href: at(`${p}/`, { wallet: "app" }) },
      { label: "Dashboard: no wallet", href: at(`${p}/`, { wallet: "none" }) },
      { label: "Dashboard: wallet on another account", href: at(`${p}/`, { wallet: "other" }) },
      { label: "Dashboard: a manager on a creator's team", href: at(`${p}/`, { role: "manager" }) },
      { label: "Benefits", href: at(`${p}/benefits`) },
      { label: "Stays", href: at(`${p}/travel`) },
      { label: "eSIM", href: at(`${p}/esim`) },
      { label: "Settings", href: at(`${p}/settings`) },
    ],
  });

  const w = `${p}/wallet`;
  out.push({
    title: "Wallet",
    intro: "The passkey is the demo's: it answers at once. The wallet crypto is the real code, on a demo phrase.",
    entries: [
      { label: "Create your wallet", href: at(w, { wallet: "none" }) },
      { label: "Locked: unlock with passkey", href: at(w) },
      { label: "Home (unlocked)", href: at(w, {}, { unlock: "1" }) },
      { label: "Receive", href: at(w, {}, { screen: "receive" }) },
      { label: "Settings", href: at(w, {}, { screen: "settings" }) },
      { label: "Settings: export your 12 words", href: at(w, {}, { screen: "export" }) },
      { label: "Settings: add another passkey", href: at(w, {}, { screen: "add" }) },
      { label: "Withdraw: form", href: at(w, {}, { screen: "withdraw", state: "form" }) },
      { label: "Withdraw: form, filled", href: at(w, {}, { screen: "withdraw", state: "form-filled" }) },
      { label: "Withdraw: form, not a Solana address and too much", href: at(w, {}, { screen: "withdraw", state: "form-invalid" }) },
      { label: "Withdraw: review", href: at(w, {}, { screen: "withdraw", state: "review" }) },
      { label: "Withdraw: link your phone first", href: at(w, {}, { screen: "withdraw", state: "link-first" }) },
      { label: "Withdraw: approve on your phone (Android)", href: at(w, {}, { screen: "withdraw", state: "on-phone" }) },
      { label: "Withdraw: approve with passkey (iPhone)", href: at(w, { phone: "ios" }, { screen: "withdraw", state: "passkey" }) },
      { label: "Withdraw: sending", href: at(w, {}, { screen: "withdraw", state: "sending" }) },
      { label: "Withdraw: sent", href: at(w, {}, { screen: "withdraw", state: "sent" }) },
      { label: "Withdraw: declined on the phone", href: at(w, {}, { screen: "withdraw", state: "rejected" }) },
      { label: "Withdraw: not approved in time", href: at(w, {}, { screen: "withdraw", state: "expired" }) },
      { label: "Withdraw: did not go through", href: at(w, {}, { screen: "withdraw", state: "failed" }) },
      { label: "Withdraw live: Android approves in 6 s", href: at(w, {}, { screen: "withdraw" }), note: "Fill it in and press Withdraw" },
      { label: "Withdraw live: the phone declines", href: at(w, {}, { screen: "withdraw", "phone-answer": "reject" }) },
      { label: "Withdraw live: iPhone, one passkey prompt", href: at(w, { phone: "ios" }, { screen: "withdraw" }) },
      { label: "Withdraw live: no phone linked", href: at(w, { phone: "none" }, { screen: "withdraw" }) },
      { label: "App wallet", href: at(w, { wallet: "app" }) },
      { label: "Wallet on another account", href: at(w, { wallet: "other" }) },
    ],
  });

  const a = `${p}/account`;
  out.push({
    title: "Account",
    entries: [
      { label: "Account", href: at(a) },
      { label: "Profile", href: at(a, {}, { view: "profile" }) },
      { label: "X: linked", href: at(a, {}, { view: "x" }) },
      { label: "X: not linked", href: at(a, { x: "none" }, { view: "x" }) },
      { label: "X: not verified", href: at(a, { x: "unverified" }, { view: "x" }) },
      { label: "X: account too new", href: at(a, { x: "too-new" }, { view: "x" }) },
      { label: "X: link again", href: at(a, { x: "relink" }, { view: "x" }) },
      ...["ok", "denied", "expired", "taken", "busy", "failed", "unavailable"].map((r) => ({
        label: `X: back from X, ${r}`,
        href: at(`${S}/x`, {}, { result: r }),
      })),
      { label: "Payout: web wallet", href: at(a, {}, { view: "payout" }) },
      { label: "Payout: app wallet", href: at(a, { wallet: "app" }, { view: "payout" }) },
      { label: "Payout: no wallet", href: at(a, { wallet: "none" }, { view: "payout" }) },
      { label: "Payout: another wallet", href: at(a, {}, { view: "other-wallet" }) },
      { label: "Your phone: Android linked", href: at(a, {}, { view: "phone" }) },
      { label: "Your phone: iPhone linked", href: at(a, { phone: "ios" }, { view: "phone" }) },
      { label: "Your phone: none linked", href: at(a, { phone: "none" }, { view: "phone" }) },
    ],
  });

  const hub = (slug: string, label: string, tabs: string[]): Entry[] => [
    { label: `${label}: hub`, href: at(`${S}/listings/${listing(slug)}`) },
    ...tabs.map((t) => ({ label: `${label}: ${t}`, href: at(`${S}/listings/${listing(slug)}`, {}, { tab: t }) })),
  ];
  out.push({
    title: "Spaces: overview and listings",
    entries: [
      { label: "Overview", href: at(S) },
      { label: "Overview: an empty account", href: at(S, {}, { demo: "empty" }), note: "Every other link brings the seeded account back" },
      { label: "Overview: Brands you work with", href: at(S, {}, { view: "brands" }) },
      { label: "Overview: By event", href: at(S, {}, { view: "events" }) },
      { label: "Overview: What sells for you", href: at(S, {}, { view: "sells" }) },
      { label: "Overview: How brands pay", href: at(S, {}, { view: "pay" }) },
      { label: "Overview: You inspired", href: at(S, {}, { view: "inspired" }), note: "Listings other creators credit you for" },
      { label: "Overview: Needs you and live", href: at(S, {}, { view: "needs" }) },
      { label: "Listings", href: at(`${S}/listings`) },
      { label: "Listings: drafts", href: at(`${S}/listings`, {}, { status: "draft" }) },
      { label: "Listings: closed", href: at(`${S}/listings`, {}, { status: "closed" }) },
      ...hub("token2049-videos", "Short videos (ladder, offers, series)", ["events", "offers", "floors", "spots", "deliveries", "updates", "team"]),
      ...hub("breakpoint-london-coverage", "Event coverage (bidding rung)", ["offers", "spots", "deliveries", "team"]),
      ...hub("breakpoint-london-suitcase", "Suitcase (placement, photo)", ["photo", "spots", "offers", "content"]),
      ...hub("token2049-content-production", "Content production", ["spots", "deliveries", "offers", "team"]),
      ...hub("road-to-korea-blockchain-week", "Closed suitcase with sales", ["spots", "deliveries", "content"]),
    ],
  });

  const draft = listing("devcon-8-hallway-interviews");
  const prodDraft = listing("breakpoint-content-production");
  out.push({
    title: "Spaces: the listing editor",
    entries: [
      { label: "New listing: Pick your hook", href: at(`${S}/listings/new`) },
      { label: "New listing: suitcase, name and dates", href: at(`${S}/listings/new`, {}, { template: "carry-on-suitcase" }) },
      { label: "New listing: content production, name and dates", href: at(`${S}/listings/new`, {}, { template: "content-production" }) },
      {
        label: "New listing: Inspired by a HOLD creator",
        href: at(`${S}/listings/new`, {}, { template: "carry-on-suitcase", inspiredBy: "hold:nodeline_creator" }),
        note: "Search finds nodeline, orbit, mesa, kopi",
      },
      { label: "New listing: Inspired by an X handle", href: at(`${S}/listings/new`, {}, { template: "carry-on-suitcase", inspiredBy: "x:orbit_travels" }) },
      { label: "Draft: name and dates", href: at(`${S}/listings/${draft}/edit`, {}, { step: "basics" }) },
      { label: "Draft: the ladder", href: at(`${S}/listings/${draft}/edit`, {}, { step: "sell" }) },
      { label: "Draft: go live", href: at(`${S}/listings/${draft}/edit`, {}, { step: "publish" }) },
      { label: "Draft: go live, X not verified", href: at(`${S}/listings/${draft}/edit`, { x: "unverified" }, { step: "publish" }) },
      { label: "Production draft: name and dates", href: at(`${S}/listings/${prodDraft}/edit`, {}, { step: "basics" }) },
      { label: "Production draft: What a spot includes", href: at(`${S}/listings/${prodDraft}/edit`, {}, { step: "includes" }) },
      { label: "Production draft: the spots", href: at(`${S}/listings/${prodDraft}/edit`, {}, { step: "sell" }) },
      { label: "Production draft: go live", href: at(`${S}/listings/${prodDraft}/edit`, {}, { step: "publish" }) },
    ],
  });

  const items = ids?.productionItems ?? {};
  const prod = listing("token2049-content-production");
  const del = (state: string, pane?: string) =>
    at(`${S}/deliveries`, {}, { listing: prod, view: "all", ...(items[state] ? { item: items[state] } : {}), ...(pane ? { pane } : {}) });
  out.push({
    title: "Spaces: offers, sales, deliveries",
    entries: [
      { label: "Offers and bids", href: at(`${S}/offers`) },
      { label: "Offers and bids: all", href: at(`${S}/offers`, {}, { view: "all" }) },
      { label: "Offers and bids: one listing", href: at(`${S}/offers`, {}, { listing: listing("token2049-videos"), view: "all" }) },
      ...(ids?.offerId ? [{ label: "Offers and bids: one offer", href: at(`${S}/offers`, {}, { listing: listing("token2049-videos"), id: ids.offerId }) }] : []),
      { label: "Offers and bids: as a manager", href: at(`${S}/offers`, { role: "manager" }) },
      { label: "Sales", href: at(`${S}/sales`) },
      { label: "Sales: one listing", href: at(`${S}/sales`, {}, { listing: listing("breakpoint-london-suitcase") }) },
      ...(ids?.contentOrder
        ? [{ label: "Sales: offer them content", href: at(`${S}/sales`, {}, { listing: listing("breakpoint-london-suitcase"), offer: ids.contentOrder }) }]
        : []),
      { label: "Deliveries", href: at(`${S}/deliveries`) },
      { label: "Deliveries: all, done included", href: at(`${S}/deliveries`, {}, { view: "all" }) },
      { label: "Deliveries: production spots with countdowns", href: at(`${S}/deliveries`, {}, { listing: prod, view: "all" }) },
      { label: "Production: to deliver (countdown)", href: del("awaiting_delivery") },
      { label: "Production: the brand's brief", href: del("awaiting_delivery", "brief") },
      { label: "Production: deliver (link and checklist)", href: del("awaiting_delivery", "deliver") },
      { label: "Production: late", href: del("overdue") },
      { label: "Production: with the brand", href: del("delivered") },
      { label: "Production: revision asked", href: del("revision_requested") },
      { label: "Production: revision, deliver again", href: del("revision_requested", "deliver") },
      { label: "Production: accepted", href: del("accepted") },
      { label: "Deliveries: as a rep", href: at(`${S}/deliveries`, { role: "rep" }) },
    ],
  });

  out.push({
    title: "Spaces: team and settings",
    entries: [
      { label: "Team: members", href: at(`${S}/team`) },
      { label: "Team: what you owe", href: at(`${S}/team`, {}, { tab: "owed" }) },
      { label: "Team: as a manager (teams you are on)", href: at(`${S}/team`, { role: "manager" }, { tab: "teams" }) },
      { label: "Team: as a manager (what you are owed)", href: at(`${S}/team`, { role: "manager" }, { tab: "earnings" }) },
      { label: "Team: as a rep", href: at(`${S}/team`, { role: "rep" }) },
      { label: "Invitation: a seat link, signed in", href: at(`${S}/team`, { role: "invitee" }, { seat: DEMO_SEAT_CODE }) },
      { label: "Invitation: a seat link, signed out", href: at(`${S}/team`, { role: "invitee", signed: "out" }, { seat: DEMO_SEAT_CODE }) },
      { label: "Invitation: the invite address", href: at(`/invite/${DEMO_INVITE_CODE}`, { role: "invitee" }, { seat: DEMO_SEAT_CODE }) },
      { label: "Spaces settings", href: at(`${S}/settings`) },
      { label: "Inspire: templates", href: at(`${S}/inspire`) },
      { label: "Inspire: events", href: at(`${S}/inspire`, {}, { tab: "events" }) },
    ],
  });

  const ins = (q: string) => at(`${S}/insights`, {}, Object.fromEntries(new URLSearchParams(q)));
  out.push({
    title: "Spaces: Insights",
    entries: [
      { label: "Hub (TOKEN2049)", href: ins(T) },
      { label: "Hub (Breakpoint, thin market)", href: ins("event=breakpoint-london-2026") },
      { label: "Hub (all of Spaces)", href: ins("event=all") },
      { label: "Your hook", href: ins(`${T}&view=hook`) },
      { label: "Your hook (all of Spaces)", href: ins("event=all&view=hook") },
      { label: "Your numbers", href: ins(`${T}&view=you`) },
      { label: "Your numbers (thin)", href: ins("event=breakpoint-london-2026&view=you") },
      { label: "What sells", href: ins(`${T}&view=sells`) },
      { label: "What sells (thin)", href: ins("event=breakpoint-london-2026&view=sells") },
      { label: "Pricing", href: ins(`${T}&view=pricing`) },
      { label: "Timing", href: ins(`${T}&view=timing`) },
      { label: "Brands buying", href: ins(`${T}&view=brands`) },
      { label: "Brands buying (none yet here)", href: ins("event=breakpoint-london-2026&view=brands") },
      { label: "Pitch a brand", href: ins(`${T}&view=pitch&brand=Northwind`) },
      { label: "Pitch a brand (empty)", href: ins(`${T}&view=pitch`) },
    ],
  });

  const pub = (slug: string) => `/s/demo_creator/${slug}`;
  out.push({
    title: "Public pages: the creator and the event",
    intro: "What brands see. The creator is fictional (@demo_creator), so are the brands.",
    entries: [
      { label: "Creator page", href: "/s/demo_creator" },
      { label: "Creator page: one event", href: "/s/demo_creator/events/token2049-singapore-2026" },
      { label: "Creator page: all year", href: "/s/demo_creator/events/all-year" },
      { label: "Creator page: past events", href: "/s/demo_creator/events/past" },
      { label: "Event page: TOKEN2049", href: "/events/token2049-singapore-2026" },
      { label: "Event page: TOKEN2049, the feed", href: "/events/token2049-singapore-2026?tab=feed" },
      { label: "Event page: Devcon 8 (no photo, empty feed)", href: "/events/devcon-8-mumbai-2026" },
      { label: "Event page: Breakpoint", href: "/events/breakpoint-london-2026" },
      { label: "Event page: over", href: "/events/ethcc-cannes-2026" },
    ],
  });

  out.push({
    title: "Public pages: every kind of space",
    entries: [
      { label: "Placement (a suitcase), inspired by a HOLD creator", href: pub("road-to-token2049") },
      { label: "Photo with squares", href: pub("road-to-token2049-photo") },
      { label: "Service (short videos), inspired by an X handle", href: pub("token2049-videos") },
      { label: "Tiers with a bidding rung", href: pub("breakpoint-london-coverage") },
      { label: "Content production", href: pub("token2049-content-production") },
      { label: "Takeover", href: pub("token2049-takeover") },
      { label: "Bids", href: pub("token2049-bids") },
      { label: "Offers", href: pub("token2049-offers") },
      { label: "Service that takes offers", href: pub("token2049-videos-offers") },
      { label: "Session (in the room)", href: pub("token2049-pitch-reviews") },
      { label: "Custom service", href: pub("token2049-afterparty-host") },
      { label: "All year, no event", href: pub("weekly-x-space-sponsor") },
    ],
  });

  out.push({
    title: "Public pages: checkout and after",
    intro: "The Solana Pay QR is \"scanned\" six seconds after it shows, then the order is paid.",
    entries: [
      { label: "Checkout: a spot on the suitcase", href: `${pub("road-to-token2049")}?demo-open=@spot>claim this spot|buy now` },
      { label: "Checkout: a spot on the photo", href: `${pub("road-to-token2049-photo")}?demo-open=@spot>claim this spot|buy now` },
      { label: "Checkout: a short video", href: `${pub("token2049-videos")}?demo-open=claim it|claim this spot|buy now` },
      { label: "Checkout: content production, the brief first", href: `${pub("token2049-content-production")}?demo-open=claim this spot|claim it` },
      { label: "Checkout: a session", href: `${pub("token2049-pitch-reviews")}?demo-open=b:book a session` },
      { label: "Make an offer", href: `${pub("token2049-offers")}?demo-open=make an offer` },
      { label: "Place a bid", href: `${pub("token2049-bids")}?demo-open=@spot>place a bid|bid|make an offer` },
      { label: "Receipt: a paid spot, then its artwork", href: `${pub("road-to-token2049")}?demo-checkout=paid&demo-open=@spot>claim this spot|buy now` },
      { label: "Receipt: a paid video", href: `${pub("token2049-videos")}?demo-checkout=paid&demo-open=claim it|claim this spot|buy now` },
      { label: "Receipt: a paid production spot", href: `${pub("token2049-content-production")}?demo-checkout=paid&demo-open=claim this spot|claim it` },
      ...["pending", "countered", "accepted", "paid", "declined", "expired", "bid_leading", "bid_outbid", "videos_accepted"].map((n) => ({
        label: `Offer thread: ${n.replace("_", " ")}`,
        href: `/o/${`fixture_${n}`.padEnd(43, "x")}`,
      })),
      ...["awaiting_contact", "awaiting_schedule", "scheduled", "awaiting_confirmation", "delivered", "disputed", "window_closed", "no_handle"].map((n) => ({
        label: `Session booking: ${n.replace(/_/g, " ")}`,
        href: `/b/fixture_${n}`,
      })),
      { label: "Brand production page: being made", href: "/p/fixture_production_making" },
      { label: "Brand production page: delivered", href: "/p/fixture_production_delivered" },
      { label: "Brand production page: delivered, asking for a revision", href: "/p/fixture_production_delivered?demo-open=ask for a revision" },
      { label: "Brand production page: revision asked", href: "/p/fixture_production_revision" },
      { label: "Brand production page: accepted", href: "/p/fixture_production_accepted" },
    ],
  });

  return out;
}

export function ScreenIndex() {
  const [ids, setIds] = useState<Ids | null>(null);
  const [base, setBase] = useState<string>("/app");
  useEffect(() => {
    setBase(clientProductBase());
    void readIds().then(setIds);
  }, []);
  const all = useMemo(() => groups(base, ids), [base, ids]);
  const count = all.reduce((n, g) => n + g.entries.length, 0);

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <p className="text-tiny uppercase tracking-wider text-amber">Demo</p>
        <h1 className="text-h3 font-light text-text">Every screen</h1>
        <p className="max-w-[720px] text-small text-text-muted">
          {count} links, one per screen and state, grouped as the product is. Each one is a full page load that carries the
          demo state it needs, so it lands on exactly that state. Nothing here reaches a backend: every call is answered in
          this browser. The DEMO badge, bottom right on every page, switches the role, the wallet and the linked phone, and
          comes back here.
        </p>
      </header>
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        {all.map((g) => (
          <section key={g.title} className="rounded-[16px] border border-white/10 bg-white/[0.03] p-5" data-group={g.title}>
            <h2 className="text-body font-medium text-text">{g.title}</h2>
            {g.intro ? <p className="mt-1 text-tiny text-text-muted">{g.intro}</p> : null}
            <ul className="mt-3 flex flex-col gap-1.5">
              {g.entries.map((e) => (
                <li key={e.href + e.label}>
                  <a href={e.href} className="text-small text-[#CFE3EC] underline decoration-white/20 underline-offset-4 hover:text-text" data-screen-link>
                    {e.label}
                  </a>
                  {e.note ? <span className="ml-2 text-tiny text-text-faint">{e.note}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {!ids ? <p className="mt-6 text-tiny text-text-faint">Reading the demo listings…</p> : null}
    </main>
  );
}
