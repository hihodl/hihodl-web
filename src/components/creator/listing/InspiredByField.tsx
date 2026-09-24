/**
 * "Inspired by": who the creator credits for this listing. Optional.
 *
 * Creators recognising each other: a HOLD creator found by their username
 * (they are told, and it shows on their Overview), or any X handle typed in.
 * The public page shows "Inspired by @handle", linked to the HOLD creator's
 * page or to x.com.
 */

"use client";

import { useEffect, useRef, useState } from "react";

import type { MessageKey } from "@/lib/app/i18n";
import { useT } from "@/lib/app/i18n/react";
import { searchCreators, type HoldCreatorHit } from "@/lib/creator/analytics";
import type { InspiredBy } from "@/lib/creator/listing";

import { Ion } from "@/components/app/ion";
import { Chip, ChipRow, emptyBtn } from "@/components/app/spaces/kit";

import { btnSmallGlass, Field, Text } from "./parts";

type Mode = "hold" | "x";

const MODES: { value: Mode; label: MessageKey }[] = [
  { value: "hold", label: "listings.inspired.modeHold" },
  { value: "x", label: "listings.inspired.modeX" },
];

const X_HANDLE = /^[A-Za-z0-9_]{1,15}$/;
const clean = (h: string) => h.trim().replace(/^@+/, "");

export function InspiredByField({
  value,
  onChange,
  problems,
}: {
  value: InspiredBy | null;
  onChange: (next: InspiredBy | null) => void;
  problems: readonly string[];
}) {
  const t = useT();
  const [mode, setMode] = useState<Mode>(value?.kind ?? "hold");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<HoldCreatorHit[]>([]);
  const [searching, setSearching] = useState(false);
  const asked = useRef(0);

  useEffect(() => {
    if (mode !== "hold" || value) return;
    const q = clean(query);
    if (!q) {
      setHits([]);
      return;
    }
    const n = ++asked.current;
    const timer = setTimeout(() => {
      setSearching(true);
      searchCreators(q)
        .then((r) => n === asked.current && setHits(r.creators))
        .catch(() => n === asked.current && setHits([]))
        .finally(() => n === asked.current && setSearching(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, mode, value]);

  const typed = clean(query);

  return (
    <Field
      label={t("listings.inspired.label")}
      hint={t("listings.inspired.hint")}
      problems={problems}
      htmlFor="listing-inspired"
    >
      {value ? (
        <div className="flex min-w-0 items-center justify-between gap-3 rounded-[14px] border border-white/10 bg-white/[0.06] px-3 py-[11px]">
          <Ion name={value.kind === "hold" ? "person-circle-outline" : "logo-x"} size={18} className="shrink-0 text-white/[0.62]" />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-[14.5px] font-bold text-white">{t("listings.inspired.byHandle", { handle: value.handle })}</span>
            <span className="truncate text-[12.5px] text-white/55">{[value.name, value.kind === "hold" ? t("listings.inspired.holdCreator") : "X"].filter(Boolean).join(" · ")}</span>
          </span>
          <button
            type="button"
            className={btnSmallGlass}
            onClick={() => {
              onChange(null);
              setQuery("");
            }}
          >
            {t("common.remove")}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <ChipRow label={t("listings.inspired.who")}>
            {MODES.map((m) => (
              <Chip
                key={m.value}
                label={t(m.label)}
                selected={m.value === mode}
                onClick={() => {
                  setMode(m.value);
                  setHits([]);
                }}
              />
            ))}
          </ChipRow>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="min-w-0 flex-1">
              <Text
                id="listing-inspired"
                value={query}
                onChange={setQuery}
                maxLength={41}
                placeholder={mode === "hold" ? t("listings.inspired.searchPlaceholder") : t("listings.inspired.xPlaceholder")}
              />
            </div>
            {mode === "x" ? (
              <button
                type="button"
                disabled={!X_HANDLE.test(typed)}
                onClick={() => onChange({ kind: "x", handle: typed })}
                className={`${emptyBtn} !h-12 !rounded-[24px] shrink-0 disabled:opacity-45`}
              >
                {t("listings.inspired.credit", { handle: typed || t("listings.inspired.handleWord") })}
              </button>
            ) : null}
          </div>
          {mode === "hold" && typed ? (
            hits.length ? (
              <ul className="flex flex-col gap-2" aria-label={t("listings.inspired.holdCreators")}>
                {hits.map((h) => (
                  <li key={h.handle}>
                    <button
                      type="button"
                      onClick={() => onChange({ kind: "hold", handle: h.handle, name: h.name })}
                      className="flex w-full min-w-0 items-center gap-2.5 rounded-[14px] border border-white/10 bg-white/[0.06] px-3 py-[11px] text-left transition-colors hover:bg-white/[0.09]"
                    >
                      {h.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={h.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-[8px] object-cover" />
                      ) : (
                        <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-white/10 text-[12px] font-bold text-white">
                          {h.handle.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-[14.5px] font-bold text-white">@{h.handle}</span>
                        <span className="block truncate text-[12.5px] text-white/55">
                          {[h.name, h.username ? t("listings.inspired.holdUsername", { username: h.username }) : null].filter(Boolean).join(" · ") ||
                            t("listings.inspired.holdCreator")}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] leading-4 text-white/55">
                {searching ? t("listings.eventPicker.looking") : t("listings.inspired.noneFound")}
              </p>
            )
          ) : null}
        </div>
      )}
    </Field>
  );
}
