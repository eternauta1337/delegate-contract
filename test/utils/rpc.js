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
  return await hre.network.provider.request({
    method: 'evm_snapshot',
    params: [],
  });
};

const restoreSnapshot = async (id) => {
  await hre.network.provider.request({
    method: 'evm_revert',
    params: [id],
  });

  await mineBlock();
};

module.exports = {
  impersonateAddress,
  takeSnapshot,
  restoreSnapshot,
  mineBlock,
};
