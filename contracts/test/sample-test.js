const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('QuadraticFunding', function () {
  it('should add project and accept contributions', async function () {
    const [owner, addr1, addr2] = await ethers.getSigners();
    const QF = await ethers.getContractFactory('QuadraticFunding');
    const qf = await QF.deploy();
    await qf.addProject('Health Project');
    await qf.connect(addr1).contribute(1, { value: ethers.parseEther('1') });
    await qf.connect(addr2).contribute(1, { value: ethers.parseEther('1') });
    const match = await qf.calculateMatch(1);
    expect(match).to.be.gt(0n);
  });
});
