/**
 * On the web a creator is paid on Solana. Base and Polygon come with the HOLD
 * app's wallet, so wherever the web would have offered them it says so in one
 * line instead of asking for MetaMask.
 */

import { PLAY_STORE_URL } from "@/lib/appLinks";

export function MoreChainsLine({ className = "" }: { className?: string }) {
  return (
    <p className={`text-tiny text-[#9FB7C2] ${className}`}>
      Want Base or Polygon too?{" "}
      <a
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#CFE3EC] underline decoration-white/30 underline-offset-2 hover:text-text"
      >
        Get the HOLD app
      </a>
    </p>
  );
}
