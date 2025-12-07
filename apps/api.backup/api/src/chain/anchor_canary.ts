import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';

export async function runAnchorCanarySigned(root = '0x68656c6c6f') {
  const ws = process.env.SUBSTRATE_WS || 'wss://rpc.polkadot.io';
  const seed = process.env.SUBSTRATE_SEED;

  if (!seed) {
    return { ok: false, note: 'missing SUBSTRATE_SEED' };
  }

  const api = await ApiPromise.create({ provider: new WsProvider(ws) });
  const kr = new Keyring({ type: 'ed25519' });
  const kp = kr.addFromUri(seed);

  // system.remark is enough for a verifiable breadcrumb
  // @ts-ignore
  const tx = (api.tx?.system?.remark && api.tx.system.remark(root));

  if (!tx) {
    return { ok: false, note: 'remark not available' };
  }

  const h = await new Promise<string>((resolve, reject) => {
    tx.signAndSend(kp, ({ status, dispatchError, txHash }) => {
      if (dispatchError) {
        reject(dispatchError.toString());
      }
      if (status?.isInBlock || status?.isFinalized) {
        resolve(txHash.toHex());
      }
    });
  });

  return { ok: true, txHash: h, root, ts: Date.now() };
}
