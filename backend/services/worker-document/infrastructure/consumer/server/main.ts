// main.ts
import { Hono } from "jsr:@hono/hono";
import { Queue, Worker } from "npm:bullmq";

const connection = { host: "localhost", port: 6379 };

const queue = new Queue("documentQueue", { connection });

const app = new Hono();

app.get("/", (c: any) => c.json({ status: "ok" }));

app.post("/create-job", async (c:any) => {
  const body = await c.req.json();
  console.log(body)
  const job = await queue.add(body['event_type'], body['data']);
  return c.json({ jobId: job.id, data: { success:  true } }, 201);
});

Deno.serve({ port: 3005 }, app.fetch);

console.log("🚀 Server corriendo en http://localhost:3005");