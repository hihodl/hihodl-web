import { PayNotFound } from "@/components/pay-links/PayPage";

/**
 * An unknown code or handle, in the pay page's own look and language. It
 * never says whether a link ever existed; it offers to pay somebody on HOLD
 * by their handle instead. Next marks a not-found answer `noindex`.
 */
export default function PayLinkNotFound() {
  return <PayNotFound />;
}
