/* Generated: one chunk per language, loaded when it is chosen. */
import type { DictionaryCode } from "../locales";

export const LOADERS: Record<Exclude<DictionaryCode, "en">, () => Promise<{ default: Readonly<Record<string, string>> }>> = {
  "es-ES": () => import("./es-ES"),
  "pt-BR": () => import("./pt-BR"),
  "fr": () => import("./fr"),
  "de": () => import("./de"),
  "it": () => import("./it"),
  "nl": () => import("./nl"),
  "tr": () => import("./tr"),
  "ar-AE": () => import("./ar-AE"),
  "hi": () => import("./hi"),
  "zh-CN": () => import("./zh-CN"),
  "ja": () => import("./ja"),
  "ko": () => import("./ko"),
  "th": () => import("./th"),
  "id": () => import("./id"),
  "vi": () => import("./vi"),
  "sw": () => import("./sw"),
};
