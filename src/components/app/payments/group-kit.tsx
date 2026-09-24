"use client";

/**
 * The pieces every group screen shares: the sheet, a person's face, a group's
 * face, the emoji picker and the photo picker.
 *
 * Faces follow the contract's order (groups-splitwise-grade.md §1.1): the
 * photo, else the emoji (front/kit's EmojiAvatar, the app's glass disk), else
 * initials, or the HOLD mark for a private person. A photo is a signed link
 * that lasts about an hour; when it fails to load the face falls back to the
 * emoji rather than a broken image.
 */

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { faceOf, type ExpenseCategory, type GroupMember, type Person } from "@/lib/app/groups";
import { useT } from "@/lib/app/i18n/react";
import { IMAGE_ACCEPT, uprightImage } from "@/lib/app/image-upright";

import { EmojiAvatar } from "../front/kit";
import { Ion, type IonName } from "../ion";
import { Modal } from "../Modal";

/** An expense's category, as the chips, the rows and Insights draw it (contract §10.2). None is drawn as Other. */
export const CATEGORY_ICON: Readonly<Record<ExpenseCategory, IonName>> = {
  food: "restaurant-outline",
  drinks: "wine-outline",
  transport: "car-outline",
  stay: "bed-outline",
  activities: "compass-outline",
  groceries: "cart-outline",
  shopping: "bag-handle-outline",
  other: "pricetag-outline",
};

/* ── Buttons this family of screens uses (a pill's radius is half its height) ── */

/** The white plate, 44 high. */
export const plateWhite =
  "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-[12px] bg-[#F1F5F9] px-4 text-[14px] font-extrabold text-[#0A1420] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-white/[0.07] disabled:text-white/60";
/** A small glass pill, 36 high. */
export const pillGlass =
  "inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-[18px] border border-white/[0.22] bg-white/10 px-4 text-[13px] font-bold text-white transition-colors hover:bg-white/[0.14] disabled:opacity-50";
/** A small white pill, 36 high. */
export const pillWhite =
  "inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-[18px] bg-[#F1F5F9] px-4 text-[13px] font-extrabold text-[#0A1420] transition-opacity hover:opacity-90 disabled:bg-white/[0.07] disabled:text-white/60";
/** The destructive choice: amber TINT, never filled, never red. */
export const plateCaution =
  "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-[12px] bg-amber/[0.14] px-4 text-[14px] font-extrabold text-amber transition-colors hover:bg-amber/[0.2] disabled:opacity-50";
export const sectionLabel = "text-[12.5px] font-bold text-white/[0.82]";

/* ── The sheet ────────────────────────────────────────────────────── */

/**
 * A group sheet: the product's one Modal (../Modal), a sheet from the foot on
 * a phone and a centred dialog on a desktop. Kept under this name so every
 * group screen opens the same surface.
 */
export function Sheet({
  title,
  onClose,
  busy = false,
  children,
  wide = false,
  footer,
}: {
  title: ReactNode;
  onClose: () => void;
  busy?: boolean;
  children: ReactNode;
  wide?: boolean;
  footer?: ReactNode;
}) {
  return (
    <Modal title={title} onClose={onClose} busy={busy} size={wide ? "lg" : "md"} footer={footer}>
      {children}
    </Modal>
  );
}

/* ── Faces ────────────────────────────────────────────────────────── */

type FaceSource = Pick<Person, "avatarUrl" | "aliasHandle" | "displayName"> & { avatarEmoji?: string | null; profileVisibility?: string | null };

/** A person: photo, else emoji, else initials, else the HOLD mark for a private person. Always round. */
export function PersonFace({ person, size = 30 }: { person: FaceSource | GroupMember | undefined; size?: number }) {
  const [broken, setBroken] = useState<string | null>(null);
  const face = faceOf({ ...(person ?? {}), avatarUrl: person?.avatarUrl && person.avatarUrl !== broken ? person.avatarUrl : null });
  const round = { width: size, height: size, borderRadius: size / 2 };
  if (face.kind === "photo") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={face.url} alt="" style={round} onError={() => setBroken(face.url)} className="shrink-0 object-cover" />
    );
  }
  if (face.kind === "emoji") return <EmojiAvatar emoji={face.emoji} size={size} />;
  if (face.kind === "hold") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src="/icon.png" alt="" style={round} className="shrink-0 object-cover" />;
  }
  return (
    <span style={round} className="flex shrink-0 items-center justify-center border border-white/10 bg-white/[0.08] font-extrabold text-white/[0.82]" aria-hidden>
      <span style={{ fontSize: Math.round(size * 0.38) }}>{face.text}</span>
    </span>
  );
}

