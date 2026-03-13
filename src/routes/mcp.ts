import { Hono } from "hono";
import { TOOL_DEFINITIONS, executeTool } from "../mcp/tools";
import type { Env } from "../types";

const PROTOCOL_VERSION = "2025-03-26";
const SERVER_INFO = { name: "fileverse-api", version: "1.0.0" };

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
}

function success(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function error(id: string | number | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

async function dispatch(req: JsonRpcRequest, apiKey: string): Promise<JsonRpcResponse | null> {
  const id = req.id ?? null;

  switch (req.method) {
    case "initialize":
      return success(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });

    case "notifications/initialized":
    case "notifications/cancelled":
      return null;

    case "ping":
      return success(id, {});

    case "tools/list":
      return success(id, { tools: TOOL_DEFINITIONS });

    case "tools/call": {
      const name = req.params?.name as string;
      const args = (req.params?.arguments ?? {}) as Record<string, unknown>;

      try {
        const result = await executeTool(name, args, apiKey);
        return success(id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Tool execution failed";
        return success(id, {
          content: [{ type: "text", text: message }],
          isError: true,
        });
      }
    }

    default:
      return error(id, -32601, `Method not found: ${req.method}`);
  }
}

const mcp = new Hono<{ Bindings: Env }>();

mcp.post("/", async (c) => {
  const body = await c.req.json();
  const apiKey = c.env.API_KEY;
  if (Array.isArray(body)) {
    const results = await Promise.all(
      body.map((req: JsonRpcRequest) => dispatch(req, apiKey)),
    );
    const responses = results.filter(Boolean);
    if (responses.length === 0) return c.body(null, 204);
    return c.json(responses);
  }

  const result = await dispatch(body, apiKey);
  if (!result) return c.body(null, 204);
  return c.json(result);
});

mcp.get("/", (c) =>
  c.json({ error: "Method Not Allowed. Use POST for MCP requests." }, 405),
);

mcp.delete("/", (c) =>
  c.json({ error: "Method Not Allowed. No sessions in stateless mode." }, 405),
);

export { mcp };
