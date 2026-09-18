/**
 * /creator/team/work — what somebody on a creator's team has to deliver.
 *
 * Its own page rather than a card on /creator/team, because it is the one page
 * a rep opens at the event, on a phone, with a link to paste: it should be
 * that and nothing else. It is reached from each team they are on.
 */

import { TeamWork } from "@/components/creator/team/TeamWork";

export default function TeamWorkPage() {
  return <TeamWork />;
}
