import { z } from "zod";

export const GetDocumentSchema = z.object({
  command: z.literal("get_document"),
  params: z.object({ documentId: z.string() }),
});

export const UpdateDocumentSchema = z.object({
  command: z.literal("update_document"),
  params: z.object({
    documentId: z.string(),
    content: z.string(),
  }),
});

export const ClientMessageSchema = z.discriminatedUnion("command", [
  GetDocumentSchema,
  UpdateDocumentSchema,
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// ── Handlers ──────────────────────────────────────────────────────────────────

export function handleGetDocument(
  params: z.infer<typeof GetDocumentSchema>["params"],
) {
  console.log(params);

  return {
    type: "get_document",
    documentId: params.documentId,
    content: `Contenido del documento ${params.documentId}`,
  };
}

export function handleUpdateDocument(
  params: z.infer<typeof UpdateDocumentSchema>["params"],
) {
  return {
    type: "update_document",
    documentId: params.documentId,
    success: true,
    updatedContent: params.content,
  };
}
