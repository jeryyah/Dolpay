import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import { existsSync } from "node:fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
// Increased limit so clients posting product overrides w/ base64 images don't get 413.
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// API routes first so they win over the SPA fallback.
app.use("/api", router);

// ---------------------------------------------------------------------------
// Static frontend (viorelvar-market)
// ---------------------------------------------------------------------------
// In production (Railway) we ship the built Vite output and serve it from the
// same Express process. Path is configurable via STATIC_DIR; defaults to the
// monorepo build path so a normal `pnpm -r run build` puts files where we
// look for them.
const STATIC_DIR =
  process.env["STATIC_DIR"] ||
  path.resolve(process.cwd(), "artifacts/viorelvar-market/dist/public");

if (existsSync(STATIC_DIR)) {
  logger.info({ STATIC_DIR }, "Serving static frontend");

  // Long-cache hashed assets, no-cache for the entry HTML so deploys roll out
  // immediately without forcing users to hard-refresh.
  app.use(
    express.static(STATIC_DIR, {
      index: false,
      setHeaders: (res, filePath) => {
        if (/\/assets\//.test(filePath)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else if (
          filePath.endsWith("version.json") ||
          filePath.endsWith("index.html")
        ) {
          res.setHeader("Cache-Control", "no-store, must-revalidate");
        }
      },
    }),
  );

  // SPA fallback — every non-API GET returns index.html so client-side routing
  // works (e.g. /admin, /produk/foo).
  app.get(/^\/(?!api\/).*/, (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET") return next();
    const indexFile = path.join(STATIC_DIR, "index.html");
    if (!existsSync(indexFile)) return next();
    res.setHeader("Cache-Control", "no-store, must-revalidate");
    res.sendFile(indexFile);
  });
} else {
  logger.warn(
    { STATIC_DIR },
    "Static frontend dir not found — only /api routes will work",
  );
}

export default app;
