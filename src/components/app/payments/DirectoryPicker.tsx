"use client";

/**
 * Choosing people from the HOLD directory: making a group, and "Add people"
 * inside one.
 *
 * From three letters it lists everyone whose @username or name CONTAINS them
 * (GET /search/users?mode=directory, the contract's §1.2: exact, then prefix,
 * then contains, ranked by the server), each with their face, and any number
 * can be ticked. A private person only appears on their exact username, with
 * no photo, and an invisible one never does: that is the server's rule, and
 * nothing here second-guesses it.
 *
 * When nothing matches, the exact-username row stays as a fallback: "@name"
 * looked up as one exact handle (the default `resolve` mode), so somebody who
 * knows a friend's handle is never stuck on a search that found no one. A
 * miss is said as a miss, never as a guess.
 */

import { useState } from "react";

import { describeGroupError, memberName, resolveExactHandle, useDirectorySearch, type Person } from "@/lib/app/groups";
import { useT } from "@/lib/app/i18n/react";

import { Ion } from "../ion";
import { Skeleton } from "../ui";
import { PersonFace, pillGlass } from "./group-kit";

const MIN = 3;

export function DirectoryPicker({
  selected,
  onChange,
  exclude = [],
  max,
  disabled,
}: {
  selected: Person[];
  onChange: (people: Person[]) => void;
  /** Ids that can't be picked: you, and the people already in the group. */
  exclude?: readonly string[];
  max?: number;
  disabled?: boolean;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const search = useDirectorySearch(query, MIN);
  const bare = query.trim().replace(/^@+/, "");
  const chosen = new Set(selected.map((p) => p.id));
  const excluded = new Set(exclude);
  const full = max !== undefined && selected.length >= max;
  const rows = (search.users ?? []).filter((p) => !excluded.has(p.id));

  const toggle = (p: Person) => {
    if (chosen.has(p.id)) onChange(selected.filter((x) => x.id !== p.id));
    else if (!full) onChange([...selected, p]);
  };

  const showFallback =
    bare.length >= 2 && /^[A-Za-z0-9_.-]{2,40}$/.test(bare) && !search.loading && !search.error && (!search.active || (search.users !== null && rows.length === 0));

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      {selected.length ? (
        <div className="flex flex-wrap gap-1.5" aria-label={t("payments.picker.chosenAria")}>
          {selected.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              onClick={() => toggle(p)}
              aria-label={t("payments.picker.remove", { name: memberName(p) })}
              className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-[16px] bg-[#F1F5F9] pl-1 pr-2.5 text-[13px] font-bold text-[#0A1420]"
            >
              <PersonFace person={p} size={24} />
              <span className="min-w-0 truncate">{memberName(p)}</span>
              <Ion name="close" size={13} />
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex min-h-12 w-full min-w-0 items-center gap-2 rounded-[16px] border border-white/[0.12] bg-white/[0.06] px-3.5 text-[15.5px] text-white transition-colors focus-within:border-white/30">
        <Ion name="search-outline" size={17} className="shrink-0 text-white/55" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value.slice(0, 100))}
          placeholder={t("payments.picker.placeholder")}
          aria-label={t("payments.picker.searchAria")}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          disabled={disabled}
          className="min-w-0 flex-1 bg-transparent py-2.5 outline-none placeholder:text-white/[0.45]"
        />
        {query ? (
          <button type="button" onClick={() => setQuery("")} aria-label={t("payments.search.clear")} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[14px] text-white/55 hover:bg-white/10 hover:text-white">
            <Ion name="close-circle" size={17} />
          </button>
        ) : null}
      </div>

      {full ? <p className="px-1 text-[12.5px] text-white/60">{t("payments.picker.full", { max })}</p> : null}

      {!search.active && bare.length > 0 && bare.length < MIN ? (
        <p className="px-1 text-[12.5px] text-white/55">{t("payments.picker.minLetters", { count: MIN })}</p>
      ) : null}

      {search.active && search.loading && search.users === null ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-11 rounded-[12px]" />
          <Skeleton className="h-11 rounded-[12px]" />
        </div>
      ) : null}

      {search.error ? (
        <div className="flex items-center gap-2 rounded-[12px] bg-amber/[0.12] px-3 py-2">
          <span className="min-w-0 flex-1 text-[13px] text-amber">{describeGroupError(search.error)}</span>
          <button type="button" className={pillGlass} onClick={search.retry}>
            {t("common.retry")}
          </button>
        </div>
      ) : null}

      {search.active && search.users !== null ? (
        <div role="listbox" aria-multiselectable="true" aria-label={t("payments.picker.listAria")} className="flex flex-col gap-1">
          {rows.length === 0 ? <p className="px-1 text-[13px] text-white/60">{t("payments.picker.noMatch", { query: bare })}</p> : null}
          {rows.map((p) => {
            const on = chosen.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={on}
                disabled={disabled || (!on && full)}
                onClick={() => toggle(p)}
                className={`flex min-w-0 items-center gap-2.5 rounded-[12px] px-2 py-2 text-left transition-colors disabled:opacity-50 ${on ? "bg-white/[0.12]" : "hover:bg-white/[0.07]"}`}
              >
                <PersonFace person={p} size={34} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[14.5px] font-bold text-white">{p.displayName?.trim() || memberName(p)}</span>
                  {p.aliasHandle ? <span className="truncate text-[12.5px] text-white/60">@{p.aliasHandle.replace(/^@+/, "")}</span> : null}
                </span>
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[12px] ${on ? "bg-[#F1F5F9] text-[#0A1420]" : "bg-white/[0.08] text-transparent"}`}
                  aria-hidden
                >
                  <Ion name="checkmark" size={15} />
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {showFallback ? <ExactHandleRow handle={bare} disabled={disabled || full} exclude={excluded} chosen={chosen} onFound={(p) => onChange([...selected, p])} /> : null}
    </div>
  );
}

/**
 * The fallback: "@name" as one exact username. The default search mode
 * answers exactly that person when the handle is theirs, and ranked rows
 * otherwise; only a row whose handle IS the text counts.
 */
function ExactHandleRow({
  handle,
  disabled,
  exclude,
  chosen,
  onFound,
}: {
  handle: string;
  disabled?: boolean;
  exclude: ReadonlySet<string>;
  chosen: ReadonlySet<string>;
  onFound: (p: Person) => void;
}) {
  const t = useT();
  const [state, setState] = useState<{ for: string; busy: boolean; words: string | null }>({ for: handle, busy: false, words: null });
  const words = state.for === handle ? state.words : null;
  const busy = state.for === handle && state.busy;

  const look = () => {
    setState({ for: handle, busy: true, words: null });
    resolveExactHandle(handle).then(
      (p) => {
        if (!p) setState({ for: handle, busy: false, words: t("payments.picker.noSuchHandle", { handle }) });
        else if (exclude.has(p.id)) setState({ for: handle, busy: false, words: t("payments.picker.alreadyInGroup", { handle }) });
        else if (chosen.has(p.id)) setState({ for: handle, busy: false, words: t("payments.picker.alreadyChosen", { handle }) });
        else {
          setState({ for: handle, busy: false, words: null });
          onFound(p);
        }
      },
      (e) => setState({ for: handle, busy: false, words: describeGroupError(e) }),
    );
  };

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={look}
        disabled={disabled || busy}
        className="flex min-w-0 items-center gap-2.5 rounded-[12px] border border-dashed border-white/[0.18] px-2 py-2 text-left transition-colors hover:bg-white/[0.07] disabled:opacity-50"
      >
        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[17px] bg-white/[0.08]">
          <Ion name="at-outline" size={17} className="text-white/75" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[14.5px] font-bold text-white">{busy ? t("payments.picker.looking") : t("payments.picker.addHandle", { handle })}</span>
          <span className="truncate text-[12.5px] text-white/60">{t("payments.picker.byExactHandle")}</span>
        </span>
      </button>
      {words ? <p className="px-1 text-[12.5px] text-amber">{words}</p> : null}
    </div>
  );
}
