import "@nomicfoundation/hardhat-toolbox";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HardhatUserConfig } from "hardhat/config";

const hardhatOutputRoot = join(tmpdir(), "proofmarket-demo-hardhat");

const sepoliaRpcUrl = process.env.SEPOLIA_RPC_URL ?? "";
const injectiveRpcUrl = process.env.INJECTIVE_EVM_RPC_URL ?? "";
const deployerKey = process.env.DEPLOYER_PRIVATE_KEY ?? "";
// Optional: expert provider key so the deploy script can self-stake on its behalf.
// In local smoke tests we use a second well-known Hardhat key.
const providerSignerKey = process.env.PROVIDER_SIGNER_PRIVATE_KEY ?? "";

// Build the accounts array: deployer always first, provider signer second (if
// present).  The deploy script loads signers[0] as deployer and signers[1] as
// the provider signer.
const deploymentAccounts: string[] = [];
if (deployerKey) deploymentAccounts.push(deployerKey);
if (providerSignerKey) deploymentAccounts.push(providerSignerKey);

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.24",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      }
    ],
    overrides: {
      "contracts/ProofMarketReputationRegistry.sol": {
        version: "0.8.24",
        settings: {
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      }
    }
  },
  paths: {
    artifacts: join(hardhatOutputRoot, "artifacts"),
    cache: join(hardhatOutputRoot, "cache")
  },
  typechain: {
    outDir: join(hardhatOutputRoot, "typechain-types")
  },
  networks: {
    sepolia: {
      url: sepoliaRpcUrl,
      accounts: deploymentAccounts.length > 0 ? deploymentAccounts : []
    },
    injectiveTestnet: {
      url: injectiveRpcUrl,
      chainId: 1439,
      gasPrice: 160_000_000,
      accounts: deploymentAccounts.length > 0 ? deploymentAccounts : []
    }
  }
};

export default config;
