require('@nomicfoundation/hardhat-toolbox');

module.exports = {
  solidity: {
    compilers: [
      {
        version: '0.8.20',
        // Use solc-js from node_modules to avoid downloads
        path: require.resolve('solc'),
      },
    ],
  },
};
