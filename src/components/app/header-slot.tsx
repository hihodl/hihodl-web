"use client";

/**
 * One title per screen.
 *
 * The shell's top bar names the section the sidebar opened. A screen drilled
 * into from another (a listing, an offer, Security) has the app's own header,
 * a chevron back and its title (TravelHeader / GlassHeader). Drawn both ways
 * the same words sat twice, one under the other.
 *
 * So inside the shell a BackHeader does not draw itself in the page: it
 * claims the top bar, whose title becomes the app's header (the chevron, the
 * title and its subtitle) and whose right side takes the header's action.
 * Outside the shell (an invitation, a public page) it draws in place as before.
 */

import { createContext, useContext } from "react";

export interface HeaderSlot {
  /** Where the chevron and the title go, in the top bar. */
  title: HTMLElement | null;
  /** Where the header's own action goes (Share, a menu), before Search. */
  right: HTMLElement | null;
  /** A screen's header is on: the top bar hides its section title until the returned release. */
  claim: () => () => void;
}

export const HeaderSlotContext = createContext<HeaderSlot | null>(null);

export function useHeaderSlot(): HeaderSlot | null {
  return useContext(HeaderSlotContext);
}
