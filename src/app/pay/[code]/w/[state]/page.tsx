/**
 * /pay/<code>/w/USD-25.00-solana — the same pay page, reopened inside a
 * wallet's browser with what the payer had chosen (payStateUrl). The page
 * reads the state from its path and puts the address back to /pay/<code>.
 */
export { default, generateMetadata } from "../../page";

export const dynamic = "force-dynamic";
