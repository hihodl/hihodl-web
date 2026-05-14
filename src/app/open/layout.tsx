import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Opening HIHODL",
  description: "Opening the HIHODL app.",
  robots: { index: false, follow: false },
};

export default function OpenLayout({ children }: { children: ReactNode }) {
  return children;
}
