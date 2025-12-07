# Blockchain Integration

This directory contains Substrate blockchain integration code for VitalCV.

## Structure

```
blockchain/
└── substrate/
    ├── pallets/
    │   ├── credential/      # Credential registry pallet
    │   ├── governance/      # Governance pallet
    │   └── audit-scrapbook/ # Audit scrapbook pallet
    └── pallet-state-board/  # State board pallet
```

## Pallets

### Credential Pallet
Manages verifiable credentials on-chain.

### Governance Pallet
Handles governance proposals and voting.

### Audit Scrapbook Pallet
Stores audit events and compliance records.

### State Board Pallet
Manages state-level board interactions.

## Integration with API

The API can interact with the blockchain through:
- RPC connections configured in `apps/api/api/config/`
- Polkadot.js API client
- Custom pallet calls

## Development

### Prerequisites
- Rust toolchain
- Substrate dependencies

### Building
```bash
cd blockchain/substrate
cargo build
```

### Testing
```bash
cargo test
```

## Configuration

Blockchain connection settings are configured via environment variables:
- `SUBSTRATE_WS_URL` - WebSocket URL for Substrate node
- `SUBSTRATE_MNEMONIC` - Account mnemonic for signing

See `infra/env-map.md` for full environment variable documentation.

