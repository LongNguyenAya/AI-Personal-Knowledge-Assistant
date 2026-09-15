// Output of the createDiagram tool, the model writes Mermaid code itself, unlike createChart (numbers come from real DB data).
// The failure case only happens when the tool's own render-check rejects the code, the model is expected to retry with a fix.
export type DiagramToolOutput = { success: true; title: string; mermaidCode: string } | { success: false; error: string };
