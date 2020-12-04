const { expect } = require("chai");

// Mainnet
const ADDRESSES = {
  LENDING_POOL: '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9',
  DATA_PROVIDER: '0x057835Ad21a177dbdd3090bB1CAE03EaCF78Fc6d',
  DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  sUSD: '0x57Ab1ec28D129707052df4dF418D58a2D46d5f51',
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
};

describe("Delegator", function() {
  let delegator;

  before('deploy a Delegator contract', async () => {
    const Delegator = await ethers.getContractFactory('Delegator');
    delegator = await Delegator.deploy();
    await delegator.deployed();
  });

  it('uses the expected AAVE addresses', async () => {
    expect(await delegator.getLendingPool()).to.be.equal(ADDRESSES.LENDING_POOL);
    expect(await delegator.getDataProvider()).to.be.equal(ADDRESSES.DATA_PROVIDER);
  });

  const itSuccesfullyDelegatesWith = ({ assetName }) => {
    const assetAddress = ADDRESSES[assetName];

    describe(`when delegating ${assetName}`, () => {
      it(`validates that ${assetName} is available for delegation`, async () => {
        expect(await delegator.isAssetAvailableForDelegation(assetAddress)).to.be.true;
      });


    });
  };

  itSuccesfullyDelegatesWith({
    tokenName: 'DAI',
    tokenAmount: 1
  });
});
