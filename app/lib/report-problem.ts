/** Window event that opens the site-wide "Report a problem" widget (ReportProblem.vue). */
export const REPORT_PROBLEM_EVENT = 'wedance:report-problem'

export function requestProblemReport() {
  if (import.meta.client) window.dispatchEvent(new Event(REPORT_PROBLEM_EVENT))
}
