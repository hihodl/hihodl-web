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

import { searchCreators, type HoldCreatorHit } from "@/lib/creator/analytics";
import type { InspiredBy } from "@/lib/creator/listing";

import { Field, Text } from "./parts";

type Mode = "hold" | "x";

const MODES: { value: Mode; label: string }[] = [
  { value: "hold", label: "A HOLD creator" },
  { value: "x", label: "An X handle" },
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
    const t = setTimeout(() => {
      setSearching(true);
      searchCreators(q)
        .then((r) => n === asked.current && setHits(r.creators))
        .catch(() => n === asked.current && setHits([]))
        .finally(() => n === asked.current && setSearching(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query, mode, value]);

  const typed = clean(query);

  return (
    <Field
      label="Inspired by"
      hint="Optional. Credit the creator who did it first or did it well. A HOLD creator is told and sees it on their Overview; your page shows “Inspired by @them”, linked to them."
      problems={problems}
      htmlFor="listing-inspired"
    >
      {value ? (
        <div className="flex min-w-0 items-center justify-between gap-3 rounded-input border border-[color:var(--color-hairline-strong)] px-4 py-3">
          <p className="min-w-0 truncate text-small text-text">
            Inspired by <span className="font-medium">@{value.handle}</span>
            {value.name ? <span className="text-text-muted"> · {value.name}</span> : null}
            <span className="text-text-muted"> · {value.kind === "hold" ? "HOLD creator" : "X"}</span>
          </p>
          <button
            type="button"
            className="h-9 shrink-0 rounded-[18px] border border-[color:var(--color-hairline-strong)] px-4 text-tiny text-text transition-colors duration-180 hover:bg-white/5"
            onClick={() => {
              onChange(null);
              setQuery("");
            }}
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div role="group" aria-label="Who inspired it" className="flex flex-wrap gap-2">
            {MODES.map((m) => {
              const on = m.value === mode;
              return (
                <button
                  key={m.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setMode(m.value);
                    setHits([]);
                  }}
                  className={`h-9 rounded-[18px] border px-4 text-tiny transition-colors duration-180 ${
                    on ? "border-amber bg-amber/10 text-text" : "border-[color:var(--color-hairline-strong)] text-text-muted hover:bg-white/5"
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="min-w-0 flex-1">
              <Text
                id="listing-inspired"
                value={query}
                onChange={setQuery}
                maxLength={41}
                placeholder={mode === "hold" ? "Search by username" : "@handle on X"}
              />
            </div>
            {mode === "x" ? (
              <button
                type="button"
                disabled={!X_HANDLE.test(typed)}
                onClick={() => onChange({ kind: "x", handle: typed })}
                className="h-12 shrink-0 rounded-[24px] border border-[color:var(--color-hairline-strong)] px-5 text-small text-text transition-colors duration-180 hover:bg-white/5 disabled:opacity-40"
              >
                Credit @{typed || "handle"}
              </button>
            ) : null}
          </div>
          {mode === "hold" && typed ? (
            hits.length ? (
              <ul className="flex flex-col gap-1" aria-label="HOLD creators">
                {hits.map((h) => (
                  <li key={h.handle}>
                    <button
                      type="button"
                      onClick={() => onChange({ kind: "hold", handle: h.handle, name: h.name })}
                      className="flex w-full min-w-0 items-center gap-3 rounded-input px-3 py-2 text-left transition-colors duration-180 hover:bg-white/5"
                    >
                      {h.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={h.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-[8px] object-cover" />
                      ) : (
                        <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-white/10 text-tiny text-text">
                          {h.handle.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-small text-text">@{h.handle}</span>
                        <span className="block truncate text-tiny text-text-muted">
                          {[h.name, h.username ? `HOLD username ${h.username}` : null].filter(Boolean).join(" · ") || "HOLD creator"}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-tiny text-text-muted">
                {searching ? "Looking…" : "No HOLD creator by that name. Not on HOLD? Credit their X handle instead."}
              </p>
            )
          ) : null}
        </div>
      )}
    </Field>
  );
}
