export const escrowAbi = [
  {
    type: "function",
    name: "createJob",
    stateMutability: "nonpayable",
    inputs: [
      { name: "providerAgentId", type: "uint256" },
      { name: "provider", type: "address" },
      { name: "verifierAgentId", type: "uint256" },
      { name: "evaluator", type: "address" },
      { name: "token", type: "address" },
      { name: "expiredAt", type: "uint256" },
      { name: "descriptionHash", type: "bytes32" },
      { name: "coverageHash", type: "bytes32" }
    ],
    outputs: [{ name: "jobId", type: "uint256" }]
  },
  {
    type: "function",
    name: "setBudget",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "amount", type: "uint256" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "fund",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "expectedAmount", type: "uint256" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "submit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "deliverableHash", type: "bytes32" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "complete",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "reasonHash", type: "bytes32" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "jobs",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "jobId", type: "uint256" },
      { name: "client", type: "address" },
      { name: "providerAgentId", type: "uint256" },
      { name: "provider", type: "address" },
      { name: "verifierAgentId", type: "uint256" },
      { name: "evaluator", type: "address" },
      { name: "token", type: "address" },
      { name: "budget", type: "uint256" },
      { name: "expiredAt", type: "uint256" },
      { name: "state", type: "uint8" },
      { name: "descriptionHash", type: "bytes32" },
      { name: "deliverableHash", type: "bytes32" },
      { name: "coverageHash", type: "bytes32" }
    ]
  },
  {
    type: "event",
    name: "JobCreated",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "client", type: "address", indexed: true },
      { name: "provider", type: "address", indexed: true }
    ]
  },
  {
    type: "event",
    name: "JobFunded",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "amount", type: "uint256", indexed: false }
    ]
  },
  {
    type: "event",
    name: "DeliverableSubmitted",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "deliverableHash", type: "bytes32", indexed: false }
    ]
  },
  {
    type: "event",
    name: "JobCompleted",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "reasonHash", type: "bytes32", indexed: false }
    ]
  }
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  }
] as const;
