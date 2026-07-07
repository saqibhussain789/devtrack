import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { env } from "../config/env";
import { verifyAccessToken } from "../modules/auth/token.util";

let io: Server | undefined;

function userRoom(userId: string): string {
  return `user:${userId}`;
}

/**
 * Every connection authenticates with the same short-lived access token used
 * for REST calls (passed via the handshake, not a header, since browsers
 * can't set custom headers on the WebSocket upgrade request). A socket that
 * fails to authenticate is rejected before `connection` fires at all, so
 * there's no unauthenticated socket state to worry about downstream.
 */
export function initSocketServer(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGIN, credentials: true },
  });

  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) {
        return next(new Error("Missing access token."));
      }
      const payload = await verifyAccessToken(token);
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error("Invalid or expired access token."));
    }
  });

  io.on("connection", (socket: Socket) => {
    socket.join(userRoom(socket.data.userId as string));
  });

  return io;
}

/** Pushes a realtime event to every connection for one user (they may have several tabs open). */
export function emitToUser(userId: string, event: string, payload: unknown): void {
  io?.to(userRoom(userId)).emit(event, payload);
}
