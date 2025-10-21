# API Module - Quick Reference

> Modern type-safe API client for QNAP Download Station with automatic session management.

## 📂 Structure

```
src/api/
├── client.ts          # Main API client with business logic
├── index.ts           # Client initialization & middleware
├── utils.ts           # Data processing utilities
├── schema.d.ts        # TypeScript API schema
├── type.ts            # Type exports
├── API.md             # QNAP API documentation
└── README.md          # This file
```

---

## 🚀 Quick Start

### Basic Usage

```typescript
import { createApiClient } from './api/client.js';
import { loadSettings } from './lib/config.js';

const settings = await loadSettings();
const client = createApiClient({ settings });

// SID is managed automatically - just call methods!
const { tasks } = await client.queryTasks();
console.log(`Found ${tasks.length} downloads`);
```

### With Logging

```typescript
import { createLogger } from './lib/logger.js';

const logger = createLogger('API');
const client = createApiClient({ settings, logger });
client.setLoggerEnabled(true);
```

---

## 📚 API Methods

### Query Tasks
```typescript
const { tasks, raw } = await client.queryTasks({
  params: {
    limit: 100,
    status: 'downloading',
    direction: 'DESC'
  },
  signal: abortController.signal
});
```

### Add Download
```typescript
// URL
await client.addUrl('http://example.com/file.zip', {
  targetFolder: '/downloads'
});

// Torrent file
const result = await client.addTorrent(file);
if (result.duplicate) {
  console.log('Already exists');
}
```

### Task Control
```typescript
await client.startTask(hash);
await client.stopTask(hash);
await client.removeTask(hash, { clean: true });
```

### Connection Test
```typescript
const isOnline = await client.testConnection();
```

---

## 🔧 Utilities

### Response Validation
```typescript
import { isSuccessResponse, getErrorMessage } from './utils.js';

if (!isSuccessResponse(data)) {
  throw new Error(`Failed: ${getErrorMessage(data)}`);
}
```

### Error Creation
```typescript
import { createApiError } from './utils.js';

const error = createApiError("Operation failed", responseData);
// error.code, error.reason, error.duplicate, error.apiUnsupported
```

---

## ⚙️ Advanced Configuration

### Custom Fetch
```typescript
const client = createApiClient({
  settings,
  fetchFn: customFetch, // For testing or custom handling
  logger: { error: console.error, debug: console.log }
});
```

### Build Base URL
```typescript
import { buildNASBaseUrl } from './index.js';

const baseUrl = buildNASBaseUrl(settings);
// → "https://192.168.1.100:8080" or "http://nas.local"
```

---

## 🏗️ Architecture

### Middleware Stack

The client uses a middleware pattern for request/response processing:

1. **SID Middleware** - Automatically injects session ID
   - Obtains SID on first request
   - Adds SID to all subsequent requests
   - Handles 401/403 by clearing SID for re-auth
   - Supports URLSearchParams and FormData

2. **Request Flow**
   ```
   Client Method Call
        ↓
   openapi-fetch Client
        ↓
   SID Middleware (onRequest)
        ↓
   HTTP Request to QNAP NAS
        ↓
   SID Middleware (onResponse)
        ↓
   Response returned to caller
   ```

### Type Safety

The module uses auto-generated TypeScript types from `schema.d.ts`:

```typescript
// All requests/responses are fully typed
type TaskQueryResponse = ApiResponse<"queryTasks">;
type LoginRequest = ApiRequest<"login">;
```

### Error Handling

Errors are enriched with metadata:

```typescript
try {
  await client.addTorrent(file);
} catch (error) {
  if (error.duplicate) {
    console.log('Torrent already exists');
  } else if (error.apiUnsupported) {
    console.log('API not available on this NAS');
  } else {
    console.error('Failed:', error.message);
  }
}
```

---

## 📖 See Also

- **API.md** - Complete QNAP Download Station API documentation
- **API_ANALYSIS_REPORT.md** - Detailed analysis and improvement suggestions
- **schema.d.ts** - Full TypeScript API schema
