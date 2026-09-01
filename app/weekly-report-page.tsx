import Link from "next/link";

import {formatPrimaryInvestors, type WeeklyPreviewReport, type WeeklyPreviewSampleEvent} from "@/lib/site/weekly-preview";

const subcategoryLabels: Record<string, string> = {
  FULL_STACK_ROBOT: "全栈机器人", ROBOT_BODY: "机器人本体", VLA_WORLD_MODEL: "VLA / 世界模型",
  ROBOT_FOUNDATION_MODEL: "机器人基础模型", OTHER_EMBODIED_AI: "其他具身智能",
  ROBOT_CORE_UPSTREAM: "机器人核心上下游", PHYSICAL_AI_INFRASTRUCTURE: "Physical AI 基础设施",
  ROBOT_RELATED_TECH: "机器人相关技术", AUTONOMOUS_PHYSICAL_SYSTEM: "自主物理系统",
  GENERAL_AI: "泛 AI", AUTONOMOUS_DRIVING: "自动驾驶", OTHER_RELATED_TECH: "其他相关技术",
};

function regionLabel(region: WeeklyPreviewSampleEvent["regionScope"]): string | null {
  return region === "CHINA" ? "中国" : region === "OVERSEAS" ? "海外" : null;
}

function InvestorGroup({label, names}: {label: string; names: readonly string[]}) {
  return names.length > 0 ? <div className="detail-row"><dt>{label}</dt><dd>{names.join("、")}</dd></div> : null;
}

function EventCard({event, index, section}: {event: WeeklyPreviewSampleEvent; index: number; section: "p1" | "p2"}) {
  const source = event.sources[0];
  const region = regionLabel(event.regionScope);
  const titleId = `${section}-event-${index}-title`;
  return <article className="event-card" aria-labelledby={titleId}>
    <header className="card-header"><div><p className="event-number">NO. {String(index + 1).padStart(2, "0")}</p><h2 id={titleId}>{event.companyDisplayName}</h2></div>
      <div className="badges" aria-label="事件分类"><span className="badge badge-tier">{event.relevanceTier}</span><span className="badge">{subcategoryLabels[event.relevanceSubcategory] ?? "具身智能"}</span></div></header>
    <p className="introduction">{event.introduction}</p>
    <dl className="facts">{event.round && <div><dt>轮次</dt><dd>{event.round}</dd></div>}{event.amount && <div><dt>金额</dt><dd>{event.amount}</dd></div>}{region && <div><dt>地域</dt><dd>{region}</dd></div>}</dl>
    <dl className="details"><InvestorGroup label="领投方" names={event.leadInvestors} /><InvestorGroup label="跟投 / 其他投资方" names={[...event.followInvestors, ...event.otherInvestors]} /></dl>
    {event.products.length > 0 && <section className="products" aria-label="主要产品"><h3>主要产品</h3><ul>{event.products.map((product) => <li key={product}>{product}</li>)}</ul></section>}
    <footer className="card-footer"><nav aria-label={`${event.companyDisplayName}公开链接`}>
      {event.officialWebsite && <a href={event.officialWebsite} target="_blank" rel="noopener noreferrer">公司官网</a>}
      <a href={source.url} target="_blank" rel="noopener noreferrer">来源1{source.publishedAt ? <time> · {source.publishedAt}</time> : null}</a>
    </nav></footer>
  </article>;
}

function roundAndStatus(event: WeeklyPreviewSampleEvent): string {
  return event.round && !/^(已完成|已上市)$/.test(event.financingStatus) ? `${event.round} · ${event.financingStatus}` : event.round ?? event.financingStatus ?? "未明确";
}

function P3Table({events}: {events: readonly WeeklyPreviewSampleEvent[]}) {
  return <div className="p3-table-frame"><table className="p3-table"><thead><tr><th>公司</th><th>行业与业务</th><th>资本事件</th><th>轮次 / 状态</th><th>金额</th><th>主要投资方</th><th>报道日期</th><th>来源1</th></tr></thead><tbody>
    {events.map((event) => { const source = event.sources[0]; return <tr key={event.companyDisplayName}>
      <th scope="row" data-label="公司">{event.companyDisplayName}</th><td data-label="行业与业务"><span className="industry-tag">{event.industryLabel}</span><span className="business-label">{event.businessLabel}</span></td>
      <td data-label="资本事件">{event.capitalEventLabel ?? "资本动态"}</td><td data-label="轮次 / 状态">{roundAndStatus(event)}</td><td data-label="金额">{event.amount ?? "未披露"}</td>
      <td data-label="主要投资方">{formatPrimaryInvestors(event)}</td><td data-label="报道日期">{source.publishedAt ?? "未明确"}</td><td data-label="来源1"><a href={source.url} target="_blank" rel="noopener noreferrer">来源1</a></td>
    </tr>; })}
  </tbody></table></div>;
}

