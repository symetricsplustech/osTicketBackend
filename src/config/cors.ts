import cors, { type CorsOptions } from "cors";
import { allowedOrigins, isProd } from "./env";

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    if (
      !isProd &&
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
    ) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin ${origin} is not allowed by CORS policy`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Request-Id",
    "X-Api-Key",
    "X-Webhook-Signature",
  ],
  exposedHeaders: [
    "X-Request-Id",
    "RateLimit-Limit",
    "RateLimit-Remaining",
    "RateLimit-Reset",
  ],
  maxAge: 600,
};

export const corsMiddleware = cors(corsOptions);
