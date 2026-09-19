import { Overview } from "@/components/app/spaces/Overview";

/** The hub; `?view=` opens one of its screens (brands, events, sells, pay, inspired, needs). */
export default function SpacesOverviewPage({ searchParams }: { searchParams: { view?: string } }) {
  return <Overview view={searchParams.view ?? null} />;
}
