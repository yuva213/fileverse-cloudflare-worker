import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import { errorHandler } from "../middleware/error";
import { ddocs } from "./ddocs";
import { folders } from "./folders";
import { search } from "./search";
import { events } from "./events";
import { mcp } from "./mcp";
import type { Env } from "../types";
import guideContent from "../static/guide.md";
import llmContent from "../static/llm.txt";

const app = new Hono<{ Bindings: Env }>();

app.use("*", errorHandler);

app.get("/", (c) => c.text(guideContent));
app.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const isJsonRpc = Array.isArray(body)
      ? body[0]?.jsonrpc === "2.0"
      : body?.jsonrpc === "2.0";

    if (isJsonRpc) {
      const url = new URL(c.req.url);
      url.pathname = "/mcp";
      const newReq = new Request(url.toString(), {
        method: "POST",
        headers: c.req.raw.headers,
        body: JSON.stringify(body),
      });
      return app.fetch(newReq, c.env, c.executionCtx);
    }
  } catch {}

  return c.json({ error: "Use POST /mcp for MCP requests." }, 405);
});
app.get("/llm.txt", (c) => c.text(llmContent));
app.get("/ping", (c) => c.json({ reply: "pong" }));

// Auth middleware for all /api/* routes
app.use("/api/*", authMiddleware);



// Mount route groups
app.route("/api/ddocs", ddocs);
app.route("/api/folders", folders);
app.route("/api/search", search);
app.route("/api/events", events);

// MCP endpoint (no auth required)
app.route("/mcp", mcp);

export { app };
