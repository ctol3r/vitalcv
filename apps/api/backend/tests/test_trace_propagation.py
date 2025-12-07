from backend.src.didcomm.trace_propagation import (
    receive_message,
    send_message,
    span_exporter,
)


def test_trace_id_propagation():
    messages = []

    def hop_b(msg):
        def forward_to_c(payload: str) -> None:
            messages.append(msg)
            # B forwards to C
            send_message(payload, lambda m: messages.append(m))

        receive_message(msg, forward_to_c)

    # A sends to B
    send_message("hello", hop_b)

    # Expect two messages: A->B and B->C
    assert len(messages) == 2

    # Simulate C receiving the forwarded message
    receive_message(messages[1], lambda _: None)

    spans = span_exporter.get_finished_spans()
    # Expect send (A) and receive (B) and send (B) and receive (C)
    assert len(spans) == 4
    trace_ids = {span.context.trace_id for span in spans}
    # All spans should share the same trace id
    assert len(trace_ids) == 1
