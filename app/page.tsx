import {formatPrimaryInvestors, weeklyPreviewHighlight, weeklyPreviewSample, type WeeklyPreviewSampleEvent} from "@/lib/site/weekly-preview";

const subcategoryLabels: Record<string, string> = {
  FULL_STACK_ROBOT: "全栈机器人",
  ROBOT_BODY: "机器人本体",
  VLA_WORLD_MODEL: "VLA / 世界模型",
  ROBOT_FOUNDATION_MODEL: "机器人基础模型",
  OTHER_EMBODIED_AI: "其他具身智能",
  ROBOT_CORE_UPSTREAM: "机器人核心上下游",
  PHYSICAL_AI_INFRASTRUCTURE: "Physical AI 基础设施",
  GENERAL_AI: "泛 AI",
  AUTONOMOUS_DRIVING: "自动驾驶",
  OTHER_RELATED_TECH: "其他相关技术",
};

function regionLabel(region: WeeklyPreviewSampleEvent["regionScope"]): string | null {
  if (region === "CHINA") return "中国";
  if (region === "OVERSEAS") return "海外";
  return null;
}

function InvestorGroup({label, names}: {label: string; names: readonly string[]}) {
  if (names.length === 0) return null;
  return (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd>{names.join("、")}</dd>
    </div>
  );
}

function EventCard({event, index, section}: {event: WeeklyPreviewSampleEvent; index: number; section: "p1" | "p2"}) {
  const region = regionLabel(event.regionScope);
  const supportingInvestors = [...event.followInvestors, ...event.otherInvestors];
  const titleId = `${section}-event-${index}-title`;
  return (
    <article className="event-card" aria-labelledby={titleId}>
      <header className="card-header">
        <div>
          <p className="event-number">NO. {String(index + 1).padStart(2, "0")}</p>
          <h2 id={titleId}>{event.companyDisplayName}</h2>
        </div>
        <div className="badges" aria-label="事件分类">
          <span className="badge badge-tier">{event.relevanceTier}</span>
          <span className="badge">{subcategoryLabels[event.relevanceSubcategory] ?? "具身智能"}</span>
        </div>
      </header>

      <p className="introduction">{event.introduction}</p>

      <dl className="facts" aria-label={`${event.companyDisplayName}融资信息`}>
        {event.round && <div><dt>轮次</dt><dd>{event.round}</dd></div>}
        {event.amount && <div><dt>金额</dt><dd>{event.amount}</dd></div>}
        {region && <div><dt>地域</dt><dd>{region}</dd></div>}
      </dl>

      <dl className="details">
        <InvestorGroup label="领投方" names={event.leadInvestors} />
        <InvestorGroup label="跟投 / 其他投资方" names={supportingInvestors} />
      </dl>

      {event.products.length > 0 && (
        <section className="products" aria-label="主要产品">
          <h3>主要产品</h3>
          <ul>{event.products.map((product) => <li key={product}>{product}</li>)}</ul>
        </section>
      )}

      <footer className="card-footer">
        <nav aria-label={`${event.companyDisplayName}公开链接`}>
          {event.officialWebsite && (
            <a href={event.officialWebsite} target="_blank" rel="noopener noreferrer">公司官网</a>
          )}
          {event.sources.map((source, sourceIndex) => (
            <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">
              来源{sourceIndex + 1}{source.publishedAt ? <time> · {source.publishedAt}</time> : null}
            </a>
          ))}
        </nav>
      </footer>
    </article>
  );
}

function roundAndStatus(event: WeeklyPreviewSampleEvent): string {
  const statusNeedsDisplay = !/^(已完成|已上市)$/.test(event.financingStatus);
  if (event.round && statusNeedsDisplay) return `${event.round} · ${event.financingStatus}`;
  return event.round ?? event.financingStatus ?? "未明确";
}

function displayAmount(event: WeeklyPreviewSampleEvent): string {
  if (!event.amount) return "未披露";
  if (event.capitalEventLabel === "IPO / 上市" && /发行价|市值/.test(event.amount)) return `${event.amount}（IPO发行/市值口径）`;
  return event.amount;
}

