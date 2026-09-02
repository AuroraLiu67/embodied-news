"use client";

import {useMemo, useState} from "react";

export type DashboardRow = {
  id: string;
  weekStart: string;
  weekLabel: string;
  company: string;
  tier: "P1" | "P2" | "P3";
  region: "CHINA" | "OVERSEAS" | null;
  round: string | null;
  amount: string | null;
  investors: string;
  business: string;
  sourceUrl: string;
};

type AmountSummary = {
  currencyNormalization: {rateDate: string; usdToCny: number; eurToCny: number; note: string; sourceUrl: string};
  singleRoundRanking: Array<{rank: number; company: string; originalAmount: string; normalizedAmount: string; basis: string}>;
};

const tierOrder = ["P1", "P2", "P3"] as const;

export function DashboardClient({rows, amountSummary, basePath}: {rows: DashboardRow[]; amountSummary: AmountSummary; basePath: string}) {
  const [week, setWeek] = useState("ALL");
  const [tier, setTier] = useState("ALL");
  const [region, setRegion] = useState("ALL");
  const [query, setQuery] = useState("");
  const weeks = useMemo(() => [...new Map(rows.map((row) => [row.weekStart, row.weekLabel])).entries()], [rows]);
  const filtered = useMemo(() => rows.filter((row) =>
    (week === "ALL" || row.weekStart === week) &&
    (tier === "ALL" || row.tier === tier) &&
    (region === "ALL" || row.region === region) &&
    `${row.company} ${row.business} ${row.investors}`.toLowerCase().includes(query.trim().toLowerCase()),
  ), [query, region, rows, tier, week]);
  const tierCounts = tierOrder.map((item) => ({tier: item, count: filtered.filter((row) => row.tier === item).length}));
  const maxTierCount = Math.max(1, ...tierCounts.map((item) => item.count));
  const disclosed = filtered.filter((row) => row.amount).length;

  return <main className="dashboard-page">
    <nav className="site-tabs" aria-label="网站栏目"><a href={`${basePath}/`}>周报</a><a href={`${basePath}/dashboard`} aria-current="page">融资数据面板</a></nav>
    <header className="dashboard-header"><p className="eyebrow">INTERACTIVE FUNDING DATA</p><h1>融资数据面板</h1><p className="deck">浏览四期公开周报数据；筛选与搜索均在浏览器本地完成，不包含飞书候选或内部备注。</p></header>
    <section className="dashboard-filters" aria-label="数据筛选">
      <label>周次<select value={week} onChange={(event) => setWeek(event.target.value)}><option value="ALL">全部四期</option>{weeks.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>相关度<select value={tier} onChange={(event) => setTier(event.target.value)}><option value="ALL">全部层级</option>{tierOrder.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>地域<select value={region} onChange={(event) => setRegion(event.target.value)}><option value="ALL">全部地域</option><option value="CHINA">中国</option><option value="OVERSEAS">海外</option></select></label>
      <label className="dashboard-search">搜索<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="公司、业务或投资方" /></label>
    </section>
    <section className="dashboard-metrics" aria-label="筛选结果概览"><div><span>事件</span><strong>{filtered.length}</strong></div><div><span>披露金额</span><strong>{disclosed}</strong></div><div><span>中国</span><strong>{filtered.filter((row) => row.region === "CHINA").length}</strong></div><div><span>海外</span><strong>{filtered.filter((row) => row.region === "OVERSEAS").length}</strong></div></section>
    <section className="dashboard-grid">
      <article className="dashboard-panel"><div className="section-heading"><p>DISTRIBUTION</p><h2>相关度分布</h2></div><div className="tier-bars">{tierCounts.map((item) => <div key={item.tier}><span>{item.tier}</span><div><i style={{width: `${item.count / maxTierCount * 100}%`}} /></div><strong>{item.count}</strong></div>)}</div></article>
      <article className="dashboard-panel"><div className="section-heading"><p>CHINA ONLY · CURRENT ISSUE</p><h2>国内单轮融资 TOP 10</h2></div><ol className="dashboard-ranking">{amountSummary.singleRoundRanking.map((item) => <li key={item.company}><span>{item.rank}</span><strong>{item.company}</strong><b>{item.normalizedAmount}</b><small>{item.originalAmount} · {item.basis}</small></li>)}</ol><p className="dashboard-source">按 {amountSummary.currencyNormalization.rateDate} 中间价折算；<a href={amountSummary.currencyNormalization.sourceUrl} target="_blank" rel="noopener noreferrer">汇率来源</a></p></article>
    </section>
    <section className="dashboard-detail"><div className="section-heading"><p>PUBLIC EVENTS</p><h2>融资事件明细</h2></div><p className="dashboard-result-note">当前显示 {filtered.length} 条</p><div className="dashboard-table-frame"><table><thead><tr><th>周次</th><th>公司</th><th>层级</th><th>地域</th><th>轮次</th><th>金额</th><th>投资方</th><th>业务</th><th>来源</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id}><td>{row.weekLabel}</td><th scope="row">{row.company}</th><td>{row.tier}</td><td>{row.region === "CHINA" ? "中国" : row.region === "OVERSEAS" ? "海外" : "未明确"}</td><td>{row.round ?? "未披露"}</td><td>{row.amount ?? "未披露"}</td><td>{row.investors}</td><td>{row.business}</td><td><a href={row.sourceUrl} target="_blank" rel="noopener noreferrer">来源</a></td></tr>)}</tbody></table></div></section>
  </main>;
}
