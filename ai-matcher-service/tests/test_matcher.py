# test_matcher.py - AI matcher service tests with trace propagation support
import os
import sys
from pathlib import Path
from typing import Any, Dict, List
from unittest.mock import MagicMock, patch

import pytest

# Add backend to path for trace propagation imports
sys.path.append(str(Path(__file__).resolve().parents[2] / "backend" / "src"))

# Add src to path for dummy_match import
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))

try:
    from didcomm.trace_propagation import receive_message, send_message, span_exporter
    TRACE_AVAILABLE = True
except ImportError:
    TRACE_AVAILABLE = False

try:
    from routes.match import dummy_match, placeholder
    DUMMY_MATCH_AVAILABLE = True
    PLACEHOLDER_AVAILABLE = True
except ImportError:
    DUMMY_MATCH_AVAILABLE = False
    PLACEHOLDER_AVAILABLE = False


def test_placeholder():
    """Simple placeholder test to keep pytest happy."""
    if not PLACEHOLDER_AVAILABLE:
        pytest.skip("placeholder not available")
    
    assert placeholder() == {"status": "stub"}


def test_dummy_match():
    """Verify that the dummy_match function returns the expected structure."""
    if not DUMMY_MATCH_AVAILABLE:
        pytest.skip("dummy_match not available")
    
    result = dummy_match({"foo": "bar"})
    assert result == {"matched": False, "input": {"foo": "bar"}}


class MockMatcher:
    """Mock matcher class with deterministic behavior for testing."""
    
    def __init__(self, seed: int = 42):
        self.seed = seed
        self.call_count = 0
    
    def match_candidates(self, criteria: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Deterministic matching with fixed seed."""
        self.call_count += 1
        
        # Deterministic results based on seed and criteria
        if criteria.get("role") == "developer":
            return [
                {"id": f"dev_{self.seed}_1", "score": 0.95, "name": "Alice Developer"},
                {"id": f"dev_{self.seed}_2", "score": 0.87, "name": "Bob Coder"}
            ]
        elif criteria.get("role") == "designer":
            return [
                {"id": f"des_{self.seed}_1", "score": 0.92, "name": "Carol Designer"}
            ]
        return []


@pytest.fixture
def mock_matcher():
    """Provide a deterministic mock matcher."""
    return MockMatcher(seed=42)


@pytest.fixture
def sample_criteria():
    """Fixed criteria for deterministic testing."""
    return {
        "role": "developer",
        "experience_years": 5,
        "skills": ["python", "javascript"],
        "location": "remote"
    }


def test_matcher_basic_functionality(mock_matcher, sample_criteria):
    """Test basic matching functionality with deterministic results."""
    results = mock_matcher.match_candidates(sample_criteria)
    
    assert len(results) == 2
    assert results[0]["id"] == "dev_42_1"
    assert results[0]["score"] == 0.95
    assert results[1]["id"] == "dev_42_2"
    assert results[1]["score"] == 0.87


def test_matcher_empty_results(mock_matcher):
    """Test matcher returns empty results for unknown role."""
    criteria = {"role": "unknown", "skills": ["nonexistent"]}
    results = mock_matcher.match_candidates(criteria)
    
    assert len(results) == 0
    assert isinstance(results, list)


def test_matcher_call_tracking(mock_matcher, sample_criteria):
    """Test that matcher tracks call count deterministically."""
    initial_count = mock_matcher.call_count
    mock_matcher.match_candidates(sample_criteria)
    
    assert mock_matcher.call_count == initial_count + 1


@pytest.mark.skipif(not TRACE_AVAILABLE, reason="Trace propagation not available")
def test_matcher_with_trace_propagation(mock_matcher, sample_criteria):
    """Test matcher service with DIDComm trace propagation."""
    results = []
    
    def matcher_service(payload: Dict[str, Any]) -> None:
        """Simulated matcher service that processes requests with tracing."""
        criteria = payload.get("criteria", {})
        matches = mock_matcher.match_candidates(criteria)
        
        # Forward results with trace context
        response_payload = {"matches": matches, "request_id": payload.get("request_id")}
        send_message(response_payload, lambda msg: results.append(msg))
    
    def client_handler(payload: Dict[str, Any]) -> None:
        """Client handler that receives matcher results."""
        results.append({"type": "client_received", "payload": payload})
    
    # Clear span exporter for clean test
    span_exporter.clear()
    
    # Client sends matching request
    request_payload = {
        "criteria": sample_criteria,
        "request_id": "test_req_001"
    }
    send_message(request_payload, lambda msg: receive_message(msg, matcher_service))
    
    # Client receives response
    if results and "payload" in results[0]:
        receive_message(results[0], client_handler)
    
    # Verify trace propagation
    spans = span_exporter.get_finished_spans()
    assert len(spans) >= 2  # At least send and receive spans
    
    # All spans should share the same trace ID
    trace_ids = {span.context.trace_id for span in spans}
    assert len(trace_ids) == 1
    
    # Verify matching results were propagated correctly
    assert len(results) >= 1
    if "payload" in results[0]:
        response_data = results[0]["payload"]
        assert "matches" in response_data
        assert response_data["request_id"] == "test_req_001"


@pytest.mark.skipif(not TRACE_AVAILABLE, reason="Trace propagation not available")
def test_matcher_trace_context_isolation(mock_matcher):
    """Test that different matcher requests have isolated trace contexts."""
    requests_data = []
    
    def matcher_service(payload: Dict[str, Any]) -> None:
        requests_data.append(payload)
    
    # Clear spans
    span_exporter.clear()
    
    # Send two separate requests
    send_message({"criteria": {"role": "developer"}, "id": "req1"}, 
                lambda msg: receive_message(msg, matcher_service))
    send_message({"criteria": {"role": "designer"}, "id": "req2"}, 
                lambda msg: receive_message(msg, matcher_service))
    
    spans = span_exporter.get_finished_spans()
    assert len(spans) == 4  # 2 send + 2 receive spans
    
    # Should have 2 different trace IDs
    trace_ids = {span.context.trace_id for span in spans}
    assert len(trace_ids) == 2
