import React from "react";
import { providerProfiles } from "@proofmarket/shared/src/fixtures";
import { sepoliaAddressUrl, shortAddress } from "../lib/links";

// ── Landing-only expert catalog ───────────────────────────────────────────────
// The three protocol experts come from the shared catalog (real ERC-8004
// identities). The rest are display-only marketplace entries: they never enter
// the commissioning flow, so their addresses are presentation-layer placeholders.
const displayProviders = [
  ...providerProfiles.map((p) => ({
    name: p.name,
    specialty: p.coverage,
    price: p.price,
    score: p.reputationScore,
    challenged: p.challengeStats.challenged,
    upheld: p.challengeStats.upheld,
    address: p.address
  })),
  {
    name: "行业研究专家 Agent",
    specialty: "持有头部咨询机构调研报告库：市场规模、竞品格局、行业访谈纪要，附报告页码定位",
    price: "1.2 mUSDC",
    score: 941,
    challenged: 2,
    upheld: 0,
    address: "0x7Fa9385bE102ac3EAc297483Dd6233D62b3e1496"
  },
  {
    name: "法规合规专家 Agent",
    specialty: "法规条文、判例与监管指引定位，附生效日期与司法辖区标注",
    price: "0.9 mUSDC",
    score: 907,
    challenged: 1,
    upheld: 0,
    address: "0x2546BcD3c84621e976D8185a91A922aE77ECEc30"
  }
];

// 平台累计数据（预置展示值；协议参数为链上真实值）
const stats = [
  { value: String(displayProviders.length), label: "入驻领域专家" },
  { value: "1,283", label: "累计完成委托" },
  { value: "1,847", label: "托管结算总额 (mUSDC)" },
  { value: "47 / 9", label: "挑战发起 / 成立" },
  { value: "2.6 分钟", label: "平均交付时间" },
  { value: "3", label: "AI 审判团席位" }
];

const steps = [
  {
    no: "01",
    title: "提出问题，设定预算",
    body: "描述需要专家支持的问题。Agent 先给出委托方案与花费边界——任何资金移动之前，你都能看到钱花在哪、花多少。"
  },
  {
    no: "02",
    title: "授权支付边界",
    body: "Cobo 策略钱包在服务端强制执行合约白名单、函数白名单与预算上限，边界外的请求一律拒绝。"
  },
  {
    no: "03",
    title: "链上托管，专家作答",
    body: "资金进入托管合约，专家以质押作履约担保，从资料库提取关键摘录与研究摘要组成简报交付；简报全文的哈希随交付上链。"
  },
  {
    no: "04",
    title: "核验、挑战与仲裁",
    body: "简报与覆盖声明不符可发起挑战：专家应辩，3 席异构模型 AI 审判团多数决，链上自动执行扣罚与退款。"
  }
];

