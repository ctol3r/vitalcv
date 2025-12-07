import '@nomicfoundation/hardhat-toolbox';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

export default {
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
