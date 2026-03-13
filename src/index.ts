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

      // BUG FIX: Was split across two crons ("*/2" submit, "*/1" resolve).
      // Free plan only fires one cron reliably — submit was silently dropped.
      // Now both run every minute under a single cron.
      switch (event.cron) {
        case "*/1 * * * *":
          await submitPendingEvents(env.DB);  // pass DB so sync.ts can fix versions
          await resolveSubmittedEvents();
          break;
      }
    } catch (error) {
      console.error(`[scheduled] cron ${event.cron} failed:`, error);
      throw error;
    }
  },
};