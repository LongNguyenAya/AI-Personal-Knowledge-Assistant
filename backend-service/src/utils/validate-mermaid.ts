import { JSDOM } from "jsdom";

// mermaid.parse() needs window/document (DOMPurify requires them to construct itself), even though
// it only returns the parsed AST here, never actually draws anything, one shim shared for the whole
// process is enough, don't discard it after every call.
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
(globalThis as { window?: unknown }).window = dom.window;
(globalThis as { document?: unknown }).document = dom.window.document;
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });

// Lazy import, only after the shim above is in place, mermaid throws immediately on import otherwise.
let mermaidPromise: Promise<typeof import("mermaid").default> | null = null;
async function getMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((m) => {
      m.default.initialize({ startOnLoad: false });
      return m.default;
    });
  }
  return mermaidPromise;
}

// Pure syntax check, never renders SVG, this is the cheap objective checker createDiagram was missing.
export async function validateMermaidSyntax(code: string): Promise<{ valid: true } | { valid: false; error: string }> {
  const mermaid = await getMermaid();
  try {
    await mermaid.parse(code);
    return { valid: true };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : String(err) };
  }
}
