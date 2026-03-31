import { SEMESTER_START_DATE, WEEKS_IN_SEMESTER, TIMEZONE } from "./const";

/**
 * 获取北京时间的今天日期字符串（YYYY-MM-DD）
 * 无论浏览器/服务器在哪个时区，都返回北京时间的日期
 */
export function getTodayBJ(): string {
  const now = new Date();
  // 使用 Intl 格式化为北京时间
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts; // en-CA 格式就是 YYYY-MM-DD
}

/**
 * 将日期字符串解析为 Date 对象（按北京时间的零点）
 * @param dateStr YYYY-MM-DD 格式
 */
function parseDateBJ(dateStr: string): Date {
  // 使用 +08:00 确保按北京时间解析
  return new Date(dateStr + "T00:00:00+08:00");
}

/**
 * 根据听课日期计算对应的周次
 * @param listenDate 听课日期 (YYYY-MM-DD 格式或 Date 对象)
 * @returns 周次 (1-19) 或 undefined 如果日期超出学期范围
 */
export function calculateWeekFromDate(listenDate: string | Date): number | undefined {
  let dateStr: string;
  if (typeof listenDate === "string") {
    dateStr = listenDate;
  } else {
    // Date 对象转为北京时间日期字符串
    dateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(listenDate);
  }

  const date = parseDateBJ(dateStr);
  const startDate = parseDateBJ(SEMESTER_START_DATE);

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
 * @returns { startDate, endDate } 该周的起始和结束日期 (YYYY-MM-DD)，或 undefined 如果周次无效
 */
export function calculateDateRangeFromWeek(week: number): { startDate: string; endDate: string } | undefined {
  if (week < 1 || week > WEEKS_IN_SEMESTER) {
    return undefined;
  }

  const startDate = parseDateBJ(SEMESTER_START_DATE);
  startDate.setDate(startDate.getDate() + (week - 1) * 7);

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);

  // 使用北京时间格式化
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);

  return {
    startDate: fmt(startDate),
    endDate: fmt(endDate),
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
 * 检查日期是否在学期范围内
 * @param date 待检查的日期
 * @returns true 如果日期有效，false 否则
 */
export function isValidFutureDate(date: string | Date): boolean {
  let dateStr: string;
  if (typeof date === "string") {
    dateStr = date;
  } else {
    dateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }

  const checkDate = parseDateBJ(dateStr);
  const startDate = parseDateBJ(SEMESTER_START_DATE);

  const endDate = parseDateBJ(SEMESTER_START_DATE);
  endDate.setDate(endDate.getDate() + (WEEKS_IN_SEMESTER - 1) * 7 + 6);

  return checkDate.getTime() >= startDate.getTime() && checkDate.getTime() <= endDate.getTime();
}

/**
 * 获取最小可选日期（学期第一天）
 * @returns 最小日期的 YYYY-MM-DD 格式字符串
 */
export function getMinSelectableDate(): string {
  return SEMESTER_START_DATE;
}

/**
 * 获取最大可选日期（学期最后一天）
 * @returns 最大日期的 YYYY-MM-DD 格式字符串
 */
export function getMaxSelectableDate(): string {
  const endDate = parseDateBJ(SEMESTER_START_DATE);
  endDate.setDate(endDate.getDate() + (WEEKS_IN_SEMESTER - 1) * 7 + 6);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(endDate);
}

/**
 * 格式化日期为北京时间的本地化字符串
 * @param date Date 对象或日期字符串
 * @param options Intl.DateTimeFormatOptions 选项
 * @returns 格式化后的字符串
 */
export function formatDateBJ(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("zh-CN", { timeZone: TIMEZONE, ...options });
}

/**
 * 格式化日期为北京时间的日期部分（年月日）
 */
export function formatDateOnlyBJ(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("zh-CN", { timeZone: TIMEZONE });
}

/**
 * 格式化日期为北京时间的时间部分（时分）
 */
export function formatTimeBJ(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("zh-CN", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit" });
}
