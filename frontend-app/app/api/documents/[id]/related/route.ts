import { withAuthedContext } from "@/lib/with-authed-context";
import { findRelatedDocuments } from "@/lib/related-documents";

export const GET = withAuthedContext<{ id: string }>(async (_req, { session, params, tx }) => {
  const related = await findRelatedDocuments(tx, session.user.id, params.id);
  return Response.json(related);
});
