# Verifier Contract Artifacts

The deploy script (`scripts/zk/deployVerifier.ts`) expects a compiled verifier
artifact at `event-ledger-verifier.json`. Generate it once the Groth16 trusted
setup is complete:

1. Produce the Solidity verifier from the `.zkey`
   ```
   pnpm dlx snarkjs zkey export solidityverifier \
     chain/zk/artifacts/event-ledger.zkey \
     chain/zk/contracts/EventLedgerVerifier.sol
   ```
2. Compile with your preferred toolchain (Hardhat, Foundry, solcjs) and save the
   resulting `{ abi, bytecode }` bundle as
   `chain/zk/contracts/event-ledger-verifier.json`.
3. Run `pnpm ts-node scripts/zk/deployVerifier.ts` to publish the contract.

> The checked-in `event-ledger-verifier.json` file only contains a placeholder
> ABI/bytecode stub so CI can lint the tree. Replace it with the compiled
> verifier before deploying to production.


