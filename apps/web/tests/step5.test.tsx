// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Step5Evidence } from "../components/steps/Step5Evidence";
import { presetDefense, presetJuryVotes } from "@proofmarket/shared/src/fixtures";
import type { Task, ProviderAnswerPackage, TaskChallenge } from "@proofmarket/shared/src/types";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(cleanup);

const pkg: ProviderAnswerPackage = {
  taskId: "task_001",
  providerAgentId: 1,
  providerId: "execution-research-expert",
  providerName: "Execution Research Provider",
  coverageStatement: "Covers 2021-2026 blockchain transaction execution acceleration papers",
  answers: [
    {
      providerAnswer: "Optimistic parallel execution is the core direction for current execution acceleration.",
      sourceTitle: "Block-STM",
      sourceLocator: "arXiv:2203.06871",
      sourceLibrary: "arxiv",
      sourceMetadata: { year: 2022, type: "paper" },
      excerptOrSummary: "Block-STM uses optimistic concurrency control to execute ordered transactions in parallel and reduce conflict re-execution.",
      relevanceExplanation: "Directly supports the execution-acceleration topic, but cannot prove universal applicability to all workloads."
    },
    {
      providerAnswer: "Speculative execution can further reduce latency.",
      sourceTitle: "Speculative Execution Survey",
      sourceLocator: "arXiv:2301.09999",
      sourceLibrary: "arxiv",
      sourceMetadata: { year: 2023, type: "paper" },
      excerptOrSummary: "Surveys applications and limits of speculative execution in blockchain settings.",
      relevanceExplanation: "Relevant to the topic, with coverage limited to EVM-compatible chains."
    }
  ],
  packageHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab"
};

const COUNTER_EVIDENCE_HASH =
  "0xdeadbeef11111111111111111111111111111111111111111111111111111111ab";

const challengeFixture: TaskChallenge = {
  type: "CoverageMiss",
  statement: "The delivered package did not include Block-STM, a representative in-scope work, so this is a coverage miss.",
  hitCoverageClause: "Coverage commitment: 2021-2026 blockchain execution acceleration sources (IEEE / Elsevier).",
  counterEvidenceHash: COUNTER_EVIDENCE_HASH,
  defense: { ...presetDefense }
};

const votesFixture = presetJuryVotes([
  "0x0000000000000000000000000000000000000a01",
  "0x0000000000000000000000000000000000000a02",
  "0x0000000000000000000000000000000000000a03"
]);

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "task_001",
    userQuestion: "What are the latest studies on blockchain transaction execution acceleration?",
    status: "Delivered",
    budgetLimit: "5 USDC",
    selectedProviderIds: ["execution-research-expert"],
    plan: null,
    policy: {
      intent: "Fund one provider research job",
      totalBudget: "5 USDC",
      perJobCap: "1 USDC",
      allowedTargets: ["ProofMarketEscrow", "Injective USDC"],
      allowedFunctions: ["createJob", "fund", "submit", "complete", "reject", "approve"],
      denyRules: ["direct transfer"],
      expiresInMinutes: 30,
      policyId: "policy_abc123",
      status: "active"
    },
    providerPackage: pkg,
    audit: [],
    jobId: 42,
    mode: "fixture",
    txRecords: [],
    claudePlanRaw: null,
    denial: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

const noop = vi.fn();
const defaultProps = {
  onVerify: noop,
  onOpenChallenge: noop,
  onRequestVote: noop,
  onResolve: noop,
};

describe("Step5Evidence — evidence package rendering", () => {
  it("renders provider name", () => {
    render(<Step5Evidence task={task()} {...defaultProps} />);
    expect(screen.getByText("Execution Research Provider")).toBeTruthy();
  });

  it("renders coverage statement", () => {
    render(<Step5Evidence task={task()} {...defaultProps} />);
    expect(screen.getByText("Covers 2021-2026 blockchain transaction execution acceleration papers")).toBeTruthy();
  });

  it("renders source titles for all evidence items", () => {
    render(<Step5Evidence task={task()} {...defaultProps} />);
    expect(screen.getByText("Block-STM")).toBeTruthy();
    expect(screen.getByText("Speculative Execution Survey")).toBeTruthy();
  });

  it("opens the first evidence item by default and frames the page as an evidence package", () => {
    const { container } = render(<Step5Evidence task={task()} {...defaultProps} />);
    expect(screen.getByText("Package summary")).toBeTruthy();
    const firstDetails = container.querySelector(".evidence-item-row");
    expect(firstDetails?.getAttribute("open")).toBe("");
  });

  it("renders source locators in summary (mono)", () => {
    render(<Step5Evidence task={task()} {...defaultProps} />);
    const locators = screen.getAllByText("arXiv:2203.06871");
    expect(locators.length).toBeGreaterThan(0);
  });

  it("renders package hash in mono", () => {
    render(<Step5Evidence task={task()} {...defaultProps} />);
    expect(
      screen.getByText("0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab")
    ).toBeTruthy();
  });
});

