"use client";

/**
 * Benefits: the hub of HOLD's products, as the app's Benefits tab is. One
 * card per product, in the app's order, each a door: Spaces opens its own
 * menu (the product level of the sidebar); Stays and eSIM open the card that
 * says they are in the app for now.
 */

import Link from "next/link";

import { waitingOnYou } from "@/lib/app/spaces-model";
import { useOffers } from "@/lib/app/spaces-data";

import { useProductHref } from "../base";
import { useShell } from "../Shell";
import { glass } from "../ui";
import { PRODUCTS, ProductIcon } from "./products";

export function BenefitsScreen() {
  const href = useProductHref();
  const { role, listings } = useShell();
  const offers = useOffers(role === "creator");
  const live = listings.filter((l) => l.status === "live").length;
  const waiting = offers.data ? waitingOnYou(offers.data).length : 0;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <section className={`${glass} flex flex-col gap-1 px-5 py-4`}>
        <h2 className="text-body font-medium text-text">Products</h2>
        <p className="text-small text-[#9FB7C2]">What you can buy, and sell, through HOLD.</p>
      </section>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-3">
        {PRODUCTS.map((p) => (
          <Link
            key={p.key}
            href={href(p.path)}
            className={`${glass} group flex min-h-[240px] flex-col justify-between gap-6 p-5 transition-colors hover:bg-white/[0.06] md:p-6`}
          >
            <div className="flex items-start justify-between gap-3">
              <ProductIcon product={p} size={52} />
              <span className="inline-flex h-6 items-center rounded-[12px] border border-white/10 px-2.5 text-[11px] text-[#9FB7C2]">
                {p.web ? "On the web" : "In the app"}
              </span>
            </div>
            <div>
              <p className="text-[22px] font-medium leading-tight text-text">{p.name}</p>
              <p className="mt-1 text-small text-text">{p.door}</p>
              <p className="mt-0.5 text-tiny text-[#9FB7C2]">{p.sub}</p>
              {p.key === "spaces" && role === "creator" ? (
                <p className="mt-3 text-tiny text-[#CFE3EC]">
                  {live} live · <span className={waiting ? "text-amber" : ""}>{waiting} waiting on you</span>
                </p>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
