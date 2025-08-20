const fs = require('fs');
const solc = require('solc');
const { ethers } = require('ethers');

async function compileContract() {
  const source = fs.readFileSync('contracts/CredentialRegistry.sol', 'utf8');
  const input = {
    language: 'Solidity',
    sources: {
      'CredentialRegistry.sol': { content: source }
    },
    settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } } }
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const contract = output.contracts['CredentialRegistry.sol']['CredentialRegistry'];
  return { abi: contract.abi, bytecode: contract.evm.bytecode.object };
}

async function main() {
  const { abi, bytecode } = await compileContract();
  const provider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:8545');
  const signer = provider.getSigner(0);
  const factory = new ethers.ContractFactory(abi, bytecode, signer);
  const registry = await factory.deploy();
  await registry.deployTransaction.wait();

  const accounts = await provider.listAccounts();
  const user = provider.getSigner(accounts[1]);
  const credential = 'Certified Nurse';
  const tx = await registry.connect(user).issueCredential(await user.getAddress(), credential);
  await tx.wait();

  const stored = await registry.credentials(await user.getAddress());
  console.log('Credential stored on-chain:', stored);
}

main().catch(err => { console.error(err); process.exit(1); });
