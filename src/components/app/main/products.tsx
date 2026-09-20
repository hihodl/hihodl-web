"use client";

/**
 * Benefits' products, in the app's order (hihodl-wallet benefits/index.tsx,
 * `productTiles`: Stays, eSIM, Spaces) and with the app's words for each door.
 * `web` says whether the product has screens here yet; the ones that do not
 * open an honest card that sends the person to the app. When Stays or eSIM
 * get web screens, flipping `web` and adding their routes is the whole change.
 */

import type { ComponentType, ReactNode, SVGProps } from "react";

import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/appLinks";

import { IconBed, IconChevronRight, IconMegaphone, IconSim } from "../icons";

export type ProductKey = "stays" | "esim" | "spaces";

export interface Product {
  key: ProductKey;
  name: string;
  /** Relative to the product root. */
  path: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** The product's tone in the app (Hi Travel green, the eSIM teal, the one amber). */
  tone: string;
  door: string;
  sub: string;
  /** What it is, for the card of a product with no web screens yet. */
  about: string;
  web: boolean;
}

export const PRODUCTS: readonly Product[] = [
  {
    key: "stays",
    name: "Stays",
    path: "/travel",
    icon: IconBed,
    tone: "#2FBE8A",
    door: "Find a stay",
    sub: "Search hotels wherever you're going",
    about: "Hotels wherever you're going, priced in the app, and HiPoints back on the nights you book.",
    web: true,
  },
  {
    key: "esim",
    name: "eSIM",
    path: "/esim",
    icon: IconSim,
    tone: "#7CC2D1",
    door: "Data abroad",
    sub: "No roaming bill",
    about: "Mobile data for the country you're going to. Pick a plan in the app, install the eSIM, and you're online when you land.",
    web: false,
  },
  {
    key: "spaces",
    name: "Spaces",
    path: "/spaces",
    icon: IconMegaphone,
    tone: "#FFB703",
    door: "Sell sponsor spots",
    sub: "On your gear or your content, paid in USDC straight to you",
    about: "",
    web: true,
  },
];

export function productByKey(key: ProductKey): Product {
  return PRODUCTS.find((p) => p.key === key)!;
}

/** The product's square: its icon on a tint of its own tone. */
export function ProductIcon({ product, size = 40 }: { product: Product; size?: number }) {
  const Icon = product.icon;
  return (
    <span
      className="flex shrink-0 items-center justify-center"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.3), background: `${product.tone}26`, color: product.tone }}
      aria-hidden
    >
      <Icon width={Math.round(size * 0.5)} height={Math.round(size * 0.5)} />
    </span>
  );
}

/** A row that is a door: icon, the product's words, a chevron. */
export function DoorRow({ product, right }: { product: Product; right?: ReactNode }) {
  return (
    <>
      <ProductIcon product={product} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-small font-medium text-text">{product.door}</span>
        <span className="mt-0.5 block truncate text-tiny text-[#9FB7C2]">{product.sub}</span>
      </span>
      {right}
      <IconChevronRight className="shrink-0 text-white/40" />
    </>
  );
}

/** The two store buttons. Real links from lib/appLinks, never a guessed one. */
export function StoreButtons() {
  const cls =
    "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-[12px] border border-white/10 bg-white/[0.06] px-4 text-small font-medium text-text transition-colors hover:bg-white/10";
  return (
    <div className="flex flex-wrap gap-2">
      <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className={cls}>
        App Store
      </a>
      <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" className={cls}>
        Google Play
      </a>
    </div>
  );
}
