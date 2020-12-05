require('dotenv').config();

require("@nomiclabs/hardhat-waffle");

module.exports = {
  solidity: "0.7.3",
  defaultNetwork: 'hardhat',
  networks: {
    mainnet: {
      url: process.env.MAINNET_PROVIDER,
    },
    local: {
      url: 'http://localhost:8545'
    },
    hardhat: {
      forking: {
        url: process.env.MAINNET_PROVIDER
      }
    }
  },
  mocha: {
    timeout: 600000
  }
};

