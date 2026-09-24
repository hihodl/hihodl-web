/**
 * English, the source: every namespace, flattened to "namespace.key".
 *
 * One file per area of the product (./<namespace>.ts). A translation is the
 * same keys, per namespace, in ../locales/<code>/<namespace>.json.
 *
 * Pure: no React, no `@/` imports.
 */

import account from "./account";
import activity from "./activity";
import analytics from "./analytics";
import board from "./board";
import common from "./common";
import creator from "./creator";
import front from "./front";
import groupThread from "./groupThread";
import groups from "./groups";
import home from "./home";
import link from "./link";
import listings from "./listings";
import menu from "./menu";
import money from "./money";
import offers from "./offers";
import payments from "./payments";
import prefs from "./prefs";
import requests from "./requests";
import runner from "./runner";
import shell from "./shell";
import spaces from "./spaces";
import sponsor from "./sponsor";
import stays from "./stays";
import titles from "./titles";
import trips from "./trips";
import wallet from "./wallet";

export const NAMESPACES = {
  common,
  titles,
  shell,
  front,
  link,
  menu,
  prefs,
  account,
  home,
  activity,
  wallet,
  money,
  payments,
  requests,
  groups,
  groupThread,
  analytics,
  spaces,
  listings,
  creator,
  runner,
  board,
  offers,
  sponsor,
  stays,
  trips,
} as const;

type Namespaces = typeof NAMESPACES;
export type Namespace = keyof Namespaces;

/** Every message key: "menu.settings.title". */
export type MessageKey = {
  [N in Namespace]: `${N}.${keyof Namespaces[N] & string}`;
}[Namespace];

function flatten(): Record<MessageKey, string> {
  const out: Record<string, string> = {};
  for (const [ns, messages] of Object.entries(NAMESPACES)) {
    for (const [k, v] of Object.entries(messages as Record<string, string>)) out[`${ns}.${k}`] = v;
  }
  return out as Record<MessageKey, string>;
}

export const EN: Readonly<Record<MessageKey, string>> = flatten();
