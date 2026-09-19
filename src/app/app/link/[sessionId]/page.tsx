import { PhoneLink } from "@/components/app/link/PhoneLink";

export const dynamic = "force-dynamic";

export default function LinkPage({ params }: { params: { sessionId: string } }) {
  return <PhoneLink sessionId={params.sessionId} />;
}
