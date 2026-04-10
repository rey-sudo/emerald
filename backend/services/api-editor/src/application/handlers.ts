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
type DocumentFormat = "json" | "binary";

interface GetDocumentResponse {
  success: boolean;
  message: string;
  command: "get_document";
  data: {
    documentId: string;
    format: DocumentFormat;
    content: any;
    isNew: boolean;
  };
}

export function handleGetDocument(
  params: z.infer<typeof GetDocumentSchema>["params"],
): GetDocumentResponse {
  console.log(params);

  const content = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Wow, this editor instance exports its content as JSON.",
          },
        ],
      },
    ],
  };

  return {
    success: true,
    message: "The document",
    command: "get_document",
    data: {
      documentId: params.documentId,
      format: "json",
      content: content,
      isNew: true,
    },
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
