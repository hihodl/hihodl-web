/** A language's namespaces, flattened to "namespace.key" like ../en. */
export function prefix(namespaces: Record<string, Record<string, string>>): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [ns, messages] of Object.entries(namespaces)) {
    for (const [k, v] of Object.entries(messages)) if (typeof v === "string" && v !== "") out[`${ns}.${k}`] = v;
  }
  return out;
}
