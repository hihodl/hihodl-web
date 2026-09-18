"use client";

/**
 * ⌘K: every page, listing and open offer the signed-in person can reach, by
 * name. The dashboard's palette, pointed at Spaces.
 */

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { IconListings, IconOffers, IconPlus, IconSearch } from "./icons";

export interface PaletteEntry {
  id: string;
  group: "Pages" | "Listings" | "Offers" | "Actions";
  label: string;
  sub?: string;
  href: string;
  keywords?: string;
  icon?: ReactNode;
}

export function CommandPalette({ entries, onClose }: { entries: readonly PaletteEntry[]; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const list = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hit = (e: PaletteEntry) =>
      !q || `${e.label} ${e.sub ?? ""} ${e.keywords ?? ""}`.toLowerCase().includes(q);
    return entries.filter(hit).slice(0, 40);
  }, [entries, query]);

  const groups = useMemo(() => {
    const order: PaletteEntry["group"][] = ["Actions", "Pages", "Listings", "Offers"];
    return order
      .map((g) => ({ group: g, items: matches.filter((m) => m.group === g) }))
      .filter((g) => g.items.length > 0);
  }, [matches]);

  const flat = groups.flatMap((g) => g.items);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function go(e: PaletteEntry | undefined) {
    if (!e) return;
    onClose();
    router.push(e.href);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]">
      <button aria-label="Close search" className="absolute inset-0 bg-[#030b13]/70 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-label="Search"
        className="relative z-10 w-full max-w-[560px] overflow-hidden rounded-[18px] border border-white/15 bg-[linear-gradient(155deg,rgba(8,20,32,0.98),rgba(5,13,22,0.98))] shadow-[0_32px_64px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3.5">
          <IconSearch className="shrink-0 text-[#9FB7C2]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(flat.length - 1, c + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(0, c - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                go(flat[cursor]);
              }
            }}
            placeholder="Search listings, offers, pages"
            aria-label="Search"
            className="min-w-0 flex-1 bg-transparent text-small text-text placeholder:text-[#6B8A99] outline-none"
          />
          <kbd className="hidden rounded-[4px] border border-white/15 px-1.5 py-0.5 text-[10px] text-[#9FB7C2] sm:block">ESC</kbd>
        </div>

        <div ref={list} className="max-h-[60vh] overflow-y-auto p-2">
          {flat.length === 0 ? (
            <p className="px-4 py-8 text-center text-small text-[#9FB7C2]">No match for “{query}”</p>
          ) : (
            groups.map((g) => (
              <div key={g.group} className="mb-2">
                <p className="mb-1 px-3 text-[10px] font-medium uppercase tracking-wider text-[#6B8A99]">{g.group}</p>
                {g.items.map((e) => {
                  const i = flat.indexOf(e);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onMouseEnter={() => setCursor(i)}
                      onClick={() => go(e)}
                      className={`flex w-full items-center gap-3 rounded-[12px] px-3 py-2 text-left transition-colors ${
                        i === cursor ? "bg-white/[0.08]" : ""
                      }`}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-white/10 bg-white/5 text-[#9FB7C2]">
                        {e.icon ?? (e.group === "Offers" ? <IconOffers /> : e.group === "Actions" ? <IconPlus /> : <IconListings />)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-small text-text">{e.label}</span>
                        {e.sub ? <span className="block truncate text-tiny text-[#9FB7C2]">{e.sub}</span> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-white/[0.08] px-4 py-2 text-[10px] text-[#6B8A99]">
          <span>↑↓ move</span>
          <span>↵ open</span>
          <span>ESC close</span>
        </div>
      </div>
    </div>
  );
}
