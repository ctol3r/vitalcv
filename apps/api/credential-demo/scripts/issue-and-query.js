const { ethers } = require("hardhat");

async function main() {
  const [deployer, user] = await ethers.getSigners();
  const CredentialRegistry = await ethers.getContractFactory("CredentialRegistry");
  const registry = await CredentialRegistry.deploy();
  await registry.waitForDeployment();

  const credential = "Certified Nurse";
  const tx = await registry.issueCredential(user.address, credential);
  await tx.wait();

  const stored = await registry.credentials(user.address);
  console.log("Credential stored on-chain:", stored);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
