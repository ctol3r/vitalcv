from __future__ import annotations

from typing import Any, Callable, Dict

from opentelemetry import propagate, trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import (
    InMemorySpanExporter,
)


# Shared tracer provider for the module
provider = TracerProvider()
span_exporter = InMemorySpanExporter()
provider.add_span_processor(SimpleSpanProcessor(span_exporter))
trace.set_tracer_provider(provider)
tracer = trace.get_tracer(__name__)


Message = Dict[str, Any]


def send_message(payload: Any, send_func: Callable[[Message], None]) -> None:
    """Send a DIDComm-like message with trace context."""
    metadata: Dict[str, str] = {}
    with tracer.start_as_current_span("send"):
        propagate.inject(metadata)
        msg = {"payload": payload, "metadata": metadata}
        send_func(msg)


def receive_message(msg: Message, handler: Callable[[Any], None]) -> None:
    """Receive a DIDComm-like message and continue trace."""
    ctx = propagate.extract(msg.get("metadata", {}))
    with tracer.start_as_current_span("receive", context=ctx):
        handler(msg.get("payload"))


__all__ = [
    "send_message",
    "receive_message",
    "span_exporter",
]
