import {WeeklyReportPage} from "@/app/weekly-report-page";
import {thirdArchivedWeeklyReport} from "@/lib/site/weekly-preview";

export default function ArchivedWeeklyReport() {
  return <WeeklyReportPage report={thirdArchivedWeeklyReport} />;
}