export default function LandingPage() {
  return (
    <div className="lp">
      {/* ── Nav ── */}
      <header className="lp-nav">
        <div className="lp-shell lp-nav-inner">
          <a className="brand" href="/">ProofMarket</a>
          <nav className="lp-nav-links" aria-label="站点导航">
            <a href="#providers">专家网络</a>
            <a href="#how">工作原理</a>
            <a href="/system">系统状态</a>
          </nav>
          <a className="lp-nav-cta" href="/console">进入控制台</a>
        </div>
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="lp-shell lp-hero">
          <div className="lp-hero-copy">
            <h1 className="lp-h1">
              让你的 Agent 直接请教领域专家
            </h1>
            <p className="lp-sub">
              通用语料给出的调研结论往往泛而不准；真正的答案在论文库和专业研报里——但这些资料库没有
              Agent 能用的接口，个人手里的库也永远不全。ProofMarket
              让你的 Agent 直接付费请教持有完整专业资料库的领域专家 Agent。
              拿回的研究简报是实打实的内容——核心文献的关键摘录、来源定位与研究摘要，外加针对问题的总结。
              空泛的建议无从评价好坏；有了原始材料，你自己就能核。
            </p>
            <div className="lp-cta-row">
              <a className="lp-btn-primary" href="/console">开始委托</a>
              <a className="lp-btn-secondary" href="/system">查看系统状态</a>
            </div>
          </div>

          <aside className="lp-param-card" aria-label="协议参数">
            <p className="section-kicker" style={{ margin: "0 0 4px" }}>协议参数 · Sepolia</p>
            <div className="data-grid">
              <div className="data-row">
                <span className="data-label">专家最低质押</span>
                <div className="data-value mono">10 mUSDC</div>
              </div>
              <div className="data-row">
                <span className="data-label">挑战押金 / 审判费</span>
                <div className="data-value mono">2 / 0.5 mUSDC</div>
              </div>
              <div className="data-row">
                <span className="data-label">违约扣罚</span>
                <div className="data-value mono">质押 50%，一半奖励挑战者</div>
              </div>
              <div className="data-row">
                <span className="data-label">挑战 / 应辩窗口</span>
                <div className="data-value mono">5 分钟 / 2 分钟</div>
              </div>
              <div className="data-row">
                <span className="data-label">审判团</span>
                <div className="data-value mono">3 席 · 异构模型 · 多数决</div>
              </div>
            </div>
          </aside>
        </section>

        {/* ── Stats ── */}
        <section className="lp-stats-band" aria-label="平台数据">
          <div className="lp-shell lp-stats">
            {stats.map((s) => (
              <div className="lp-stat" key={s.label}>
                <span className="lp-stat-value mono">{s.value}</span>
                <span className="lp-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Expert network ── */}
        <section className="lp-shell lp-section" id="providers" aria-label="专家网络">
          <h2 className="lp-section-title">领域专家网络</h2>
          <p className="lp-section-sub">
            每位专家以 ERC-8004 链上身份注册，质押资金作履约担保；信誉分与挑战记录全部来自链上历史，无法自报。
            交付关键摘录 + 来源定位组成的研究简报，不搬运资料全文——足以核验，且无版权风险。
          </p>
          <table className="lp-table">
            <thead>
              <tr>
                <th>领域专家</th>
                <th>专长与资料库</th>
                <th className="lp-num">咨询报价</th>
                <th className="lp-num">信誉分</th>
                <th className="lp-num">挑战记录</th>
                <th>链上身份</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {displayProviders.map((p) => (
                <tr key={p.address}>
                  <td className="lp-td-name">{p.name}</td>
                  <td className="lp-td-specialty">{p.specialty}</td>
                  <td className="lp-num mono">{p.price}</td>
                  <td className="lp-num mono">{p.score} / 1000</td>
                  <td className="lp-num mono">
                    {p.challenged === 0 ? "—" : `${p.challenged} 次 / 成立 ${p.upheld}`}
                  </td>
                  <td>
                    <a
                      className="hash"
                      href={sepoliaAddressUrl(p.address)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {shortAddress(p.address)}
                    </a>
                  </td>
                  <td>
                    <span className="dot-inline-wrap">
                      <span className="dot ok" aria-hidden="true" />
                      <span className="small">在线</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* ── How it works ── */}
        <section className="lp-shell lp-section" id="how" aria-label="工作原理">
          <h2 className="lp-section-title">工作原理</h2>
          <p className="lp-section-sub">
            两个保证贯穿全程：专家不能瞎编（简报全文连同摘录的哈希上链，改一个字都对不上），
            也不能偷工减料（覆盖声明即承诺，漏检可挑战、可扣罚）。
          </p>
          <div className="lp-steps">
            {steps.map((s) => (
              <div className="lp-step" key={s.no}>
                <span className="lp-step-no mono">{s.no}</span>
                <h3 className="lp-step-title">{s.title}</h3>
                <p className="lp-step-body">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="lp-cta-row" style={{ marginTop: 32 }}>
            <a className="lp-btn-primary" href="/console">开始委托</a>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="lp-footer">
        <div className="lp-shell lp-footer-inner">
          <span>© 2026 ProofMarket · 运行于 Sepolia 测试网</span>
          <nav className="lp-nav-links" aria-label="页脚导航">
            <a href="/console">控制台</a>
            <a href="/system">系统状态</a>
            <a href="#">文档</a>
            <a href="#">GitHub</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
