require('dotenv').config()
require("hardhat-tracer");
require("@nomiclabs/hardhat-waffle");
require("hardhat-gas-reporter");
require('@openzeppelin/hardhat-upgrades');

/**
 * @type import('hardhat/config').HardhatUserConfig
 */

module.exports = {
  gasReporter: {
    enabled:false
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
    },
    testnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      accounts: [process.env.BSC_TESTNET_PRIVATE_KEY],
    }, 
    opbnbtestnet: {
      url: "https://opbnb-testnet-rpc.bnbchain.org",
      accounts: [process.env.BSC_TESTNET_PRIVATE_KEY],
    },
  },
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  paths: {
    sources: "./contracts/8",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 40000
  }
}