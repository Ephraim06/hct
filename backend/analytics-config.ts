/** First day of production tracking. Reporting dates use UTC, as labelled in the dashboard. */
export const TRACKING_STARTED_ON='2026-11-04';
export const analyticsToday=()=>new Date().toISOString().slice(0,10);
export function analyticsStart(days=180,today=analyticsToday()){
 const retained=new Date(Date.parse(today)-(Math.min(days,180)-1)*86400000).toISOString().slice(0,10);
 return retained<TRACKING_STARTED_ON?TRACKING_STARTED_ON:retained;
}
