require('dotenv').config();

require("@nomiclabs/hardhat-waffle");

module.exports = {
  solidity: "0.7.3",
  defaultNetwork: 'mainnet',
  networks: {
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
    },
    mainnet_fork: {
      url: 'http://localhost:8545'
    }
  }
};

