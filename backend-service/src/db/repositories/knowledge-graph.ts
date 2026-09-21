import { kgEntities, kgRelations, chunks, documents } from "@ai-assistant/db/src/schema";
import { eq, and, ilike, sql } from "drizzle-orm";
import { withUserContext, type UserScopedTx } from "../context";
import { embedText } from "../../utils/embedding";
import type { KgEntityKind } from "@ai-assistant/db/src/schema";

type RawEntity = { name: string; kind: KgEntityKind };
type RawRelation = { sourceEntity: string; relationType: string; targetEntity: string };

// Measured directly against gemini-embedding-001 (see conversation notes): "du an Alpha" vs "Alpha"
// (same entity) sits at distance 0.214, almost identical to "Beta Corp" vs "Gamma Corp" (different
// entities) at 0.211. No threshold separates these, so embedding similarity alone is not reliable for
// this kind of short-name variation. Kept only as a narrow, conservative safety net (checked after the
// substring check below fails), threshold picked safely under the measured false-positive distance.
const NAME_SIMILARITY_THRESHOLD = 0.1;

// Case-insensitive containment either direction, catches a name that's a shortened or expanded form
// of the other (e.g. "Alpha" inside "du an Alpha", "Beta Corp" inside "cong ty Beta Corp"). Minimum
// length guard avoids a short generic string matching almost everything.
function isLikelySameName(a: string, b: string): boolean {
  const na = a.trim().toLowerCase();
  const nb = b.trim().toLowerCase();
  if (na === nb) return true;
  const [shorter, longer] = na.length <= nb.length ? [na, nb] : [nb, na];
  return shorter.length >= 3 && longer.includes(shorter);
}

// Once any 2 merged mentions disagree on kind, mark this entity untrustworthy for graph traversal
// downstream (implemented in a later phase), by the same reasoning whether the disagreement is
// "concept" vs a real kind, or 2 different real kinds:
// - If either side is "concept", the merged kind becomes "concept" permanently, this alone is enough
//   for downstream code to recognize and block it, no separate flag needed for this case.
// - If both sides are real (non-concept) kinds but differ (e.g. "person" vs "organization"), the
//   stored kind is left as-is (arbitrary, it will be blocked anyway) but kindDisagreement is set true.
// Never reverses a "concept" downgrade or clears kindDisagreement back to false once set.
function reconcileKindOnMerge(
  existingKind: KgEntityKind,
  existingDisagreement: boolean,
  newKind: KgEntityKind
): { entityKind: KgEntityKind; kindDisagreement: boolean } {
  if (existingKind === newKind) return { entityKind: existingKind, kindDisagreement: existingDisagreement };
  if (existingKind === "concept" || newKind === "concept") return { entityKind: "concept", kindDisagreement: existingDisagreement };
  return { entityKind: existingKind, kindDisagreement: true };
}

// Applies a merge match's kind reconciliation and returns its id, shared by all 3 match branches below.
async function mergeIntoExisting(
  tx: UserScopedTx,
  existing: { id: string; entityKind: KgEntityKind; kindDisagreement: boolean },
  newKind: KgEntityKind
): Promise<string> {
  const reconciled = reconcileKindOnMerge(existing.entityKind, existing.kindDisagreement, newKind);
  if (reconciled.entityKind !== existing.entityKind || reconciled.kindDisagreement !== existing.kindDisagreement) {
    await tx.update(kgEntities).set(reconciled).where(eq(kgEntities.id, existing.id));
  }
  return existing.id;
}

export type KgEntityRow = { id: string; name: string; entityKind: KgEntityKind; kindDisagreement: boolean };

const ENTITY_COLUMNS = { id: kgEntities.id, name: kgEntities.name, entityKind: kgEntities.entityKind, kindDisagreement: kgEntities.kindDisagreement };

