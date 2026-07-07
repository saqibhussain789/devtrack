import { createServer } from "node:http";
import app from "./app";
import { env } from "./config/env";
import { initSocketServer } from "./sockets/io";

const httpServer = createServer(app);
initSocketServer(httpServer);

httpServer.listen(env.PORT, () => {
  console.log(`DevTrack API running on http://localhost:${env.PORT}`);
});
