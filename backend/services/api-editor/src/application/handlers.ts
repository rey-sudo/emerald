import { z } from "zod";

export const GetDocumentSchema = z.object({
  command: z.literal("get_document"),
  params: z.object({ documentId: z.string() }),
});

export const UpdateDocumentSchema = z.object({
  command: z.literal("update_document"),
  params: z.object({
    documentId: z.string(),
    binario: z.instanceof(Uint8Array),
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
    command: "get_document",
    documentId: params.documentId,
    content: `Contenido del documento ${params.documentId}`,
  };
}

export function handleUpdateDocument(
  params: z.infer<typeof UpdateDocumentSchema>["params"],
) {
  console.log("Binario recibido:", params.binario);

  return {
    command: "update_document",
    documentId: params.documentId,
    success: true,
  };
}
