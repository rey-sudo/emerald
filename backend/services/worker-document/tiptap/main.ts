import { Hono } from "jsr:@hono/hono";
import { JSDOM } from "npm:jsdom";
import { generateJSON } from "npm:@tiptap/html";
import { mergeAttributes, Node } from "npm:@tiptap/core";
import { timeout } from "jsr:@hono/hono/timeout";
import { z } from "zod";
import StarterKit from "npm:@tiptap/starter-kit";

const HOST = Deno.env.get("HOST") || "localhost";
const PORT = Number(Deno.env.get("PORT")) || 7081;

const { window } = new JSDOM();

const g = globalThis as any;
g.window = window;
g.document = window.document;
g.navigator = window.navigator;
g.HTMLElement = window.HTMLElement;
g.DocumentFragment = window.DocumentFragment;
g.DOMParser = window.DOMParser;

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
        parseHTML: (el) => el.getAttribute("data-number"),
        renderHTML: (attrs) => ({ "data-number": attrs.number }),
      },
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute("id"),
        renderHTML: (attrs) => ({ id: attrs.id }),
      },
      class: {
        default: "page-virtual",
        parseHTML: (el) => el.getAttribute("class"),
        renderHTML: (attrs) => ({ class: attrs.class }),
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

const extensions = [StarterKit, PageNode];

//==============================================================================================

const app = new Hono();

app.get("/", (c) => {
  return c.json({
    message: "Test Ok",
    timestamp: new Date().toISOString(),
  });
});

//==============================================================================================

const HtmlToJsonSchema = z.object({
  html: z
    .string()
    .min(1, { message: 'The "html" field must be a non-empty string.' }),
});

app.post("/html-to-json", timeout(180_000), async (c) => {
  try {
    const body = await c.req.json();
    const parsed = HtmlToJsonSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { error: "Validation error.", details: parsed.error.issues },
        400,
      );
    }

    const html = parsed.data.html;
    const json = generateJSON(html, extensions);
    return c.json(json);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json(
      { error: "Error processing the HTML.", detail: message },
      500,
    );
  }
});

//==============================================================================================

app.notFound((c) => {
  return c.json({ error: "Route not found" }, 404);
});

//==============================================================================================

Deno.serve(
  {
    port: PORT,
    onListen: ({ hostname, port }) =>
      console.log(`🚀 Server running on http://${hostname}:${port}`),
  },
  app.fetch,
);
