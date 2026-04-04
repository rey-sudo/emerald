import { Hono, type Context } from "jsr:@hono/hono";
import { Queue } from "npm:bullmq";
import { z } from "npm:zod";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function envInt(name: string, fallback: number): number {
  const value = Number(Deno.env.get(name) ?? fallback);
  if (isNaN(value)) throw new Error(`Env "${name}" must be a number`);
  return value;
}

const PORT = envInt("PORT", 3005);
if (PORT < 1 || PORT > 65535) throw new Error(`Invalid PORT: ${PORT}`);

const queue = new Queue(Deno.env.get("QUEUE_NAME") ?? "documentQueue", {
  connection: {
    host: Deno.env.get("REDIS_HOST") ?? "localhost",
    port: envInt("REDIS_PORT", 6379),
  },
});

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const CreateJobSchema = z.object({
  event_type: z
    .string({ error: "event_type must be a string" })
    .trim()
    .min(1, "event_type cannot be empty")
    .max(256, "event_type must be 256 characters or fewer"),
  data: z.record(z.string(), z.unknown()),
});

type CreateJobBody = z.infer<typeof CreateJobSchema>;

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = new Hono();

/** Rejects bodies larger than 100 KB before they reach the queue. */
app.use("/create-job", async (c: Context, next) => {
  if (Number(c.req.header("content-length") ?? 0) > 100_000) {
    return c.json({ error: "Payload too large (max 100 KB)" }, 413);
  }
  await next();
});

app.get("/", (c: Context) => c.json({ status: "ok" }));

/**
 * Enqueues a new job.
 * Body: `{ event_type: string, data: Record<string, unknown> }`
 */
app.post("/create-job", async (c: Context) => {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: "Body must be valid JSON" }, 400);
  }

  const parsed = CreateJobSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues.map(({ path, message }) => ({
      field: path.join("."),
      message,
    }));
    return c.json({ error: "Validation failed", details }, 400);
  }

  const { event_type, data }: CreateJobBody = parsed.data;

  try {
    const job = await queue.add(event_type, data);
    return c.json({ jobId: job.id, data: { success: true } }, 201);
  } catch (err) {
    console.error("[create-job] Failed to enqueue:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} received — closing queue...`);

  await Promise.race([
    queue.close(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Queue close timed out")), 5_000)
    ),
  ]).catch((err) => console.error("[shutdown]", err.message));

  Deno.exit(0);
}

Deno.addSignalListener("SIGINT", () => shutdown("SIGINT"));
Deno.addSignalListener("SIGTERM", () => shutdown("SIGTERM"));

Deno.serve(
  {
    port: PORT,
    onListen: ({ port }) => console.log(`🚀 http://localhost:${port}`),
  },
  app.fetch,
);
