import "./config/env";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env, isProduction } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.middleware";
import { apiRateLimiter } from "./middleware/rate-limit.middleware";
import { requestId } from "./middleware/request-id.middleware";
import routes from "./routes";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Raw request body bytes, captured for GitHub webhook HMAC signature verification. */
      rawBody?: Buffer;
    }
  }
}

const app = express();

// Behind a reverse proxy (Render, Railway, Fly, etc.) in production, Express
// otherwise sees the proxy's IP for every request — which breaks per-client
// rate limiting (everyone shares one bucket) and req.ip-based logging.
if (isProduction) {
  app.set("trust proxy", 1);
}

app.use(requestId);
app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));
// CSP is left to the frontend (Next.js serves the actual HTML/JS); this API
// only ever returns JSON, so a content-security-policy header here has
// nothing to constrain and would just add noise.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      (req as express.Request).rawBody = Buffer.from(buf);
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());
app.use(apiRateLimiter);

app.use("/api/v1", routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
