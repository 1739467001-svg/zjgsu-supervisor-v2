/**
 * 课程数据上传路由
 * POST /api/upload-courses
 * 仅研究生院主管（graduate_admin）和 admin 可访问
 *
 * 核心策略：UPSERT（保持 ID 稳定）
 * - 用「学院+课程名+教师+星期+节次+教室」作为唯一标识
 * - 已存在的课程：保留原 ID，仅更新内容字段
 * - 新增课程：插入并分配新 ID
 * - 不再存在的课程：若无关联评价/听课计划则删除，否则保留
 * 这样可确保 course_evaluations 和 listening_plans 的 courseId 关联不断裂
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { getDb } from "./db";
import { courses } from "../drizzle/schema";
import { sql, eq, and, notInArray } from "drizzle-orm";
import { sdk } from "./_core/sdk";

const router = Router();

// multer 内存存储（文件不落盘，直接在内存中处理）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB 限制
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase();
    if (ext.endsWith(".xls") || ext.endsWith(".xlsx")) {
      cb(null, true);
    } else {
      cb(new Error("只支持 .xls 或 .xlsx 格式的文件"));
    }
  },
});

// ============================================================
// 解析周次字符串为数字数组
// ============================================================
function parseWeekNumbers(weekStr: string): number[] {
  if (!weekStr || weekStr.trim() === "") return [];
  const str = weekStr.trim();
  const weeks = new Set<number>();

  if (str === "十六周" || str.includes("十六周")) {
    for (let i = 1; i <= 16; i++) weeks.add(i);
    if (str === "十六周") return [...weeks].sort((a, b) => a - b);
  }
  if (str.includes("前八周")) {
    for (let i = 1; i <= 8; i++) weeks.add(i);
  }
  if (str.includes("后八周")) {
    for (let i = 9; i <= 16; i++) weeks.add(i);
  }
  if (str.includes("前十一周")) {
    for (let i = 1; i <= 11; i++) weeks.add(i);
  }
  if (str.includes("单周")) {
    for (let i = 1; i <= 18; i += 2) weeks.add(i);
  }
  if (str.includes("双周")) {
    for (let i = 2; i <= 18; i += 2) weeks.add(i);
  }

  // 解析 "第X|Y|Z周" 格式
  const pipePattern = /第([\d|]+)周/g;
  let match;
  while ((match = pipePattern.exec(str)) !== null) {
    const nums = match[1].split("|");
    nums.forEach((n) => {
      const num = parseInt(n.trim());
      if (!isNaN(num) && num > 0) weeks.add(num);
    });
  }

  // 解析 "第X周" 格式
  const singlePattern = /第(\d+)周/g;
  while ((match = singlePattern.exec(str)) !== null) {
    const num = parseInt(match[1]);
    if (!isNaN(num) && num > 0) weeks.add(num);
  }

  return [...weeks].sort((a, b) => a - b);
}

// ============================================================
// 解析 Excel 数据为课程记录数组
// ============================================================
function parseExcelToCourses(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  // 第0行是"排课信息"大标题，第1行是真正的表头，从第2行开始是数据
  const allRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

  if (allRows.length < 3) {
    throw new Error("文件内容不足，请确认是正确的研究生课表文件");
  }

  const dataRows = allRows.slice(2);

  const validRows = dataRows.filter(
    (row: any[]) =>
      row[3] && String(row[3]).trim() && row[7] && String(row[7]).trim()
  );

  if (validRows.length === 0) {
    throw new Error("未找到有效课程数据，请检查文件格式");
  }

  return validRows.map((row: any[]) => {
    const customWeeks = String(row[12] || "").trim();
    const weekNumbers = parseWeekNumbers(customWeeks);
    const studentCountRaw = row[14];
    const studentCount =
      studentCountRaw !== undefined && studentCountRaw !== ""
        ? Math.round(parseFloat(String(studentCountRaw)) || 0)
        : 0;

    return {
      academicYear: String(row[0] || "2025-2026").trim(),
      semester: String(row[1] || "第二学期").trim(),
      college: String(row[2] || "").trim(),
      courseName: String(row[3] || "").trim(),
      courseType: String(row[4] || "").trim(),
      classroom: String(row[5] || "").trim(),
      classId: String(row[6] || "").trim(),
      teacher: String(row[7] || "").trim(),
      campus: String(row[8] || "").trim(),
      weekday: String(row[9] || "").trim(),
      weekType: String(row[10] || "").trim(),
      period: String(row[11] || "").trim(),
      customWeeks,
      weekNumbers,
      studentMajor: String(row[13] || "").trim(),
      studentCount,
    };
  });
}

// 生成课程唯一标识（用于匹配新旧数据）
function courseKey(c: {
  college: string;
  courseName: string;
  teacher: string;
  weekday: string;
  period: string;
  classroom: string;
}): string {
  return [c.college, c.courseName, c.teacher, c.weekday, c.period, c.classroom]
    .map((s) => (s || "").trim())
    .join("||");
}

// ============================================================
// 上传接口
// ============================================================
router.post(
  "/api/upload-courses",
  async (req: Request, res: Response, next) => {
    // 权限验证：仅 graduate_admin 和 admin 可访问
    try {
      const user = await sdk.authenticateRequest(req);
      if (!["graduate_admin", "admin"].includes(user.role || "")) {
        return res.status(403).json({
          success: false,
          message: "权限不足，仅研究生院主管可上传课程数据",
        });
      }
      (req as any).uploadUser = user;
    } catch {
      return res.status(401).json({ success: false, message: "请先登录" });
    }
    next();
  },
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: "请选择要上传的文件" });
      }

      // 解析 Excel
      let newCourseData: ReturnType<typeof parseExcelToCourses>;
      try {
        newCourseData = parseExcelToCourses(req.file.buffer);
      } catch (err: any) {
        return res
          .status(400)
          .json({ success: false, message: err.message || "文件解析失败" });
      }

      // 统计信息
      const teacherSet = new Set(
        newCourseData.map((r) => r.teacher).filter(Boolean)
      );
      const collegeSet = new Set(
        newCourseData.map((r) => r.college).filter(Boolean)
      );

      // 获取数据库实例
      const db = await getDb();
      if (!db) {
        return res
          .status(500)
          .json({ success: false, message: "数据库连接失败" });
      }

      // ---- UPSERT 策略 ----
      // 1. 读取数据库中所有现有课程
      const existingCourses = await db.select().from(courses);

      // 2. 建立现有课程的 key -> id 映射
      const existingKeyToId = new Map<number, number>(); // key hash -> id
      const existingKeyMap = new Map<string, number>(); // key string -> id
      for (const c of existingCourses) {
        const k = courseKey(c as any);
        existingKeyMap.set(k, c.id);
      }

      // 3. 对新数据进行分类：更新 or 新增
      const toUpdate: Array<{ id: number; data: (typeof newCourseData)[0] }> =
        [];
      const toInsert: Array<(typeof newCourseData)[0]> = [];
      const matchedIds = new Set<number>();

      for (const nc of newCourseData) {
        const k = courseKey(nc);
        if (existingKeyMap.has(k)) {
          const id = existingKeyMap.get(k)!;
          toUpdate.push({ id, data: nc });
          matchedIds.add(id);
        } else {
          toInsert.push(nc);
        }
      }

      // 4. 找出需要删除的旧课程（新数据中不存在的）
      const toDeleteIds = existingCourses
        .map((c) => c.id)
        .filter((id) => !matchedIds.has(id));

      // 5. 查询哪些待删除课程有关联的评价或听课计划（保留这些，避免断裂）
      let safeToDeleteIds: number[] = toDeleteIds;
      if (toDeleteIds.length > 0) {
        // 查询有关联评价的 courseId
        const linkedEvalResult = await db.execute(
          sql`SELECT DISTINCT courseId FROM course_evaluations WHERE courseId IN (${sql.raw(toDeleteIds.join(","))})`
        ) as any;
        const linkedPlanResult = await db.execute(
          sql`SELECT DISTINCT courseId FROM listening_plans WHERE courseId IN (${sql.raw(toDeleteIds.join(","))})`
        ) as any;

        const linkedIds = new Set<number>();
        const evalRows = Array.isArray(linkedEvalResult) ? linkedEvalResult[0] : linkedEvalResult;
        const planRows = Array.isArray(linkedPlanResult) ? linkedPlanResult[0] : linkedPlanResult;
        
        if (Array.isArray(evalRows)) {
          evalRows.forEach((r: any) => linkedIds.add(Number(r.courseId)));
        }
        if (Array.isArray(planRows)) {
          planRows.forEach((r: any) => linkedIds.add(Number(r.courseId)));
        }

        // 只删除没有关联的课程
        safeToDeleteIds = toDeleteIds.filter((id) => !linkedIds.has(id));
      }

      // 6. 执行数据库操作
      // 更新已存在的课程（保留 ID）
      for (const { id, data } of toUpdate) {
        await db
          .update(courses)
          .set({
            academicYear: data.academicYear,
            semester: data.semester,
            college: data.college,
            courseName: data.courseName,
            courseType: data.courseType,
            classroom: data.classroom,
            classId: data.classId,
            teacher: data.teacher,
            campus: data.campus,
            weekday: data.weekday,
            weekType: data.weekType,
            period: data.period,
            customWeeks: data.customWeeks,
            weekNumbers: data.weekNumbers,
            studentMajor: data.studentMajor,
            studentCount: data.studentCount,
          })
          .where(eq(courses.id, id));
      }

      // 插入新课程（分批）
      if (toInsert.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < toInsert.length; i += batchSize) {
          const batch = toInsert.slice(i, i + batchSize);
          await db.insert(courses).values(batch);
        }
      }

      // 删除安全可删除的旧课程
      if (safeToDeleteIds.length > 0) {
        await db.execute(
          sql`DELETE FROM courses WHERE id IN (${sql.raw(safeToDeleteIds.join(","))})`
        );
      }

      // 统计最终数量
      const finalCountResult = await db.execute(
        sql`SELECT COUNT(*) as total, COUNT(DISTINCT teacher) as teachers, COUNT(DISTINCT college) as colleges FROM courses`
      ) as any;
      const finalRows = Array.isArray(finalCountResult) ? finalCountResult[0] : finalCountResult;
      const finalStats = Array.isArray(finalRows) && finalRows.length > 0
        ? finalRows[0]
        : { total: newCourseData.length, teachers: teacherSet.size, colleges: collegeSet.size };

      return res.json({
        success: true,
        message: "课程数据更新成功",
        stats: {
          total: Number(finalStats.total) || newCourseData.length,
          teachers: Number(finalStats.teachers) || teacherSet.size,
          colleges: Number(finalStats.colleges) || collegeSet.size,
          updated: toUpdate.length,
          inserted: toInsert.length,
          deleted: safeToDeleteIds.length,
          preserved: toDeleteIds.length - safeToDeleteIds.length,
        },
      });
    } catch (err: any) {
      console.error("[upload-courses] 错误:", err);
      return res.status(500).json({
        success: false,
        message: "服务器内部错误：" + (err.message || "未知错误"),
      });
    }
  }
);

export default router;
