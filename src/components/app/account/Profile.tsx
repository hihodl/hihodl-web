"use client";

/**
 * The profile: the app's Profile hub hero, its avatar screen and its
 * username screen (app/(drawer)/(internal)/profile/index.tsx, AvatarSheet,
 * handle.tsx), on the web.
 *
 * Everything here is the app's: GET /me for what is shown (the photo comes
 * back signed for an hour), PATCH /me for the name and the @username (same
 * rules and endpoint as onboarding and the app), and the photo uploaded to the
 * private `user-avatars` bucket at `{uid}/avatar-{ts}.jpg`, with /me told the
 * path (lib/app/me). The email is the sign-in's and is not edited here.
 *
 * The display name has no row in the app's hub; the web keeps it because a
 * creator's public pages print it, and it sits on the avatar screen.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { CreatorApiError, describeCreatorError } from "@/lib/creator/api";
import { checkUsername, chosenUsername, cleanUsername, removeAvatar, updateMe, uploadAvatar, type UsernameVerdict } from "@/lib/app/me";
import { useMe, useRefresh } from "@/lib/app/spaces-data";

import { Avatar } from "../front/kit";
import { BackHeader, Column, ctaCommit, HoldCard, holdCard, MenuRow, Notice, SectionTitle } from "../hold";
import { Ion } from "../ion";
import { useShell } from "../Shell";
import { Skeleton } from "../ui";
import { UserAvatar } from "./UserAvatar";

function dayText(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

/** The hub's hero: the avatar, big and centred (tap to edit), and the @handle under it. */
export function ProfileHero({ onAvatar }: { onAvatar: () => void }) {
  const me = useMe();
  if (!me.data) {
    return me.error ? <Notice>{describeCreatorError(me.error)}</Notice> : <Skeleton className="mb-6 h-[190px] rounded-[28px]" />;
  }
  const username = chosenUsername(me.data);
  return (
    <HoldCard className="mb-6 flex flex-col items-center px-[18px] py-[22px]">
      <button type="button" onClick={onAvatar} aria-label="Edit avatar" className="mb-3 rounded-[48px] transition-opacity hover:opacity-90">
        <UserAvatar size={96} round fallbackName={username ? `@${username}` : me.data.profile.displayName} />
      </button>
      <p className="max-w-full truncate text-[20px] font-strong tracking-[0.1px] text-white">{username ? `@${username}` : "@—"}</p>
      {me.data.profile.displayName ? <p className="mt-1 max-w-full truncate text-[13px] text-[#9FB7C2]">{me.data.profile.displayName}</p> : null}
    </HoldCard>
  );
}

/* ── Avatar and name (AvatarSheet) ────────────────────────────────── */

