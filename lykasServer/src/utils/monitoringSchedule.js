const MONITORING_PERIODS = [1, 2, 3];

function getApplicationCompletionDate(application) {
  const entry = [...(application.stageHistory || [])].reverse().find((item) => item.stage === "completed");
  return entry?.changedAt || application.updatedAt;
}

function addMonths(date, months) {
  const result = new Date(date);
  const originalDay = result.getDate();
  result.setMonth(result.getMonth() + months);
  if (result.getDate() !== originalDay) result.setDate(0);
  return result;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonitoringSchedule(application, monitoringPeriod) {
  if (!MONITORING_PERIODS.includes(monitoringPeriod)) return null;
  const scheduledDate = addMonths(getApplicationCompletionDate(application), monitoringPeriod);
  return {
    monitoringPeriod,
    scheduledDate,
    dueDate: scheduledDate,
    reportMonth: monthKey(scheduledDate),
  };
}

module.exports = { MONITORING_PERIODS, getApplicationCompletionDate, getMonitoringSchedule };
