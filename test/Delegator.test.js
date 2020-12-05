const { expect } = require("chai");
const {
  takeSnapshot,
  restoreSnapshot,
  impersonateAddress,
} = require('./utils/rpc');

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
};

describe("Delegator", function() {
  // Contracts
  let delegator, token;

  // Users
  let deployer, someone;
  let lender, borrower;

  // Used to compare values
  const tokenBalance = {};
  const collateralETH = {};
  const availableBorrowsETH = {};
  const totalDebtETH = {};

  const connectDelegatorWith = (signer) => {
    delegator = delegator.connect(signer);
  };

  const connectTokenWith = (signer) => {
    token = token.connect(signer);
  };

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

    const itSuccesfullyDelegatesWith = ({ assetName, collateralAmount, delegatedAmount }) => {
      const collateralAmountHuman = ethers.utils.formatEther(collateralAmount);
      const delegatedAmountHuman = ethers.utils.formatEther(delegatedAmount);

      describe(`when using ${collateralAmountHuman} ${assetName} as collateral to loan ${delegatedAmountHuman} ${assetName}`, () => {
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
            expect(await token.balanceOf(lender.address)).to.be.gt(collateralAmount);
          });

          describe('before the lender has provided allowance to the contract', () => {
            it('reverts if the lender attempts to deposit collateral', async () => {
              connectDelegatorWith(lender);

              expect(delegator.depositCollateral(token.address, 1)).to.be.revertedWith('Insufficient allowance');
            });
          });

          describe('when the lender provides allowance to the contract', () => {
            before('provide allowance to the contract', async () => {
              connectTokenWith(lender);

              await token.approve(delegator.address, ethers.utils.parseEther('100000000000000000'));
            });

            it('provided allowance to the contract', async () => {
              expect(await token.allowance(lender.address, delegator.address)).to.be.gte(collateralAmount);
            });

            describe('when the lender deposits collateral', () => {
              before('record current values', async () => {
                const data = await delegator.getUserData(delegator.address);

                collateralETH.before = data.totalCollateralETH;
                availableBorrowsETH.before = data.availableBorrowsETH;
              });

              before('deposit collateral through the contract', async () => {
                connectDelegatorWith(lender);

                await delegator.depositCollateral(token.address, collateralAmount);
              });

              it('deposited the collateral on behalf of the contract', async () => {
                const data = await delegator.getUserData(delegator.address);
                collateralETH.after = data.totalCollateralETH;

                expect(collateralETH.after).to.be.gt(collateralETH.before);
              });

              it('shows available borrow balance', async () => {
                const data = await delegator.getUserData(delegator.address);
                availableBorrowsETH.after = data.availableBorrowsETH;

                expect(availableBorrowsETH.after).to.be.gt(availableBorrowsETH.before);
              });

              describe('when the lender withdraws collateral before a loan is made', () => {
                // let snapshotId;

                // before('takeSnapshot', async () => {
                //   snapshotId = await takeSnapshot();
                // });

                // after('restoreSnapshot', async () => {
                //   await restoreSnapshot(snapshotId);
                // });

                before('record previous values', async () => {
                  tokenBalance.before = await token.balanceOf(lender.address);

                  const data = await delegator.getUserData(delegator.address);
                  collateralETH.before = data.totalCollateralETH;
                });

                before('withdraw some collateral', async () => {
                  connectDelegatorWith(lender);

                  await delegator.withdrawCollateral(token.address, ethers.utils.parseEther('1000'));
                });

                it('incremented the lender balance', async () => {
                  tokenBalance.after = await token.balanceOf(lender.address);

                  expect(tokenBalance.after).to.be.gt(tokenBalance.before);
                });

                it('decremented the lender collateral', async () => {
                  const data = await delegator.getUserData(delegator.address);
                  collateralETH.after = data.totalCollateralETH;

                  expect(collateralETH.after).to.be.lt(collateralETH.before);
                });
              });

              it('reverts when the borrower attempts to borrow before credit has been delegated', async () => {
                connectDelegatorWith(borrower);

                // TODO: verify what this error means
                expect(delegator.borrowDelegatedCredit(token.address, 1, false)).to.be.revertedWith('9');
              });

              describe('when the lender approves credit delegation', () => {
                before('approve credit', async () => {
                  connectDelegatorWith(lender);

                  await delegator.approveCreditDelegation(token.address, delegatedAmount, false);
                });

                it('shows available credit for the borrower', async () => {
                  expect(await delegator.getDelegatedCreditAllowance(token.address, false)).to.be.equal(delegatedAmount);
                });

                it('reverts if the borrower attempts to borrow more than its allowance', async () => {
                  connectDelegatorWith(borrower);

                  const exceeding = delegatedAmount.add(ethers.utils.parseEther('1'));
                  expect(delegator.borrowDelegatedCredit(token.address, exceeding, false)).to.be.revertedWith('9');
                });

                describe('when the borrower takes the delegated loan', () => {
                  before('record current values', async () => {
                    const data = await delegator.getUserData(delegator.address);
                    totalDebtETH.before = data.totalDebtETH;

                    tokenBalance.before = await token.balanceOf(borrower.address);
                  });

                  before('borrow credit', async () => {
                    connectDelegatorWith(borrower);

                    await delegator.borrowDelegatedCredit(token.address, delegatedAmount, false);
                  });

                  it('increases the lenders debt', async () => {
                    const data = await delegator.getUserData(delegator.address);
                    totalDebtETH.after = data.totalDebtETH;

                    expect(totalDebtETH.after).to.be.gt(totalDebtETH.before);
                  });

                  it('increases the borrowers balance', async () => {
                    tokenBalance.after = await token.balanceOf(borrower.address);

                    expect(tokenBalance.after).to.be.gt(tokenBalance.before);
                  });
                });
              });
            });
          });
        });
      });
    };

    const collateralAmount = ethers.utils.parseEther('50000');
    const delegatedAmount = ethers.utils.parseEther('10000');

    itSuccesfullyDelegatesWith({ assetName: 'DAI', collateralAmount, delegatedAmount });
  });
});
