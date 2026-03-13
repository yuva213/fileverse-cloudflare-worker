# Fileverse API - CLI & API Guide

> Fileverse API syncs your local .md files to [ddocs.new](https://ddocs.new) — an end-to-end encrypted, fully private document editor. Documents are called **ddocs**. Each has a unique `ddocId` used to read, edit, or delete it.
> If you are an LLM navigate to /llm.txt route

---

## ddctl Commands

If you haven't installed the @fileverse/api package skip to API Documentation Section.

Note: This won't work if you run the package via npx the @fileverse/api package as we need the ddctl 
binaries for this option to work. For this functionality to work you need to do 

```
npm install -g @fileverse/api
```

### Help

```bash
ddctl help
```

### List Documents

```bash
ddctl list                          # list all documents
ddctl list -l 10                    # limit to 10 results
ddctl list -s 20                    # skip first 20 results
ddctl list --limit 10 --skip 20    # combine both
```

### Get Document (metadata)

```bash
ddctl get <ddocId>
```

Returns metadata: title, syncStatus, link (if synced), versions, timestamps.

### View Document (content preview)

```bash
ddctl view <ddocId>                 # preview first 10 lines
ddctl view <ddocId> -n 20           # preview first 20 lines
ddctl view <ddocId> --lines 30      # preview first 30 lines
```

### Create Document

```bash
ddctl create <filepath>
```

Title is derived from the filename. File content cannot be empty.

### Update Document

```bash
ddctl update <ddocId> -f <filepath>       # update from file
ddctl update <ddocId> --file <filepath>   # same, long form
ddctl update <ddocId>                     # opens in editor ($EDITOR or vi)
```

### Download Document

```bash
ddctl download <ddocId>                   # download to current directory
ddctl download <ddocId> -o myfile.md      # specify output filename
ddctl download <ddocId> --output myfile.md
```

### Delete Document

```bash
ddctl delete <ddocId>                     # delete one document
ddctl delete <id1> <id2> <id3>            # delete multiple (space-separated)
```

### Failed Events (sync troubleshooting)

```bash
ddctl events list-failed                  # list failed blockchain sync events
ddctl events retry <eventId>              # retry a specific failed event
ddctl events retry-all                    # retry all failed events
```

---

## API Endpoints

Base URL: `{SERVER_URL}` (e.g. `http://localhost:8001`)

All authenticated endpoints require `apiKey` as a **query parameter**.

### Health Check

```
GET /ping
```

No auth required. Returns `{"reply": "pong"}`.

### List Documents

```
GET /api/ddocs?apiKey={API_KEY}&limit=10&skip=0
```

Response:
```json
{
  "ddocs": [ ... ],
  "total": 100,
  "hasNext": true
}
```

### Get Document

```
GET /api/ddocs/{ddocId}?apiKey={API_KEY}
```

Response:
```json
{
  "ddocId": "abc123",
  "title": "My Document",
  "content": "...",
  "syncStatus": "pending | synced | failed",
  "link": "https://...",
  "localVersion": 2,
  "onchainVersion": 2,
  "isDeleted": 0,
  "createdAt": "...",
  "updatedAt": "..."
}
```

### Create Document (JSON)

```
POST /api/ddocs?apiKey={API_KEY}
Content-Type: application/json

{
  "title": "Document Title",
  "content": "Document content here..."
}
```

Response (201):
```json
{
  "message": "...",
  "data": {
    "ddocId": "abc123",
    "title": "...",
    "syncStatus": "pending",
    ...
  }
}
```

Extract `ddocId` from `response.data.ddocId`.

### Create Document (File Upload)

```
POST /api/ddocs?apiKey={API_KEY}
Content-Type: multipart/form-data

Field: "file" = <your file>
```

Title is derived from filename. Max file size: 10MB.

### Update Document (JSON)

```
PUT /api/ddocs/{ddocId}?apiKey={API_KEY}
Content-Type: application/json

{
  "title": "New Title",
  "content": "Updated content..."
}
```

Both fields are optional — send only what you want to change.

### Update Document (File Upload)

```
PUT /api/ddocs/{ddocId}?apiKey={API_KEY}
Content-Type: multipart/form-data

Field: "file" = <your updated file>
```

### Delete Document

```
DELETE /api/ddocs/{ddocId}?apiKey={API_KEY}
```

### Search Documents

```
GET /api/search?apiKey={API_KEY}&q={query}&limit=10&skip=0
```

Response:
```json
{
  "nodes": [ ... ],
  "total": 5,
  "hasNext": false
}
```

Note: search returns `nodes`, not `ddocs`.

### OpenAPI Spec

```
GET {SERVER_URL}/openapi.json
```

Machine-readable OpenAPI 3.1 specification.

---

## Quick Reference

### API Endpoints

| Method | Path                              | Description              |
|--------|-----------------------------------|--------------------------|
| GET    | /ping                             | Health check (no auth)   |
| GET    | /api/ddocs                        | List documents           |
| GET    | /api/ddocs/{ddocId}               | Get document             |
| POST   | /api/ddocs                        | Create document          |
| PUT    | /api/ddocs/{ddocId}               | Update document          |
| DELETE | /api/ddocs/{ddocId}               | Delete document          |
| GET    | /api/search?q={query}             | Search documents         |

### ddctl Commands

| Command                        | Description                        |
|--------------------------------|------------------------------------|
| ddctl list                     | List documents                     |
| ddctl get {ddocId}             | Get document metadata              |
| ddctl view {ddocId}            | Preview document content           |
| ddctl create {filepath}        | Create document from file          |
| ddctl update {ddocId}          | Update document (editor or file)   |
| ddctl download {ddocId}        | Download document to file          |
| ddctl delete {ddocId} [...]    | Delete one or more documents       |

---

## Sync Status

After creating or updating a document, it syncs to the blockchain asynchronously:

| Status    | Meaning                                    |
|-----------|--------------------------------------------|
| `pending` | Saved locally, blockchain sync in progress |
| `synced`  | Published on blockchain, `link` available  |
| `failed`  | Sync failed — use events retry to fix      |

Typical sync time: 5-30 seconds.

---

## Error Codes

| Code | Meaning                                          |
|------|--------------------------------------------------|
| 400  | Validation error (missing/invalid body or params)|
| 401  | Invalid or missing API key                       |
| 404  | Resource not found                               |
| 429  | Rate limited — respect Retry-After header        |
| 500  | Internal server error                            |
