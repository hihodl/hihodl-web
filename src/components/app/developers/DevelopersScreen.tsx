"use client";

/**
 * Settings › Developers: what a creator needs to take payments on their own
 * site (documentation/creator-pages-and-checkout-strategy-2026-10-01.md,
 * Track B).
 *
 *   API keys      live or test; the secret is shown once, with copy; listed
 *                 by name and prefix; revoked with a confirm
 *   Webhooks      an https endpoint; its signing secret shown once; listed,
 *                 deleted, and each one's last deliveries with Resend
 *   Quickstart    a curl that makes a checkout, and the Node code that checks
 *                 HOLD-Signature
 *
 * Until the backend serves /developer (it answers 404), the screen is one
 * line, "Coming soon", and nothing that reads as an error.
 */

import { useState, type FormEvent } from "react";

import { instantIn } from "@/lib/ad-space/format";
import {
  createKey,
  createWebhook,
  deleteWebhook,
  isNotDeployed,
  isWebhookUrl,
  resendDelivery,
  revokeKey,
  useDeliveries,
  useDevKeys,
  useDevWebhooks,
  type DevDelivery,
  type DevKey,
  type DevWebhook,
  type KeyMode,
  type NewDevKey,
  type NewDevWebhook,
} from "@/lib/developers/api";
import { VERIFY_NODE, createCheckoutCurl } from "@/lib/developers/snippets";
import { useT } from "@/lib/app/i18n/react";

import { useProductHref } from "../base";
import { BackHeader, Column, Notice, SectionTitle, btnGlass, holdCard } from "../hold";
import { Ion } from "../ion";
import { Skeleton } from "../ui";

import { CodeBlock, Pills, SecretOnce } from "./dev-kit";

const input =
  "h-12 w-full min-w-0 rounded-[14px] border border-white/10 bg-white/[0.06] px-3.5 text-[16px] font-bold text-white outline-none placeholder:font-medium placeholder:text-white/35 focus:border-white/25";
const whiteGlass =
  "inline-flex h-12 items-center justify-center gap-2 rounded-[24px] border border-white/[0.26] bg-white/[0.14] px-5 text-[15px] font-bold text-white transition-colors hover:bg-white/[0.2] disabled:border-white/[0.12] disabled:bg-white/[0.06] disabled:text-white/45";

function when(iso: string | null | undefined): string | null {
  return iso ? instantIn(iso) : null;
}

export function DevelopersScreen() {
  const t = useT();
  const href = useProductHref();
  const keys = useDevKeys();
  const hooks = useDevWebhooks();
  const notDeployed = isNotDeployed(keys.error) || isNotDeployed(hooks.error);

  return (
    <Column>
      <BackHeader title={t("developers.title")} backHref={href("/menu?screen=settings")} />
      {notDeployed ? (
        <p className="py-8 text-center text-[15px] font-bold text-[#CFE3EC]">{t("developers.comingSoon")}</p>
      ) : (
        <>
          <p className="mb-1 px-1 text-[13.5px] leading-[19px] text-[#CFE3EC]">{t("developers.intro")}</p>
          <KeysSection keys={keys} />
          <WebhooksSection hooks={hooks} />
          <Quickstart />
        </>
      )}
    </Column>
  );
}

/* ── API keys ─────────────────────────────────────────────────────── */

type Read<T> = { data?: T; error?: unknown; mutate: () => Promise<unknown> };

function LoadFailed({ onRetry }: { onRetry: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-2.5 p-4">
      <Notice icon="cloud-offline-outline">{t("developers.loadFailed")}</Notice>
      <button type="button" className={`${btnGlass} self-start`} onClick={onRetry}>
        {t("developers.tryAgain")}
      </button>
    </div>
  );
}

