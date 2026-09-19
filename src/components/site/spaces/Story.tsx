import { existsSync } from "node:fs";
import path from "node:path";

import Image from "next/image";

import { btnPrimary, btnSecondary, eyebrow } from "@/components/ad-space/ui";

import { DressArt, PhotoArt, ProductionArt, SuitcaseArt } from "./art";
import { Reveal } from "./Reveal";
import { CHAPTER_LABEL, HERO, SCENES, type Scene } from "./scenes";

/**
 * The homepage as a story told in images: she arrives with the suitcase, the
 * stickers, the looks, then what she makes on the feed, then the deal. One line
 * per scene, full bleed.
 *
 * An image is used when its file is in /public/spaces/story, and its
 * `-mobile` 9:16 cut, when present, replaces it below md. Checked on the
 * server at render, so shipping an image is dropping a file, and a scene whose
 * image is not there yet shows its drawing on the Benefits ground instead of a
 * broken picture.
 */

const STORY_DIR = path.join(process.cwd(), "public", "spaces", "story");

function exists(file: string): boolean {
  try {
    return existsSync(path.join(STORY_DIR, file));
  } catch {
    return false;
  }
}

/** `01-arrival.jpg` → `01-arrival-mobile.jpg`: the optional 9:16 cut for phones. */
function mobileFile(file: string): string {
  return file.replace(/(\.[a-z]+)$/i, "-mobile$1");
}

/** Settles from a slight zoom as the scene arrives. Colour and transform only. */
const IMAGE_MOTION =
  "transition-[transform,opacity] duration-[1400ms] ease-out-soft group-data-[reveal=waiting]/reveal:scale-[1.08] group-data-[reveal=waiting]/reveal:opacity-60";
const TEXT_MOTION =
  "transition-[transform,opacity] duration-900 ease-out-soft delay-150 group-data-[reveal=waiting]/reveal:translate-y-6 group-data-[reveal=waiting]/reveal:opacity-0";

function Backdrop({ scene, priority = false }: { scene: Scene; priority?: boolean }) {
  if (exists(scene.file)) {
    const mobile = mobileFile(scene.file);
    const hasMobile = exists(mobile);
    return (
      <>
        {hasMobile && (
          <Image
            src={`/spaces/story/${mobile}`}
            alt={scene.alt}
            fill
            priority={priority}
            sizes="100vw"
            className={`object-cover md:hidden ${IMAGE_MOTION}`}
          />
        )}
        <Image
          src={`/spaces/story/${scene.file}`}
          alt={scene.alt}
          fill
          priority={priority}
          sizes="100vw"
          className={`object-cover ${hasMobile ? "hidden md:block" : ""} ${IMAGE_MOTION}`}
          style={{ objectPosition: scene.focus }}
        />
      </>
    );
  }
  const Art =
    scene.fallback === "suitcase"
      ? SuitcaseArt
      : scene.fallback === "photo"
        ? PhotoArt
        : scene.fallback === "dress"
          ? DressArt
          : null;
  return (
    <div
      className={`absolute inset-0 ${IMAGE_MOTION}`}
      style={{
        background:
          "radial-gradient(60% 60% at 70% 40%, rgba(255,183,3,0.14), transparent 70%), linear-gradient(180deg, #1a5276 0%, #0f3555 45%, #0a1929 100%)",
      }}
      role="img"
      aria-label={scene.alt}
    >
      {Art && (
        <div className="absolute inset-y-0 right-0 flex w-full items-center justify-center opacity-30 md:w-[42%] md:opacity-100">
          <Art className="h-[42vh] w-auto max-w-[88%]" />
        </div>
      )}
      {scene.fallback === "production" && (
        <div className="absolute inset-y-0 right-0 hidden w-1/2 items-center justify-center md:flex">
          <ProductionArt className="w-[340px]" />
        </div>
      )}
    </div>
  );
}

/** Dark at the bottom (phones) and the left (desktop), where the line sits. */
const SCRIM =
  "linear-gradient(0deg, rgba(10,25,41,0.92) 0%, rgba(10,25,41,0.55) 35%, transparent 65%), linear-gradient(90deg, rgba(10,25,41,0.55) 0%, transparent 55%)";

export function StoryHero({ createHref }: { createHref: string }) {
  return (
    <section className="relative isolate -mt-18 flex min-h-[100svh] items-end overflow-hidden" aria-label="HOLD Spaces">
      <Reveal className="absolute inset-0 -z-10">
        <Backdrop scene={HERO} priority />
        <div className="absolute inset-0" style={{ background: SCRIM }} aria-hidden />
      </Reveal>
      <Reveal className="container-page w-full pb-16 pt-40 md:pb-24">
        <div className={TEXT_MOTION}>
          <p className={`${eyebrow} text-amber`}>HOLD Spaces</p>
          <h1
            className="mt-5 max-w-3xl font-display text-[52px] leading-[1] tracking-[-0.035em] text-text md:text-display"
            style={{ fontWeight: 200 }}
          >
            {HERO.line}
          </h1>
          <p className="mt-6 max-w-lg text-lead text-text">{HERO.sub}</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <a href={createHref} className={btnPrimary}>
              Create your space
            </a>
            <a href="#story" className={btnSecondary}>
              See the story
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export function StoryScenes() {
  let lastChapter = HERO.chapter;
  return (
    <div id="story" className="scroll-mt-18 bg-abyss">
      {SCENES.map((scene) => {
        const opensChapter = scene.chapter !== lastChapter;
        lastChapter = scene.chapter;
        return (
          <section
            key={scene.id}
            className="relative isolate flex min-h-[88svh] items-end overflow-hidden md:min-h-[100svh]"
            aria-label={scene.line}
          >
            <Reveal className="absolute inset-0 -z-10">
              <Backdrop scene={scene} />
              <div className="absolute inset-0" style={{ background: SCRIM }} aria-hidden />
            </Reveal>
            <Reveal className="container-page w-full pb-16 pt-32 md:pb-24">
              <div className={TEXT_MOTION}>
                <p className={`${eyebrow} ${opensChapter ? "text-amber" : "text-text-muted"}`}>
                  {CHAPTER_LABEL[scene.chapter]}
                </p>
                <h2 className="mt-4 max-w-3xl font-display text-[40px] font-light leading-[1.05] tracking-[-0.03em] text-text md:text-h1">
                  {scene.line}
                </h2>
                <p className="mt-5 max-w-md text-body text-text md:text-lead">{scene.sub}</p>
              </div>
            </Reveal>
          </section>
        );
      })}
    </div>
  );
}
