import { Hono, type Context } from "jsr:@hono/hono";
import { Queue } from "npm:bullmq";
import { z } from "npm:zod";

function envInt(name: string, fallback: number): number {
  const value = Number(Deno.env.get(name) ?? fallback);
  if (isNaN(value)) throw new Error(`Env "${name}" must be a number`);
  return value;
}

const PORT = envInt("CONSUMER_SERVER_PORT", 7080);
if (PORT < 1 || PORT > 65535) throw new Error(`Invalid PORT: ${PORT}`);

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

function createQueue(name: string): Queue {
  return new Queue(name, {
    connection: {
      host: Deno.env.get("REDIS_HOST") ?? "localhost",
      port: envInt("REDIS_PORT", 6379),
    },
  });
}

const queue = createQueue(Deno.env.get("QUEUE_NAME") ?? "documentQueue");

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

const ok = (c: Context, body: unknown, status: 200 | 201 = 200) =>
  c.json(body, status);

const fail = (
  c: Context,
  message: string,
  status: 400 | 413 | 500,
  extra?: object,
) => c.json({ error: message, ...extra }, status);

const app = new Hono();

app.get("/", (c) => ok(c, { status: "ok" }));

app.post("/create-job", async (c: Context) => {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return fail(c, "Body must be valid JSON", 400);
  }

  const parsed = CreateJobSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues.map(({ path, message }) => ({
      field: path.join("."),
      message,
    }));
    return fail(c, "Validation failed", 400, { details });
  }

  const { event_type, data }: CreateJobBody = parsed.data;

  try {
    const jobOptions = {
      attempts: 10,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    };

    const job = await queue.add(event_type, data, jobOptions);
    return ok(c, { jobId: job.id, data: { success: true } }, 201);
  } catch (err) {
    console.error("[create-job] Failed to enqueue:", err);
    return fail(c, "Internal server error", 500);
  }
});

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} received — closing queue...`);

  await Promise.race([
    queue.close(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Queue close timed out")), 5_000),
    ),
  ]).catch((err: Error) => console.error("[shutdown]", err.message));

  Deno.exit(0);
}

function startServer(): void {
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    Deno.addSignalListener(signal, () => shutdown(signal));
  }
  Deno.serve(
    {
      port: PORT,
      onListen: ({ port }) => console.log(`🚀 http://localhost:${port}`),
    },
    app.fetch,
  );
}

startServer();
