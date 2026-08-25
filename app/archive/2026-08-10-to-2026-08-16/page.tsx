import {WeeklyReportPage} from "@/app/weekly-report-page";
import {previousWeeklyReport} from "@/lib/site/weekly-preview";

export default function ArchivedWeeklyReport() {
  return <WeeklyReportPage report={previousWeeklyReport} />;
}
