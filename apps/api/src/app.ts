import "./config/env";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import morgan from "morgan";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.middleware";
import { requestId } from "./middleware/request-id.middleware";
import routes from "./routes";

const app = express();

app.use(requestId);
app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api/v1", routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