// 3 match attempts in increasing cost order: exact name, then substring containment (both free, no
// embedding call), then embedding similarity as a narrow safety net. Shared by findOrCreateEntity
// (merges/creates on the result) and findEntityByName (a read-only lookup for the query tool, so a
// user's own wording of a name resolves to whatever canonical name got stored at extraction time).
// Also returns the computed name embedding when one was needed, so a cache miss doesn't have to
// re-embed the same name a second time just to store it on a newly created entity.
async function resolveEntityMatch(
  tx: UserScopedTx,
  userId: string,
  name: string
): Promise<{ match: KgEntityRow | null; embedding: number[] | null }> {
  const [exactMatch] = await tx.select(ENTITY_COLUMNS).from(kgEntities).where(and(eq(kgEntities.userId, userId), ilike(kgEntities.name, name)));
  if (exactMatch) return { match: exactMatch, embedding: null };

  const userEntities = await tx.select(ENTITY_COLUMNS).from(kgEntities).where(eq(kgEntities.userId, userId));
  const substringMatch = userEntities.find((e) => isLikelySameName(e.name, name));
  if (substringMatch) return { match: substringMatch, embedding: null };
  if (userEntities.length === 0) return { match: null, embedding: null };

  const nameEmbedding = await embedText(name);
  const embeddingLiteral = JSON.stringify(nameEmbedding);
  const [fuzzyMatch] = await tx
    .select({ ...ENTITY_COLUMNS, distance: sql<number>`${kgEntities.nameEmbedding} <=> ${embeddingLiteral}::vector`.as("distance") })
    .from(kgEntities)
    .where(eq(kgEntities.userId, userId))
    .orderBy(sql`${kgEntities.nameEmbedding} <=> ${embeddingLiteral}::vector`)
    .limit(1);

  if (fuzzyMatch && fuzzyMatch.distance <= NAME_SIMILARITY_THRESHOLD) return { match: fuzzyMatch, embedding: nameEmbedding };
  return { match: null, embedding: nameEmbedding };
}

async function findOrCreateEntity(tx: UserScopedTx, userId: string, name: string, kind: KgEntityKind): Promise<string> {
  const { match, embedding } = await resolveEntityMatch(tx, userId, name);
  if (match) return mergeIntoExisting(tx, match, kind);

  const nameEmbedding = embedding ?? (await embedText(name));
  const [created] = await tx.insert(kgEntities).values({ userId, name, nameEmbedding, entityKind: kind }).returning({ id: kgEntities.id });
  return created.id;
}

// Read-only lookup for the query tool, never creates. Returns null if nothing in this user's graph
// is close enough to the given name.
export async function findEntityByName(userId: string, name: string): Promise<KgEntityRow | null> {
  return withUserContext(userId, async (tx) => (await resolveEntityMatch(tx, userId, name)).match);
}

// Writes 1 chunk's raw extraction output. A relation naming an entity the same extraction call didn't
// itself declare is dropped rather than guessed at, this should never happen if the schema is followed
// but is cheap to guard against.
export async function insertExtractedGraph(
  userId: string,
  sourceChunkId: string,
  entities: RawEntity[],
  relations: RawRelation[]
): Promise<{ entitiesLinked: number; relationsCreated: number }> {
  return withUserContext(userId, async (tx) => {
    const idByName = new Map<string, string>();
    for (const entity of entities) {
      const key = entity.name.toLowerCase();
      if (idByName.has(key)) continue;
      const id = await findOrCreateEntity(tx, userId, entity.name, entity.kind);
      idByName.set(key, id);
    }

    let relationsCreated = 0;
    for (const relation of relations) {
      const sourceId = idByName.get(relation.sourceEntity.toLowerCase());
      const targetId = idByName.get(relation.targetEntity.toLowerCase());
      if (!sourceId || !targetId) continue;
      await tx.insert(kgRelations).values({
        userId,
        sourceEntityId: sourceId,
        targetEntityId: targetId,
        relationType: relation.relationType,
        sourceChunkId,
      });
      relationsCreated++;
    }

    return { entitiesLinked: idByName.size, relationsCreated };
  });
}

export type KgGraphEdge = { sourceEntityId: string; targetEntityId: string; relationType: string; sourceChunkId: string; sourceFileName: string };

// Fetches the user's whole graph in 2 queries, traversal itself runs in application code (see
// query-knowledge-graph.ts), not as a recursive SQL CTE, per-user relation counts are small enough
// for now that this is simpler to reason about and to apply the concept/kindDisagreement block to.
export async function getGraphForUser(userId: string): Promise<{ entities: KgEntityRow[]; edges: KgGraphEdge[] }> {
  return withUserContext(userId, async (tx) => {
    const entities = await tx.select(ENTITY_COLUMNS).from(kgEntities).where(eq(kgEntities.userId, userId));
    const edges = await tx
      .select({
        sourceEntityId: kgRelations.sourceEntityId,
        targetEntityId: kgRelations.targetEntityId,
        relationType: kgRelations.relationType,
        sourceChunkId: kgRelations.sourceChunkId,
        sourceFileName: documents.fileName,
      })
      .from(kgRelations)
      .innerJoin(chunks, eq(kgRelations.sourceChunkId, chunks.id))
      .innerJoin(documents, eq(chunks.documentId, documents.id))
      .where(eq(kgRelations.userId, userId));
    return { entities, edges };
  });
}
