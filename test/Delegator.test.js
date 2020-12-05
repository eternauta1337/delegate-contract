const { expect } = require("chai");
const hre = require('hardhat');

const impersonateAddress = async (address) => {
  await hre.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [address],
  });

  const signer = await ethers.provider.getSigner(address);
  signer.address = signer._address;

  return signer;
};

const resetFork = async () => {
  await hre.network.provider.request({
    method: 'hardhat_reset',
    params: [],
  });
};

const mineBlock = async () => {
  await hre.network.provider.request({
    method: 'evm_mine',
    params: [],
  });
};

const takeSnapshot = async () => {
  const response = await hre.network.provider.request({
    method: 'evm_snapshot',
    params: [],
  });
  console.log(response);

  await mineBlock();

  return response.result;
};

const restoreSnapshot = async (id) => {
  await hre.network.provider.request({
    method: 'evm_revert',
    params: [id],
  });

  await mineBlock();
};

// Mainnet
const addresses = {
  lendingPool: '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9',
  dataProvider: '0x057835Ad21a177dbdd3090bB1CAE03EaCF78Fc6d',
  DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  sUSD: '0x57Ab1ec28D129707052df4dF418D58a2D46d5f51',
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
};
const holders = {
  sUSD: '0xEb3107117FEAd7de89Cd14D463D340A2E6917769', // Synthetix protocolDAO
  DAI: '0x0B30483057D6A7798378EdbA707d625116Ed7640',
}

describe("Delegator", function() {
  // Contracts
  let delegator, token;

  // Users
  let deployer, someone;
  let lender, borrower;

  before('reset the fork', async () => {
    // TODO: This is causing problems
    // await resetFork();
  });

  describe('when deploying a Delegator contract', () => {
    before('get lender and borrower', async () => {
      ([deployer, lender, borrower, someone] = await ethers.getSigners());
    });

    before('deploy the Delegator contract', async () => {
      const Delegator = await ethers.getContractFactory('Delegator');
      delegator = await Delegator.deploy(lender.address, borrower.address);

      await delegator.deployed();
    });

    it('uses the expected Aave addresses', async () => {
      expect(await delegator.lendingPool()).to.be.equal(addresses.lendingPool);
      expect(await delegator.dataProvider()).to.be.equal(addresses.dataProvider);
    });

    it('properly assigned lender and borrower', async () => {
      expect(await delegator.lender()).to.be.equal(lender.address);
      expect(await delegator.borrower()).to.be.equal(borrower.address);
    });

    const connectDelegatorWith = (signer) => {
      delegator = delegator.connect(signer);
    };

    const connectTokenWith = (signer) => {
      token = token.connect(signer);
    };

    const itSuccesfullyDelegatesWith = ({ assetName, amount }) => {
      describe(`when delegating ${ethers.utils.formatEther(amount)} ${assetName}`, () => {
        before('connect with token', async () => {
          const assetAddress = addresses[assetName];
          token = await ethers.getContractAt('IERC20', assetAddress);
        });

        it(`validates that ${assetName} is available for delegation`, async () => {
          expect(await delegator.isAssetAvailableForDelegation(token.address)).to.be.true;
        });

        it('reverts if someone tries to call restricted lender functions', async () => {
          connectDelegatorWith(someone);

          const errMsg = 'Sender is not the lender';
          expect(delegator.depositCollateral(token.address, 1)).to.be.revertedWith(errMsg);
          expect(delegator.withdrawCollateral(token.address, 1)).to.be.revertedWith(errMsg);
          expect(delegator.approveCreditDelegation(token.address, 1, false)).to.be.revertedWith(errMsg);
          expect(delegator.withdrawBalance(token.address)).to.be.revertedWith(errMsg);
        });

        it('reverts if someone tries to call restricted borrower functions', async () => {
          connectDelegatorWith(someone);

          const errMsg = 'Sender is not the borrower';
          expect(delegator.borrowDelegatedCredit(token.address, 1, false)).to.be.revertedWith(errMsg);
        });

        describe(`when the lender owns the necessary ${assetName}`, () => {
          before(`ensure that the lender has enough ${assetName}`, async () => {
            const tokenHolder = await impersonateAddress(holders[assetName]);

            connectTokenWith(tokenHolder);
            await token.transfer(lender.address, await token.balanceOf(tokenHolder.address));
          });

          it('lender has the necessary balance', async () => {
            expect(await token.balanceOf(lender.address)).to.be.gt(amount);
          });

          describe('before the lender has provided allowance to the token', () => {
            it('reverts if the lender attempts to deposit collateral', async () => {
              connectDelegatorWith(lender);

              expect(delegator.depositCollateral(token.address, 1)).to.be.revertedWith('Insufficient allowance');
            });
          });

          describe('when the lender provides allowance to the contract', () => {
            let collateralETH = {};

            before('record previous collateral', async () => {
              const data = await delegator.getUserData(delegator.address);

              collateralETH.before = data.totalCollateralETH;
            });

            before('provide allowance to the contract', async () => {
              connectTokenWith(lender);
              await token.approve(delegator.address, amount);
            });

            it('provided allowance to the contract', async () => {
              expect(await token.allowance(lender.address, delegator.address)).to.be.equal(amount);
            });

            describe('when the lender deposits collateral', () => {
              before('deposit collateral through the contract', async () => {
                connectDelegatorWith(lender);

                await delegator.depositCollateral(token.address, amount);
              });

              it('deposited the collateral on behalf of the contract', async () => {
                const data = await delegator.getUserData(delegator.address);
                collateralETH.after = data.totalCollateralETH;

                expect(collateralETH.after).to.be.gt(collateralETH.before);
              });

              describe('when the lender withdraws collateral before a loan is made', () => {
                let snapshotId;
                let tokenBalance = {};

                before('takeSnapshot', async () => {
                  snapshotId = await takeSnapshot();
                  console.log('SNAPSHOT', snapshotId);
                });

                after('restoreSnapshot', async () => {
                  await restoreSnapshot(snapshotId);
                });

                before('record previous balance', async () => {
                  tokenBalance.before = await token.balanceOf(lender.address);
                });

                before('withdraw all colateral', async () => {
                  connectDelegatorWith(lender);

                  await delegator.withdrawCollateral(token.address, amount);
                });

                it('incremented the lender balance', async () => {
                  tokenBalance.after = await token.balanceOf(lender.address);

                  expect(tokenBalance.after).to.be.gt(tokenBalance.before);
                });
              });
            });
          });
        });
      });
    };

    const amount = ethers.utils.parseEther('50000');
    itSuccesfullyDelegatesWith({ assetName: 'DAI', amount });
    // itSuccesfullyDelegatesWith({ assetName: 'sUSD', amount: 1 });
  });
});
