// Output tool createDiagram, model tự viết mã Mermaid, khác createChart (số liệu lấy từ DB thật).
export interface DiagramToolOutput {
  success: true;
  title: string;
  mermaidCode: string;
}
