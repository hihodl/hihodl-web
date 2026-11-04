/**
 * A small ICU MessageFormat: the part of it the product's words need.
 *
 *   "Hello {name}"                                         interpolation
 *   "{count, plural, one {# member} other {# members}}"    plurals, CLDR rules
 *   "{count, plural, =0 {Nobody} one {One} other {#}}"     exact matches first
 *   "{role, select, admin {Admin} other {Member}}"         select
 *
 * Branches nest. `#` inside a plural branch is the count, formatted for the
 * locale. A variable that is not given is left as "{name}" so a missing value
 * is visible rather than silently blank. No quoting rules: an apostrophe is an
 * apostrophe, which is what translators write.
 *
 * Rich text (`<b>…</b>`, `<link>…</link>`) is split by `splitTags`, which the
 * React side uses to put elements around the chunks.
 *
 * Pure: no React, no `@/` imports.
 */

export type Vars = Record<string, string | number | null | undefined>;

type Node =
  | { k: "text"; v: string }
  | { k: "var"; name: string }
  | { k: "hash" }
  | { k: "plural"; name: string; offset: number; branches: Record<string, Node[]> }
  | { k: "select"; name: string; branches: Record<string, Node[]> };

const cache = new Map<string, Node[]>();

function parse(src: string): Node[] {
  const hit = cache.get(src);
  if (hit) return hit;
  let i = 0;

  function parseNodes(inPlural: boolean, stopAtBrace: boolean): Node[] {
    const out: Node[] = [];
    let text = "";
    const flush = () => {
      if (text) out.push({ k: "text", v: text });
      text = "";
    };
    while (i < src.length) {
      const c = src[i];
      if (c === "}" && stopAtBrace) break;
      if (c === "#" && inPlural) {
        flush();
        out.push({ k: "hash" });
        i++;
        continue;
      }
      if (c === "{") {
        const start = i;
        const node = parseArg();
        if (node) {
          flush();
          out.push(node);
        } else {
          // Not an argument: keep the brace as text.
          i = start + 1;
          text += "{";
        }
        continue;
      }
      text += c;
      i++;
    }
    flush();
    return out;
  }

  function skipWs() {
    while (i < src.length && /\s/.test(src[i])) i++;
  }

  function readIdent(): string {
    const m = /^[A-Za-z0-9_]+/.exec(src.slice(i));
    if (!m) return "";
    i += m[0].length;
    return m[0];
  }

  function parseArg(): Node | null {
    // at "{"
    i++;
    skipWs();
    const name = readIdent();
    if (!name) return null;
    skipWs();
    if (src[i] === "}") {
      i++;
      return { k: "var", name };
    }
    if (src[i] !== ",") return null;
    i++;
    skipWs();
    const type = readIdent();
    skipWs();
    if (type !== "plural" && type !== "select" && type !== "selectordinal") return null;
    if (src[i] !== ",") return null;
    i++;
    skipWs();
    let offset = 0;
    const off = /^offset:(\d+)/.exec(src.slice(i));
    if (off) {
      offset = Number(off[1]);
      i += off[0].length;
      skipWs();
    }
    const branches: Record<string, Node[]> = {};
    while (i < src.length && src[i] !== "}") {
      skipWs();
      const m = /^(=\d+|[A-Za-z_]+)/.exec(src.slice(i));
      if (!m) return null;
      const key = m[0];
      i += key.length;
      skipWs();
      if (src[i] !== "{") return null;
      i++;
      branches[key] = parseNodes(type !== "select", true);
      if (src[i] !== "}") return null;
      i++;
      skipWs();
    }
    if (src[i] !== "}") return null;
    i++;
    return type === "select" ? { k: "select", name, branches } : { k: "plural", name, offset, branches };
  }

  const nodes = parseNodes(false, false);
  cache.set(src, nodes);
  return nodes;
}

const pluralRules = new Map<string, Intl.PluralRules>();
function pluralOf(locale: string, n: number): string {
  let r = pluralRules.get(locale);
  if (!r) {
    try {
      r = new Intl.PluralRules(locale);
    } catch {
      r = new Intl.PluralRules("en");
    }
    pluralRules.set(locale, r);
  }
  return r.select(n);
}

const numberFormats = new Map<string, Intl.NumberFormat>();
function num(locale: string, n: number): string {
  let f = numberFormats.get(locale);
  if (!f) {
    try {
      f = new Intl.NumberFormat(locale);
    } catch {
      f = new Intl.NumberFormat("en");
    }
    numberFormats.set(locale, f);
  }
  return f.format(n);
}

function render(nodes: Node[], vars: Vars, locale: string, hash: number | null): string {
  let out = "";
  for (const n of nodes) {
    switch (n.k) {
      case "text":
        out += n.v;
        break;
      case "hash":
        out += hash === null ? "#" : num(locale, hash);
        break;
      case "var": {
        const v = vars[n.name];
        out += v === undefined || v === null ? `{${n.name}}` : String(v);
        break;
      }
      case "plural": {
        const raw = Number(vars[n.name]);
        const value = Number.isFinite(raw) ? raw : 0;
        const exact = n.branches[`=${value}`];
        const branch = exact ?? n.branches[pluralOf(locale, value - n.offset)] ?? n.branches.other ?? [];
        out += render(branch, vars, locale, value - n.offset);
        break;
      }
      case "select": {
        const v = vars[n.name];
        const branch = n.branches[String(v)] ?? n.branches.other ?? [];
        out += render(branch, vars, locale, hash);
        break;
      }
    }
  }
  return out;
}

export function formatMessage(message: string, vars: Vars | undefined, locale: string): string {
  if (!vars && message.indexOf("{") === -1) return message;
  return render(parse(message), vars ?? {}, locale, null);
}

/**
 * "Tap <b>Pay</b> to <link>continue</link>" as text and tagged chunks, in
 * order. Tags do not nest; an unknown or unclosed tag stays as text.
 */
export type Chunk = { tag: null; text: string } | { tag: string; text: string };

export function splitTags(s: string): Chunk[] {
  const out: Chunk[] = [];
  const re = /<([a-zA-Z][a-zA-Z0-9]*)>([\s\S]*?)<\/\1>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ tag: null, text: s.slice(last, m.index) });
    out.push({ tag: m[1], text: m[2] });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ tag: null, text: s.slice(last) });
  return out;
}

/** The variable names and tags a message uses, for checking a translation against English. */
export function signature(message: string): string[] {
  const names = new Set<string>();
  const nodes = (() => {
    try {
      return parse(message);
    } catch {
      return [];
    }
  })();
  const walk = (ns: Node[]) => {
    for (const n of ns) {
      if (n.k === "var") names.add(`{${n.name}}`);
      if (n.k === "plural" || n.k === "select") {
        names.add(`{${n.name}}`);
        Object.values(n.branches).forEach(walk);
      }
    }
  };
  walk(nodes);
  for (const m of message.matchAll(/<([a-zA-Z][a-zA-Z0-9]*)>/g)) names.add(`<${m[1]}>`);
  return Array.from(names).sort();
}
