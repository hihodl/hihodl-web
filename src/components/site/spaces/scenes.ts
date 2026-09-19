/**
 * The homepage story, scene by scene. One image and one line per scene: the
 * page sells by showing, not by explaining.
 *
 * Each scene's image lives at /public/spaces/story/<file>. Drop the file in and
 * the scene uses it; until then it falls back to the drawing named in
 * `fallback`. Prompts for every image: documentation/spaces-story-images.md.
 *
 * Every image is composed with the subject on the RIGHT and quiet space at
 * the bottom left, where the line sits over a dark scrim. `focus` is the CSS
 * object-position of the subject, so a 16:9 image cropped to a phone keeps her
 * in frame; a `-mobile` 9:16 cut next to the file replaces it on phones.
 */

export type Chapter = "ground" | "feed" | "deal";

export type Scene = {
  id: string;
  chapter: Chapter;
  file: string;
  /** Written for someone who cannot see the image. */
  alt: string;
  line: string;
  sub: string;
  focus: string;
  fallback: "suitcase" | "photo" | "production" | "dress" | null;
};

export const CHAPTER_LABEL: Record<Chapter, string> = {
  ground: "On the ground",
  feed: "On the feed",
  deal: "The deal",
};

export const HERO: Scene = {
  id: "arrival",
  chapter: "ground",
  file: "01-arrival.jpg",
  alt: "A creator walks into a conference pulling a carry-on suitcase covered in brand stickers while people turn to look.",
  line: "This is your hook.",
  sub: "Turn what you carry into ad space. Brands pay you for every spot on it.",
  focus: "68% 50%",
  fallback: "suitcase",
};

export const SCENES: Scene[] = [
  {
    id: "stickers",
    chapter: "ground",
    file: "02-stickers.jpg",
    alt: "Close up of a hard-shell suitcase covered in a grid of brand stickers, a hand on the handle.",
    line: "Every sticker is a brand that paid you.",
    sub: "A suitcase, a laptop, a dress, a blazer. Pick the object, set your spots and prices, post one link.",
    focus: "65% 50%",
    fallback: "suitcase",
  },
  {
    id: "looks",
    chapter: "ground",
    file: "03-looks.jpg",
    alt: "At a conference entrance, people stop to photograph the creator and her sticker-covered suitcase.",
    line: "Nobody scrolls past this.",
    sub: "Be early and be different. The object gets the looks. Your reach is what brands pay for.",
    focus: "62% 50%",
    fallback: null,
  },
  {
    id: "filming",
    chapter: "feed",
    file: "04-filming.jpg",
    alt: "The creator films a vertical video on her phone on the event floor, the suitcase beside her.",
    line: "Then sell what you make.",
    sub: "Short videos from inside the event, made for the brand that booked them.",
    focus: "66% 50%",
    fallback: null,
  },
  {
    id: "interview",
    chapter: "feed",
    file: "05-interview.jpg",
    alt: "Two people record an interview at a conference, one holding a microphone, a camera on a small rig.",
    line: "Interviews. Recaps. Your camera.",
    sub: "The brand brings a brief. You deliver on a private link in 24 to 72 hours.",
    focus: "62% 45%",
    fallback: "production",
  },
  {
    id: "door",
    chapter: "deal",
    file: "06-door.jpg",
    alt: "Evening after the event. The creator sits by a window with her laptop and phone, the suitcase in the corner of the room.",
    line: "A spot opens the door.",
    sub: "The brand that bought a spot is the brand that books your content next.",
    focus: "66% 50%",
    fallback: null,
  },
];
