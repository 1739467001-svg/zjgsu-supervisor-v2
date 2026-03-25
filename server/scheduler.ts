/**
 * 定时任务模块：听课前一天自动发送站内信提醒
 *
 * 逻辑说明：
 * - 浙工商研究生课程按"周次+星期"排课，无具体日期
 * - 学期开始日期：2026-03-02（第1周星期一）
 * - 每天凌晨 0:30 运行，计算明天是第几周星期几，
 *   查找所有 status=pending 且 planWeek 匹配的听课计划，
 *   向对应督导专家发送站内信提醒
 */

import { getDb } from "./db";
import { listeningPlans, courses, users, notifications } from "../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";

// ============================================================
// 学期日期计算
// ============================================================

/** 学期第1周星期一的日期（2026-03-02） */
const SEMESTER_START = new Date("2026-03-02T00:00:00+08:00");

/** 中文星期 -> ISO weekday (1=Mon, 7=Sun) */
const WEEKDAY_MAP: Record<string, number> = {
  星期一: 1,
  星期二: 2,
  星期三: 3,
  星期四: 4,
  星期五: 5,
  星期六: 6,
  星期日: 7,
};

/** ISO weekday -> 中文星期 */
const ISO_TO_CN: Record<number, string> = {
  1: "星期一",
  2: "星期二",
  3: "星期三",
  4: "星期四",
  5: "星期五",
  6: "星期六",
  7: "星期日",
};

/**
 * 根据给定日期计算学期周次和星期
 * @returns { week: number, weekdayCN: string } | null（超出学期范围则返回null）
 */
function getSemesterInfo(date: Date): { week: number; weekdayCN: string } | null {
  // 转为北京时间的零点
  const bjDate = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Shanghai" }));
  bjDate.setHours(0, 0, 0, 0);

  const startBJ = new Date(SEMESTER_START.toLocaleString("en-US", { timeZone: "Asia/Shanghai" }));
  startBJ.setHours(0, 0, 0, 0);

  const diffMs = bjDate.getTime() - startBJ.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return null; // 学期未开始

  const week = Math.floor(diffDays / 7) + 1;
  if (week > 19) return null; // 学期已结束

  // JS getDay(): 0=Sun, 1=Mon...6=Sat → 转为 ISO weekday
  const jsDay = bjDate.getDay();
  const isoDay = jsDay === 0 ? 7 : jsDay;
  const weekdayCN = ISO_TO_CN[isoDay];

  return { week, weekdayCN };
}

// ============================================================
// 核心提醒逻辑
// ============================================================

export async function sendListeningReminders(): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Scheduler] Database not available, skipping reminder task");
    return;
  }

  // 计算"明天"是学期第几周星期几
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const info = getSemesterInfo(tomorrow);

  if (!info) {
    console.log("[Scheduler] Tomorrow is outside semester range, no reminders to send");
    return;
  }

  const { week: tomorrowWeek, weekdayCN: tomorrowWeekday } = info;
  console.log(`[Scheduler] Checking reminders for: 第${tomorrowWeek}周 ${tomorrowWeekday}`);

  try {
    // 查询明天有课的所有待听课计划（JOIN courses表）
    const pendingPlans = await db
      .select({
        planId: listeningPlans.id,
        supervisorId: listeningPlans.supervisorId,
        planWeek: listeningPlans.planWeek,
        courseId: listeningPlans.courseId,
        courseName: courses.courseName,
        teacher: courses.teacher,
        weekday: courses.weekday,
        period: courses.period,
        classroom: courses.classroom,
        campus: courses.campus,
      })
      .from(listeningPlans)
      .innerJoin(courses, eq(listeningPlans.courseId, courses.id))
      .where(
        and(
          eq(listeningPlans.status, "pending"),
          eq(listeningPlans.planWeek, tomorrowWeek),
          eq(courses.weekday, tomorrowWeekday)
        )
      );

    if (pendingPlans.length === 0) {
      console.log("[Scheduler] No pending plans for tomorrow, no reminders needed");
      return;
    }

    console.log(`[Scheduler] Found ${pendingPlans.length} plans to remind`);

    // 按督导专家分组，批量创建通知
    type PlanRow = (typeof pendingPlans)[number];
    const plansBySupervisor: Record<number, PlanRow[]> = {};
    for (const plan of pendingPlans) {
      if (!plansBySupervisor[plan.supervisorId]) {
        plansBySupervisor[plan.supervisorId] = [];
      }
      plansBySupervisor[plan.supervisorId].push(plan);
    }

    let sentCount = 0;
    for (const supervisorIdStr of Object.keys(plansBySupervisor)) {
      const supervisorId = parseInt(supervisorIdStr);
      const plans = plansBySupervisor[supervisorId];
      // 构建通知内容
      const courseList = plans
        .map(
          (p) =>
            `《${p.courseName || "未知课程"}》（${p.teacher || ""}，${p.period || ""}，${p.classroom || ""}）`
        )
        .join("；");

      const title = `听课提醒：明天（${tomorrowWeekday}）有 ${plans.length} 门课程待督导`;
      const content = `您好！明天（第${tomorrowWeek}周 ${tomorrowWeekday}）您有以下听课计划待执行：\n\n${courseList}\n\n请按时前往听课，完成后记得填写课程评价。`;

      await db.insert(notifications).values({
        recipientId: supervisorId,
        senderId: 0, // 系统自动发送
        title,
        content,
        type: "plan_reminder",
        isRead: false,
        createdAt: new Date(),
      });
      sentCount++;
    }

    console.log(`[Scheduler] Sent ${sentCount} reminder notifications to supervisors`);
  } catch (error) {
    console.error("[Scheduler] Error sending reminders:", error);
  }
}

// ============================================================
// 定时器启动（每天凌晨 0:30 运行）
// ============================================================

let schedulerTimer: NodeJS.Timeout | null = null;

function getNextRunDelay(): number {
  const now = new Date();
  const bjNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Shanghai" }));

  // 今天的 0:30
  const target = new Date(bjNow);
  target.setHours(0, 30, 0, 0);

  // 如果今天的 0:30 已过，则设为明天的 0:30
  if (bjNow >= target) {
    target.setDate(target.getDate() + 1);
  }

  const delay = target.getTime() - bjNow.getTime();
  return delay;
}

export function startScheduler(): void {
  const scheduleNext = () => {
    const delay = getNextRunDelay();
    const nextRun = new Date(Date.now() + delay);
    console.log(
      `[Scheduler] Next reminder check scheduled at: ${nextRun.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`
    );

    schedulerTimer = setTimeout(async () => {
      await sendListeningReminders();
      scheduleNext(); // 执行完后安排下一次
    }, delay);
  };

  scheduleNext();
  console.log("[Scheduler] Listening reminder scheduler started");
}

export function stopScheduler(): void {
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
    console.log("[Scheduler] Scheduler stopped");
  }
}
