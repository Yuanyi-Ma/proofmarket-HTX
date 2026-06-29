import { describe, expect, it } from "vitest";
import {
  INJECTIVE_EVM_TESTNET_CHAIN_ID,
  SEPOLIA_CHAIN_ID
} from "@proofmarket/shared/src/chains";
import { getViemChainByChainId } from "../src/chains";

describe("getViemChainByChainId", () => {
  it("returns the built-in Sepolia chain", () => {
    const chain = getViemChainByChainId(SEPOLIA_CHAIN_ID);

    expect(chain.id).toBe(SEPOLIA_CHAIN_ID);
    expect(chain.name).toBe("Sepolia");
  });

  it("returns the Injective EVM testnet chain", () => {
    const chain = getViemChainByChainId(INJECTIVE_EVM_TESTNET_CHAIN_ID);

    expect(chain.id).toBe(1439);
    expect(chain.name).toBe("Injective EVM Testnet");
    expect(chain.nativeCurrency.symbol).toBe("INJ");
    expect(chain.rpcUrls.default.http[0]).toBe(
      "https://testnet.evm.archival.chain.virtual.json-rpc.injective.network/"
    );
  });
});
