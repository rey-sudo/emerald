import Fastify from "fastify";
import StarterKit from "@tiptap/starter-kit";
import * as Y from "yjs";
import { JSDOM } from "jsdom";
import { generateJSON } from "@tiptap/html";
import { mergeAttributes, Node } from "@tiptap/core";
import { TiptapTransformer } from "@hocuspocus/transformer";
import { z } from "zod";

const HOST = process.env.HOST || "localhost";
const PORT = Number(process.env.PORT) || 7001;

const { window } = new JSDOM();

const g = globalThis as any;
g.window = window;
g.document = window.document;
g.HTMLElement = window.HTMLElement;
g.DocumentFragment = window.DocumentFragment;
g.DOMParser = window.DOMParser;

Object.defineProperty(globalThis, "navigator", {
  value: window.navigator,
  writable: true,
  configurable: true,
});

//==============================================================================================

const PageNode = Node.create({
  name: "page",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      number: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-number"),
        renderHTML: (attributes) => ({ "data-number": attributes.number }),
      },
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute("id"),
        renderHTML: (attributes) => ({ id: attributes.id }),
      },
      class: {
        default: "page-virtual",
        parseHTML: (element) => element.getAttribute("class"),
        renderHTML: (attributes) => ({ class: attributes.class }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="page"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes({ "data-type": "page" }, HTMLAttributes), 0];
  },
});

const extensions: any = [
  StarterKit.configure({
    bold: {
      HTMLAttributes: {
        class: "custom-bold-style",
      },
    },
  }),
  PageNode
];

//==============================================================================================

const HtmlToJsonSchema = z.object({
  html: z
    .string()
    .min(1, { message: 'The "html" field must be a non-empty string.' }),
});

//==============================================================================================

const app = Fastify({ logger: false });

app.get("/", async (_request, reply) => {
  return reply.send({
    message: "Test Ok",
    timestamp: new Date().toISOString(),
  });
});

//==============================================================================================

app.post("/html-to-json", {
  config: { timeout: 180_000 },
  handler: async (request, reply) => {
    try {
      const parsed = HtmlToJsonSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: "Validation error.", details: parsed.error.issues });
      }

      const html = parsed.data.html;
      const json = generateJSON(html, extensions);
      return reply.send(json);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply
        .status(500)
        .send({ error: "Error processing the HTML.", detail: message });
    }
  },
});

app.post("/html-to-y", {
  config: { timeout: 180_000 },
  handler: async (request, reply) => {
    try {
      const parsed = HtmlToJsonSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: "Validation error.", details: parsed.error.issues });
      }

      const html = parsed.data.html;

      // 1. Convertir HTML a JSON de TipTap
      const json = generateJSON(html, extensions);

      // 2. Convertir el JSON a Y.Doc
      const ydoc = TiptapTransformer.toYdoc(json, "default", extensions);

      // 3. Codificar el Y.Doc como binario
      const binary = Y.encodeStateAsUpdate(ydoc);

      // 4. Enviar el binario
      return reply
        .status(200)
        .header("Content-Type", "application/octet-stream")
        .header("Content-Disposition", 'attachment; filename="document.yjs"')
        .send(Buffer.from(binary));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply
        .status(500)
        .send({
          error: "Error processing the HTML to Y.js binary.",
          detail: message,
        });
    }
  },
});

//==============================================================================================

app.setNotFoundHandler((_request, reply) => {
  return reply.status(404).send({ error: "Route not found" });
});

//==============================================================================================

app.listen({ port: PORT, host: HOST }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`🚀 Server running on ${address}`);
});
