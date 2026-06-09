# ProofMarket Demo

ProofMarket demonstrates one Cobo-bounded evidence procurement loop: a user asks a research question, the Research Agent proposes a bounded plan, Cobo constrains spending, escrow funds the provider job, evidence is verified, and settlement or challenge outcomes are replayable in the audit trail.

The demo uses deterministic providers and a mock corpus. It does not perform real paid database retrieval, sell full documents, or give an agent unrestricted wallet access.

## Demo Runbook

### Local Verification

```bash
pnpm install
pnpm test
pnpm --filter @proofmarket/web build
pnpm --filter @proofmarket/web test:e2e
```

`pnpm test` includes the contract suite. Focused contract checks can be run with `pnpm --filter @proofmarket/contracts test`; Hardhat outputs are configured under the system temp directory so the repo is not left with `artifacts`, `cache`, or `typechain-types`. Hardhat warns on Node v25; use a Hardhat-supported Node LTS in CI if needed.

### Demo Scripts

```bash
pnpm demo:success
pnpm demo:challenge
pnpm demo:denial
```

The success path settles the expert provider task. The challenge path starts from a fresh task, uses the shallow provider, wins a coverage-miss challenge, and executes refund or slash. The denial path starts from a fresh task and records a Cobo rejection before funds move.

Checked-in fixture snapshots live in `data/fixtures/happy-path.json`, `data/fixtures/challenge-path.json`, and `data/fixtures/cobo-denial.json`. The test suite validates their terminal states, Pact vocabulary, and Cobo denial audit detail.

### Live Demo

```bash
pnpm dev
```

Open `http://localhost:3000`.

If MockUSDC is not visible in Cobo, say "test asset" during the demo.
Use `Create fresh task` between the success, challenge, and denial paths when presenting the live UI.

### Talk Track

1. Create a task from the default blockchain execution acceleration research question.
2. Generate the procurement plan and show the scope, providers, budget, and verification method before spending.
3. Show exactly three providers and explain why `Execution Research Expert Agent` is recommended.
4. Submit and activate the Cobo Pact, making the spending boundary visible.
5. Fund the escrow job and point to the transaction hash rather than a direct provider payment.
6. Run the expert provider and show the evidence-backed answer package.
7. Verify the evidence and settle payment only after the verifier accepts it.
8. Start a fresh shallow-provider path, show the `CoverageMiss`, then show challenge win plus refund or slash.
9. Start a fresh denial path, trigger the blocked Cobo action, and show that funds did not move.
10. Open the audit log and replay the plan, Pact, allowed transaction, delivery hash, verifier result, settlement, challenge result, and denial.