export function ProfileEdit({ onBack }: { onBack: () => void }) {
  const me = useMe();
  const { session } = useShell();
  const refresh = useRefresh();
  const m = me.data;

  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"save" | "photo" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // Filled once the profile is read; typing is never overwritten by a re-read.
  const filled = useRef(false);
  useEffect(() => {
    if (!m || filled.current) return;
    filled.current = true;
    setName(m.profile.displayName ?? "");
  }, [m]);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  if (!m) {
    return (
      <Column>
        <BackHeader title="Avatar" onBack={onBack} />
        <Skeleton className="h-[320px] rounded-[28px]" />
      </Column>
    );
  }
  const uid = m.supabaseUid ?? session.user.id;
  const current = chosenUsername(m);

  const nameChanged = name.trim() !== (m.profile.displayName ?? "") && name.trim() !== "";

  const save = async () => {
    setBusy("save");
    setNotice(null);
    try {
      await updateMe({ displayName: name.trim() });
      await refresh("me");
      setSaved(true);
    } catch (e) {
      setNotice(describeCreatorError(e));
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
      setNotice(e instanceof CreatorApiError ? describeCreatorError(e) : "Couldn't load photo. Try again, or pick a different image.");
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
    <Column>
      <BackHeader title="Avatar" onBack={onBack} />
      <p className="mb-5 text-center text-[13px] text-[#9FB7C2]">Pick how your avatar should look.</p>

      <div className="mb-6 flex justify-center">
        <Avatar src={preview ?? m.profile.avatarUrl} name={shownName} size={96} round />
      </div>

      <HoldCard>
        <MenuRow
          icon="image-outline"
          label={busy === "photo" ? "Saving photo…" : "Choose from library"}
          sub="Pick a photo you already have."
          disabled={busy !== null}
          onClick={() => input.current?.click()}
        />
        {m.profile.avatarUrl ? (
          <MenuRow icon="trash-outline" label="Remove photo" sub="Go back to your initial." disabled={busy !== null} onClick={() => void clearPhoto()} />
        ) : null}
      </HoldCard>
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

      <SectionTitle>Display name</SectionTitle>
      <HoldCard className="px-[18px] py-3">
        <label htmlFor="acc-name" className="sr-only">
          Display name
        </label>
        <input
          id="acc-name"
          className="h-11 w-full bg-transparent text-[16px] text-white outline-none placeholder:text-white/40"
          maxLength={60}
          placeholder="Your name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          disabled={busy !== null}
        />
      </HoldCard>
      <p className="mt-2 px-1 text-[12px] text-[#9FB7C2]">Shown on your public pages, next to your @.</p>

      {notice ? (
        <div className="mt-4">
          <Notice>{notice}</Notice>
        </div>
      ) : null}
      <div className="mt-6">
        <button type="button" className={ctaCommit} disabled={!nameChanged || busy !== null} onClick={() => void save()}>
          {busy === "save" ? "Saving…" : saved ? "Saved" : "Save"}
        </button>
      </div>
    </Column>
  );
}

/* ── Username (profile/handle.tsx) ────────────────────────────────── */

export function UsernameScreen({ onBack }: { onBack: () => void }) {
  const me = useMe();
  const refresh = useRefresh();
  const m = me.data;
  const current = chosenUsername(m);
  const changeableAt = m?.aliasChangeableAt ?? null;
  const locked = !!current && !!changeableAt && new Date(changeableAt).getTime() > Date.now();

  const [username, setUsername] = useState("");
  const [verdict, setVerdict] = useState<UsernameVerdict | "checking" | "error" | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const asked = useRef("");

  const filled = useRef(false);
  useEffect(() => {
    if (!m || filled.current) return;
    filled.current = true;
    setUsername(current ?? "");
    setVerdict(current ? "own" : null);
  }, [m, current]);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const onUsername = (raw: string) => {
    const v = cleanUsername(raw).toLowerCase();
    setUsername(v);
    setConfirm(false);
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

  const changed = !!username && username !== current;
  const canContinue = changed && verdict === "available" && !busy && !locked;

  const save = async () => {
    setBusy(true);
    setNotice(null);
    try {
      await updateMe({ aliasHandle: username });
      await refresh("me");
      onBack();
    } catch (e) {
      if (e instanceof CreatorApiError && e.code === "CONFLICT") setVerdict("taken");
      else if (e instanceof CreatorApiError && e.code === "RATE_LIMIT_EXCEEDED") setNotice(e.serverMessage ?? "You can only change your username once every 14 days.");
      else setNotice(describeCreatorError(e));
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  };

  // handle.tsx's status pill: neutral while checking, green when free, orange when not. Never red.
  const pill =
    !changed || !verdict || verdict === "own" ? null : verdict === "checking" ? (
      <StatusPill tone="neutral">Checking…</StatusPill>
    ) : verdict === "available" ? (
      <StatusPill tone="good">Username is available</StatusPill>
    ) : verdict === "error" ? (
      <StatusPill tone="warn">We could not check that right now.</StatusPill>
    ) : verdict === "invalid" ? (
      <StatusPill tone="warn">3 or more letters, numbers, _ . or -</StatusPill>
    ) : (
      <StatusPill tone="warn">Username is not available</StatusPill>
    );

  return (
    <Column>
      <BackHeader title="Username" onBack={onBack} />
      {!m ? (
        <Skeleton className="h-40 rounded-[28px]" />
      ) : (
        <div className="flex flex-col items-center px-6 pt-4">
          <p className="mb-3 text-center text-[15px] font-medium text-[#9FB7C2]">Choose your handle</p>
          <label htmlFor="acc-username" className="sr-only">
            Username
          </label>
          <input
            id="acc-username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={50}
            placeholder="@"
            value={username ? `@${username}` : ""}
            onChange={(e) => onUsername(e.target.value)}
            disabled={busy || locked}
            className="w-full bg-transparent py-1 text-center text-[40px] font-strong tracking-[0.2px] text-white outline-none placeholder:text-white/25 disabled:opacity-70"
          />
          {locked ? (
            <p className="mt-5 text-center text-[12px] font-medium text-[#9FB7C2]">
              You can only change your username once every 14 days. Next change: {dayText(changeableAt ?? "")}.
            </p>
          ) : pill ? (
            <div className="mt-5">{pill}</div>
          ) : (
            <p className="mt-5 text-center text-[12px] font-medium text-[#9FB7C2]">3 or more letters, numbers, _ . or -</p>
          )}
          <p className="mt-3.5 text-[12px] font-medium text-[#9FB7C2]">{username.length}/50</p>
        </div>
      )}

      {notice ? (
        <div className="mt-6">
          <Notice>{notice}</Notice>
        </div>
      ) : null}

      {confirm ? (
        <div className={`${holdCard} mt-8 flex flex-col gap-3 p-5`}>
          <p className="text-[17px] font-strong text-white">Change username?</p>
          <p className="text-[14px] leading-5 text-white/[0.72]">If you change your username now, you won&apos;t be able to change it again for 14 days.</p>
          <button type="button" className={ctaCommit} disabled={busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Change"}
          </button>
          <button type="button" className="h-11 text-[15px] font-strong text-white/80 hover:text-white" disabled={busy} onClick={() => setConfirm(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="mt-10">
          <button type="button" className={ctaCommit} disabled={!canContinue} onClick={() => setConfirm(true)}>
            Continue
          </button>
        </div>
      )}
    </Column>
  );
}

function StatusPill({ tone, children }: { tone: "neutral" | "good" | "warn"; children: React.ReactNode }) {
  const cls =
    tone === "good"
      ? "border-[rgba(34,197,94,0.35)] bg-[rgba(34,197,94,0.10)] text-[#86EFAC]"
      : tone === "warn"
        ? "border-[rgba(251,133,0,0.35)] bg-[rgba(251,133,0,0.10)] text-[#FDBA74]"
        : "border-white/[0.14] bg-white/[0.05] text-white/[0.78]";
  const icon = tone === "good" ? "checkmark-circle" : tone === "warn" ? "alert-circle" : null;
  return (
    <span role="status" className={`inline-flex h-[34px] items-center gap-2 rounded-[17px] border px-3.5 text-[13px] font-strong tracking-[0.1px] ${cls}`}>
      {icon ? <Ion name={icon} size={16} className={tone === "good" ? "text-[#22C55E]" : "text-[#FB8500]"} /> : <span className="h-3.5 w-3.5 animate-spin rounded-[7px] border-2 border-white/30 border-t-white/80" aria-hidden />}
      {children}
    </span>
  );
}
