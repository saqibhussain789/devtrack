import { io, type Socket } from "socket.io-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
// Socket.IO attaches to the raw HTTP server, not the /api/v1 router, so it
// needs the bare origin rather than the REST client's base path.
const SOCKET_ORIGIN = API_URL.replace(/\/api\/v1\/?$/, "");

export function createSocket(accessToken: string): Socket {
  return io(SOCKET_ORIGIN, { auth: { token: accessToken }, transports: ["websocket", "polling"] });
}
