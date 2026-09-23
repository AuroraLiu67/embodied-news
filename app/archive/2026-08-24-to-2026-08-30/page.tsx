import {WeeklyReportPage} from "@/app/weekly-report-page";
import {archivedWeeklyReport} from "@/lib/site/weekly-preview";

export default function ArchivedWeeklyReport() {
  return <WeeklyReportPage report={archivedWeeklyReport} />;
}
