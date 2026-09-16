import { SlimHeader } from "@/components/ad-space/sections";
import { eyebrow } from "@/components/ad-space/ui";

export default function ReceiptNotFound() {
  return (
    <>
      <SlimHeader />
      <main className="container-page flex min-h-[60vh] flex-col justify-center py-20">
        <p className={`${eyebrow} text-amber`}>Receipt</p>
        <h1 className="mt-5 max-w-2xl font-display text-h3 font-light text-text md:text-h2">
          This receipt link doesn&rsquo;t work.
        </h1>
        <p className="mt-5 max-w-xl text-body text-text-muted">
          Check that you copied all of it. It is the link shown after you paid.
        </p>
      </main>
    </>
  );
}
