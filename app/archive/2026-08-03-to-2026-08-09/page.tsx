import {WeeklyReportPage} from "@/app/weekly-report-page";
import {firstArchivedWeeklyReport} from "@/lib/site/weekly-preview";

export default function ArchivedWeeklyReport() {
  return <WeeklyReportPage report={firstArchivedWeeklyReport} />;
}
