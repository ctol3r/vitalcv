# Credential Evidence IBC Module

This package provides a skeleton implementation of a Cosmos SDK IBC module
for transferring credential evidence between chains. The module defines a
packet data structure and a minimal keeper with send/receive functions.

The implementation is intentionally light-weight and does not depend on the
Cosmos SDK to allow development without external dependencies. Integration
with the actual Cosmos SDK would require wiring these functions with the IBC
module and handling packet acknowledgement logic.
