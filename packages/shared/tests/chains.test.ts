import { describe, expect, it } from "vitest";
import {
  INJECTIVE_EVM_TESTNET_CHAIN_ID,
  SEPOLIA_CHAIN_ID,
  getProofMarketNetworkByChainId,
  getProofMarketNetworkByName
} from "../src/chains";

describe("ProofMarket network config", () => {
  it("resolves Sepolia by chain id for backwards compatibility", () => {
    const network = getProofMarketNetworkByChainId(SEPOLIA_CHAIN_ID);

    expect(network.name).toBe("sepolia");
    expect(network.deploymentFile).toBe("sepolia.json");
    expect(network.rpcEnvVar).toBe("SEPOLIA_RPC_URL");
    expect(network.policyChainId).toBe("SETH");
  });

  it("resolves Injective EVM testnet by chain id", () => {
    const network = getProofMarketNetworkByChainId(INJECTIVE_EVM_TESTNET_CHAIN_ID);

    expect(network.name).toBe("injective-testnet");
    expect(network.chainId).toBe(1439);
    expect(network.deploymentFile).toBe("injective.json");
    expect(network.rpcEnvVar).toBe("INJECTIVE_EVM_RPC_URL");
    expect(network.policyChainId).toBe("injective-evm-testnet");
    expect(network.explorerBaseUrl).toBe("https://testnet.blockscout.injective.network");
    expect(network.assetSymbol).toBe("USDC");
  });

  it("resolves Injective EVM testnet by deployment network name", () => {
    expect(getProofMarketNetworkByName("injective-testnet").chainId).toBe(1439);
  });

  it("rejects unsupported networks", () => {
    expect(() => getProofMarketNetworkByChainId(1)).toThrow(/unsupported chainId/);
    expect(() => getProofMarketNetworkByName("mainnet")).toThrow(/unsupported network/);
  });
});
