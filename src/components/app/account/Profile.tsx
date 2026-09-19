"use client";

/**
 * The profile card, and its edit screen.
 *
 * Everything here is the app's: GET /me for what is shown (the photo comes
 * back signed for an hour), PATCH /me for the name and the @username (same
 * rules and endpoint as onboarding and the app), and the photo uploaded to the
 * private `user-avatars` bucket at `{uid}/avatar-{ts}.jpg`, with /me told the
 * path (lib/app/me). The email is the sign-in's and is not edited here.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { CreatorApiError, describeCreatorError } from "@/lib/creator/api";
import {
  checkUsername,
  chosenUsername,
  cleanUsername,
  removeAvatar,
  updateMe,
  uploadAvatar,
  type UsernameVerdict,
} from "@/lib/app/me";
import { useMe, useRefresh } from "@/lib/app/spaces-data";

import { Avatar, btnGhost, btnLink, btnPrimary, inputCls, ScreenHeader, Warn } from "../front/kit";
import { IconChevronRight } from "../icons";
import { useShell } from "../Shell";
import { glass, Skeleton } from "../ui";
import { UserAvatar } from "./UserAvatar";

const PLAN: Record<string, string> = { free: "Free", pro: "Pro" };

function countryName(code: string | null | undefined): string | null {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

function dayText(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

export function ProfileCard({ onOpen }: { onOpen: () => void }) {
  const me = useMe();
  const { session } = useShell();
  if (!me.data) {
    return me.error ? (
      <section className={`${glass} p-5`}>
        <Warn>{describeCreatorError(me.error)}</Warn>
      </section>
    ) : (
      <Skeleton className="h-[132px]" />
    );
  }
  const m = me.data;
  const username = chosenUsername(m);
  const name = m.profile.displayName?.trim() || (username ? `@${username}` : "Add your name");
  const facts = [
    { label: "Email", value: m.email ?? session.user.email ?? "–" },
    { label: "Plan", value: PLAN[m.profile.plan] ?? m.profile.plan },
    ...(countryName(m.profile.country) ? [{ label: "Country", value: countryName(m.profile.country)! }] : []),
  ];
  return (
    <button type="button" onClick={onOpen} className={`${glass} group flex w-full min-w-0 flex-col gap-5 p-5 text-left transition-colors hover:bg-white/[0.06] sm:flex-row sm:items-center sm:p-6`}>
      <span className="flex min-w-0 flex-1 items-center gap-4">
        <UserAvatar size={72} fallbackName={name} />
        <span className="min-w-0">
          <span className="block truncate text-[22px] font-medium leading-tight text-text">{name}</span>
          <span className="mt-1 block truncate text-small text-[#9FB7C2]">{username ? `@${username}` : "No username yet"}</span>
        </span>
      </span>
      <span className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-x-6 gap-y-2 sm:w-[48%]">
        {facts.map((f) => (
          <span key={f.label} className="min-w-0">
            <span className="block text-[11px] text-[#9FB7C2]">{f.label}</span>
            <span className="mt-0.5 block truncate text-small text-text">{f.value}</span>
          </span>
        ))}
      </span>
      <span className="flex shrink-0 items-center gap-1 text-small text-amber">
        Edit profile <IconChevronRight />
      </span>
    </button>
  );
}

const VERDICT: Record<UsernameVerdict | "checking" | "error", string> = {
  checking: "Checking…",
  available: "Available",
  own: "This is yours",
  taken: "Taken. Try another.",
  reserved: "That one is reserved. Try another.",
  invalid: "3 or more letters, numbers, _ . or -",
  error: "We could not check that right now.",
};

export function ProfileEdit({ onBack }: { onBack: () => void }) {
  const me = useMe();
  const { session } = useShell();
  const refresh = useRefresh();
  const m = me.data;
  const current = chosenUsername(m);
  const changeableAt = m?.aliasChangeableAt ?? null;
  const locked = !!current && !!changeableAt && new Date(changeableAt).getTime() > Date.now();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [verdict, setVerdict] = useState<UsernameVerdict | "checking" | "error" | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"save" | "photo" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const asked = useRef("");

  // Filled once the profile is read; typing is never overwritten by a re-read.
  const filled = useRef(false);
  useEffect(() => {
    if (!m || filled.current) return;
    filled.current = true;
    setName(m.profile.displayName ?? "");
    setUsername(current ?? "");
    setVerdict(current ? "own" : null);
  }, [m, current]);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  if (!m) return <Skeleton className="h-[420px] w-full max-w-[560px]" />;
  const uid = m.supabaseUid ?? session.user.id;

  const onUsername = (raw: string) => {
    const v = cleanUsername(raw).toLowerCase();
    setUsername(v);
    setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    if (!v) return setVerdict(null);
    if (v === current) return setVerdict("own");
    setVerdict("checking");
    asked.current = v;
    timer.current = setTimeout(() => {
      checkUsername(v).then(
        (r) => asked.current === v && setVerdict(r),
        () => asked.current === v && setVerdict("error"),
      );
    }, 450);
  };

  const nameChanged = name.trim() !== (m.profile.displayName ?? "") && name.trim() !== "";
  const usernameChanged = !!username && username !== current;
  const usernameOk = !usernameChanged || verdict === "available";
  const canSave = (nameChanged || usernameChanged) && usernameOk && busy === null;

  const save = async () => {
    setBusy("save");
    setNotice(null);
    try {
      const patch: { displayName?: string; aliasHandle?: string } = {};
      if (nameChanged) patch.displayName = name.trim();
      if (usernameChanged) patch.aliasHandle = username;
      await updateMe(patch);
      await refresh("me");
      setSaved(true);
    } catch (e) {
      if (e instanceof CreatorApiError && e.code === "CONFLICT") setVerdict("taken");
      else if (e instanceof CreatorApiError && e.code === "RATE_LIMIT_EXCEEDED") setNotice(e.serverMessage ?? "You changed your username recently. Try again later.");
      else setNotice(describeCreatorError(e));
    } finally {
      setBusy(null);
    }
  };

  const photo = async (f: File | null) => {
    setFile(f);
    if (!f) return;
    setBusy("photo");
    setNotice(null);
    try {
      await uploadAvatar(f, uid, m.profile.avatarUrl);
      await refresh("me");
      setFile(null);
    } catch (e) {
      setNotice(e instanceof CreatorApiError ? describeCreatorError(e) : "That photo could not be used. Try a JPEG or PNG.");
      setFile(null);
    } finally {
      setBusy(null);
    }
  };

  const clearPhoto = async () => {
    setBusy("photo");
    setNotice(null);
    try {
      await removeAvatar(uid, m.profile.avatarUrl);
      await refresh("me");
    } catch (e) {
      setNotice(describeCreatorError(e));
    } finally {
      setBusy(null);
    }
  };

  const shownName = name.trim() || (current ? `@${current}` : "?");
  return (
    <section className={`${glass} flex w-full max-w-[560px] flex-col gap-5 p-5 sm:p-6`}>
      <ScreenHeader title="Edit profile" onBack={onBack} />

      <div className="flex items-center gap-4">
        <Avatar src={preview ?? m.profile.avatarUrl} name={shownName} size={72} />
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={btnGhost} disabled={busy !== null} onClick={() => input.current?.click()}>
            {busy === "photo" ? "Saving photo…" : m.profile.avatarUrl ? "Change photo" : "Add a photo"}
          </button>
          {m.profile.avatarUrl && busy === null ? (
            <button type="button" className={btnLink} onClick={() => void clearPhoto()}>
              Remove
            </button>
          ) : null}
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            className="hidden"
            onChange={(e) => {
              void photo(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <div>
        <label htmlFor="acc-name" className="text-tiny text-[#9FB7C2]">
          Display name
        </label>
        <input
          id="acc-name"
          className={`${inputCls} mt-1.5`}
          maxLength={60}
          placeholder="Your name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          disabled={busy !== null}
        />
      </div>

      <div>
        <label htmlFor="acc-username" className="text-tiny text-[#9FB7C2]">
          Username
        </label>
        <div className={`mt-1.5 flex items-center rounded-[12px] border border-white/10 bg-white/[0.05] pl-4 focus-within:border-amber/60 ${locked ? "opacity-70" : ""}`}>
          <span className="text-small text-[#9FB7C2]">@</span>
          <input
            id="acc-username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={50}
            value={username}
            onChange={(e) => onUsername(e.target.value)}
            disabled={busy !== null || locked}
            className="h-11 min-w-0 flex-1 bg-transparent pl-1 pr-4 text-small text-text outline-none"
          />
        </div>
        <p className={`mt-1.5 text-tiny ${usernameChanged && verdict === "available" ? "text-success" : usernameChanged && verdict && verdict !== "checking" ? "text-amber" : "text-[#9FB7C2]"}`}>
          {locked
            ? `You can change it again on ${dayText(changeableAt ?? "")}. A username changes once every 14 days.`
            : usernameChanged && verdict
              ? VERDICT[verdict]
              : "Changes once every 14 days. The same @ in the app."}
        </p>
      </div>

      <div>
        <p className="text-tiny text-[#9FB7C2]">Email</p>
        <p className="mt-1 break-all text-small text-text">{m.email ?? session.user.email ?? "–"}</p>
        <p className="mt-0.5 text-[11px] text-[#B4BEC9]">The one you sign in with.</p>
      </div>

      {notice ? <Warn>{notice}</Warn> : null}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={btnPrimary} disabled={!canSave} onClick={() => void save()}>
          {busy === "save" ? "Saving…" : "Save"}
        </button>
        {saved ? <span className="text-small text-success">Saved</span> : null}
      </div>
    </section>
  );
}
