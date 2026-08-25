import {WeeklyReportPage} from "@/app/weekly-report-page";
import {currentWeeklyReport} from "@/lib/site/weekly-preview";

export default function Home() {
  return <WeeklyReportPage report={currentWeeklyReport} />;
}
