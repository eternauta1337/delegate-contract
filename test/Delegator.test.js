const { expect } = require("chai");

describe("Delegator", function() {
  let delegator;

  before('deploy a Delegator contract', async () => {
    const Delegator = await ethers.getContractFactory('Delegator');
    delegator = await Delegator.deploy();
    await delegator.deployed();
  });

  it('uses the expected AAVE addresses', async () => {
    expect(await delegator.getAddressesRegistry()).to.be.equal('0x52D306e36E3B6B02c153d0266ff0f85d18BCD413');
    expect(await delegator.getAddressesProvider()).to.be.equal('0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5');
    expect(await delegator.getLendingPool()).to.be.equal('0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9');
    expect(await delegator.getDataProvider()).to.be.equal('0x057835Ad21a177dbdd3090bB1CAE03EaCF78Fc6d');
  });

  it('validates its addresses provider', async () => {
    expect(await delegator.validateAddressesProvider()).to.be.true;
  });
});
