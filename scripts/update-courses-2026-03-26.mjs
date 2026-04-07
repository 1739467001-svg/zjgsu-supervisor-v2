/**
 * 课程数据更新脚本
 * 数据来源: 2025-2026-2研究生课表2026-03-26.xls
 * 执行: node scripts/update-courses-2026-03-26.mjs
 */

import mysql from "mysql2/promise";
import XLSX from "xlsx";
import dotenv from "dotenv";

dotenv.config();

// ============================================================
// 解析周次字符串为数字数组
// ============================================================
function parseWeekNumbers(weekStr) {
  if (!weekStr || weekStr.trim() === "") return [];
  const str = weekStr.trim();
  const weeks = new Set();

  // 处理特殊描述（优先匹配）
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

  // 解析 "第X|Y|Z周" 格式（含多个周次）
  const pipePattern = /第([\d|]+)周/g;
  let match;
  while ((match = pipePattern.exec(str)) !== null) {
    const nums = match[1].split("|");
    nums.forEach((n) => {
      const num = parseInt(n.trim());
      if (!isNaN(num) && num > 0) weeks.add(num);
    });
  }

  // 解析 "第X周" 格式（单周次）
  const singlePattern = /第(\d+)周/g;
  while ((match = singlePattern.exec(str)) !== null) {
    const num = parseInt(match[1]);
    if (!isNaN(num) && num > 0) weeks.add(num);
  }

  return [...weeks].sort((a, b) => a - b);
}

// ============================================================
// 主函数
// ============================================================
async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("❌ 未找到 DATABASE_URL 环境变量");
    process.exit(1);
  }

  const connection = await mysql.createConnection(dbUrl);
  console.log("✅ 数据库连接成功");

  try {
    // 读取新课程 Excel 文件
    const xlsPath = "/root/upload/2025-2026-2研究生课表2026-03-26.xls";
    console.log(`\n📂 读取课程文件: ${xlsPath}`);
    const workbook = XLSX.readFile(xlsPath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    // 第0行是"排课信息"大标题，第1行是真正的表头，从第2行开始是数据
    const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const courseRows = allRows.slice(2); // 跳过前2行
    console.log(`📊 读取到 ${courseRows.length} 条课程记录`);

    // 过滤有效行（课程名称和教师不能为空）
    const validRows = courseRows.filter(
      (row) => row[3] && String(row[3]).trim() && row[7] && String(row[7]).trim()
    );
    console.log(`✅ 有效课程记录: ${validRows.length} 条`);

    // 统计信息
    const teacherSet = new Set(validRows.map((r) => String(r[7] || "").trim()).filter(Boolean));
    const collegeSet = new Set(validRows.map((r) => String(r[2] || "").trim()).filter(Boolean));
    console.log(`👨‍🏫 唯一教师数: ${teacherSet.size}`);
    console.log(`🏫 唯一学院数: ${collegeSet.size}`);

    // ============================================================
    // 清空旧课程数据（保留已有评价的关联，先处理外键）
    // ============================================================
    console.log("\n🗑️  清空旧课程数据...");

    // 先检查是否有评价数据
    const [evalCount] = await connection.execute(
      "SELECT COUNT(*) as cnt FROM course_evaluations"
    );
    console.log(`   当前评价记录数: ${evalCount[0].cnt} 条（将保留）`);

    // 清空课程表（评价表通过 courseId 外键关联，但 MySQL 默认不强制外键约束除非明确设置）
    await connection.execute("DELETE FROM courses");
    console.log("   ✅ 旧课程数据已清空");

    // 重置自增ID
    await connection.execute("ALTER TABLE courses AUTO_INCREMENT = 1");

    // ============================================================
    // 批量插入新课程数据
    // ============================================================
    console.log("\n📥 开始导入新课程数据...");
    let insertedCount = 0;
    const batchSize = 100;

    for (let i = 0; i < validRows.length; i += batchSize) {
      const batch = validRows.slice(i, i + batchSize);
      const values = batch.map((row) => {
        const customWeeks = String(row[12] || "").trim();
        const weekNumbers = parseWeekNumbers(customWeeks);
        const studentCountRaw = row[14];
        const studentCount =
          studentCountRaw !== undefined && studentCountRaw !== ""
            ? Math.round(parseFloat(String(studentCountRaw)) || 0)
            : 0;

        return [
          String(row[0] || "2025-2026").trim(),   // academicYear
          String(row[1] || "第二学期").trim(),     // semester
          String(row[2] || "").trim(),              // college
          String(row[3] || "").trim(),              // courseName
          String(row[4] || "").trim(),              // courseType
          String(row[5] || "").trim(),              // classroom
          String(row[6] || "").trim(),              // classId
          String(row[7] || "").trim(),              // teacher
          String(row[8] || "").trim(),              // campus
          String(row[9] || "").trim(),              // weekday
          String(row[10] || "").trim(),             // weekType
          String(row[11] || "").trim(),             // period
          customWeeks,                              // customWeeks
          JSON.stringify(weekNumbers),              // weekNumbers
          String(row[13] || "").trim(),             // studentMajor
          studentCount,                             // studentCount
        ];
      });

      if (values.length > 0) {
        const placeholders = values
          .map(() => "(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
          .join(",");
        await connection.execute(
          `INSERT INTO courses 
           (academicYear, semester, college, courseName, courseType, classroom, classId, 
            teacher, campus, weekday, weekType, period, customWeeks, weekNumbers, studentMajor, studentCount) 
           VALUES ${placeholders}`,
          values.flat()
        );
        insertedCount += values.length;
      }

      // 进度显示
      if ((i / batchSize) % 5 === 0) {
        process.stdout.write(`\r   进度: ${insertedCount}/${validRows.length} 条...`);
      }
    }
    console.log(`\r   ✅ 成功导入 ${insertedCount} 条课程记录`);

    // ============================================================
    // 验证导入结果
    // ============================================================
    console.log("\n🔍 验证导入结果...");
    const [totalResult] = await connection.execute(
      "SELECT COUNT(*) as total FROM courses"
    );
    const [teacherResult] = await connection.execute(
      "SELECT COUNT(DISTINCT teacher) as cnt FROM courses"
    );
    const [collegeResult] = await connection.execute(
      "SELECT COUNT(DISTINCT college) as cnt FROM courses"
    );
    const [collegeList] = await connection.execute(
      "SELECT college, COUNT(*) as cnt FROM courses GROUP BY college ORDER BY cnt DESC"
    );

    console.log(`   总课程记录: ${totalResult[0].total} 条`);
    console.log(`   唯一教师数: ${teacherResult[0].cnt}`);
    console.log(`   唯一学院数: ${collegeResult[0].cnt}`);
    console.log("\n   各学院课程数:");
    collegeList.forEach((r) => {
      console.log(`     ${r.college}: ${r.cnt} 条`);
    });

    console.log("\n✅ 课程数据更新完成！");
    console.log(`\n📋 前端统计数字应更新为:`);
    console.log(`   课程总数: ${totalResult[0].total}`);
    console.log(`   覆盖学院: ${collegeResult[0].cnt}`);
    console.log(`   授课教师: ${teacherResult[0].cnt}`);

  } catch (err) {
    console.error("\n❌ 导入失败:", err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error("❌ 脚本执行失败:", err);
  process.exit(1);
});