function P3Table({events}: {events: readonly WeeklyPreviewSampleEvent[]}) {
  return (
    <div className="p3-table-frame">
      <table className="p3-table">
        <thead><tr><th>公司</th><th>行业与业务</th><th>资本事件</th><th>轮次 / 状态</th><th>金额</th><th>主要投资方</th><th>日期</th><th>来源1</th></tr></thead>
        <tbody>
          {events.map((event) => {
            const source = event.sources[0];
            if (!source) throw new Error(`P3事件缺少来源1: ${event.companyDisplayName}`);
            return (
              <tr key={event.companyDisplayName}>
                <th scope="row" data-label="公司">{event.companyDisplayName}</th>
                <td data-label="行业与业务"><span className="industry-tag">{event.industryLabel}</span><span className="business-label">{event.businessLabel}</span></td>
                <td data-label="资本事件">{event.capitalEventLabel ?? "资本动态"}</td>
                <td data-label="轮次 / 状态">{roundAndStatus(event)}</td>
                <td data-label="金额">{displayAmount(event)}</td>
                <td data-label="主要投资方">{formatPrimaryInvestors(event)}</td>
                <td data-label="日期">{source.publishedAt ?? "未明确"}</td>
                <td data-label="来源1"><a href={source.url} target="_blank" rel="noopener noreferrer">来源1</a></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function Home() {
  const {counts, events, p1Events, p2Events, p3Events} = weeklyPreviewSample;
  return (
    <main>
      <header className="report-header">
        <div className="preview-line">
          <span className="preview-badge">周报预览 · 82条</span>
          <span>非飞书正式发布</span>
        </div>
        <p className="eyebrow">EMBODIED INTELLIGENCE · WEEKLY BRIEF</p>
        <h1>具身智能公司动态周报</h1>
        <p className="issue-date">2026.08.03–08.09</p>
        <p className="deck">聚焦具身智能、Physical AI 与硬科技资本动态。P1/P2 使用完整简介卡片，P3 使用紧凑行业表格。</p>

        <dl className="statistics" aria-label="本周事件统计">
          <div><dt>收集</dt><dd>{counts.original}</dd></div>
          <div><dt>周报收录</dt><dd>{counts.public}</dd></div>
          <div><dt>P1</dt><dd>{counts.P1}</dd></div>
          <div><dt>P2</dt><dd>{counts.P2}</dd></div>
          <div><dt>P3</dt><dd>{counts.P3}</dd></div>
        </dl>

        <div className="weekly-context">
          <section className="amount-highlight" aria-labelledby="amount-highlight-title">
            <p>本周已披露最高资本金额</p>
            <h2 id="amount-highlight-title"><span>{weeklyPreviewHighlight.company}</span>{weeklyPreviewHighlight.amount}</h2>
            <p>{weeklyPreviewHighlight.event} · {weeklyPreviewHighlight.status}</p>
            <small>{weeklyPreviewHighlight.scopeNote}</small>
          </section>

          <section className="tier-guide" aria-labelledby="tier-guide-title">
            <div className="tier-guide-heading">
              <p>相关度分层依据</p>
              <h2 id="tier-guide-title">P1 / P2 / P3</h2>
            </div>
            <dl>
              <div><dt>P1</dt><dd>具身智能直接相关：机器人本体、全栈机器人、VLA、世界模型、机器人基础模型与学习控制平台。</dd></div>
              <div><dt>P2</dt><dd>关键上下游或强相关技术：机器人核心部件、感知与执行、仿真和数据、Physical AI，以及泛 AI 与自动驾驶。</dd></div>
              <div><dt>P3</dt><dd>具备技术壁垒、但与具身智能暂无明确直接联系的其他硬科技，包括半导体、材料、航天、能源、量子与生物医药。</dd></div>
            </dl>
            <p className="tier-note">P1–P3 表示与具身智能主题的相关程度，不代表融资金额、公司质量或投资建议。</p>
          </section>
        </div>
        <p className="sample-note">全周收集 {counts.original} 条、周报收录 {counts.public} 条；当前预览展示全部 {events.length} 条：P1 {counts.P1}、P2 {counts.P2}、P3 {counts.P3}。</p>
      </header>

      <section className="events" aria-labelledby="events-heading">
        <div className="section-heading">
          <p>P1 · DIRECTLY RELEVANT</p>
          <h2 id="events-heading">具身智能重点融资</h2>
        </div>
        {p1Events.map((event, index) => <EventCard key={event.companyDisplayName} event={event} index={index} section="p1" />)}
      </section>

      <section className="events" aria-labelledby="p2-events-heading">
        <div className="section-heading">
          <p>P2 · ADJACENT TECHNOLOGY</p>
          <h2 id="p2-events-heading">核心上下游与相邻技术</h2>
        </div>
        {p2Events.map((event, index) => <EventCard key={event.companyDisplayName} event={event} index={index} section="p2" />)}
      </section>

      <section className="events p3-section" aria-labelledby="p3-events-heading">
        <div className="section-heading">
          <p>P3 · HARD TECHNOLOGY</p>
          <h2 id="p3-events-heading">其他硬科技资本动态</h2>
        </div>
        <P3Table events={p3Events} />
      </section>
    </main>
  );
}
