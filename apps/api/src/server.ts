import { createServer } from "node:http";
import app from "./app";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { initSocketServer } from "./sockets/io";

const httpServer = createServer(app);
const io = initSocketServer(httpServer);

httpServer.listen(env.PORT, () => {
  console.log(`DevTrack API running on http://localhost:${env.PORT}`);
});

/**
 * Orchestrators (Docker, Render, Railway, k8s) send SIGTERM before killing a
 * container on redeploy/scale-down. Without this, in-flight requests get cut
 * off mid-response and the Postgres pool is abandoned rather than closed.
 * The force-exit timeout is a backstop in case a stuck connection (e.g. an
 * open socket) never lets `close()` resolve on its own.
 */
function shutdown(signal: string) {
  console.log(`${signal} received, shutting down gracefully...`);

  const forceExit = setTimeout(() => {
    console.error("Graceful shutdown timed out, forcing exit.");
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  io.close();
  httpServer.close(async () => {
    await prisma.$disconnect();
    clearTimeout(forceExit);
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
