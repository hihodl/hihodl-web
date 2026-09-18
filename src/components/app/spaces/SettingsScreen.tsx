"use client";

/**
 * Spaces › Settings: the app itself. Who is signed in and signing out, how
 * the sidebar is drawn, and where help and the legal pages are. Nothing here
 * is stored on the server: the sidebar is remembered in this browser, as it
 * always was.
 *
 * Who you are and how you get paid (the X account, the payout wallet, the
 * Creative Director plan) is Account, not here.
 */

import { signOut } from "@/lib/creator/session";

import { useSpacesBase } from "../base";
import { IconSignOut } from "../icons";
import { useShell, useShellPrefs } from "../Shell";
import { Panel, Segmented } from "../ui";

/** The product's own host serves only the product; the website's pages live on the website. */
const WEBSITE = "https://hihodl.xyz";

const btn =
  "inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] border border-white/10 bg-white/[0.06] px-3 text-tiny font-medium text-[#CFE3EC] transition-colors hover:bg-white/10 hover:text-text";

export function SettingsScreen() {
  const { session, x } = useShell();
  const { collapsed, setCollapsed } = useShellPrefs();
  // On app.hihodl.xyz a bare /terms would be read as a page of the product.
  const site = useSpacesBase().startsWith("/app") ? "" : WEBSITE;

  const links = [
    { label: "Support", sub: "support@hihodl.xyz", href: "mailto:support@hihodl.xyz" },
    { label: "Terms", sub: "Terms of use", href: `${site}/terms` },
    { label: "Privacy", sub: "Privacy policy", href: `${site}/privacy` },
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2 lg:items-start">
      <Panel title="Signed in">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-small text-text">{session.user.email ?? "Signed in"}</p>
            {x?.linked ? <p className="mt-0.5 truncate text-tiny text-[#9FB7C2]">@{x.handle} on X</p> : null}
          </div>
          <button type="button" className={btn} onClick={() => void signOut()}>
            <IconSignOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </Panel>

      <Panel title="Display">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-small text-text">Sidebar</p>
            <p className="mt-0.5 text-tiny text-[#9FB7C2]">On a wide screen</p>
          </div>
          <Segmented
            label="Sidebar"
            value={collapsed ? "icons" : "full"}
            onChange={(v) => setCollapsed(v === "icons")}
            options={[
              { value: "full", label: "Full" },
              { value: "icons", label: "Icons only" },
            ]}
          />
        </div>
      </Panel>

      <Panel title="Help and legal" className="lg:col-span-2">
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-3">
          {links.map((l) => (
            <li key={l.label}>
              <a
                href={l.href}
                target={l.href.startsWith("mailto:") ? undefined : "_blank"}
                rel="noopener noreferrer"
                className="block rounded-[12px] border border-white/[0.08] bg-white/[0.03] px-4 py-3 transition-colors hover:bg-white/[0.07]"
              >
                <span className="block text-small text-text">{l.label}</span>
                <span className="mt-0.5 block truncate text-tiny text-[#9FB7C2]">{l.sub}</span>
              </a>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
