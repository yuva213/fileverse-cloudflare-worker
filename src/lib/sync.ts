import { EventsModel, submitEvent, resolveEvent } from "@fileverse/api/base";

const MAX_SUBMIT_PER_TICK = 2;
const MAX_RESOLVE_PER_TICK = 3;

/**
 * BUG FIX: @fileverse/api v1.0.8 derives the on-chain version for the
 * editFile() contract call as: Math.floor(metadata.version / 2)
 * where metadata.version lives in the files.metadata JSON column in D1.
 *
 * The contract expects: onchainVersion + 1
 * So metadata.version must equal: (onchainVersion + 1) * 2
 *
 * When users save multiple times before the first sync, localVersion grows
 * (e.g. 5) and metadata.version grows with it (e.g. "4"), so the package
 * sends version=2 (4/2) but the contract expects version=1 → Tec06 revert.
 *
 * Fix: before each submit we patch metadata.version in D1 directly.
 */
async function fixVersionBeforeSubmit(
  db: D1Database,
  fileId: string
): Promise<void> {
  try {
    const row = await db
      .prepare(
        "SELECT _id, onchainVersion, metadata FROM files WHERE _id = ? AND isDeleted = 0"
      )
      .bind(fileId)
      .first<{ _id: string; onchainVersion: number; metadata: string }>();

    if (!row) {
      console.warn(`[sync:fix] file ${fileId} not found in DB`);
      return;
    }

    const onchainVersion = row.onchainVersion ?? 0;
    const correctMetaVersion = String((onchainVersion + 1) * 2);

    let meta: Record<string, unknown> = {};
    try {
      meta = row.metadata ? JSON.parse(row.metadata) : {};
    } catch {
      meta = {};
    }

    if (String(meta.version ?? "") === correctMetaVersion) {
      return; // already correct, skip write
    }

    console.log(
      `[sync:fix] file ${fileId}: metadata.version ` +
        `"${meta.version}" → "${correctMetaVersion}" ` +
        `(onchainVersion=${onchainVersion}, contract will receive ${onchainVersion + 1})`
    );

    meta.version = correctMetaVersion;

    await db
      .prepare("UPDATE files SET metadata = ? WHERE _id = ?")
      .bind(JSON.stringify(meta), row._id)
      .run();
  } catch (err) {
    // Non-fatal — log and continue. Worst case: another Tec06 on this event.
    console.error(`[sync:fix] version correction failed for ${fileId}:`, err);
  }
}

export async function submitPendingEvents(db: D1Database): Promise<void> {
  for (let i = 0; i < MAX_SUBMIT_PER_TICK; i++) {
    const event = await EventsModel.findNextEligible([]);
    if (!event) break;
    try {
      console.log(
        `[sync:submit] event ${event._id}, type: ${event.type}, fileId: ${event.fileId}`
      );
      await fixVersionBeforeSubmit(db, event.fileId);
      await submitEvent(event);
      console.log(`[sync:submit] event ${event._id} submitted successfully`);
    } catch (error) {
      console.error(`[sync:submit] event ${event._id} failed:`, error);
    }
  }
}

export async function resolveSubmittedEvents(): Promise<void> {
  for (let i = 0; i < MAX_RESOLVE_PER_TICK; i++) {
    const event = await EventsModel.findNextSubmitted([]);
    if (!event) break;
    try {
      console.log(`[sync:resolve] event ${event._id}, type: ${event.type}`);
      await resolveEvent(event);
      console.log(`[sync:resolve] event ${event._id} resolved`);
    } catch (error) {
      console.error(`[sync:resolve] event ${event._id} failed:`, error);
    }
  }
}