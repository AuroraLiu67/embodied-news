import {WeeklyReportPage} from "@/app/weekly-report-page";
import {secondArchivedWeeklyReport} from "@/lib/site/weekly-preview";

export default function ArchivedWeeklyReport() {
  return <WeeklyReportPage report={secondArchivedWeeklyReport} />;
}
