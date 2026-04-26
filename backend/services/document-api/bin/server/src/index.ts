import { app } from "./app.js";

const HOST = process.env.HOST ?? "0.0.0.0";
const PORT = parseInt(process.env.PORT ?? '8001', 10)

const start = async () => {
  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`\n🚀  Server listening in http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
