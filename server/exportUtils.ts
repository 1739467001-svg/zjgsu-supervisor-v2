import XLSX from "xlsx";
import { CourseEvaluation } from "../drizzle/schema";

interface EvaluationExportData extends CourseEvaluation {
  course?: {
    courseName: string | null;
    teacher: string | null;
    college: string | null;
    campus: string | null;
    courseType: string | null;
  };
  supervisor?: {
    name: string | null;
    email: string | null;
  };
}

/**
 * 生成评价数据 Excel 文件
 */
export function generateEvaluationExcel(evaluations: EvaluationExportData[]): Buffer {
  // 准备数据
  const data = evaluations.map((evaluation) => ({
    "评价ID": evaluation.id,
    "课程名称": (evaluation as any).course?.courseName || "未知课程",
    "主讲教师": (evaluation as any).course?.teacher || "—",
    "所属学院": (evaluation as any).course?.college || "—",
    "校区": (evaluation as any).course?.campus || "—",
    "课程性质": (evaluation as any).course?.courseType || "—",
    "督导专家": (evaluation as any).supervisor?.name || "—",
    "听课日期": evaluation.listenDate ? new Date(evaluation.listenDate).toLocaleDateString("zh-CN") : "—",
    "实际周次": evaluation.actualWeek ? `第${evaluation.actualWeek}周` : "—",
    "综合评分": evaluation.overallScore || "—",
    "教学内容": evaluation.score_teaching_content || "—",
    "课程目标": evaluation.score_course_objective || "—",
    "参考资料": evaluation.score_reference_sharing || "—",
    "文献融入": evaluation.score_literature_humanities || "—",
    "教学组织": evaluation.score_teaching_organization || "—",
    "课程发展": evaluation.score_course_development || "—",
    "课程专注": evaluation.score_course_focus || "—",
    "语言逻辑": evaluation.score_language_logic || "—",
    "互动参与": evaluation.score_interaction || "—",
    "学习准备": evaluation.score_learning_preparation || "—",
    "教学质量": evaluation.score_teaching_quality || "—",
    "积极回应": evaluation.score_active_response || "—",
    "以学生为中心": evaluation.score_student_centered || "—",
    "科研融合": evaluation.score_research_teaching || "—",
    "学习效果": evaluation.score_learning_effect || "—",
    "互动质量": (evaluation as any).score_interaction_quality || "—",
    "方法多样": (evaluation as any).score_method_diversity || "—",
    "平等交流": (evaluation as any).score_equal_dialogue || "—",
    "节奏调控": (evaluation as any).score_pace_control || "—",
    "即时反馈": (evaluation as any).score_feedback || "—",
    "评价状态": evaluation.status === "submitted" ? "已提交" : "草稿",
    "提交时间": evaluation.updatedAt ? new Date(evaluation.updatedAt).toLocaleString("zh-CN") : "—",
  }));

  // 创建工作簿
  const worksheet = XLSX.utils.json_to_sheet(data);
  
  // 设置列宽
  const columnWidths = [
    { wch: 10 }, // 评价ID
    { wch: 20 }, // 课程名称
    { wch: 15 }, // 主讲教师
    { wch: 18 }, // 所属学院
    { wch: 10 }, // 校区
    { wch: 12 }, // 课程性质
    { wch: 15 }, // 督导专家
    { wch: 12 }, // 听课日期
    { wch: 10 }, // 实际周次
    { wch: 8 },  // 综合评分
    { wch: 8 },  // 教学内容
    { wch: 8 },  // 课程目标
    { wch: 8 },  // 参考资料
    { wch: 8 },  // 文献融入
    { wch: 8 },  // 教学组织
    { wch: 8 },  // 课程发展
    { wch: 8 },  // 课程专注
    { wch: 8 },  // 语言逻辑
    { wch: 8 },  // 互动参与
    { wch: 8 },  // 学习准备
    { wch: 8 },  // 教学质量
    { wch: 8 },  // 积极回应
    { wch: 12 }, // 以学生为中心
    { wch: 8 },  // 科研融合
    { wch: 8 },  // 学习效果
    { wch: 8 },  // 互动质量
    { wch: 8 },  // 方法多样
    { wch: 8 },  // 平等交流
    { wch: 8 },  // 节奏调控
    { wch: 8 },  // 即时反馈
    { wch: 10 }, // 评价状态
    { wch: 18 }, // 提交时间
  ];
  worksheet["!cols"] = columnWidths;

  // 创建工作簿并添加工作表
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "评价数据");

  // 生成 Buffer
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
  return buffer;
}

/**
 * 生成统计汇总 Excel 文件
 */
export function generateStatisticsExcel(
  evaluations: EvaluationExportData[],
  colleges: string[]
): Buffer {
  // 按学院统计
  const collegeStats = colleges.map((college) => {
    const collegeEvals = evaluations.filter((e) => (e as any).course?.college === college);
    const submitted = collegeEvals.filter((e) => e.status === "submitted").length;
    const avgScore =
      collegeEvals.length > 0
        ? (
            collegeEvals.reduce((sum, e) => sum + (e.overallScore || 0), 0) /
            collegeEvals.filter((e) => e.overallScore).length
          ).toFixed(2)
        : "—";

    return {
      "学院": college,
      "总课程数": collegeEvals.length,
      "已评价": submitted,
      "未评价": collegeEvals.length - submitted,
      "完成率": collegeEvals.length > 0 ? `${((submitted / collegeEvals.length) * 100).toFixed(1)}%` : "—",
      "平均评分": avgScore,
    };
  });

  // 创建工作簿
  const worksheet = XLSX.utils.json_to_sheet(collegeStats);
  worksheet["!cols"] = [
    { wch: 20 }, // 学院
    { wch: 12 }, // 总课程数
    { wch: 10 }, // 已评价
    { wch: 10 }, // 未评价
    { wch: 10 }, // 完成率
    { wch: 10 }, // 平均评分
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "统计汇总");

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
  return buffer;
}
