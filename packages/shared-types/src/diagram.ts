// Output of the createDiagram tool, the model writes Mermaid code itself, unlike createChart (numbers come from real DB data).
export interface DiagramToolOutput {
  success: true;
  title: string;
  mermaidCode: string;
}
