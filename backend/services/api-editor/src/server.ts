import { app } from "./app.js";

const HOST = process.env.HOST ?? "0.0.0.0";
const PORT = parseInt(process.env.PORT ?? '8003', 10)

const start = async () => {
  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`\n🚀  Server listening in http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
