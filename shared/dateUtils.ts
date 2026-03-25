import { SEMESTER_START_DATE, WEEKS_IN_SEMESTER } from "./const";

/**
 * 根据听课日期计算对应的周次
 * @param listenDate 听课日期 (YYYY-MM-DD 格式或 Date 对象)
 * @returns 周次 (1-19) 或 undefined 如果日期超出学期范围
 */
export function calculateWeekFromDate(listenDate: string | Date): number | undefined {
  const date = typeof listenDate === "string" ? new Date(listenDate) : listenDate;
  const startDate = new Date(SEMESTER_START_DATE);
  
  // 设置为同一天的开始时间以便比较
  startDate.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  
  // 计算天数差
  const diffMs = date.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  // 计算周次（第一周是第 0-6 天）
  const week = Math.floor(diffDays / 7) + 1;
  
  // 检查是否在有效范围内
  if (week < 1 || week > WEEKS_IN_SEMESTER) {
    return undefined;
  }
  
  return week;
}

/**
 * 根据周次计算该周的日期范围（周一到周日）
 * @param week 周次 (1-19)
 * @returns { startDate, endDate } 该周的起始和结束日期，或 undefined 如果周次无效
 */
export function calculateDateRangeFromWeek(week: number): { startDate: string; endDate: string } | undefined {
  if (week < 1 || week > WEEKS_IN_SEMESTER) {
    return undefined;
  }
  
  const startDate = new Date(SEMESTER_START_DATE);
  startDate.setDate(startDate.getDate() + (week - 1) * 7);
  
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  
  return {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
  };
}

/**
 * 获取当前时间对应的周次
 * @returns 当前周次 (1-19) 或 undefined 如果当前时间超出学期范围
 */
export function getCurrentWeek(): number | undefined {
  return calculateWeekFromDate(new Date());
}

/**
 * 检查日期是否在学期范围内且不早于当前时间
 * @param date 待检查的日期
 * @returns true 如果日期有效，false 否则
 */
export function isValidFutureDate(date: string | Date): boolean {
  const checkDate = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  
  checkDate.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  
  // 日期不能早于今天
  if (checkDate.getTime() < now.getTime()) {
    return false;
  }
  
  // 日期必须在学期范围内（学期第一天到最后一天）
  const startDate = new Date(SEMESTER_START_DATE);
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(SEMESTER_START_DATE);
  endDate.setDate(endDate.getDate() + (WEEKS_IN_SEMESTER - 1) * 7 + 6);
  endDate.setHours(23, 59, 59, 999);
  
  return checkDate.getTime() >= startDate.getTime() && checkDate.getTime() <= endDate.getTime();
}

/**
 * 获取最小可选日期（今天）
 * @returns 最小日期的 YYYY-MM-DD 格式字符串
 */
export function getMinSelectableDate(): string {
  const today = new Date();
  return today.toISOString().split("T")[0];
}

/**
 * 获取最大可选日期（学期最后一天）
 * @returns 最大日期的 YYYY-MM-DD 格式字符串
 */
export function getMaxSelectableDate(): string {
  const startDate = new Date(SEMESTER_START_DATE);
  startDate.setDate(startDate.getDate() + (WEEKS_IN_SEMESTER - 1) * 7 + 6);
  return startDate.toISOString().split("T")[0];
}
