import Image from "next/image";
import { AmberCta, BODY, H2, PHOTO_GLASS } from "./ui";
import { Icon, type IconName } from "./Icon";

/**
 * The account three ways, the way Revolut shows "Your salary, reimagined":
 * three cards, each its own photo, balance and one line of activity. The
 * middle one sits forward. Main in dollars, Main in euros, and Savings: the
 * three faces the app really has. Every figure is an example.
 */
const CARDS: {
  photo: string;
  pos: string;
  alt: string;
  label: string;
  amount: string;
  row: { icon: IconName; title: string; sub: string; amount: string };
  center?: boolean;
}[] = [
  {
    photo: "/home/lisbon.jpg",
    pos: "30% 50%",
    alt: "A woman with coffee on a balcony over the rooftops of Lisbon",
    label: "Main · EUR",
    amount: "€1,850.00",
    row: { icon: "at", title: "Sent to @marta", sub: "Yesterday, 21:40", amount: "−€45.00" },
  },
  {
    photo: "/home/walk.jpg",
    pos: "40% 50%",
    alt: "A woman in a linen coat walking past a deep blue wall",
    label: "Main · USD",
    amount: "$2,340.10",
    row: { icon: "bank", title: "Client payment", sub: "USD account · Friday", amount: "+$1,800.00" },
    center: true,
  },
  {
    photo: "/home/towel.jpg",
    pos: "40% 45%",
    alt: "A woman lying in the sun on a striped towel with a coffee",
    label: "Savings",
    amount: "$1,500.00",
    row: { icon: "leaf", title: "Moved from Main", sub: "Earning while you sleep", amount: "+$500.00" },
  },
];

export function Accounts() {
  return (
    <section id="accounts" className="scroll-mt-16 bg-white px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-[1120px] text-center">
        <H2>
          Your pay, <em>reimagined</em>
        </H2>
        <p className={`mx-auto mt-5 max-w-[640px] text-[18px] leading-[1.5] md:text-[20px] ${BODY}`}>
          Get paid into your own accounts, send in seconds, and let your Savings grow while you sleep. All from one app.
        </p>
        <div className="mt-8">
          <AmberCta>Open your account</AmberCta>
        </div>
      </div>

      <div className="mx-auto mt-14 flex max-w-[1120px] snap-x snap-mandatory scroll-px-4 items-center gap-4 overflow-x-auto pb-6 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CARDS.map((c) => (
          <div
            key={c.label}
            className={`relative aspect-[3/4] w-[78vw] max-w-[340px] shrink-0 snap-center overflow-hidden rounded-[28px] shadow-[0_20px_50px_rgba(15,15,26,0.14)] md:w-auto md:max-w-none ${
              c.center ? "md:z-10 md:scale-[1.08]" : ""
            }`}
          >
            <Image src={c.photo} alt={c.alt} fill quality={90} sizes="(min-width: 768px) 380px, 78vw" className="object-cover" style={{ objectPosition: c.pos }} />
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/50" />
            <div className="absolute inset-x-0 top-[34%] flex flex-col items-center text-white">
              <p className="text-[14px] font-medium text-white/90">{c.label}</p>
              <p className="mt-1 text-[40px] font-semibold leading-none tracking-[-0.02em] [text-shadow:0_2px_16px_rgba(0,0,0,0.25)]">{c.amount}</p>
              <span className={`mt-4 rounded-full px-4 py-2 text-[14px] font-semibold ${PHOTO_GLASS}`}>Accounts</span>
            </div>
            <div className="absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-[18px] bg-white px-3.5 py-3 text-left shadow-sm">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#00C2FF] text-white">
                <Icon name={c.row.icon} size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium text-[#0F0F1A]">{c.row.title}</span>
                <span className="block truncate text-[13px] text-[#5F6975]">{c.row.sub}</span>
              </span>
              <span className="text-[15px] font-semibold text-[#0F0F1A]">{c.row.amount}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
