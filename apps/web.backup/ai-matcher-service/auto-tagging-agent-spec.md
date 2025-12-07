# Auto-Tagging Micro-Agent Specification

## Overview

The auto-tagging micro-agent is a lightweight service that consumes claim events and automatically tags claims with taxonomy terms and fraud signals. This service operates asynchronously and communicates via JSON webhooks.

## Purpose

- Automatically classify claims using healthcare taxonomy terms
- Detect potential fraud signals based on claim patterns
- Provide real-time tagging without blocking claim submission
- Enable downstream systems to filter and analyze claims by tags

## Architecture

### Event-Driven Design
- Listens for claim lifecycle events via webhook
- Processes events asynchronously
- Returns tagged results via callback webhook

### Technology Stack
- Python 3.9+ (for AI/ML capabilities)
- FastAPI or Flask (lightweight HTTP server)
- Optional: ML model for classification (can start with rule-based)

## JSON Webhook Contract

### Input: Claim Event Webhook

**Endpoint:** `POST /webhook/claim-event`

**Request Headers:**
```
Content-Type: application/json
X-Webhook-Signature: <hmac_signature> (optional, for security)
```

**Request Body:**
```json
{
  "eventType": "claim.submitted" | "claim.ocr_complete" | "claim.status_changed",
  "claimId": "claim_123456789",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "npi": "1234567893",
    "providerName": "Dr. Jane Smith",
    "claimType": "professional",
    "amount": 1500.00,
    "patientName": "John Doe",
    "status": "processing",
    "documentMetadata": {
      "filename": "claim.pdf",
      "mimeType": "application/pdf",
      "size": 123456
    },
    "ocrResults": {
      "extractedFields": {
        "procedureCode": "99213",
        "diagnosisCode": "E11.9"
      },
      "confidence": 0.95
    }
  }
}
```

**Response (200 OK):**
```json
{
  "acknowledged": true,
  "eventId": "evt_123456789",
  "message": "Event received, processing started"
}
```

### Output: Tagged Claim Callback

**Callback Endpoint:** Configured per client (e.g., `POST {callback_url}/webhook/claim-tagged`)

**Request Body:**
```json
{
  "claimId": "claim_123456789",
  "timestamp": "2024-01-15T10:30:05Z",
  "tags": [
    {
      "category": "taxonomy",
      "term": "CPT-99213",
      "confidence": 0.92,
      "source": "ocr_extraction"
    },
    {
      "category": "taxonomy",
      "term": "ICD10-E11.9",
      "confidence": 0.88,
      "source": "ocr_extraction"
    },
    {
      "category": "specialty",
      "term": "Primary Care",
      "confidence": 0.85,
      "source": "npi_lookup"
    },
    {
      "category": "fraud_signal",
      "term": "amount_outlier",
      "confidence": 0.65,
      "severity": "medium",
      "reason": "Claim amount exceeds 95th percentile for this provider specialty",
      "source": "statistical_analysis"
    }
  ],
  "metadata": {
    "processingTimeMs": 234,
    "modelVersion": "v1.0.0-pilot",
    "rulesApplied": ["amount_check", "npi_specialty_match"]
  }
}
```

## Tag Categories

### 1. Taxonomy Tags
- **Purpose**: Standard healthcare classification codes
- **Examples**: CPT codes, ICD-10 codes, HCPCS codes
- **Source**: OCR extraction, claim metadata

### 2. Specialty Tags
- **Purpose**: Provider specialty classification
- **Examples**: "Primary Care", "Cardiology", "Emergency Medicine"
- **Source**: NPI lookup, provider profile

### 3. Fraud Signal Tags
- **Purpose**: Flag potential fraudulent patterns
- **Examples**: 
  - `amount_outlier`: Unusually high claim amount
  - `frequency_anomaly`: Unusual submission frequency
  - `temporal_anomaly`: Suspicious timing patterns
  - `provider_mismatch`: NPI/provider name mismatch
- **Severity Levels**: `low`, `medium`, `high`
- **Source**: Statistical analysis, ML models, rule-based checks

## Implementation Phases

### Phase 1: Pilot (Rule-Based)
- Basic rule-based tagging
- Extract tags from OCR results
- Simple fraud checks (amount thresholds, basic pattern matching)
- In-memory tag store (no persistence)

