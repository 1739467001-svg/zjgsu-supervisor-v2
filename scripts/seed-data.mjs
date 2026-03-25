import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import XLSX from "xlsx";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 解析周次字符串为数字数组
function parseWeekNumbers(weekStr) {
  if (!weekStr) return [];
  const weeks = new Set();

  // 处理特殊描述
  if (weekStr.includes("十六周") || weekStr === "十六周") {
    for (let i = 1; i <= 16; i++) weeks.add(i);
    return [...weeks];
  }
  if (weekStr.includes("前八周")) {
    for (let i = 1; i <= 8; i++) weeks.add(i);
  }
  if (weekStr.includes("后八周")) {
    for (let i = 9; i <= 16; i++) weeks.add(i);
  }
  if (weekStr.includes("前十一周")) {
    for (let i = 1; i <= 11; i++) weeks.add(i);
  }

  // 解析 "第X|Y|Z周" 格式
  const pipePattern = /第([\d|]+)周/g;
  let match;
  while ((match = pipePattern.exec(weekStr)) !== null) {
    const nums = match[1].split("|");
    nums.forEach((n) => {
      const num = parseInt(n.trim());
      if (!isNaN(num)) weeks.add(num);
    });
  }

  // 解析单独的数字（如"第12周"）
  const singlePattern = /第(\d+)周/g;
  while ((match = singlePattern.exec(weekStr)) !== null) {
    const num = parseInt(match[1]);
    if (!isNaN(num)) weeks.add(num);
  }

  return [...weeks].sort((a, b) => a - b);
}

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const db = drizzle(connection);

  console.log("开始导入数据...");

  // ============================================================
  // 1. 导入课表数据
  // ============================================================
  console.log("\n[1/2] 导入课表数据...");

  // 使用xlsx读取xls文件
  const xlsPath = "/home/ubuntu/upload/pasted_file_Fly8t6_全校总课表2026-03-01.xls";
  const workbook = XLSX.readFile(xlsPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // 跳过前两行（标题行）
  const courseRows = rows.slice(2);
  console.log(`课表数据行数: ${courseRows.length}`);

  // 清空课程表
  await connection.execute("DELETE FROM courses");
  console.log("已清空课程表");

  // 批量插入
  let insertedCourses = 0;
  const batchSize = 100;
  for (let i = 0; i < courseRows.length; i += batchSize) {
    const batch = courseRows.slice(i, i + batchSize);
    const values = batch
      .filter((row) => row[0] && row[3]) // 过滤空行
      .map((row) => {
        const customWeeks = String(row[12] || "");
        const weekNumbers = parseWeekNumbers(customWeeks);
        return [
          String(row[0] || "2025-2026"), // academicYear
          String(row[1] || "第二学期"), // semester
          String(row[2] || ""), // college
          String(row[3] || ""), // courseName
          String(row[4] || ""), // courseType
          String(row[5] || ""), // classroom
          String(row[6] || "").trim(), // classId
          String(row[7] || "").trim(), // teacher
          String(row[8] || ""), // campus
          String(row[9] || ""), // weekday
          String(row[10] || ""), // weekType
          String(row[11] || ""), // period
          customWeeks, // customWeeks
          JSON.stringify(weekNumbers), // weekNumbers
          String(row[13] || ""), // studentMajor
          parseInt(row[14]) || 0, // studentCount
        ];
      });

    if (values.length > 0) {
      const placeholders = values.map(() => "(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").join(",");
      await connection.execute(
        `INSERT INTO courses (academicYear, semester, college, courseName, courseType, classroom, classId, teacher, campus, weekday, weekType, period, customWeeks, weekNumbers, studentMajor, studentCount) VALUES ${placeholders}`,
        values.flat()
      );
      insertedCourses += values.length;
    }
  }
  console.log(`✓ 成功导入 ${insertedCourses} 条课程记录`);

  // ============================================================
  // 2. 导入用户数据（基于角色信息表）
  // ============================================================
  console.log("\n[2/2] 导入用户数据...");

  const xlsxPath = "/home/ubuntu/upload/pasted_file_gAwP5K_浙江工商大学督导开发系统角色信息汇总2026.3.xlsx";
  const wb2 = XLSX.readFile(xlsxPath);
  const ws2 = wb2.Sheets["人员 productivity"];
  const userRows = XLSX.utils.sheet_to_json(ws2, { header: 1 });

  // 角色映射
  const roleMap = {
    研究生院主管: "graduate_admin",
    督导专家: "supervisor_expert",
    督导组长: "supervisor_leader",
    学院教学秘书: "college_secretary",
  };

  // 清空用户表（保留系统用户）
  await connection.execute("DELETE FROM users WHERE employeeId IS NOT NULL");
  console.log("已清空用户表");

  let insertedUsers = 0;
  for (const row of userRows) {
    // 跳过标题行和空行
    if (!row[0] || !row[1] || !row[4] || row[0] === "姓名" || row[4] === "拟分配角色") continue;

    const name = String(row[0]).trim();
    const employeeId = String(row[1]).trim();
    const phone = row[2] ? String(row[2]).trim() : null;
    const college = row[3] ? String(row[3]).trim() : null;
    const roleStr = String(row[4]).trim();
    const email = row[5] ? String(row[5]).trim() : null;
    const remark = row[6] ? String(row[6]).trim() : null;

    const role = roleMap[roleStr] || "user";

    // 使用工号作为openId
    const openId = `emp_${employeeId}`;

    try {
      await connection.execute(
        `INSERT INTO users (openId, employeeId, name, email, phone, role, college, remark, loginMethod, lastSignedIn) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'employee_id', NOW())
         ON DUPLICATE KEY UPDATE name=VALUES(name), email=VALUES(email), phone=VALUES(phone), role=VALUES(role), college=VALUES(college), remark=VALUES(remark)`,
        [openId, employeeId, name, email, phone, role, college, remark]
      );
      insertedUsers++;
    } catch (err) {
      console.warn(`跳过用户 ${name} (${employeeId}): ${err.message}`);
    }
  }
  console.log(`✓ 成功导入 ${insertedUsers} 位用户`);

  await connection.end();
  console.log("\n✅ 数据导入完成！");
}

main().catch(console.error);
