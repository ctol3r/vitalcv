# pallet-state-board

This pallet provides off-chain workers that periodically fetch state board data from an external API and store it on-chain. The off-chain worker submits an unsigned transaction with the fetched data which is stored in `BoardData` storage and emits the `BoardSynced` event.

This code is intended as a starting point for integrating state board synchronization into a Substrate-based blockchain.
