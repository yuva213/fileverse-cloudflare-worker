import { app } from "./routes";
import { ensureInitialized } from "./lib/init";
import { submitPendingEvents, resolveSubmittedEvents } from "./lib/sync";
import type { Env } from "./types";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    await ensureInitialized(env);
    return app.fetch(request, env, ctx);
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    try {
      await ensureInitialized(env);

      // BUG FIX: Previously split across two crons ("*/2" and "*/1").
      // Cloudflare Workers free plan only reliably fires one cron trigger.
      // Now both submit + resolve run every minute under a single cron.
      switch (event.cron) {
        case "*/1 * * * *":
          await submitPendingEvents();
          await resolveSubmittedEvents();
          break;
      }
    } catch (error) {
      console.error(`[scheduled] cron ${event.cron} failed:`, error);
      throw error;
    }
  },
};