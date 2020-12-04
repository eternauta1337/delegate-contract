require('dotenv').config();

require("@nomiclabs/hardhat-waffle");

module.exports = {
  solidity: "0.7.3",
  defaultNetwork: 'hardhat',
  networks: {
    mainnet: {
      url: process.env.MAINNET_PROVIDER,
    },
    hardhat: {
      forking: {
        url: process.env.MAINNET_PROVIDER
      }
    }
  }
};

