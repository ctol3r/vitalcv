import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import path from 'path';
import { ethers } from 'ethers';

interface VerifierArtifact {
  abi: any[];
  bytecode: string;
}

const DEFAULT_ARTIFACT = path.resolve(
  process.cwd(),
  'chain/zk/contracts/event-ledger-verifier.json',
);
const DEFAULT_VKEY = path.resolve(
  process.cwd(),
  'chain/zk/artifacts/event-ledger.vkey.json',
);

async function main() {
  const artifactPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_ARTIFACT;
  const vkeyPath = process.argv[3] ? path.resolve(process.argv[3]) : DEFAULT_VKEY;
  const rpcUrl = process.env.ZK_VERIFIER_RPC ?? 'http://localhost:8545';
  const privateKey = process.env.ZK_VERIFIER_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error('Set ZK_VERIFIER_PRIVATE_KEY to the deployer private key');
  }

  const artifact = (await loadArtifact(artifactPath)) as VerifierArtifact;
  if (!artifact.bytecode || artifact.bytecode === '0x') {
    throw new Error(
      `Verifier artifact at ${artifactPath} is missing bytecode. Compile the Solidity verifier first.`,
    );
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`[zk][deploy] deploying verifier from ${await wallet.getAddress()} to ${rpcUrl}`);

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`[zk][deploy] verifier deployed at ${address}`);

  const txHash = contract.deploymentTransaction()?.hash;
  if (txHash) {
    console.log(`[zk][deploy] deployment tx: ${txHash}`);
  }

  try {
    const vkeyHash = await hashFile(vkeyPath);
    console.log(`[zk][deploy] verification key sha256=${vkeyHash} (${vkeyPath})`);
  } catch (error) {
    console.warn(`[zk][deploy] unable to hash verification key at ${vkeyPath}`, error);
  }
}

async function loadArtifact(filePath: string) {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function hashFile(filePath: string): Promise<string> {
  const raw = await readFile(filePath);
  return createHash('sha256').update(raw).digest('hex');
}

main().catch((error) => {
  console.error('[zk][deploy] failed', error);
  process.exit(1);
});


