"use client";

/**
 * A Benefits product that has no web screens yet (Stays, eSIM): one honest
 * card. What it is, that it lives in the HOLD app for now, and the way to the
 * app. No pretend search box, no prices we did not quote.
 */

import Link from "next/link";

import { useProductHref } from "../base";
import { glass } from "../ui";
import { productByKey, ProductIcon, StoreButtons, type ProductKey } from "./products";

export function InTheAppScreen({ product: key }: { product: ProductKey }) {
  const product = productByKey(key);
  const href = useProductHref();
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-4">
      <section className={`${glass} flex w-full max-w-[560px] flex-col gap-5 p-6 sm:p-8`}>
        <Link href={href("/benefits")} className="-ml-2 self-start rounded-[8px] px-2 py-1 text-tiny text-[#9FB7C2] hover:bg-white/10 hover:text-text">
          ← Benefits
        </Link>
        <div className="flex items-center gap-4">
          <ProductIcon product={product} size={56} />
          <div className="min-w-0">
            <h2 className="text-[22px] font-medium leading-tight text-text">{product.name}</h2>
            <p className="mt-1 text-small text-[#9FB7C2]">{product.door}</p>
          </div>
        </div>
        <p className="text-body leading-relaxed text-[#CFE3EC]">{product.about}</p>
        <div className="rounded-[14px] border border-white/10 bg-white/[0.04] px-4 py-3">
          <p className="text-small font-medium text-text">Available in the HOLD app for now</p>
          <p className="mt-0.5 text-tiny text-[#9FB7C2]">Sign in there with the same account. It comes to the web next.</p>
        </div>
        <StoreButtons />
      </section>
    </div>
  );
}
