import Image from "next/image";

/**
 * "Made for how you move": one card per kind of life, each with what HOLD
 * does in it. These are situations, not customers. No names and no quotes,
 * because an invented testimonial on a money product is a regulatory problem
 * (the homepage lost three of them on 19-aug-2026 for exactly that).
 *
 * A native scroll-snap row: swipe on a phone, shift+wheel or trackpad on a
 * desktop. No carousel library, no autoplay.
 */
type Person = { photo: string; alt: string; focus: string; who: string; line: string };

const PEOPLE: Person[] = [
  {
    photo: "/home/designer.jpg",
    alt: "A designer leaning back from his desk in a sunny apartment",
    focus: "52% 40%",
    who: "Freelancer, Mexico City",
    line: "A US client pays on Friday. It lands in dollars and stays in dollars.",
  },
  {
    photo: "/home/lisbon.jpg",
    alt: "A woman with coffee on a balcony over Lisbon",
    focus: "28% 50%",
    who: "Remote worker, Lisbon",
    line: "Paid in dollars, rent in euros. One account for both.",
  },
  {
    photo: "/home/train.jpg",
    alt: "A man by a train window along the Italian coast",
    focus: "62% 40%",
    who: "On the coast train, Italy",
    line: "His eSIM was on before the train left the station.",
  },
  {
    photo: "/home/linen.jpg",
    alt: "A man in a linen shirt in front of a blue door",
    focus: "28% 35%",
    who: "Flat share, Madrid",
    line: "Rent split three ways. Nobody chases anybody.",
  },
  {
    photo: "/home/towel.jpg",
    alt: "A woman lying in the sun on a striped towel with a coffee",
    focus: "45% 40%",
    who: "Sunday, anywhere",
    line: "Savings earning. Nothing to do.",
  },
];

export function PeopleCarousel() {
  return (
    <section id="people" className="bg-abyss py-20 md:py-28">
      <div className="container-page">
        <h2 className="font-display font-light text-[40px] md:text-h1 leading-[1.05] tracking-[-0.03em] text-text">
          Made for how you <em className="font-editorial text-[1.06em]">move</em>.
        </h2>
      </div>
      <ul
        className="mt-10 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 pb-4 md:mt-14 md:gap-5 md:px-[max(32px,calc((100vw-1200px)/2+32px))] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Ways people use HOLD"
      >
        {PEOPLE.map((p) => (
          <li
            key={p.photo}
            className="relative aspect-[4/5] w-[78vw] max-w-[360px] shrink-0 snap-center overflow-hidden rounded-[24px] md:snap-start"
          >
            <Image
              src={p.photo}
              alt={p.alt}
              fill
              sizes="(min-width: 768px) 360px, 78vw"
              className="object-cover"
              style={{ objectPosition: p.focus }}
            />
            <div className="absolute inset-x-3 bottom-3 rounded-[18px] border border-white/10 bg-[#11161D]/85 p-4 supports-[backdrop-filter]:bg-[#11161D]/45 supports-[backdrop-filter]:backdrop-blur-[20px]">
              <p className="text-tiny uppercase tracking-wider text-white/80">{p.who}</p>
              <p className="mt-1.5 text-small text-white">{p.line}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
