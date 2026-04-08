import { Hono } from "jsr:@hono/hono";

const app = new Hono();

// Ruta raíz
app.get("/", (c) => {
  return c.json({
    message: "¡Hola desde Hono + Deno 2026! 🦕🔥",
    timestamp: new Date().toISOString(),
  });
});

// Ruta con parámetro
app.get("/usuario/:nombre", (c) => {
  const nombre = c.req.param("nombre");
  return c.json({ mensaje: `Hola, ${nombre}!` });
});

// Ruta POST
app.post("/eco", async (c) => {
  const body = await c.req.json();
  return c.json({ recibido: body });
});

// Ruta 404 personalizada
app.notFound((c) => {
  return c.json({ error: "Ruta no encontrada" }, 404);
});

Deno.serve({ port: 3000 }, app.fetch);

console.log("🚀 Servidor corriendo en http://localhost:3000");