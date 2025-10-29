# AI-Powered Semantic Linking System

## 🧠 Overview

This document describes the AI-powered semantic linking system that automatically discovers and visualizes relationships between entities (credentials, issuers, holders, etc.) in the VitalCV ecosystem.

---

## 🎯 Core Concept

### What It Does

The system uses AI to:

1. Extract semantic embeddings from credential metadata
2. Find similar entities using vector similarity search
3. Infer relationship types (issued_by, verified_by, related_to, etc.)
4. Store links in a local knowledge graph
5. Visualize connections in the VitalGraph component

### Key Benefits

- **Automatic Discovery**: No manual linking required
- **Semantic Understanding**: Understands context and meaning
- **Real-time Updates**: Auto-refreshes as new data arrives
- **Bi-directional**: Links work in both directions
- **Confidence Scoring**: Shows AI certainty for each link

---

## 📦 Components

### 1. LinkInspector (`components/ai/LinkInspector.tsx`)

Shows all discovered links for an entity in a card view.

**Features:**

- Relationship badges with color coding
- Confidence scores (0-100%)
- AI inference indicators
- Auto-refresh every 15 seconds
- Click to navigate to linked entities

**Usage:**

```tsx
import { LinkInspector } from '@/components/ai/LinkInspector';

<LinkInspector entityId="cred-123" entityType="credential" autoRefresh={true} />;
```

### 2. AutoLinkBadge (`components/ai/AutoLinkBadge.tsx`)

Compact badge showing link count.

**Features:**

- Shows number of AI-discovered links
- Sparkles icon indicator
- Tooltip with details

**Usage:**

```tsx
import { AutoLinkBadge } from '@/components/ai/AutoLinkBadge';

<AutoLinkBadge entityId="cred-123" variant="compact" />;
```

### 3. LinkGraph (`components/ai/LinkGraph.tsx`)

Visual graph of semantic relationships.

**Features:**

- Interactive relationship visualization
- Trigger AI analysis button
- Relationship icons (📜 issued, ✓ verified, 🔗 related)
- Confidence indicators
- Click to explore entities

**Usage:**

```tsx
import { LinkGraph } from '@/components/ai/LinkGraph';

<LinkGraph
  entityId="npi-1234567890"
  onNodeClick={(nodeId) => navigateToEntity(nodeId)}
  autoRefresh={true}
/>;
```

### 4. useLocalLinkUpdate Hook (`hooks/useLocalLinkUpdate.ts`)

Polling hook for automatic link updates.

**Features:**

- Configurable refresh interval (default: 15s)
- Merges new links with existing ones
- Silent failure handling

**Usage:**

```tsx
import { useLocalLinkUpdate } from '@/hooks/useLocalLinkUpdate';

useLocalLinkUpdate((newLinks) => {
  setGraphLinks((prev) => [...prev, ...newLinks]);
}, 15000);
```

---

## 🔌 API Endpoints

### GET `/api/links`

Fetch links for an entity.

**Query Parameters:**

- `entity` - Entity ID to fetch links for
- `source` - Filter by source ID
- `target` - Filter by target ID

**Response:**

```json
{
  "links": [
    {
      "id": "link-123",
      "sourceId": "cred-456",
      "targetId": "npi-789",
      "targetName": "Dr. Jane Smith",
      "targetType": "npi",
      "relationship": "issued_to",
      "score": 0.92,
      "inferred": true,
      "createdAt": "2025-01-20T12:00:00Z"
    }
  ]
}
```

### POST `/api/links`

Create a link.

**Request Body:**

```json
{
  "sourceId": "cred-123",
  "targetId": "cred-456",
  "relationship": "similar",
  "targetName": "Medical License",
  "targetType": "credential"
}
```

### POST `/api/links/infer`

Trigger AI inference for an entity.

**Query Parameters:**

- `entity` - Entity ID to infer links for

**Response:**

```json
{
  "links": [
    {
      "id": "inferred-1",
      "sourceId": "cred-123",
      "targetId": "cred-456",
      "relationship": "issued_by",
      "score": 0.87,
      "inferred": true
    }
  ]
}
```

### GET `/api/links/recent`

Get recently discovered links (for auto-refresh).

**Response:**

```json
{
  "links": [...],
  "lastUpdate": "2025-01-20T12:00:00Z"
}
```

---

## 🔗 Integration Examples

### In Credential Detail View

```tsx
import { LinkInspector } from '@/components/ai/LinkInspector';

export function CredentialDetail({ credential }) {
  return (
    <div>
      <h2>{credential.type}</h2>
      <p>{credential.issuer}</p>

      {/* AI Link Analysis */}
      <LinkInspector entityId={credential.id} />
    </div>
  );
}
```

### In Graph Visualization

