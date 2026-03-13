import {
  ApiKeysModel,
  listFiles,
  getFile,
  createFile,
  updateFile,
  deleteFile,
  searchNodes,
  EventsModel,
} from "@fileverse/api/base";

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

async function resolvePortalAddress(apiKey: string): Promise<string> {
  const info = await ApiKeysModel.findByApiKey(apiKey);
  if (!info?.portalAddress) {
    throw new Error("Invalid API key");
  }
  return info.portalAddress;
}


export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "fileverse_list_documents",
    description:
      "List documents stored in Fileverse. Returns an array of documents with their metadata and sync status.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum number of documents to return" },
        skip: { type: "number", description: "Number of documents to skip (for pagination)" },
      },
    },
  },
  {
    name: "fileverse_get_document",
    description:
      "Get a single document by its ddocId. Returns the full document including content, sync status, and blockchain link.",
    inputSchema: {
      type: "object",
      properties: {
        ddocId: { type: "string", description: "The unique document identifier" },
      },
      required: ["ddocId"],
    },
  },
  {
    name: "fileverse_create_document",
    description:
      "Create a new document and wait for blockchain sync. Returns the document with its sync status and public link once synced.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Document title" },
        content: { type: "string", description: "Document content (plain text or markdown)" },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "fileverse_update_document",
    description:
      "Update an existing document's title and/or content, then wait for blockchain sync. Returns the updated document with sync status and link.",
    inputSchema: {
      type: "object",
      properties: {
        ddocId: { type: "string", description: "The unique document identifier" },
        title: { type: "string", description: "New document title" },
        content: { type: "string", description: "New document content" },
      },
      required: ["ddocId"],
    },
  },
  {
    name: "fileverse_delete_document",
    description: "Delete a document by its ddocId.",
    inputSchema: {
      type: "object",
      properties: {
        ddocId: { type: "string", description: "The unique document identifier to delete" },
      },
      required: ["ddocId"],
    },
  },
  {
    name: "fileverse_search_documents",
    description: "Search documents by text query. Returns matching documents ranked by relevance.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query string" },
        limit: { type: "number", description: "Maximum number of results" },
        skip: { type: "number", description: "Number of results to skip" },
      },
      required: ["query"],
    },
  },
  {
    name: "fileverse_get_sync_status",
    description:
      "Check the sync status of a document. Returns the current syncStatus and blockchain link if synced.",
    inputSchema: {
      type: "object",
      properties: {
        ddocId: { type: "string", description: "The unique document identifier" },
      },
      required: ["ddocId"],
    },
  },
  {
    name: "fileverse_retry_failed_events",
    description:
      "Retry all failed blockchain sync events. Use this when documents are stuck in 'failed' sync status.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  apiKey: string,
): Promise<unknown> {
  const portalAddress = await resolvePortalAddress(apiKey);

  switch (name) {
    case "fileverse_list_documents":
      return listFiles({
        limit: args.limit as number | undefined,
        skip: args.skip as number | undefined,
        portalAddress,
      });

    case "fileverse_get_document": {
      const doc = await getFile(args.ddocId as string, portalAddress);
      if (!doc) throw new Error("Document not found");
      return doc;
    }

    case "fileverse_create_document": {
      const created = await createFile({
        title: args.title as string,
        content: args.content as string,
        portalAddress,
      });
      return created;
    }

    case "fileverse_update_document": {
      const updates: { title?: string; content?: string } = {};
      if (args.title) updates.title = args.title as string;
      if (args.content) updates.content = args.content as string;
      const updated = await updateFile(args.ddocId as string, updates, portalAddress);
      return updated;
    }

    case "fileverse_delete_document":
      return deleteFile(args.ddocId as string, portalAddress);

    case "fileverse_search_documents":
      return searchNodes({
        query: args.query as string,
        limit: args.limit as number | undefined,
        skip: args.skip as number | undefined,
        portalAddress,
      });

    case "fileverse_get_sync_status": {
      const doc = await getFile(args.ddocId as string, portalAddress);
      if (!doc) throw new Error("Document not found");
      return {
        ddocId: doc.ddocId,
        syncStatus: doc.syncStatus,
        link: doc.link,
        localVersion: doc.localVersion,
        onchainVersion: doc.onchainVersion,
      };
    }

    case "fileverse_retry_failed_events": {
      const retried = await EventsModel.resetAllFailedToPending(portalAddress);
      return { retried };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
