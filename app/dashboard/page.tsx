import {DashboardClient, type DashboardRow} from "./dashboard-client";
import {loadPublicConfig} from "@/lib/config/public";
import {archivedWeeklyReport, currentAmountSummary, currentWeeklyReport, firstArchivedWeeklyReport, formatPrimaryInvestors, previousWeeklyReport, type WeeklyPreviewReport} from "@/lib/site/weekly-preview";

const reports = [currentWeeklyReport, previousWeeklyReport, archivedWeeklyReport, firstArchivedWeeklyReport];

function toRows(report: WeeklyPreviewReport): DashboardRow[] {
  const weekLabel = `${report.weekStart.slice(5).replace("-", ".")}—${report.weekEnd.slice(5).replace("-", ".")}`;
  return report.events.map((event) => ({
    id: `${report.weekStart}-${event.companyDisplayName}`,
    weekStart: report.weekStart,
    weekLabel,
    company: event.companyDisplayName,
    tier: event.relevanceTier,
    region: event.regionScope,
    round: event.round,
    amount: event.amount,
    currency: event.currency,
    financingStatus: event.financingStatus,
    investors: formatPrimaryInvestors(event),
    business: (event.introduction ?? event.businessLabel ?? event.products.join("、")) || "未披露",
    sourceUrl: event.sources[0]!.url,
  }));
}

export default function DashboardPage() {
  const {siteBasePath} = loadPublicConfig();
  return <DashboardClient rows={reports.flatMap(toRows)} amountSummary={currentAmountSummary} basePath={siteBasePath} />;
}