function displayWeek(start: string, end: string) { return `${start.replaceAll("-", ".")}–${end.slice(5).replace("-", ".")}`; }

const weekOptions = [
  {weekStart: "2026-08-24", href: "/", label: "本周 · 08.24—08.30"},
  {weekStart: "2026-08-17", href: "/archive/2026-08-17-to-2026-08-23", label: "往期 · 08.17—08.23"},
  {weekStart: "2026-08-10", href: "/archive/2026-08-10-to-2026-08-16", label: "往期 · 08.10—08.16"},
  {weekStart: "2026-08-03", href: "/archive/2026-08-03-to-2026-08-09", label: "往期 · 08.03—08.09"},
] as const;

export function WeeklyReportPage({report}: {report: WeeklyPreviewReport}) {
  const {counts, events, p1Events, p2Events, p3Events, highlight} = report;
  const isArchive = report.weekStart !== "2026-08-24";
  return <main>
    <nav className="week-switcher" aria-label="周报版本">{weekOptions.map((week) => <Link key={week.weekStart} href={week.href} aria-current={report.weekStart === week.weekStart ? "page" : undefined}>{week.label}</Link>)}</nav>
    <header className="report-header"><div className="preview-line"><span className="preview-badge">{isArchive ? "历史周报" : "本周预览"} · {counts.public}条</span><span>非飞书正式发布</span></div>
      <p className="eyebrow">EMBODIED INTELLIGENCE · WEEKLY BRIEF</p><h1>具身智能公司动态周报</h1><p className="issue-date">{displayWeek(report.weekStart, report.weekEnd)}</p>
      <p className="deck">聚焦具身智能、Physical AI 与硬科技资本动态。P1/P2 使用完整简介卡片，P3 使用紧凑行业表格。</p>
      <dl className="statistics" aria-label="本周事件统计"><div><dt>收集</dt><dd>{counts.original}</dd></div><div><dt>周报收录</dt><dd>{counts.public}</dd></div><div><dt>P1</dt><dd>{counts.P1}</dd></div><div><dt>P2</dt><dd>{counts.P2}</dd></div><div><dt>P3</dt><dd>{counts.P3}</dd></div></dl>
      <div className="weekly-context"><section className="amount-highlight"><p>本周已披露最高资本金额</p><h2><span>{highlight.company}</span>{highlight.amount}</h2><p>{highlight.event} · {highlight.status}</p><small>{highlight.scopeNote}</small></section>
        <section className="tier-guide"><div className="tier-guide-heading"><p>相关度分层依据</p><h2>P1 / P2 / P3</h2></div><dl><div><dt>P1</dt><dd>具身智能直接相关：机器人本体、全栈机器人、VLA、世界模型、机器人基础模型与学习控制平台。</dd></div><div><dt>P2</dt><dd>关键上下游或强相关技术：机器人核心部件、感知与执行、仿真和数据、Physical AI，以及泛 AI 与自动驾驶。</dd></div><div><dt>P3</dt><dd>具备技术壁垒、但与具身智能暂无明确直接联系的其他硬科技，包括半导体、材料、航天、能源、量子与生物医药。</dd></div></dl><p className="tier-note">P1–P3 表示与具身智能主题的相关程度，不代表融资金额、公司质量或投资建议。</p></section></div>
      <p className="sample-note">周报收录 {events.length} 条：P1 {counts.P1}、P2 {counts.P2}、P3 {counts.P3}。</p></header>
    <section className="events"><div className="section-heading"><p>P1 · DIRECTLY RELEVANT</p><h2>具身智能重点融资</h2></div>{p1Events.map((event, index) => <EventCard key={event.companyDisplayName} event={event} index={index} section="p1" />)}</section>
    <section className="events"><div className="section-heading"><p>P2 · ADJACENT TECHNOLOGY</p><h2>核心上下游与相邻技术</h2></div>{p2Events.map((event, index) => <EventCard key={event.companyDisplayName} event={event} index={index} section="p2" />)}</section>
    <section className="events p3-section"><div className="section-heading"><p>P3 · HARD TECHNOLOGY</p><h2>其他硬科技资本动态</h2></div><P3Table events={p3Events} /></section>
  </main>;
}
