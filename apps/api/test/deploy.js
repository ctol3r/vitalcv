const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ReputationSBT", function () {
  it("should deploy and mint", async function () {
    const [issuer, receiver] = await ethers.getSigners();
    const ReputationSBT = await ethers.getContractFactory("ReputationSBT");
    const sbt = await ReputationSBT.deploy("ReputationBadge", "RBT");
    await sbt.waitForDeployment();

    const tx = await sbt.connect(issuer).issue(receiver.address, 2); // BurnAuth.Both
    await tx.wait();
    expect(await sbt.ownerOf(1)).to.equal(receiver.address);
    expect(await sbt.burnAuth(1)).to.equal(2);
  });
});