/** A group: its photo, else its emoji, else its initials. */
export function GroupFace({ name, emoji, photoUrl, size = 34 }: { name: string; emoji: string | null | undefined; photoUrl?: string | null; size?: number }) {
  const [broken, setBroken] = useState<string | null>(null);
  const style = { width: size, height: size, borderRadius: size / 2 };
  if (photoUrl && broken !== photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt="" style={style} onError={() => setBroken(photoUrl)} className="shrink-0 object-cover" />;
  }
  if (emoji?.trim()) return <EmojiAvatar emoji={emoji.trim()} size={size} />;
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "G";
  return (
    <span style={{ ...style, fontSize: size * 0.36 }} className="flex shrink-0 items-center justify-center border border-white/10 bg-white/[0.08] font-extrabold text-white/[0.82]" aria-hidden>
      {initials}
    </span>
  );
}

/** A small overlapping row of faces: "Seen by" under a message. */
export function FaceStack({ people, size = 16, max = 4 }: { people: (GroupMember | undefined)[]; size?: number; max?: number }) {
  const shown = people.slice(0, max);
  return (
    <span className="flex items-center" aria-hidden>
      {shown.map((p, i) => (
        <span key={p?.userId ?? i} className="flex ring-2 ring-[#0A1B24]" style={{ marginLeft: i ? -size * 0.3 : 0, borderRadius: size / 2 }}>
          <PersonFace person={p} size={size} />
        </span>
      ))}
    </span>
  );
}

/* ── Emoji picker ─────────────────────────────────────────────────── */

/** The app's set (GroupSplitBuilder's EMOJIS), de-duplicated, trips and money first. */
export const GROUP_EMOJIS: readonly string[] = [
  ...new Set([
    "👥", "🏖️", "✈️", "🏠", "🍕", "🍻", "🎉", "🚗", "🏕️", "⛰️", "🎿", "🏄", "⚽️", "🎮", "💼", "🎁", "☕️", "🍷", "🍔", "🌮",
    "🍰", "🥂", "🎂", "🎸", "🎬", "🏆", "💎", "🚀", "🔥", "🌙", "🌈", "🌊", "🌟", "✨", "🦊", "🐼", "🐳", "🦄", "🐯", "🐻",
    "🦁", "🐉", "😎", "🤑", "🪙", "🧭", "🗺️", "🏨", "🏡", "🏢", "🗼", "🗽", "🏰", "🎡", "🎢", "🚂", "🚢", "⛵️", "🚁", "🛸",
    "🎨", "🎭", "🎯", "🎲", "🎹", "🏀", "🎾", "🏐", "🥊", "🚴", "🏊", "🏋️", "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
  ]),
];

/** A tappable grid of emojis. The chosen one is a white plate; nothing changes a border width. */
export function EmojiGrid({ value, onPick }: { value: string; onPick: (emoji: string) => void }) {
  const t = useT();
  return (
    <div role="listbox" aria-label={t("groups.kit.emoji")} className="grid grid-cols-8 gap-1">
      {GROUP_EMOJIS.map((e) => (
        <button
          key={e}
          type="button"
          role="option"
          aria-selected={e === value}
          onClick={() => onPick(e)}
          className={`flex aspect-square items-center justify-center rounded-[10px] text-[20px] transition-colors ${e === value ? "bg-[#F1F5F9]" : "hover:bg-white/10"}`}
        >
          {e}
        </button>
      ))}
    </div>
  );
}

/**
 * The group's face, chosen: the emoji in a disk that opens the grid, and an
 * optional photo beside it. The photo is only picked here; the caller uploads
 * it after the group exists (POST /groups/:id/photo), as the contract says.
 */