describe("Step5Evidence — verify action state", () => {
  it("shows Verify Evidence button when status is Delivered", () => {
    render(<Step5Evidence task={task({ status: "Delivered" })} {...defaultProps} />);
    expect(screen.getByRole("button", { name: /Verify Evidence/ })).toBeTruthy();
  });

  it("does not show Verify Evidence button in readOnly mode", () => {
    render(<Step5Evidence task={task({ status: "Delivered" })} {...defaultProps} readOnly={true} />);
    expect(screen.queryByRole("button", { name: /Verify Evidence/ })).toBeNull();
  });

  it("disables Verify Evidence when isBusy", () => {
    render(<Step5Evidence task={task({ status: "Delivered" })} {...defaultProps} isBusy={true} />);
    const btn = screen.getByRole("button", { name: /Verify Evidence/ });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows Verified status text when Verified", () => {
    render(<Step5Evidence task={task({ status: "Verified" })} {...defaultProps} />);
    expect(screen.getAllByText("Verified").length).toBeGreaterThan(0);
  });
});

describe("Step5Evidence — challenge entry at Delivered", () => {
  it("shows Open Challenge button at Delivered alongside Verify Evidence", () => {
    render(<Step5Evidence task={task({ status: "Delivered" })} {...defaultProps} />);
    // Both the primary and secondary actions should be present
    expect(screen.getByRole("button", { name: /Verify Evidence/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Open Challenge/ })).toBeTruthy();
  });

  it("disables Open Challenge when isBusy", () => {
    render(<Step5Evidence task={task({ status: "Delivered" })} {...defaultProps} isBusy={true} />);
    const btn = screen.getByRole("button", { name: /Open Challenge/ });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("does not show Open Challenge in readOnly mode", () => {
    render(<Step5Evidence task={task({ status: "Delivered" })} {...defaultProps} readOnly={true} />);
    expect(screen.queryByRole("button", { name: /Open Challenge/ })).toBeNull();
  });
});

describe("Step5Evidence — challenge window banner (real mode)", () => {
  it("shows a ticking countdown while the window is open", () => {
    const endsAt = new Date(Date.now() + 120_000).toISOString();
    render(
      <Step5Evidence
        task={task({ mode: "real", status: "Delivered", challengeWindowEndsAt: endsAt })}
        {...defaultProps}
      />
    );
    expect(screen.getByTestId("challenge-window-banner").textContent).toContain("Challenge window remaining");
  });

  it("announces a closed window once it has passed", () => {
    const endsAt = new Date(Date.now() - 1_000).toISOString();
    render(
      <Step5Evidence
        task={task({ mode: "real", status: "Delivered", challengeWindowEndsAt: endsAt })}
        {...defaultProps}
      />
    );
    expect(screen.getByTestId("challenge-window-banner").textContent).toContain("Challenge window closed");
  });
});

describe("Step5Evidence — Challenged stage", () => {
  const challengedTask = task({
    status: "Challenged",
    challenge: challengeFixture
  });

  it("shows Challenge opened heading", () => {
    render(<Step5Evidence task={challengedTask} {...defaultProps} />);
    expect(screen.getByText("Challenge opened")).toBeTruthy();
  });

  it("shows challenge type CoverageMiss with in-scope miss label", () => {
    render(<Step5Evidence task={challengedTask} {...defaultProps} />);
    expect(screen.getAllByText(/CoverageMiss/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/in-scope coverage miss/).length).toBeGreaterThan(0);
  });

  it("shows the deposit D and jury fee F as separate locked rows", () => {
    render(<Step5Evidence task={challengedTask} {...defaultProps} />);
    expect(screen.getByText("Challenge deposit D")).toBeTruthy();
    expect(screen.getByText("Jury fee F")).toBeTruthy();
  });

  it("shows counterEvidenceHash in mono", () => {
    render(<Step5Evidence task={challengedTask} {...defaultProps} />);
    const hashes = screen.getAllByText(COUNTER_EVIDENCE_HASH);
    expect(hashes.length).toBeGreaterThan(0);
  });

  it("shows the Challenge Package panel with statement and coverage clause", () => {
    render(<Step5Evidence task={challengedTask} {...defaultProps} />);
    expect(screen.getAllByText(/Challenge Package/).length).toBeGreaterThan(0);
    expect(screen.getByText(challengeFixture.statement)).toBeTruthy();
    expect(screen.getAllByText(challengeFixture.hitCoverageClause).length).toBeGreaterThan(0);
  });

  it("shows the provider defense card with plaintext and hash", () => {
    render(<Step5Evidence task={challengedTask} {...defaultProps} />);
    expect(screen.getByText(/Provider Defense Statement/)).toBeTruthy();
    expect(screen.getByText(presetDefense.statement)).toBeTruthy();
    expect(screen.getByText(presetDefense.defenseHash)).toBeTruthy();
  });

  it("shows Request Jury Verdict action button", () => {
    render(<Step5Evidence task={challengedTask} {...defaultProps} />);
    expect(screen.getByRole("button", { name: /Request Jury Verdict/ })).toBeTruthy();
  });

  it("shows real-mode tx records when present", () => {
    const realTask = task({
      status: "Challenged",
      mode: "real",
      challenge: challengeFixture,
      txRecords: [
        {
          label: "approveDeposit",
          policySignerRequestId: null,
          txHash: "0xaaa0000000000000000000000000000000000000000000000000000000000001",
          status: "confirmed"
        },
        {
          label: "openChallenge",
          policySignerRequestId: null,
          txHash: "0xbbb0000000000000000000000000000000000000000000000000000000000002",
          status: "confirmed"
        },
        {
          label: "defense",
          policySignerRequestId: null,
          txHash: "0xccc0000000000000000000000000000000000000000000000000000000000003",
          status: "confirmed"
        }
      ]
    });
    render(<Step5Evidence task={realTask} {...defaultProps} />);
    expect(screen.getByText("On-chain transactions")).toBeTruthy();
    // Should show all three tx labels
    expect(screen.getByText("Approve deposit + jury fee")).toBeTruthy();
    expect(screen.getByText("Open challenge")).toBeTruthy();
    expect(screen.getByText("Submit defense")).toBeTruthy();
  });
});

describe("Step5Evidence — ChallengeWon stage (jury verdict)", () => {
  const wonTask = task({
    status: "ChallengeWon",
    challenge: { ...challengeFixture, votes: votesFixture }
  });

  it("shows the 2:1 majority verdict heading", () => {
    render(<Step5Evidence task={wonTask} {...defaultProps} />);
    expect(screen.getByText(/Jury vote 2 : 1/)).toBeTruthy();
    expect(screen.getByText(/challenge upheld/)).toBeTruthy();
  });

  it("renders one neutral vote card per juror (no model-brand claims)", () => {
    render(<Step5Evidence task={wonTask} {...defaultProps} />);
    votesFixture.forEach((vote, i) => {
      expect(screen.getByTestId(`jury-vote-${vote.jurorId}`)).toBeTruthy();
      expect(screen.getByText(`Juror ${i + 1}`)).toBeTruthy();
      // Model brands are unverifiable claims — they must not render.
      expect(screen.queryByText(new RegExp(vote.modelFamily))).toBeNull();
    });
  });

  it("marks the dissenting vote and shows its reason book", () => {
    render(<Step5Evidence task={wonTask} {...defaultProps} />);
    expect(screen.getAllByText(/NotFault/).length).toBeGreaterThan(0);
    const dissent = votesFixture.find((v) => v.vote === "ProviderNotFault")!;
    expect(screen.getByText(dissent.reasonBook.conclusion)).toBeTruthy();
  });

  it("shows reason-book hashes (on-chain commitments)", () => {
    render(<Step5Evidence task={wonTask} {...defaultProps} />);
    for (const vote of votesFixture) {
      expect(screen.getByText(vote.reasonHash)).toBeTruthy();
    }
  });

  it("shows Execute Verdict button", () => {
    render(<Step5Evidence task={wonTask} {...defaultProps} />);
    expect(screen.getByRole("button", { name: /Execute Verdict/ })).toBeTruthy();
  });

  it("still shows materials panel (counterEvidenceHash) for reference", () => {
    render(<Step5Evidence task={wonTask} {...defaultProps} />);
    const hashes = screen.getAllByText(COUNTER_EVIDENCE_HASH);
    expect(hashes.length).toBeGreaterThan(0);
  });
});

describe("Step5Evidence — RefundedOrSlashed stage", () => {
  const resolvedTask = task({
    status: "RefundedOrSlashed",
    challenge: {
      ...challengeFixture,
      votes: votesFixture,
      resolvedTxHash: null
    }
  });

  it("shows Verdict executed heading", () => {
    render(<Step5Evidence task={resolvedTask} {...defaultProps} />);
    expect(screen.getAllByText(/Verdict executed/).length).toBeGreaterThan(0);
  });

  it("shows the fund action lines including the jury fee", () => {
    render(<Step5Evidence task={resolvedTask} {...defaultProps} />);
    expect(screen.getByText(/Slash 50% of the Provider performance bond/)).toBeTruthy();
    expect(screen.getByText(/Refund escrowed funds to the buyer/)).toBeTruthy();
    expect(screen.getByText(/Return challenger deposit \+ jury fee in full/)).toBeTruthy();
    expect(screen.getByText(/split across three jurors/)).toBeTruthy();
  });

  it("does not leak roadmap copy into the resolved view", () => {
    render(<Step5Evidence task={resolvedTask} {...defaultProps} />);
    expect(screen.queryByText(/future work/)).toBeNull();
  });

  it("shows resolve txHash with etherscan link in real mode", () => {
    const realResolvedTask = task({
      status: "RefundedOrSlashed",
      mode: "real",
      challenge: {
        ...challengeFixture,
        votes: votesFixture,
        resolvedTxHash: "0xffff000000000000000000000000000000000000000000000000000000000099"
      },
      txRecords: [
        {
          label: "resolve",
          policySignerRequestId: null,
          txHash: "0xffff000000000000000000000000000000000000000000000000000000000099",
          status: "confirmed"
        }
      ]
    });
    render(<Step5Evidence task={realResolvedTask} {...defaultProps} />);
    // Should show a shortened hash linked to etherscan
    const link = screen.getByRole("link", { name: /View verdict transaction on Injective Explorer/ });
    expect(link).toBeTruthy();
    expect((link as HTMLAnchorElement).href).toContain("testnet.blockscout.injective.network");
  });

  it("shows terminal audit prompt", () => {
    render(<Step5Evidence task={resolvedTask} {...defaultProps} />);
    expect(screen.getByText(/Challenge flow complete/)).toBeTruthy();
  });

  it("does not show Execute Verdict button (terminal state)", () => {
    render(<Step5Evidence task={resolvedTask} {...defaultProps} />);
    expect(screen.queryByRole("button", { name: /Execute Verdict/ })).toBeNull();
  });
});

describe("Step5Evidence — real-mode challenge explainer", () => {
  it("shows the challenge explainer at Delivered in real mode", () => {
    render(
      <Step5Evidence
        task={task({ mode: "real", status: "Delivered" })}
        {...defaultProps}
      />
    );
    expect(screen.getByText(/If you object to the Evidence Service Package/)).toBeTruthy();
  });

  it("does not show the challenge explainer in fixture mode", () => {
    render(
      <Step5Evidence
        task={task({ mode: "fixture", status: "Delivered" })}
        {...defaultProps}
      />
    );
    expect(screen.queryByText(/If you object to the Evidence Service Package/)).toBeNull();
  });
});

describe("Step5Evidence — no package", () => {
  it("shows waiting message when providerPackage is null", () => {
    render(
      <Step5Evidence
        task={task({ providerPackage: null })}
        {...defaultProps}
      />
    );
    expect(screen.getByText(/Waiting for Provider delivery/)).toBeTruthy();
  });
});

describe("Step5Evidence — legacy status badges (status labels)", () => {
  it("shows challenge in progress status text when status is Challenged", () => {
    render(
      <Step5Evidence
        task={task({ mode: "fixture", status: "Challenged", challenge: challengeFixture })}
        {...defaultProps}
      />
    );
    expect(screen.getAllByText(/Challenge in progress/).length).toBeGreaterThan(0);
  });

  it("shows challenge upheld status text when ChallengeWon", () => {
    render(
      <Step5Evidence
        task={task({
          mode: "fixture",
          status: "ChallengeWon",
          challenge: { ...challengeFixture, votes: votesFixture }
        })}
        {...defaultProps}
      />
    );
    expect(screen.getAllByText(/Challenge upheld/).length).toBeGreaterThan(0);
  });

  it("shows verdict executed status when RefundedOrSlashed", () => {
    render(
      <Step5Evidence
        task={task({
          mode: "fixture",
          status: "RefundedOrSlashed",
          challenge: { ...challengeFixture, votes: votesFixture }
        })}
        {...defaultProps}
      />
    );
    expect(screen.getAllByText(/Verdict executed/).length).toBeGreaterThan(0);
  });
});

// Agent spot check + on-chain commitment (real computations).
import { buildPackageCommitment } from "@proofmarket/shared/src/merkle";

/** Same content, real commitment root: both spot check and commitment verification are real computations. */
function withRealRoot(p: ProviderAnswerPackage): ProviderAnswerPackage {
  const { packageHash: _ignored, ...preimage } = p;
  return { ...p, packageHash: buildPackageCommitment(preimage).root };
}

const expertPkg: ProviderAnswerPackage = withRealRoot({
  ...pkg,
  coverageStatement:
    "This package is based on subscribed literature and industry research databases, covering 2021-2026 blockchain transaction execution acceleration.",
  answers: [
    {
      ...pkg.answers[0],
      sourceTitle:
        "Block-STM: Scaling Blockchain Execution by Turning Ordering Curse to a Performance Blessing",
      sourceLocator: "doi:10.1145/3572848.3577524",
      sourceLibrary: "acm-dl",
      excerptOrSummary:
        "Block-STM exploits optimistic concurrency control with a collaborative scheduler to execute ordered blockchain transactions in parallel while guaranteeing deterministic results."
    },
    {
      providerAnswer: "State hotspots constrain parallel speedup.",
      sourceTitle: "State Hotspots in High-Throughput Smart-Contract Execution",
      sourceLocator: "delphi:state-hotspots-2025",
      sourceLibrary: "delphi-digital",
      sourceMetadata: { year: 2025, type: "report" },
      excerptOrSummary:
        "Bench data shows serialization fallbacks on hot accounts erase most of the parallel speedup once contention crosses a modest threshold.",
      relevanceExplanation: "Constrains overclaiming."
    }
  ]
});

const shallowPkg: ProviderAnswerPackage = withRealRoot({
  ...pkg,
  providerId: "shallow-search-provider",
  providerName: "Fast Literature Search Agent",
  coverageStatement:
    "Claims broad coverage of 2021-2026 academic papers on blockchain execution acceleration (with IEEE Xplore / ACM Digital Library subscriptions).",
  answers: [
    {
      providerAnswer: "Performance gains mainly come from consensus and hardware.",
      sourceTitle: "A Survey of Blockchain Performance Optimization Techniques",
      sourceLocator: "doi:10.1109/COMST.2023.3310992",
      sourceLibrary: "ieee-xplore",
      sourceMetadata: { year: 2023, type: "paper" },
      excerptOrSummary:
        "The survey concludes that consensus upgrades and hardware improvements are the dominant sources of recent blockchain performance gains.",
      relevanceExplanation: "Survey-style source."
    },
    {
      providerAnswer: "Throughput benchmarks are determined by consensus parameters.",
      sourceTitle: "Consensus Throughput Benchmarks Revisited",
      sourceLocator: "doi:10.1109/INFOCOM.2024.1187",
      sourceLibrary: "ieee-xplore",
      sourceMetadata: { year: 2024, type: "paper" },
      excerptOrSummary:
        "Benchmark variance is explained primarily by consensus parameters.",
      relevanceExplanation: "Supports a consensus-centered narrative."
    }
  ]
});

describe("Step5Evidence — Agent spot check (scope-matched, real computations)", () => {
  it("expert package: samples in scope and present, no failure strip", () => {
    render(<Step5Evidence task={task({ providerPackage: expertPkg })} {...defaultProps} />);
    expect(screen.getByTestId("agent-spot-check")).toBeTruthy();
    expect(screen.queryByTestId("spot-check-failed")).toBeNull();
    expect(screen.getAllByText(/included in the Evidence Service Package/).length).toBe(2);
  });

  it("expert package: source-accuracy rows pass the real corpus comparison", () => {
    render(<Step5Evidence task={task({ providerPackage: expertPkg })} {...defaultProps} />);
    expect(screen.getAllByText(/excerpt matches local archive/).length).toBe(2);
    expect(screen.queryByText(/excerpt contradicts local archive/)).toBeNull();
  });

  it("a tampered excerpt fails the corpus comparison (red, not copy)", () => {
    const tampered = withRealRoot({
      ...expertPkg,
      answers: [
        {
          ...expertPkg.answers[0],
          excerptOrSummary:
            "Block-STM guarantees linear speedup for every workload."
        },
        expertPkg.answers[1]
      ]
    });
    render(<Step5Evidence task={task({ providerPackage: tampered })} {...defaultProps} />);
    expect(screen.getAllByText(/excerpt contradicts local archive/).length).toBe(1);
    expect(screen.getByTestId("spot-check-failed").textContent).toContain("Source Accuracy");
  });

  it("shallow package: dual failure — excerpt mismatch AND in-scope coverage miss", () => {
    render(<Step5Evidence task={task({ providerPackage: shallowPkg })} {...defaultProps} />);
    const strip = screen.getByTestId("spot-check-failed");
    expect(strip.textContent).toContain("Source Accuracy");
    expect(strip.textContent).toContain("Coverage Completeness");
    expect(screen.getAllByText(/excerpt contradicts local archive/).length).toBe(1);
    expect(screen.getAllByText(/missing from the package and inside the Coverage Statement/).length).toBe(1);
    expect(screen.getAllByText(/outside the Coverage Statement/).length).toBe(1);
  });

  it("sources absent from the local corpus are skipped, not failed", () => {
    render(<Step5Evidence task={task({ providerPackage: shallowPkg })} {...defaultProps} />);
    expect(screen.getAllByText(/local archive does not contain this source; skipped/).length).toBe(1);
  });

  it("shallow package: secondary action becomes Build Challenge Package and Open Challenge", () => {
    render(<Step5Evidence task={task({ providerPackage: shallowPkg })} {...defaultProps} />);
    expect(screen.getByRole("button", { name: "Build Challenge Package and Open Challenge" })).toBeTruthy();
  });

  it("expert package keeps the plain Open Challenge action", () => {
    render(<Step5Evidence task={task({ providerPackage: expertPkg })} {...defaultProps} />);
    expect(screen.getByRole("button", { name: "Open Challenge" })).toBeTruthy();
  });

  it("on-chain commitment shows a single real verification row, no structure internals", () => {
    render(<Step5Evidence task={task({ providerPackage: expertPkg })} {...defaultProps} />);
    expect(screen.getAllByText(/matches the Provider-signed on-chain package hash/).length).toBe(1);
    expect(screen.queryByText(/commitment structure/)).toBeNull();
    expect(screen.queryByText(/Merkle/)).toBeNull();
  });
});

describe("Step5Evidence — challenge materials rigor rows", () => {
  it("Challenge Package shows the counter-evidence library subscription and jury assignment basis", () => {
    render(
      <Step5Evidence
        task={task({ status: "Challenged", challenge: challengeFixture })}
        {...defaultProps}
      />
    );
    expect(screen.getAllByText(/Counter-evidence library/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Jury assignment basis/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Paid subscription/).length).toBeGreaterThan(0);
  });

  it("every jury vote card carries an Original-text check row", () => {
    render(
      <Step5Evidence
        task={task({
          status: "ChallengeWon",
          challenge: { ...challengeFixture, votes: votesFixture }
        })}
        {...defaultProps}
      />
    );
    expect(screen.getAllByText("Original-text check").length).toBe(votesFixture.length);
    expect(screen.getAllByText(/ACM (Digital Library subscription|DL access)|retrieved doi:10\.1145\/3572848\.3577524/).length).toBeGreaterThan(0);
  });
});
