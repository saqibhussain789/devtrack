import "./config/env";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import morgan from "morgan";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.middleware";
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

app.use(requestId);
app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as express.Request).rawBody = Buffer.from(buf);
    },
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api/v1", routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
