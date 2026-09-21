import { tool } from "ai";
import { z } from "zod";
import { findEntityByName, getGraphForUser, type KgEntityRow, type KgGraphEdge } from "../../db/repositories/knowledge-graph";

const MAX_HOPS = 3;

type PathStep = { from: string; relationType: string; to: string; sourceFileName: string };

function isUnsafeBridge(entity: KgEntityRow): boolean {
  return entity.entityKind === "concept" || entity.kindDisagreement;
}

// BFS, edges treated as bidirectional (a "phu trach" relation still connects both entities regardless
// of extraction direction), same algorithm validated in standalone scripts before this was built into
// the product. A node marked unsafe (concept kind, or disagreeing kind labels across merged mentions)
// is never traversed THROUGH, but is still reachable as the final destination itself, so a direct
// lookup on that entity's own name still works even though it can't act as a bridge to something else.
function findPath(entitiesById: Map<string, KgEntityRow>, edges: KgGraphEdge[], fromId: string, toId: string): PathStep[] | null {
  const adjacency = new Map<string, { toId: string; relationType: string; sourceFileName: string }[]>();
  for (const edge of edges) {
    if (!adjacency.has(edge.sourceEntityId)) adjacency.set(edge.sourceEntityId, []);
    adjacency.get(edge.sourceEntityId)!.push({ toId: edge.targetEntityId, relationType: edge.relationType, sourceFileName: edge.sourceFileName });
    if (!adjacency.has(edge.targetEntityId)) adjacency.set(edge.targetEntityId, []);
    adjacency.get(edge.targetEntityId)!.push({ toId: edge.sourceEntityId, relationType: `(reverse) ${edge.relationType}`, sourceFileName: edge.sourceFileName });
  }

  const visited = new Set([fromId]);
  const queue: { nodeId: string; path: PathStep[] }[] = [{ nodeId: fromId, path: [] }];

  while (queue.length > 0) {
    const { nodeId, path } = queue.shift()!;
    if (nodeId === toId) return path;
    if (path.length >= MAX_HOPS) continue;

    for (const edge of adjacency.get(nodeId) ?? []) {
      if (visited.has(edge.toId)) continue;
      const nextEntity = entitiesById.get(edge.toId);
      if (nextEntity && isUnsafeBridge(nextEntity) && edge.toId !== toId) continue;
      visited.add(edge.toId);
      queue.push({
        nodeId: edge.toId,
        path: [
          ...path,
          {
            from: entitiesById.get(nodeId)?.name ?? "?",
            relationType: edge.relationType,
            to: nextEntity?.name ?? "?",
            sourceFileName: edge.sourceFileName,
          },
        ],
      });
    }
  }
  return null;
}

export function queryKnowledgeGraphTool(userId: string) {
  return tool({
    description:
      "Tìm mối liên hệ giữa 2 thực thể cụ thể (người/tổ chức/dự án có tên riêng) được nhắc tới RẢI RÁC " +
      "ở nhiều tài liệu khác nhau, không cùng nằm trong 1 đoạn văn. Dùng khi user hỏi kiểu 'A có liên " +
      "quan gì tới B', 'A và B có quan hệ gì không'. KHÁC với searchDocuments (tìm nội dung 1 chủ đề " +
      "trong 1 tài liệu, không nối nhiều tài liệu). Nếu found=false, PHẢI nói rõ KHÔNG tìm thấy liên hệ " +
      "nào theo đúng error trả về, TUYỆT ĐỐI không tự suy đoán/bịa thêm mối liên hệ không có trong kết quả.",
    inputSchema: z.object({
      entityA: z.string().describe("Tên thực thể thứ nhất, lấy đúng theo cách user gọi trong câu hỏi"),
      entityB: z.string().describe("Tên thực thể thứ hai, lấy đúng theo cách user gọi trong câu hỏi"),
    }),
    execute: async ({ entityA, entityB }) => {
      const [entityARow, entityBRow] = await Promise.all([findEntityByName(userId, entityA), findEntityByName(userId, entityB)]);

      if (!entityARow || !entityBRow) {
        const missing = [!entityARow ? entityA : null, !entityBRow ? entityB : null].filter(Boolean);
        return { found: false as const, error: `Không tìm thấy "${missing.join('", "')}" trong knowledge graph của user.` };
      }

      if (entityARow.id === entityBRow.id) {
        return { found: true as const, path: [], note: `"${entityA}" và "${entityB}" là cùng 1 thực thể (${entityARow.name}) trong knowledge graph.` };
      }

      const { entities, edges } = await getGraphForUser(userId);
      const entitiesById = new Map(entities.map((e) => [e.id, e]));
      const path = findPath(entitiesById, edges, entityARow.id, entityBRow.id);

      if (!path) {
        return {
          found: false as const,
          error: `Tìm thấy cả "${entityARow.name}" và "${entityBRow.name}" nhưng không có đường kết nối nào giữa 2 thực thể này (đã thử tối đa ${MAX_HOPS} bước).`,
        };
      }

      return { found: true as const, path };
    },
  });
}
