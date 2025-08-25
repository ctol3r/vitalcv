import { ethers } from "hardhat";
import { expect } from "chai";

describe("MatchingPool", function () {
  it("allocates sponsor funds proportionally to unique contributors", async () => {
    const [sponsor, alice, bob, charlie, projectA, projectB] = await ethers.getSigners();

    const MatchingPool = await ethers.getContractFactory("MatchingPool");
    const pool = await MatchingPool.deploy();
    await pool.deployed();

    // sponsor deposits 10 ether
    await pool.connect(sponsor).addSponsorFunds({ value: ethers.parseEther("10") });

    // contributions
    await pool.connect(alice).contribute(projectA.address, { value: ethers.parseEther("1") });
    await pool.connect(bob).contribute(projectA.address, { value: ethers.parseEther("1") });
    await pool.connect(charlie).contribute(projectB.address, { value: ethers.parseEther("1") });

    await pool.allocate();

    const balBeforeA = await ethers.provider.getBalance(projectA.address);
    const balBeforeB = await ethers.provider.getBalance(projectB.address);

    await pool.withdrawMatch(projectA.address);
    await pool.withdrawMatch(projectB.address);

    const balAfterA = await ethers.provider.getBalance(projectA.address);
    const balAfterB = await ethers.provider.getBalance(projectB.address);

    const receivedA = balAfterA - balBeforeA;
    const receivedB = balAfterB - balBeforeB;

    // Each project has 2 unique contributors: projectA has 2, projectB has 1
    // Total unique contributors = 3, sponsor funds = 10 ether
    // projectA match = 10 * 2/3 = 6.6666.., projectB match = 10 * 1/3 = 3.3333..
    expect(receivedA).to.be.closeTo(ethers.parseEther("8"), ethers.parseEther("0.1"));
    expect(receivedB).to.be.closeTo(ethers.parseEther("4"), ethers.parseEther("0.1"));
  });
});
