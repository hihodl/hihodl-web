"use client";

import { createContext, useCallback, useContext, type PointerEvent, type ReactNode, type MouseEvent } from "react";

import { useT } from "@/lib/app/i18n/react";
import { addableKinds, editMessage, type EditTarget, type SectionKind } from "@/lib/ad-space/preview-bridge";
import { sectionsOf } from "@/lib/ad-space/studio";

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void };
    /** The app's Supabase access token, injected before the page loads. Read, never stored. */
    __HOLD_ACCESS_TOKEN__?: unknown;
  }
}

/** To the app, when there is an app. A bridge that throws is the app's to fix. */
export function postToApp(message: string | null) {
  if (!message) return;
  try {
    window.ReactNativeWebView?.postMessage(message);
  } catch {
    /* the page is still the page */
  }
}

/**
 * Whether this render is the app's editor. Outside `PreviewBridge` (the
 * public page, the console's frame) it is false and every `Editable` is
 * its children and nothing else, so the site's markup never changes.
 */
const EditingContext = createContext(false);

export function useEditing(): boolean {
  return useContext(EditingContext);
}

const INTERACTIVE = 'a, button, [role="button"], [role="link"], input, select, textarea, label, summary';

/**
 * The page inside the app's WebView.
 *
 * Nothing on it acts: a buy, an offer, a link, a checkout is a tap that goes
 * nowhere, because a preview that can take money or walk off to another site
 * is not a preview. In the editor a tap on an editable part instead tells the
 * app which part (`hold-edit`), and the part shows a thin dashed outline
 * while it is pressed. One capturing handler does both, so no component of
 * the page needs to know it is being previewed.
 */
export function PreviewBridge({ editing, children }: { editing: boolean; children: ReactNode }) {
  const onClickCapture = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const el = e.target instanceof Element ? e.target : null;
      const region = editing ? el?.closest<HTMLElement>("[data-hold-edit]") : null;
      if (region) {
        e.preventDefault();
        e.stopPropagation();
        postToApp(
          editMessage(region.dataset.holdEdit as EditTarget, {
            index: region.dataset.holdIndex,
            kind: region.dataset.holdKind,
          }),
        );
        return;
      }
      if (el?.closest(INTERACTIVE)) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [editing],
  );

  const press = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!editing) return;
      const region = e.target instanceof Element ? e.target.closest<HTMLElement>("[data-hold-edit]") : null;
      region?.setAttribute("data-pressed", "");
    },
    [editing],
  );
  const release = useCallback(() => {
    document.querySelectorAll("[data-hold-edit][data-pressed]").forEach((n) => n.removeAttribute("data-pressed"));
  }, []);

  return (
    <EditingContext.Provider value={editing}>
      <div
        onClickCapture={onClickCapture}
        onSubmitCapture={(e) => e.preventDefault()}
        onPointerDown={press}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerLeave={release}
      >
        {editing && <style>{EDIT_CSS}</style>}
        {children}
      </div>
    </EditingContext.Provider>
  );
}

const EDIT_CSS = `
[data-hold-edit]{cursor:pointer;-webkit-tap-highlight-color:transparent;border-radius:12px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
[data-hold-edit][data-pressed]{outline:1px dashed rgb(var(--sp-ink) / 0.6);outline-offset:4px}
`;

/**
 * A part of the page the creator can tap to edit. Off the editor it renders
 * its children alone, with no wrapper.
 *
 * `chip` adds the small pencil: `corner` pins it to the part's top right (the
 * cover), `inline` sets it after the text (the title).
 */
export function Editable({
  target,
  index,
  as = "div",
  chip,
  className,
  children,
}: {
  target: Exclude<EditTarget, "addSection">;
  index?: number;
  as?: "div" | "span";
  chip?: "corner" | "inline";
  className?: string;
  children: ReactNode;
}) {
  const editing = useEditing();
  if (!editing) return <>{children}</>;
  const Tag = as;
  return (
    <Tag
      data-hold-edit={target}
      data-hold-index={index}
      className={`${chip === "corner" ? "relative block" : ""} ${className ?? ""}`.trim() || undefined}
    >
      {children}
      {chip && <Pencil corner={chip === "corner"} />}
    </Tag>
  );
}

function Pencil({ corner }: { corner: boolean }) {
  const t = useT();
  return (
    <span
      aria-label={t("board.studio.edit")}
      className={`pointer-events-none inline-flex h-6 w-6 items-center justify-center rounded-[12px] bg-[#0A1929]/55 text-white backdrop-blur-md ${
        corner ? "absolute right-3 top-3 z-10" : "ml-2 align-middle"
      }`}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    </span>
  );
}

const ADD_LABEL: Record<SectionKind, "board.studio.audience" | "board.studio.link" | "board.studio.text" | "board.studio.pastWork"> = {
  audience: "board.studio.audience",
  link: "board.studio.link",
  text: "board.studio.text",
  pastWork: "board.studio.pastWork",
};

/** The add chips at the end of the sections: only the kinds still allowed, only in the editor. */
export function AddSectionChips({ sections, bare = false }: { sections: unknown; bare?: boolean }) {
  const t = useT();
  const editing = useEditing();
  if (!editing) return null;
  const kinds = addableKinds(sectionsOf(sections));
  if (kinds.length === 0) return null;
  const row = (
    <div className="flex flex-wrap gap-2">
      {kinds.map((k) => (
        <button
          key={k}
          type="button"
          data-hold-edit="addSection"
          data-hold-kind={k}
          className="inline-flex h-8 items-center rounded-[16px] border border-[color:var(--color-hairline-strong)] bg-sp-ink/[0.04] px-3 text-tiny text-sp-ink/85"
        >
          + {t(ADD_LABEL[k])}
        </button>
      ))}
    </div>
  );
  return bare ? <section className="container-page pb-12 md:pb-16">{row}</section> : <div className="mt-4">{row}</div>;
}

/** The reason's place when there is none, in the editor only: the one way to tap a story that is not there. */
export function StoryPlaceholder() {
  const t = useT();
  const editing = useEditing();
  if (!editing) return null;
  return (
    <Editable target="story">
      <p className="mt-4 max-w-2xl text-body text-sp-ink/50 md:text-lead">{t("board.studio.addStory")}</p>
    </Editable>
  );
}
