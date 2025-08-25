const { ethers } = require("hardhat");

async function main() {
  const ReputationSBT = await ethers.getContractFactory("ReputationSBT");
  const sbt = await ReputationSBT.deploy("ReputationBadge", "RBT");
  await sbt.waitForDeployment();
  console.log("ReputationSBT deployed to:", await sbt.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
