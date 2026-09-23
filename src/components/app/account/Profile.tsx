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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CreatorApiError, describeCreatorError } from "@/lib/creator/api";
import {
  checkUsername,
  chosenUsername,
  cleanUsername,
  cropToJpeg,
  describeProfileError,
  loadImage,
  removeAvatar,
  updateMe,
  uploadAvatar,
  type CropRect,
  type Me,
  type ProfileVisibility,
  type UsernameVerdict,
} from "@/lib/app/me";
import { useMe, useRefresh } from "@/lib/app/spaces-data";

import { DEFAULT_AVATAR_EMOJI, EmojiAvatar } from "../front/kit";
import { BackHeader, Column, ctaCommit, HoldCard, holdCard, MenuRow, Notice, SectionTitle } from "../hold";
import { Ion, type IonName } from "../ion";
import { Sheet } from "../payments/group-kit";
import { useShell } from "../Shell";
import { Skeleton } from "../ui";
import { AvatarCropper } from "./AvatarCropper";
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

export function ProfileEdit({ onBack, onEmoji }: { onBack: () => void; onEmoji: () => void }) {
  const me = useMe();
  const { session } = useShell();
  const refresh = useRefresh();
  const m = me.data;

  const [name, setName] = useState("");
  /** The photo being cropped. Null until one is picked; cleared once uploaded. */
  const [picked, setPicked] = useState<HTMLImageElement | null>(null);
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

  if (!m) {
    return (
      <Column>
        <BackHeader title="Avatar" onBack={onBack} />
        <Skeleton className="h-[320px] rounded-[28px]" />
      </Column>
    );
  }
  const uid = m.supabaseUid ?? session.user.id;

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

  /**
   * A picked file is DECODED, not uploaded. Nothing leaves until a square has
   * been chosen — the old behaviour uploaded on pick and centre-cropped, which
   * is how a portrait ended up cut off at the eyebrows with no way back.
   */
  const pick = async (f: File | null) => {
    if (!f) return;
    setNotice(null);
    try {
      setPicked(await loadImage(f));
    } catch {
      setNotice("That file is not an image we can read. Try a JPEG or a PNG.");
    }
  };

  const applyCrop = async (rect: CropRect) => {
    if (!picked) return;
    setBusy("photo");
    setNotice(null);
    try {
      await uploadAvatar(await cropToJpeg(picked, rect), uid, m.profile.avatarUrl);
      await refresh("me");
      setPicked(null);
    } catch (e) {
      setNotice(e instanceof CreatorApiError ? describeCreatorError(e) : "Couldn't save that photo. Try again, or pick a different image.");
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

  // An API that predates the emoji avatar sends no `avatarEmoji` key at all.
  const emojiSupported = "avatarEmoji" in m.profile;
  return (
    <Column>
      <BackHeader title="Avatar" onBack={onBack} />

      {picked ? (
        <AvatarCropper
          image={picked}
          busy={busy === "photo"}
          onCancel={() => {
            setPicked(null);
            input.current?.click();
          }}
          onConfirm={(rect) => void applyCrop(rect)}
        />
      ) : (
        <>
          <p className="mb-5 text-center text-[13px] text-[#9FB7C2]">Pick how your avatar should look.</p>

          <div className="mb-6 flex justify-center">
            <UserAvatar size={96} round />
          </div>

          <HoldCard>
            <MenuRow
              icon="image-outline"
              label="Choose from library"
              sub="Pick a photo, then choose the part that shows."
              disabled={busy !== null}
              onClick={() => input.current?.click()}
            />
            {emojiSupported ? <MenuRow icon="happy-outline" label="Pick emoji" sub="Shown whenever there is no photo." disabled={busy !== null} onClick={onEmoji} /> : null}
            {m.profile.avatarUrl ? (
              <MenuRow icon="trash-outline" label="Remove photo" sub="Go back to your emoji." disabled={busy !== null} onClick={() => void clearPhoto()} />
            ) : null}
          </HoldCard>
        </>
      )}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        className="hidden"
        onChange={(e) => {
          void pick(e.target.files?.[0] ?? null);
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

/* ── Emoji and visibility: saved at once, put back if HOLD refuses ── */

type ProfileChoice = Partial<Pick<Me["profile"], "avatarEmoji" | "profileVisibility">>;

/**
 * Save one choice the way the app does (tap and it applies), but honestly:
 * the /me cache shows the choice at once, is put back as it was if PATCH /me
 * refuses, and is read again after a success so every face (UserAvatar, the
 * sign-in door's remembered face, group lists) follows.
 */
function useSaveProfileChoice(): (patch: ProfileChoice) => Promise<void> {
  const me = useMe();
  const refresh = useRefresh();
  const { data, mutate } = me;
  return useCallback(
    async (patch: ProfileChoice) => {
      if (!data) return;
      const before: Me = data;
      await mutate({ ...before, profile: { ...before.profile, ...patch } }, { revalidate: false });
      try {
        await updateMe({ avatarEmoji: patch.avatarEmoji, profileVisibility: patch.profileVisibility ?? undefined });
      } catch (e) {
        await mutate(before, { revalidate: false });
        throw e;
      }
      await refresh("me");
    },
    [data, mutate, refresh],
  );
}

/** profile/avatar-emoji.tsx's set, in its order. */
const AVATAR_EMOJIS: readonly string[] = [
  "🚀", "🔥", "🔒", "🔮", "🖼️", "💯", "🔌", "⛓️", "🌙", "👻",
  "👾", "🤖", "😎", "💎", "🙌", "🧠", "📱", "🤑", "🪙", "🧭",
  "🏴‍☠️", "🛡️", "⚡️", "🌐", "🦊", "🐼", "🐳", "🦄", "🐵", "🐉",
  "🐯", "🐻", "🦁", "🕊️", "🌈", "🌋", "🌊", "🌪️", "🌟", "✨",
  "🛰️", "🪐", "🌌", "🗝️",
];

/** The app's keyword search: a hit moves to the front, the rest of the grid stays. */
const EMOJI_KEYWORDS: Record<string, readonly string[]> = {
  rocket: ["🚀"],
  fire: ["🔥"],
  lock: ["🔒"],
  crystal: ["🔮"],
  diamond: ["💎"],
  moon: ["🌙"],
  ghost: ["👻"],
  robot: ["🤖"],
  fox: ["🦊"],
  coin: ["🪙"],
  brain: ["🧠"],
  phone: ["📱"],
  star: ["🌟", "✨"],
  wave: ["🌊"],
};

/** profile/avatar-emoji.tsx: the preview, the search, the grid. A tap saves and goes back. */
export function EmojiScreen({ onBack }: { onBack: () => void }) {
  const me = useMe();
  const save = useSaveProfileChoice();
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const m = me.data;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return AVATAR_EMOJIS;
    return Array.from(new Set([...(EMOJI_KEYWORDS[q] ?? []), ...AVATAR_EMOJIS]));
  }, [search]);

  if (!m) {
    return (
      <Column>
        <BackHeader title="Pick emoji" onBack={onBack} />
        {me.error ? <Notice>{describeCreatorError(me.error)}</Notice> : <Skeleton className="h-[320px] rounded-[28px]" />}
      </Column>
    );
  }
  if (!("avatarEmoji" in m.profile)) {
    return (
      <Column>
        <BackHeader title="Pick emoji" onBack={onBack} />
        <Notice tone="calm">Emoji avatars are not available on the web yet. You can pick one in the HOLD app.</Notice>
      </Column>
    );
  }
  const current = m.profile.avatarEmoji?.trim() || DEFAULT_AVATAR_EMOJI;

  const pick = async (emoji: string) => {
    if (busy) return;
    if (emoji === current) return onBack();
    setBusy(true);
    setNotice(null);
    try {
      await save({ avatarEmoji: emoji });
      onBack();
    } catch (e) {
      setNotice(describeProfileError(e, describeCreatorError));
      setBusy(false);
    }
  };

  return (
    <Column>
      <BackHeader title="Pick emoji" onBack={onBack} />
      <div className="mb-4 mt-1 flex justify-center">
        <EmojiAvatar emoji={current} size={96} />
      </div>
      {m.profile.avatarUrl ? <p className="mb-4 text-center text-[13px] text-[#9FB7C2]">Your photo shows while you have one. This emoji takes its place when you remove it.</p> : null}

      <label className="mb-2 flex items-center rounded-[16px] border border-white/[0.08] bg-white/[0.06] px-3.5 py-3">
        <Ion name="search" size={16} className="mr-2 shrink-0 text-white/65" />
        <span className="sr-only">Search emoji</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search… rocket, moon, diamond…"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/65"
        />
      </label>

      {notice ? (
        <div className="mb-2">
          <Notice>{notice}</Notice>
        </div>
      ) : null}

      <div role="listbox" aria-label="Emoji" aria-busy={busy} className="grid grid-cols-6 gap-1.5">
        {filtered.map((e) => {
          const selected = e === current;
          return (
            <button
              key={e}
              type="button"
              role="option"
              aria-selected={selected}
              aria-label={`Select ${e}`}
              disabled={busy}
              onClick={() => void pick(e)}
              className={`flex aspect-square items-center justify-center rounded-[14px] border text-[28px] transition-colors disabled:cursor-wait ${
                selected ? "border-[rgba(255,183,3,0.45)] bg-[rgba(255,183,3,0.12)]" : "border-transparent bg-white/[0.03] hover:bg-white/[0.08]"
              }`}
            >
              {e}
            </button>
          );
        })}
      </div>
    </Column>
  );
}

/** The row's value on the Profile hub. */
export function visibilityLabel(v: ProfileVisibility | null | undefined): string {
  return v === "private" ? "Private" : v === "invisible" ? "Invisible" : "Public";
}

const VISIBILITY_OPTIONS: { id: ProfileVisibility; icon: IonName; title: string; body: string }[] = [
  { id: "public", icon: "globe-outline", title: "Public", body: "Anyone on HOLD can find you in search. Your profile photo is visible." },
  {
    id: "private",
    icon: "shield-outline",
    title: "Private",
    body: "Only people who know your exact @username can find you. Photo is hidden — you appear with the HOLD logo.",
  },
  {
    id: "invisible",
    icon: "eye-off-outline",
    title: "Invisible",
    body: "Your @username is off. Nobody can find you on HOLD. You still receive money at your virtual accounts (IBAN, US bank, PIX, CLABE) and your on-chain address.",
  },
];

/** profile/_components/VisibilitySheet.tsx: three rows, a tap saves and closes. */
export function VisibilitySheet({ onClose }: { onClose: () => void }) {
  const me = useMe();
  const save = useSaveProfileChoice();
  const [busy, setBusy] = useState<ProfileVisibility | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const current: ProfileVisibility = me.data?.profile.profileVisibility ?? "public";

  const choose = async (id: ProfileVisibility) => {
    if (busy) return;
    if (id === current) return onClose();
    setBusy(id);
    setNotice(null);
    try {
      await save({ profileVisibility: id });
      onClose();
    } catch (e) {
      setNotice(describeProfileError(e, describeCreatorError));
      setBusy(null);
    }
  };

  return (
    <Sheet title="Profile visibility" onClose={onClose} busy={busy !== null} wide>
      <p className="text-[14px] leading-5 text-white/65">Control how other people find you on HOLD. You can change this any time.</p>
      {notice ? <Notice>{notice}</Notice> : null}
      <div role="radiogroup" aria-label="Profile visibility" className="flex flex-col gap-3">
        {VISIBILITY_OPTIONS.map((opt) => {
          const selected = current === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={busy !== null}
              onClick={() => void choose(opt.id)}
              className={`flex items-start gap-3.5 rounded-[16px] border px-4 py-[18px] text-left transition-colors disabled:cursor-wait ${
                selected ? "border-[rgba(255,183,3,0.28)] bg-[rgba(255,183,3,0.06)]" : "border-white/[0.08] bg-white/[0.06] hover:bg-white/10"
              }`}
            >
              <span className={`mt-px flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${selected ? "bg-[rgba(255,183,3,0.12)] text-[#FFB703]" : "bg-[rgba(143,211,227,0.10)] text-[#8FD3E3]"}`}>
                <Ion name={opt.icon} size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-bold text-white">{opt.title}</span>
                <span className="mt-[5px] block text-[14px] leading-5 text-white/65">{opt.body}</span>
              </span>
              {busy === opt.id ? (
                <span className="mt-0.5 h-5 w-5 shrink-0 animate-spin rounded-[10px] border-2 border-white/30 border-t-white/80" aria-hidden />
              ) : (
                <Ion name={selected ? "radio-button-on" : "radio-button-off"} size={20} className={`mt-0.5 shrink-0 ${selected ? "text-[#FFB703]" : "text-white/45"}`} />
              )}
            </button>
          );
        })}
      </div>
    </Sheet>
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
