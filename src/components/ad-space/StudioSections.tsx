import { t } from "@/lib/app/i18n";
import { compactNumber, onTimeText, trackRecordText } from "@/lib/ad-space/format";
import { hostOf, sectionsOf, type PageSection, type StudioLink } from "@/lib/ad-space/studio";
import type { Space } from "@/lib/ad-space/types";

import { AddSectionChips, Editable } from "./edit-mode";
import { card, eyebrow } from "./ui";

/**
 * The sections a creator added in the studio, in their order: their audience
 * (from what we already sync from X, nothing typed), a link, a few lines of
 * text, their past work. Nothing shows unless they added it, and nothing here
 * explains itself: a brand reads a label and a value.
 *
 * Links leave the page in a new tab and carry `nofollow ugc`: the creator
 * wrote them, not us.
 */
export function StudioSections({ space }: { space: Space }) {
  const sections = sectionsOf(space.sections);
  // In the app's editor an empty page still offers its add chips; anywhere else, nothing.
  if (sections.length === 0) return <AddSectionChips sections={sections} bare />;
  return (
    <section className="container-page pb-12 md:pb-16" aria-label={space.creator.xHandle ? `@${space.creator.xHandle}` : undefined}>
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
        {sections.map((s, i) => (
          <Editable key={`${s.kind}-${i}`} target="section" index={i}>
            <Section section={s} space={space} />
          </Editable>
        ))}
      </div>
      <AddSectionChips sections={sections} />
    </section>
  );
}

const linkRel = "noopener noreferrer nofollow ugc";

function Section({ section: s, space }: { section: PageSection; space: Space }) {
  switch (s.kind) {
    case "audience": {
      const c = space.creator;
      const rows = [
        typeof c.xFollowers === "number" ? t("board.creator.followers", { followers: compactNumber(c.xFollowers) }) : null,
        trackRecordText(c.trackRecord),
        onTimeText(c.trackRecord),
      ].filter((r): r is string => Boolean(r));
      return (
        <div className={`${card} flex flex-col gap-3 p-5`}>
          <h3 className={`${eyebrow} text-sp-ink/80`}>{t("board.studio.audience")}</h3>
          <ul className="flex flex-col gap-1.5 text-small text-sp-ink">
            {rows.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      );
    }
    case "link":
      return (
        <a
          href={s.url}
          target="_blank"
          rel={linkRel}
          className={`${card} flex min-h-[64px] items-center justify-between gap-4 p-5 transition-colors duration-180 hover:bg-sp-ink/[0.06]`}
        >
          <LinkText link={s} />
          <span aria-hidden className="shrink-0 text-sp-ink/70">
            &#8599;
          </span>
        </a>
      );
    case "text":
      return (
        <div className={`${card} flex flex-col gap-3 p-5`}>
          <h3 className={`${eyebrow} break-words text-sp-ink/80 [overflow-wrap:anywhere]`}>{s.title}</h3>
          <p className="whitespace-pre-line break-words text-small text-sp-ink [overflow-wrap:anywhere]">{s.body}</p>
        </div>
      );
    case "pastWork":
      return (
        <div className={`${card} flex flex-col gap-3 p-5`}>
          <h3 className={`${eyebrow} text-sp-ink/80`}>{t("board.studio.pastWork")}</h3>
          <ul className="flex flex-col">
            {s.items.map((it, i) => (
              <li key={`${it.url}-${i}`} className="border-t border-[color:var(--color-hairline)] first:border-t-0">
                <a href={it.url} target="_blank" rel={linkRel} className="flex items-center justify-between gap-4 py-2.5 hover:opacity-80">
                  <LinkText link={it} />
                  <span aria-hidden className="shrink-0 text-sp-ink/70">
                    &#8599;
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      );
  }
}

function LinkText({ link }: { link: StudioLink }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate text-small text-sp-ink">{link.label}</span>
      <span className="truncate text-tiny text-sp-ink/70">{hostOf(link.url)}</span>
    </span>
  );
}
