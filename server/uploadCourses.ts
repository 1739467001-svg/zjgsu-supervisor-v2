/**
 * 课程数据上传路由
 * POST /api/upload-courses
 * 仅研究生院主管（graduate_admin）和 admin 可访问
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { getDb } from "./db";
import { courses } from "../drizzle/schema";
import { sql } from "drizzle-orm";
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
        return res.status(403).json({ success: false, message: "权限不足，仅研究生院主管可上传课程数据" });
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
        return res.status(400).json({ success: false, message: "请选择要上传的文件" });
      }

      // 解析 Excel
      let courseData;
      try {
        courseData = parseExcelToCourses(req.file.buffer);
      } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || "文件解析失败" });
      }

      // 统计信息
      const teacherSet = new Set(courseData.map((r) => r.teacher).filter(Boolean));
      const collegeSet = new Set(courseData.map((r) => r.college).filter(Boolean));

      // 获取数据库实例
      const db = await getDb();
      if (!db) {
        return res.status(500).json({ success: false, message: "数据库连接失败" });
      }

      // 清空旧数据并批量插入新数据（事务）
      await db.transaction(async (tx) => {
        await tx.delete(courses);
        // 分批插入，每批 100 条
        const batchSize = 100;
        for (let i = 0; i < courseData.length; i += batchSize) {
          const batch = courseData.slice(i, i + batchSize);
          await tx.insert(courses).values(batch);
        }
      });

      // 重置自增 ID（事务外执行）
      await db.execute(sql`ALTER TABLE courses AUTO_INCREMENT = 1`);

      return res.json({
        success: true,
        message: "课程数据更新成功",
        stats: {
          total: courseData.length,
          teachers: teacherSet.size,
          colleges: collegeSet.size,
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
