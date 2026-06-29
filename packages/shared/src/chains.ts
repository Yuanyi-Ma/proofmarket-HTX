export const SEPOLIA_CHAIN_ID = 11155111;
export const INJECTIVE_EVM_TESTNET_CHAIN_ID = 1439;

export type ProofMarketNetworkName = "sepolia" | "injective-testnet";

export type ProofMarketNetworkConfig = {
  name: ProofMarketNetworkName;
  chainId: number;
  chainName: string;
  deploymentFile: string;
  rpcEnvVar: string;
  defaultRpcUrl: string;
  explorerBaseUrl: string;
  policyChainId: string;
  assetSymbol: string;
  assetDisplayName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
};

const NETWORKS: Record<ProofMarketNetworkName, ProofMarketNetworkConfig> = {
  sepolia: {
    name: "sepolia",
    chainId: SEPOLIA_CHAIN_ID,
    chainName: "Sepolia",
    deploymentFile: "sepolia.json",
    rpcEnvVar: "SEPOLIA_RPC_URL",
    defaultRpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
    explorerBaseUrl: "https://sepolia.etherscan.io",
    policyChainId: "SETH",
    assetSymbol: "mUSDC",
    assetDisplayName: "mUSDC",
    nativeCurrency: {
      name: "Sepolia Ether",
      symbol: "SEP",
      decimals: 18
    }
  },
  "injective-testnet": {
    name: "injective-testnet",
    chainId: INJECTIVE_EVM_TESTNET_CHAIN_ID,
    chainName: "Injective EVM Testnet",
    deploymentFile: "injective.json",
    rpcEnvVar: "INJECTIVE_EVM_RPC_URL",
    defaultRpcUrl: "https://testnet.evm.archival.chain.virtual.json-rpc.injective.network/",
    explorerBaseUrl: "https://testnet.blockscout.injective.network",
    policyChainId: "injective-evm-testnet",
    assetSymbol: "USDC",
    assetDisplayName: "test USDC",
    nativeCurrency: {
      name: "Injective",
      symbol: "INJ",
      decimals: 18
    }
  }
};

export function getProofMarketNetworkByName(
  name: string
): ProofMarketNetworkConfig {
  const network = NETWORKS[name as ProofMarketNetworkName];
  if (!network) {
    throw new Error(`unsupported network ${name}`);
  }
  return network;
}

export function getProofMarketNetworkByChainId(
  chainId: number
): ProofMarketNetworkConfig {
  const network = Object.values(NETWORKS).find((entry) => entry.chainId === chainId);
  if (!network) {
    throw new Error(`unsupported chainId ${chainId}`);
  }
  return network;
}

export function listProofMarketNetworks(): ProofMarketNetworkConfig[] {
  return Object.values(NETWORKS);
}