```tsx
import { LinkGraph } from '@/components/ai/LinkGraph';

export function VitalGraphEnhanced({ data }) {
  const [selectedEntity, setSelectedEntity] = useState(null);

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Main force graph */}
      <ForceGraph2D data={data} />

      {/* AI Link Panel */}
      {selectedEntity && <LinkGraph entityId={selectedEntity.id} onNodeClick={setSelectedEntity} />}
    </div>
  );
}
```

### In Wallet List

```tsx
import { AutoLinkBadge } from '@/components/ai/AutoLinkBadge';

export function CredentialItem({ credential }) {
  return (
    <div className="flex items-center gap-2">
      <span>{credential.type}</span>
      <AutoLinkBadge entityId={credential.id} variant="compact" />
    </div>
  );
}
```

---

## 🧪 Relationship Types

### Defined Relationships

| Type          | Description                       | Color  | Example                 |
| ------------- | --------------------------------- | ------ | ----------------------- |
| `issued_by`   | Credential issued by an issuer    | Blue   | Medical Board → License |
| `issued_to`   | Credential assigned to a holder   | Green  | License → NPI           |
| `verified_by` | Credential verified by a verifier | Purple | License ← Hospital      |
| `related_to`  | General relationship              | Orange | Similar credentials     |
| `similar`     | High semantic similarity          | Gray   | Related documents       |

---

## 🎨 Visual Indicators

### Link Colors

- **AI-Inferred Links**: Purple (`rgba(139,92,246,0.8)`)
- **Manual Links**: Gray (`rgba(148,163,184,0.6)`)
- **High Confidence**: Thicker lines

### Relationship Icons

- `issued_by` / `issued_to`: 📜
- `verified_by`: ✓
- `related_to`: 🔗
- `similar`: →

### Confidence Levels

- **High (90-100%)**: Solid badge
- **Medium (70-89%)**: Outline badge
- **Low (<70%)**: Muted badge

---

## 🔄 Auto-Refresh Behavior

### Polling Interval

Default: 15 seconds

Can be configured:

```tsx
useLocalLinkUpdate(callback, 30000); // 30 seconds
```

### Update Strategy

1. Poll `/api/links/recent` at interval
2. Merge new links with existing
3. Deduplicate by ID
4. Update UI automatically

### Manual Refresh

```tsx
// Refresh links manually
const response = await fetch(`/api/links?entity=${entityId}`);
const data = await response.json();
setLinks(data.links);
```

---

## 🚀 Next Steps

### To Complete the System

1. **Backend Vector Store**: Replace in-memory store with:

   - PostgreSQL with pgvector
   - Chroma DB
   - Pinecone
   - Weaviate

2. **Embedding Generation**: Add:

   - OpenAI embeddings
   - Cohere embeddings
   - Local embeddings (Sentence Transformers)

3. **Advanced Inference**: Implement:

   - Batch inference for multiple entities
   - Incremental updates
   - Link scoring algorithms

4. **Performance**: Optimize:
   - Debounce auto-refresh
   - Cache embeddings
   - Lazy load link components

---

## 📊 Example Use Cases

### 1. Credential Verification

```tsx
// In credential detail view
<LinkInspector entityId={credential.id} />

// Shows:
// - Issued by: Medical Board (92% confidence)
// - Related to: Board Certification (87% confidence)
// - Similar to: Other Licenses (74% confidence)
```

### 2. NPI Profile

```tsx
// In NPI profile page
<LinkGraph entityId={npi} onNodeClick={handleNodeClick} />

// Discovers:
// - NPIs associated with credentials
// - Organizations that issued credentials
// - Verification history
```

### 3. Network Analysis

```tsx
// In graph visualization
<AutoLinkBadge entityId={entity.id} />

// Indicates entities with rich connections
```

---

## 🛠️ Development Tips

### Debugging

```typescript
// Enable verbose logging
localStorage.setItem('ai-links-debug', 'true');

// Check link store
console.log(linkStore);
```

### Mock Data

Development mode includes mock AI-inferred links for testing.

### Testing

```typescript
// Test link inference
const { triggerInference } = useLinkInference('cred-123');
const links = await triggerInference();
console.log('Discovered:', links);
```

---

## 📈 Performance Considerations

### Current Implementation

- In-memory storage (dev)
- Synchronous inference (mock)
- No caching

### Production Optimizations

1. **Batch Processing**: Infer links in batches
2. **Caching**: Cache embeddings for 24 hours
3. **Incremental Updates**: Only process new data
4. **Lazy Loading**: Load link components on demand

---

## 🔐 Security

### Link Privacy

- Links are entity-specific (no cross-entity leakage)
- Confidence scores visible
- Manual links require explicit creation

### Data Sanitization

- No PII in link metadata
- Links contain only IDs and types
- Actual credential data not exposed

---

## 📝 API Specification

See `app/api/links/route.ts` for complete API documentation.

---

**Status**: ✅ Implemented
**Components**: 4 (LinkInspector, AutoLinkBadge, LinkGraph, useLocalLinkUpdate)
**API Endpoints**: 3 (GET, POST, Infer)
**Next**: Connect to real vector DB backend