function KeysSection({ keys }: { keys: Read<DevKey[]> }) {
  const t = useT();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<KeyMode>("test");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [fresh, setFresh] = useState<NewDevKey | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const k = await createKey(n.slice(0, 60), mode);
      setFresh(k);
      setName("");
      void keys.mutate();
    } catch {
      setProblem(t("developers.keys.failed"));
    } finally {
      setBusy(false);
    }
  };

  const rows = keys.data ?? [];
  return (
    <>
      <SectionTitle>{t("developers.keys.title")}</SectionTitle>
      <section className={`${holdCard} flex flex-col`}>
        <form onSubmit={submit} className="flex flex-col gap-3 p-4">
          <input
            className={input}
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 60))}
            placeholder={t("developers.keys.namePlaceholder")}
            aria-label={t("developers.keys.name")}
            maxLength={60}
            autoComplete="off"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Pills
              label={t("developers.keys.title")}
              value={mode}
              onChange={setMode}
              options={[
                { value: "test", label: t("developers.keys.test") },
                { value: "live", label: t("developers.keys.live") },
              ]}
            />
            <button type="submit" className={whiteGlass} disabled={busy || !name.trim()}>
              {busy ? t("developers.keys.creating") : t("developers.keys.create")}
            </button>
          </div>
          {problem ? <Notice>{problem}</Notice> : null}
          {fresh?.secret ? (
            <SecretOnce
              title={t("developers.keys.secretTitle", { mode: fresh.mode === "live" ? t("developers.keys.live") : t("developers.keys.test") })}
              body={t("developers.keys.secretBody")}
              secret={fresh.secret}
              copyLabel={t("developers.keys.copy")}
              copiedLabel={t("developers.keys.copied")}
              doneLabel={t("developers.keys.done")}
              onDone={() => setFresh(null)}
            />
          ) : null}
        </form>
        <div className="h-px bg-white/[0.07]" />
        {keys.data === undefined && !keys.error ? <Skeleton className="m-4 h-14" /> : null}
        {keys.error && !keys.data ? <LoadFailed onRetry={() => void keys.mutate()} /> : null}
        {keys.data && rows.length === 0 ? <p className="p-4 text-[13px] text-white/55">{t("developers.keys.empty")}</p> : null}
        {rows.map((k, i) => (
          <KeyRow key={k.id} k={k} first={i === 0} onGone={() => void keys.mutate()} />
        ))}
      </section>
    </>
  );
}

function ModeTag({ mode }: { mode: string }) {
  const t = useT();
  const live = mode === "live";
  return (
    <span className={`inline-flex h-[22px] shrink-0 items-center rounded-[11px] px-[9px] text-[11.5px] font-strong ${live ? "bg-[rgba(14,155,104,0.14)] text-[#2FBE8A]" : "bg-amber/[0.12] text-amber"}`}>
      {live ? t("developers.keys.live") : t("developers.keys.test")}
    </span>
  );
}

function KeyRow({ k, first, onGone }: { k: DevKey; first: boolean; onGone: () => void }) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(false);
  const created = when(k.createdAt);
  const used = when(k.lastUsedAt);
  const revoke = async () => {
    setBusy(true);
    setProblem(false);
    try {
      await revokeKey(k.id);
      onGone();
    } catch {
      setProblem(true);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };
  return (
    <div className={`flex flex-col gap-2 px-4 py-3.5 ${first ? "" : "border-t border-white/[0.06]"}`}>
      <div className="flex items-center gap-2.5">
        <span className="min-w-0 flex-1 truncate text-[14.5px] font-bold text-white">{k.name}</span>
        <ModeTag mode={k.mode} />
      </div>
      <div className="flex items-center gap-2.5">
        <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-[#9FB7C2]" dir="ltr">
          {k.prefix}…
        </span>
        {!confirming ? (
          <button type="button" onClick={() => setConfirming(true)} className="shrink-0 text-[13px] font-bold text-white/70 hover:text-white">
            {t("developers.keys.revoke")}
          </button>
        ) : null}
      </div>
      {created || used ? (
        <p className="text-[12px] text-white/50">{[created ? t("developers.keys.created", { date: created }) : null, used ? t("developers.keys.lastUsed", { date: used }) : null].filter(Boolean).join(" · ")}</p>
      ) : null}
      {confirming ? (
        <div className="flex flex-col gap-2.5 rounded-[14px] bg-white/[0.04] p-3">
          <p className="text-[13px] leading-[18px] text-[#CFE3EC]">{t("developers.keys.revokeConfirm", { name: k.name })}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnGlass} onClick={() => setConfirming(false)} disabled={busy}>
              {t("developers.keys.keep")}
            </button>
            <button type="button" className={btnGlass} onClick={() => void revoke()} disabled={busy}>
              {busy ? t("developers.keys.revoking") : t("developers.keys.revoke")}
            </button>
          </div>
        </div>
      ) : null}
      {problem ? <Notice>{t("developers.keys.failed")}</Notice> : null}
    </div>
  );
}

