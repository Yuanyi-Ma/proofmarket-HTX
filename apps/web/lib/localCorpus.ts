// 用户侧本地资料库（demo 内置快照）：locator → 本地存有的原文段落。
// 查准抽检是对这份数据的真实子串比对——摘录必须逐字出现在本地段落里才算
// 通过；本地存有该来源但摘录对不上 = 比对失败（红）；本地没有该来源则跳过
// 不抽（灰）。这模拟用户 Agent 手里那份不完整但可信的本地库：覆盖度有限
// （所以查全只能抽样），但已有的内容是逐字可对的。
//
// 注意 doi:10.1109/COMST.2023.3310992：本地存档的真实结论是"执行层并行化
// 主导近年吞吐提升"，与速查 Agent 证据服务包里那句"共识与硬件主导"相矛盾——
// 这条比对失败不是缺数据，是证据服务包摘录被改写过（查准失败的演示样本）。
export const LOCAL_CORPUS: Record<string, string> = {
  "doi:10.1145/3572848.3577524":
    "(Local archive, ACM DL copy, PPoPP '23, §1) Block-STM exploits optimistic concurrency control with a collaborative scheduler to execute ordered blockchain transactions in parallel while guaranteeing deterministic results. The engine is deployed on the Aptos mainnet.",
  "doi:10.1109/TPDS.2025.3412067":
    "(Local archive, IEEE Xplore copy, §4) Even when the scheduler admits full parallelism, contention on hot state keys and storage I/O can dominate end-to-end execution latency. Hot-state partitioning recovers most of the lost speedup in the evaluated traces.",
  "delphi:state-hotspots-2025":
    "(Local archive, Delphi Digital 2025 execution-layer report, p.14) Bench data shows serialization fallbacks on hot accounts erase most of the parallel speedup once contention crosses a modest threshold.",
  "doi:10.1109/COMST.2023.3310992":
    "(Local archive, IEEE Xplore copy, §7 Conclusions) The survey concludes that execution-layer parallelism — rather than consensus upgrades or hardware alone — accounts for the majority of recent end-to-end blockchain performance gains."
};