export function FacePicker({
  name,
  emoji,
  onEmoji,
  photo,
  onPhoto,
  photoUrl,
  onRemovePhoto,
  disabled,
}: {
  name: string;
  emoji: string;
  onEmoji: (e: string) => void;
  /** A picked, prepared photo not yet uploaded. */
  photo: Blob | null;
  onPhoto: (b: Blob | null) => void;
  /** The group's current photo, when editing. */
  photoUrl?: string | null;
  onRemovePhoto?: () => void;
  disabled?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const preview = useObjectUrl(photo);
  const shown = preview ?? photoUrl ?? null;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={disabled}
          aria-expanded={open}
          aria-label={t("groups.kit.chooseEmoji")}
          className="relative shrink-0 rounded-[32px] transition-opacity hover:opacity-90"
        >
          <GroupFace name={name || t("groups.kit.groupFallback")} emoji={emoji} photoUrl={shown} size={64} />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-[12px] bg-[#F1F5F9] text-[#0A1420]">
            <Ion name="create-outline" size={13} />
          </span>
        </button>
        <div className="flex min-w-0 flex-col gap-1.5">
          <PhotoButton label={shown ? t("groups.kit.changePhoto") : t("groups.kit.addPhoto")} onPicked={onPhoto} disabled={disabled} />
          {shown ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => (photo ? onPhoto(null) : onRemovePhoto?.())}
              className="self-start rounded-[10px] px-2 py-1 text-[12.5px] font-bold text-white/70 hover:bg-white/10 hover:text-white"
            >
              {t("groups.kit.removePhoto")}
            </button>
          ) : (
            <span className="px-0.5 text-[12px] text-white/55">{t("groups.kit.photoOptional")}</span>
          )}
        </div>
      </div>
      {open ? (
        <div className="rounded-[14px] border border-white/10 bg-white/[0.04] p-2">
          <EmojiGrid
            value={emoji}
            onPick={(e) => {
              onEmoji(e);
              setOpen(false);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Choose an image file; it comes back upright and under 3 MB, or the words for why not. */
export function PhotoButton({
  label,
  onPicked,
  onError,
  disabled,
  className = pillGlass,
  icon = "camera-outline",
}: {
  label: string;
  onPicked: (b: Blob) => void;
  onError?: (words: string) => void;
  disabled?: boolean;
  className?: string;
  icon?: "camera-outline" | "image-outline" | "receipt-outline";
}) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <>
      <button type="button" className={`${className} self-start`} disabled={disabled || busy} onClick={() => input.current?.click()}>
        <Ion name={icon} size={15} />
        {busy ? t("groups.kit.preparing") : label}
      </button>
      <input
        ref={input}
        type="file"
        accept={IMAGE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          setProblem(null);
          uprightImage(file)
            .then(onPicked)
            .catch((err: unknown) => {
              const words = err instanceof Error && err.message.startsWith("image:") ? err.message.slice(6) : t("groups.kit.imageUnusable");
              if (onError) onError(words);
              else setProblem(words);
            })
            .finally(() => setBusy(false));
        }}
      />
      {problem ? <span className="text-[12px] text-amber">{problem}</span> : null}
    </>
  );
}

/** An object URL for a blob, revoked when it changes or the screen goes. */
export function useObjectUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

/** An honest failure with a way back: the words and Retry. */
export function LoadFailed({ words, onRetry }: { words: string; onRetry: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center px-4 py-6 text-center">
      <Ion name="alert-circle-outline" size={40} className="text-white/40" />
      <p className="mt-2 text-[13.5px] text-white/[0.72]">{words}</p>
      <button type="button" onClick={onRetry} className={`${pillGlass} mt-3`}>
        <Ion name="refresh" size={14} />
        {t("common.retry")}
      </button>
    </div>
  );
}

/* ── Currency ─────────────────────────────────────────────────────── */

export const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "MXN", "BRL", "ARS", "COP", "CLP", "PEN", "CAD", "AUD", "CHF", "JPY", "SGD", "AED"] as const;

/** A three-letter code, typed or picked from the common ones. */
export function CurrencyInput({ value, onChange, disabled, label, className = "" }: { value: string; onChange: (v: string) => void; disabled?: boolean; label?: string; className?: string }) {
  const t = useT();
  const listId = useId();
  return (
    <>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase())}
        list={listId}
        aria-label={label ?? t("groups.kit.currency")}
        disabled={disabled}
        autoCapitalize="characters"
        spellCheck={false}
        className={`h-12 w-full min-w-0 rounded-[16px] border border-white/[0.12] bg-white/[0.06] px-3 text-center text-[15.5px] font-bold uppercase text-white outline-none transition-colors focus:border-white/30 disabled:opacity-60 ${className}`}
      />
      <datalist id={listId}>
        {COMMON_CURRENCIES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </>
  );
}