/* ── Webhooks ─────────────────────────────────────────────────────── */

function WebhooksSection({ hooks }: { hooks: Read<DevWebhook[]> }) {
  const t = useT();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [fresh, setFresh] = useState<NewDevWebhook | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!isWebhookUrl(url)) {
      setProblem(t("developers.hooks.badUrl"));
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const h = await createWebhook(url.trim());
      setFresh(h);
      setUrl("");
      void hooks.mutate();
    } catch {
      setProblem(t("developers.keys.failed"));
    } finally {
      setBusy(false);
    }
  };

  const rows = hooks.data ?? [];
  return (
    <>
      <SectionTitle>{t("developers.hooks.title")}</SectionTitle>
      <section className={`${holdCard} flex flex-col`}>
        <form onSubmit={submit} className="flex flex-col gap-3 p-4">
          <p className="text-[12.5px] leading-[17px] text-[#9FB7C2]">{t("developers.hooks.body")}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              className={input}
              value={url}
              onChange={(e) => {
                setUrl(e.target.value.slice(0, 2048));
                setProblem(null);
              }}
              placeholder={t("developers.hooks.urlPlaceholder")}
              aria-label={t("developers.hooks.url")}
              inputMode="url"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              dir="ltr"
            />
            <button type="submit" className={`${whiteGlass} shrink-0`} disabled={busy || !url.trim()}>
              {busy ? t("developers.hooks.adding") : t("developers.hooks.add")}
            </button>
          </div>
          {problem ? <Notice>{problem}</Notice> : null}
          {fresh?.secret ? (
            <SecretOnce
              title={t("developers.hooks.secretTitle")}
              body={t("developers.hooks.secretBody")}
              secret={fresh.secret}
              copyLabel={t("developers.keys.copy")}
              copiedLabel={t("developers.keys.copied")}
              doneLabel={t("developers.keys.done")}
              onDone={() => setFresh(null)}
            />
          ) : null}
        </form>
        <div className="h-px bg-white/[0.07]" />
        {hooks.data === undefined && !hooks.error ? <Skeleton className="m-4 h-14" /> : null}
        {hooks.error && !hooks.data ? <LoadFailed onRetry={() => void hooks.mutate()} /> : null}
        {hooks.data && rows.length === 0 ? <p className="p-4 text-[13px] text-white/55">{t("developers.hooks.empty")}</p> : null}
        {rows.map((h, i) => (
          <WebhookRow key={h.id} hook={h} first={i === 0} onGone={() => void hooks.mutate()} />
        ))}
      </section>
    </>
  );
}