### Phase 2: Enhanced (ML Integration)
- Train ML model for fraud detection
- Improve taxonomy extraction accuracy
- Persistent tag storage
- Historical pattern analysis

### Phase 3: Production
- Real-time streaming processing
- Advanced ML models
- Multi-source data fusion
- Audit logging and compliance

## Stub Implementation

**File:** `ai-matcher-service/src/auto_tagging_agent.py`

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
import logging

app = FastAPI(title="Auto-Tagging Agent", version="0.1.0-pilot")
logger = logging.getLogger(__name__)

# In-memory tag store (for pilot)
tag_store: Dict[str, List[Dict]] = {}

class ClaimEvent(BaseModel):
    eventType: str
    claimId: str
    timestamp: str
    data: Dict

class Tag(BaseModel):
    category: str
    term: str
    confidence: float
    source: str
    severity: Optional[str] = None
    reason: Optional[str] = None

class TaggedClaim(BaseModel):
    claimId: str
    timestamp: str
    tags: List[Tag]
    metadata: Dict

@app.post("/webhook/claim-event")
async def receive_claim_event(event: ClaimEvent):
    """Receive claim event and process tags"""
    try:
        tags = process_claim_tags(event)
        
        # Store tags (in-memory for pilot)
        tag_store[event.claimId] = tags
        
        # In production, send callback webhook here
        # await send_callback_webhook(event.claimId, tags)
        
        return {
            "acknowledged": True,
            "eventId": f"evt_{event.claimId}",
            "message": "Event received, processing started"
        }
    except Exception as e:
        logger.error(f"Error processing claim event: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def process_claim_tags(event: ClaimEvent) -> List[Dict]:
    """Stub tag processing logic"""
    tags = []
    
    # Extract taxonomy tags from OCR results
    if "ocrResults" in event.data:
        ocr = event.data["ocrResults"]
        if "extractedFields" in ocr:
            fields = ocr["extractedFields"]
            if "procedureCode" in fields:
                tags.append({
                    "category": "taxonomy",
                    "term": f"CPT-{fields['procedureCode']}",
                    "confidence": ocr.get("confidence", 0.9),
                    "source": "ocr_extraction"
                })
            if "diagnosisCode" in fields:
                tags.append({
                    "category": "taxonomy",
                    "term": f"ICD10-{fields['diagnosisCode']}",
                    "confidence": ocr.get("confidence", 0.9),
                    "source": "ocr_extraction"
                })
    
    # Simple fraud signal: amount outlier (stub)
    if "amount" in event.data:
        amount = event.data["amount"]
        if amount > 10000:  # Simple threshold for pilot
            tags.append({
                "category": "fraud_signal",
                "term": "amount_outlier",
                "confidence": 0.65,
                "severity": "medium",
                "reason": "Claim amount exceeds threshold",
                "source": "statistical_analysis"
            })
    
    return tags

@app.get("/tags/{claim_id}")
async def get_tags(claim_id: str):
    """Retrieve tags for a claim"""
    tags = tag_store.get(claim_id, [])
    return {"claimId": claim_id, "tags": tags}
```

## Configuration

**Environment Variables:**
```bash
# Auto-Tagging Agent Configuration
AUTO_TAGGER_PORT=5001
AUTO_TAGGER_CALLBACK_URL=http://backend:4000/api/webhook/claim-tagged
AUTO_TAGGER_ENABLED=true

# Optional: ML Model Configuration
ML_MODEL_PATH=/models/fraud_detection_v1.pkl
ML_MODEL_VERSION=v1.0.0-pilot
```

## Integration Points

1. **Backend Integration**: Backend should call auto-tagging agent webhook after claim events
2. **Callback URL**: Configured to send tagged results back to backend
3. **Metrics**: Tag processing latency, tag accuracy, fraud detection rate

## Testing

- Unit tests for tag extraction logic
- Integration tests for webhook contract
- E2E tests with mock claim events

## Future Enhancements

- Real-time streaming (Kafka/RabbitMQ)
- Distributed processing (Celery/Redis)
- Advanced ML models (TensorFlow/PyTorch)
- Tag confidence threshold tuning
- Multi-language support
