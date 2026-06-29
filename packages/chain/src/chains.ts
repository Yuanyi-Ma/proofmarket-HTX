import { defineChain, type Chain } from "viem";
import { sepolia } from "viem/chains";
import {
  getProofMarketNetworkByChainId,
  SEPOLIA_CHAIN_ID
} from "@proofmarket/shared/src/chains";

export function getViemChainByChainId(chainId: number = SEPOLIA_CHAIN_ID): Chain {
  const network = getProofMarketNetworkByChainId(chainId);
  if (network.chainId === SEPOLIA_CHAIN_ID) {
    return sepolia;
  }
  return defineChain({
    id: network.chainId,
    name: network.chainName,
    nativeCurrency: network.nativeCurrency,
    rpcUrls: {
      default: { http: [network.defaultRpcUrl] }
    },
    blockExplorers: {
      default: {
        name: "Blockscout",
        url: network.explorerBaseUrl
      }
    }
  });
}
