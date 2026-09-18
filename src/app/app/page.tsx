import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { spacesBaseFor } from "@/lib/app/paths";

/** The product opens on its first module. */
export default function ProductHome() {
  redirect(spacesBaseFor(headers().get("host")));
}