function WebhookRow({ hook, first, onGone }: { hook: DevWebhook; first: boolean; onGone: () => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(false);
  const remove = async () => {
    setBusy(true);
    setProblem(false);
    try {
      await deleteWebhook(hook.id);
      onGone();
    } catch {
      setProblem(true);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };
  return (
    <div className={`flex flex-col gap-2 px-4 py-3.5 ${first ? "" : "border-t border-white/[0.06]"}`}>
      <div className="flex items-center gap-2.5">
        <Ion name="git-network-outline" size={16} className="shrink-0 text-[#9FB7C2]" />
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-white" dir="ltr">
          {hook.url}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-[13px] font-bold text-white/70 hover:text-white">
          {open ? t("developers.hooks.hideDeliveries") : t("developers.hooks.deliveries")}
        </button>
        {!confirming ? (
          <button type="button" onClick={() => setConfirming(true)} className="text-[13px] font-bold text-white/70 hover:text-white">
            {t("developers.hooks.delete")}
          </button>
        ) : null}
      </div>
      {confirming ? (
        <div className="flex flex-col gap-2.5 rounded-[14px] bg-white/[0.04] p-3">
          <p className="text-[13px] leading-[18px] text-[#CFE3EC]">{t("developers.hooks.deleteConfirm")}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnGlass} onClick={() => setConfirming(false)} disabled={busy}>
              {t("developers.keys.keep")}
            </button>
            <button type="button" className={btnGlass} onClick={() => void remove()} disabled={busy}>
              {busy ? t("developers.hooks.deleting") : t("developers.hooks.delete")}
            </button>
          </div>
        </div>
      ) : null}
      {problem ? <Notice>{t("developers.keys.failed")}</Notice> : null}
      {open ? <Deliveries webhookId={hook.id} /> : null}
    </div>
  );
}

function deliveryTone(status: string): "good" | "caution" | "calm" {
  const s = status.toLowerCase();
  if (s === "delivered" || s === "succeeded" || s === "success" || s === "ok") return "good";
  if (s === "failed" || s === "error" || s === "exhausted") return "caution";
  return "calm";
}

function Deliveries({ webhookId }: { webhookId: string }) {
  const t = useT();
  const d = useDeliveries(webhookId);
  if (d.data === undefined && !d.error) return <Skeleton className="h-12" />;
  if (d.error && !d.data) return <LoadFailed onRetry={() => void d.mutate()} />;
  const rows = d.data ?? [];
  if (!rows.length) return <p className="text-[12.5px] text-white/55">{t("developers.hooks.noDeliveries")}</p>;
  return (
    <div className="flex flex-col overflow-hidden rounded-[14px] border border-white/[0.07] bg-black/[0.2]">
      {rows.slice(0, 20).map((x, i) => (
        <DeliveryRow key={x.id} d={x} first={i === 0} onResent={() => void d.mutate()} />
      ))}
    </div>
  );
}

function DeliveryRow({ d, first, onResent }: { d: DevDelivery; first: boolean; onResent: () => void }) {
  const t = useT();
  const [state, setState] = useState<"idle" | "busy" | "done" | "failed">("idle");
  const tone = deliveryTone(d.status);
  const label = tone === "good" ? t("developers.hooks.delivered") : tone === "caution" ? t("developers.hooks.failedStatus") : t("developers.hooks.pending");
  const ink = tone === "good" ? "text-[#2FBE8A]" : tone === "caution" ? "text-amber" : "text-white/60";
  const at = when(d.createdAt);
  const resend = async () => {
    setState("busy");
    try {
      await resendDelivery(d.id);
      setState("done");
      onResent();
    } catch {
      setState("failed");
    }
  };
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 ${first ? "" : "border-t border-white/[0.06]"}`}>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-mono text-[12.5px] text-white" dir="ltr">
          {d.event ?? d.type ?? "event"}
        </span>
        <span className="mt-0.5 block truncate text-[11.5px] text-white/50">
          <span className={`font-bold ${ink}`}>{label}</span>
          {typeof d.responseStatus === "number" ? ` · HTTP ${d.responseStatus}` : ""}
          {at ? ` · ${at}` : ""}
        </span>
      </span>
      <button type="button" onClick={() => void resend()} disabled={state === "busy" || state === "done"} className="shrink-0 text-[12.5px] font-bold text-white/70 hover:text-white disabled:opacity-60">
        {state === "busy" ? t("developers.hooks.resending") : state === "done" ? t("developers.hooks.resent") : state === "failed" ? t("developers.tryAgain") : t("developers.hooks.resend")}
      </button>
    </div>
  );
}

/* ── Quickstart ───────────────────────────────────────────────────── */

function Quickstart() {
  const t = useT();
  return (
    <>
      <SectionTitle>{t("developers.quick.title")}</SectionTitle>
      <section className={`${holdCard} flex flex-col gap-3 p-4`}>
        <p className="text-[14px] font-bold text-white">{t("developers.quick.create")}</p>
        <p className="text-[12.5px] leading-[17px] text-[#9FB7C2]">{t("developers.quick.createBody")}</p>
        <CodeBlock code={createCheckoutCurl()} copyLabel={t("developers.keys.copy")} copiedLabel={t("developers.keys.copied")} />
        <p className="mt-2 text-[14px] font-bold text-white">{t("developers.quick.verify")}</p>
        <p className="text-[12.5px] leading-[17px] text-[#9FB7C2]">{t("developers.quick.verifyBody")}</p>
        <CodeBlock code={VERIFY_NODE} copyLabel={t("developers.keys.copy")} copiedLabel={t("developers.keys.copied")} />
      </section>
    </>
  );
}
