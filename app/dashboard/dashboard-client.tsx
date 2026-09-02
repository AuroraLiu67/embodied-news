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
  currency: "CNY" | "USD" | "HKD" | "EUR" | null;
  financingStatus: string;
  investors: string;
  business: string;
  sourceUrl: string;
};

type AmountSummary = {
  currencyNormalization: {rateDate: string; usdToCny: number; eurToCny: number; note: string; sourceUrl: string};
  singleRoundRanking: Array<{rank: number; company: string; originalAmount: string; normalizedAmount: string; basis: string}>;
};

const tierOrder = ["P1", "P2", "P3"] as const;

type RankingItem = DashboardRow & {cnyAmount: number; normalizedAmount: string};

function amountMagnitude(amount: string): number | null {
  const numeric = /([0-9]+(?:\.[0-9]+)?)/.exec(amount)?.[1];
  if (numeric) {
    const value = Number(numeric);
    if (/亿/.test(amount)) return value * 100_000_000;
    if (/万/.test(amount)) return value * 10_000;
    return value;
  }
  if (/数十亿/.test(amount)) return 1_000_000_000;
  if (/数亿|亿元|亿(?:美元|欧元|港元)/.test(amount)) return 100_000_000;
  if (/数千万/.test(amount)) return 20_000_000;
  if (/千万/.test(amount)) return 10_000_000;
  if (/数百万/.test(amount)) return 2_000_000;
  if (/百万/.test(amount)) return 1_000_000;
  return null;
}

function normalizedLabel(value: number, original: string): string {
  const qualifier = original.startsWith("超") ? "超" : original.startsWith("近") ? "近" : original.startsWith("约") ? "约" : /数/.test(original) ? "约" : "";
  const suffix = /数/.test(original) ? "起" : "";
  const yi = value / 100_000_000;
  return `${qualifier}${yi >= 10 ? yi.toFixed(2).replace(/\.00$/, "") : yi.toFixed(2).replace(/0$/, "").replace(/\.0$/, "")}亿元${suffix}`;
}

export function buildDomesticRanking(
  rows: DashboardRow[],
  week: string,
  rates: AmountSummary["currencyNormalization"],
): RankingItem[] {
  const seenCompanies = new Set<string>();
  return rows
    .filter((row) => row.region === "CHINA" && (week === "ALL" || row.weekStart === week))
    .filter((row) => !/累计|合计|连续.*轮|两轮|三轮|IPO|上市|发行价|市值|拟募资|拟融资|拟增资|融资意向|寻求融资|进行中/i.test(`${row.round ?? ""} ${row.amount ?? ""} ${row.financingStatus}`))
    .flatMap((row) => {
      if (!row.amount) return [];
      const primaryAmount = row.amount.split(/[（(；;]/, 1)[0] ?? row.amount;
      const magnitude = amountMagnitude(primaryAmount);
      if (!magnitude) return [];
      const primaryCurrency = /美元/.test(primaryAmount) ? "USD" : /欧元/.test(primaryAmount) ? "EUR" : /港元/.test(primaryAmount) ? "HKD" : /元/.test(primaryAmount) ? "CNY" : row.currency;
      const rate = primaryCurrency === "USD" ? rates.usdToCny : primaryCurrency === "EUR" ? rates.eurToCny : primaryCurrency === "CNY" ? 1 : null;
      if (!rate) return [];
      const cnyAmount = magnitude * rate;
      return [{...row, cnyAmount, normalizedAmount: normalizedLabel(cnyAmount, primaryAmount)}];
    })
    .sort((left, right) => right.cnyAmount - left.cnyAmount || left.id.localeCompare(right.id, "zh-CN"))
    .filter((item) => {
      if (seenCompanies.has(item.company)) return false;
      seenCompanies.add(item.company);
      return true;
    })
    .slice(0, 10);
}

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
  const ranking = useMemo(() => buildDomesticRanking(rows, week, amountSummary.currencyNormalization), [amountSummary.currencyNormalization, rows, week]);
  const rankingMaximum = Math.max(1, ...ranking.map((item) => item.cnyAmount));
  const rankingLabel = week === "ALL" ? "全部四期" : weeks.find(([value]) => value === week)?.[1] ?? week;

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
      <article className="dashboard-panel dashboard-ranking-panel"><div className="section-heading"><p>CHINA ONLY · {rankingLabel}</p><h2>国内单轮融资 TOP 10</h2></div><ol className="dashboard-ranking">{ranking.map((item, index) => <li key={item.id}><span>{index + 1}</span><div className="dashboard-ranking-name"><strong>{item.company}</strong><small>{item.amount} · {item.round ?? "轮次未披露"}</small></div><div className="dashboard-ranking-measure"><b>{item.normalizedAmount}</b><div aria-hidden="true"><i style={{width: `${item.cnyAmount / rankingMaximum * 100}%`}} /></div></div></li>)}</ol><p className="dashboard-source">榜单随周次切换；全部四期按同一汇率口径比较。按 {amountSummary.currencyNormalization.rateDate} 中间价折算；<a href={amountSummary.currencyNormalization.sourceUrl} target="_blank" rel="noopener noreferrer">汇率来源</a></p></article>
    </section>
    <section className="dashboard-detail"><div className="section-heading"><p>PUBLIC EVENTS</p><h2>融资事件明细</h2></div><p className="dashboard-result-note">当前显示 {filtered.length} 条</p><div className="dashboard-table-frame"><table><thead><tr><th>周次</th><th>公司</th><th>层级</th><th>地域</th><th>轮次</th><th>金额</th><th>投资方</th><th>业务</th><th>来源</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id}><td>{row.weekLabel}</td><th scope="row">{row.company}</th><td>{row.tier}</td><td>{row.region === "CHINA" ? "中国" : row.region === "OVERSEAS" ? "海外" : "未明确"}</td><td>{row.round ?? "未披露"}</td><td>{row.amount ?? "未披露"}</td><td>{row.investors}</td><td>{row.business}</td><td><a href={row.sourceUrl} target="_blank" rel="noopener noreferrer">来源</a></td></tr>)}</tbody></table></div></section>
  </main>;
}
