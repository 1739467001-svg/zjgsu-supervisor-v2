import XLSX from "xlsx";
import { CourseEvaluation } from "../drizzle/schema";
import { formatDateOnlyBJ, formatDateBJ } from "../shared/dateUtils";

interface EvaluationExportData extends CourseEvaluation {
  course?: {
    courseName: string | null;
    teacher: string | null;
    college: string | null;
    campus: string | null;
    courseType: string | null;
    studentMajor?: string | null;
    classId?: string | null;
    weekday?: string | null;
    period?: string | null;
    studentCount?: number | null;
    classroom?: string | null;
  };
  supervisor?: {
    name: string | null;
    email: string | null;
  };
}

// ============================================================
// 评价维度定义（与前端 EvaluationForm 完全一致）
// ============================================================
const SCORE_DIMENSIONS = [
  {
    title: "一、教师风范",
    items: [
      { key: "score_teaching_content", label: "1. 教学行为合规性", description: "按课表准时上下课、不擅自调课、不久坐讲台、不长时间用视频代讲，无不当言论" },
      { key: "score_course_objective", label: "2. 课堂秩序管理", description: "有效提醒并营造学生前排就坐、合理使用电子设备的氛围" },
      { key: "score_reference_sharing", label: "3. 教学准备充分度", description: "教学材料、设备调试到位，呈现专业严谨性" },
      { key: "score_literature_humanities", label: "4. 前沿视野传递", description: "清晰关联教学内容与学科前沿、关键科研问题，体现研究生培养深度" },
      { key: "score_teaching_organization", label: "5. 教学感染力", description: "眼神、手势、语调自然得体，能吸引学生注意力，课堂氛围有效调动" },
    ],
  },
  {
    title: "二、学生状态",
    items: [
      { key: "score_course_development", label: "1. 到课率与准时率", description: "实际到课人数占比高，迟到、缺课现象少" },
      { key: "score_course_focus", label: "2. 课堂专注度", description: "学生抬头追随教学焦点、主动参与思考的比例与持续性强" },
      { key: "score_language_logic", label: "3. 设备使用合理性", description: "电子设备用于课程相关学习而非无关活动的程度" },
      { key: "score_interaction", label: "4. 互动响应率", description: "对教师提问或讨论邀请的响应积极性和广度" },
      { key: "score_learning_preparation", label: "5. 学习准备情况", description: "学生普遍携带相关资料、主动记录课堂笔记" },
    ],
  },
  {
    title: "三、课程内容",
    items: [
      { key: "score_teaching_quality", label: "1. 教学大纲贴合度", description: "严格按教学大纲授课，无擅自删减核心内容，教学进度合理" },
      { key: "score_active_response", label: "2. 深度与前沿性", description: "内容是否超越基础层面，融入最新研究进展与专业前沿动态" },
      { key: "score_student_centered", label: "3. 课件与案例质量", description: "PPT逻辑清晰、视觉辅助效果佳；案例典型时效强，具有启发性" },
      { key: "score_research_teaching", label: "4.1 科研转化融合度（学术学位课程）", description: "将自身科研成果或前沿课题有机转化为教学内容" },
      { key: "score_learning_effect", label: "4.2 前沿视野传递（专业学位课程）", description: "清晰关联教学内容与学科前沿、行业创新" },
      { key: "score_learning_task_design", label: "5. 学习任务设计", description: "阅读材料、课堂任务或课后作业具有一定挑战度" },
    ],
  },
  {
    title: "四、教学过程",
    items: [
      { key: "score_interaction_quality", label: "1. 师生互动质量", description: "互动是否频繁、自然，并能激发学生思考" },
      { key: "score_method_diversity", label: "2. 教学方法多样性", description: "是否根据内容灵活运用研讨、案例分析等多种方法" },
      { key: "score_equal_dialogue", label: "3. 平等交流氛围", description: "是否主动营造安全、平等的氛围" },
      { key: "score_pace_control", label: "4. 节奏调控能力", description: "能否根据学生现场反馈调整讲授速度与互动节奏" },
      { key: "score_feedback", label: "5. 即时反馈运用", description: "是否利用提问、小练习等方式即时诊断学习效果并回应" },
    ],
  },
];

// Excel 列头映射（与维度定义一致）
const SCORE_COLUMNS = SCORE_DIMENSIONS.flatMap((dim) =>
  dim.items.map((item) => ({ key: item.key, label: item.label.replace(/^\d+(\.\d+)?[\.\s]+/, "") }))
);

// ============================================================
// Excel 导出：按专业分类（每个专业一个 Sheet）
// ============================================================
export function generateEvaluationExcel(evaluations: EvaluationExportData[]): Buffer {
  const workbook = XLSX.utils.book_new();

  // 只导出已提交的评价
  const submitted = evaluations.filter((e) => e.status === "submitted");

  // 按学生专业分组
  const majorMap = new Map<string, EvaluationExportData[]>();
  for (const ev of submitted) {
    const major = (ev as any).course?.studentMajor || "未分类专业";
    if (!majorMap.has(major)) majorMap.set(major, []);
    majorMap.get(major)!.push(ev);
  }

  // 如果没有数据，创建空表
  if (majorMap.size === 0) {
    const ws = XLSX.utils.aoa_to_sheet([["暂无已提交的评价数据"]]);
    XLSX.utils.book_append_sheet(workbook, ws, "无数据");
    return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
  }

  // 为每个专业创建一个 Sheet
  for (const [major, evals] of majorMap) {
    const rows = evals.map((ev) => {
      const c = (ev as any).course || {};
      const s = (ev as any).supervisor || {};
      const row: Record<string, any> = {
        "课程名称": c.courseName || "—",
        "主讲教师": c.teacher || "—",
        "所属学院": c.college || "—",
        "课程性质": c.courseType || "—",
        "校区": c.campus || "—",
        "班级编号": c.classId || "—",
        "教室": c.classroom || "—",
        "上课时间": `${c.weekday || ""} ${c.period || ""}`.trim() || "—",
        "学生人数": c.studentCount || "—",
        "督导专家": s.name || "—",
        "听课日期": ev.listenDate ? formatDateOnlyBJ(ev.listenDate) : "—",
        "实际周次": ev.actualWeek ? `第${ev.actualWeek}周` : "—",
        "综合评分": ev.overallScore || "—",
      };
      // 添加所有评分维度列
      for (const col of SCORE_COLUMNS) {
        row[col.label] = (ev as any)[col.key] || "—";
      }
      // 文字评价
      row["教学亮点"] = ev.highlights || "—";
      row["不足与建议"] = ev.suggestions || "—";
      row["综合改进建议"] = ev.improvement_suggestion || "—";
      row["发展与支持建议"] = ev.development_suggestion || "—";
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows);

    // 设置列宽
    const colWidths: { wch: number }[] = [
      { wch: 22 }, // 课程名称
      { wch: 12 }, // 主讲教师
      { wch: 18 }, // 所属学院
      { wch: 12 }, // 课程性质
      { wch: 10 }, // 校区
      { wch: 14 }, // 班级编号
      { wch: 14 }, // 教室
      { wch: 14 }, // 上课时间
      { wch: 10 }, // 学生人数
      { wch: 12 }, // 督导专家
      { wch: 12 }, // 听课日期
      { wch: 10 }, // 实际周次
      { wch: 10 }, // 综合评分
    ];
    // 评分列
    for (let i = 0; i < SCORE_COLUMNS.length; i++) {
      colWidths.push({ wch: 14 });
    }
    // 文字评价列
    colWidths.push({ wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 });
    ws["!cols"] = colWidths;

    // Sheet 名称最多 31 字符
    const sheetName = major.length > 28 ? major.substring(0, 28) + "..." : major;
    XLSX.utils.book_append_sheet(workbook, ws, sheetName);
  }

  // 添加汇总 Sheet
  const summaryRows = Array.from(majorMap.entries()).map(([major, evals]) => {
    const scores = evals.filter((e) => e.overallScore).map((e) => e.overallScore!);
    const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : "—";
    return {
      "专业": major,
      "评价总数": evals.length,
      "平均综合评分": avgScore,
      "最高分": scores.length > 0 ? Math.max(...scores).toFixed(1) : "—",
      "最低分": scores.length > 0 ? Math.min(...scores).toFixed(1) : "—",
    };
  });
  const summaryWs = XLSX.utils.json_to_sheet(summaryRows);
  summaryWs["!cols"] = [{ wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(workbook, summaryWs, "专业汇总");

  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
}

// ============================================================
// PDF 导出：复刻督导评价表单（生成 HTML 转 PDF）
// ============================================================

function escapeHtml(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\n/g, "<br/>");
}

function renderScoreCircles(value: number | null | undefined, max = 5): string {
  if (!value) return '<span style="color:#999;font-size:12px;">未评分</span>';
  let html = '<div style="display:flex;gap:4px;align-items:center;">';
  for (let i = 1; i <= max; i++) {
    const active = i <= value;
    html += `<div style="width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;background:${active ? "#2c5282" : "#e8edf2"};color:${active ? "#fff" : "#999"};">${i}</div>`;
  }
  html += `<span style="font-size:12px;font-weight:600;color:#2c5282;margin-left:4px;">${value}/${max}分</span></div>`;
  return html;
}

function renderSingleEvaluationHtml(ev: EvaluationExportData): string {
  const c = (ev as any).course || {};
  const s = (ev as any).supervisor || {};

  let html = `
<div style="page-break-after:always;max-width:700px;margin:0 auto;font-family:'SimSun','Microsoft YaHei','PingFang SC',sans-serif;color:#1a202c;">
  <!-- 标题 -->
  <div style="text-align:center;margin-bottom:20px;">
    <h1 style="font-size:20px;font-weight:bold;margin:0 0 4px 0;">浙江工商大学研究生课程督导评价表</h1>
  </div>

  <!-- 课程基本信息 -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:13px;" border="1" cellpadding="6">
    <tr>
      <td style="background:#f0f4f8;font-weight:bold;width:15%;">课程名称</td>
      <td style="width:35%;">${escapeHtml(c.courseName)}</td>
      <td style="background:#f0f4f8;font-weight:bold;width:15%;">主讲教师</td>
      <td style="width:35%;">${escapeHtml(c.teacher)}</td>
    </tr>
    <tr>
      <td style="background:#f0f4f8;font-weight:bold;">所属学院</td>
      <td>${escapeHtml(c.college)}</td>
      <td style="background:#f0f4f8;font-weight:bold;">课程性质</td>
      <td>${escapeHtml(c.courseType)}</td>
    </tr>
    <tr>
      <td style="background:#f0f4f8;font-weight:bold;">校区</td>
      <td>${escapeHtml(c.campus)}</td>
      <td style="background:#f0f4f8;font-weight:bold;">教室</td>
      <td>${escapeHtml(c.classroom)}</td>
    </tr>
    <tr>
      <td style="background:#f0f4f8;font-weight:bold;">上课时间</td>
      <td>${escapeHtml(c.weekday)} ${escapeHtml(c.period)}</td>
      <td style="background:#f0f4f8;font-weight:bold;">学生人数</td>
      <td>${c.studentCount || "—"}</td>
    </tr>
    <tr>
      <td style="background:#f0f4f8;font-weight:bold;">督导专家</td>
      <td>${escapeHtml(s.name)}</td>
      <td style="background:#f0f4f8;font-weight:bold;">听课日期</td>
      <td>${ev.listenDate ? formatDateOnlyBJ(ev.listenDate) : "—"}</td>
    </tr>
    <tr>
      <td style="background:#f0f4f8;font-weight:bold;">实际周次</td>
      <td>${ev.actualWeek ? `第${ev.actualWeek}周` : "—"}</td>
      <td style="background:#f0f4f8;font-weight:bold;">综合评分</td>
      <td style="font-weight:bold;color:#2c5282;">${ev.overallScore ? `${ev.overallScore.toFixed(1)}/5` : "—"}</td>
    </tr>
  </table>

  <!-- 一、定量评分 -->
  <h2 style="font-size:15px;font-weight:bold;color:#2c5282;margin:16px 0 10px 0;border-bottom:2px solid #2c5282;padding-bottom:4px;">一、定量督导评分</h2>
`;

  for (const dim of SCORE_DIMENSIONS) {
    html += `<h3 style="font-size:13px;font-weight:bold;color:#2c5282;margin:12px 0 6px 0;background:#f0f4f8;padding:6px 10px;border-radius:4px;">${dim.title}</h3>`;
    html += '<table style="width:100%;border-collapse:collapse;margin-bottom:8px;font-size:12px;" border="1" cellpadding="5">';
    html += '<tr style="background:#f7fafc;"><th style="width:30%;text-align:left;">评价指标</th><th style="width:40%;text-align:left;">说明</th><th style="width:30%;text-align:center;">评分</th></tr>';

    for (const item of dim.items) {
      const score = (ev as any)[item.key];
      // 4.1/4.2 二选一：无值的跳过
      if ((item.key === "score_research_teaching" || item.key === "score_learning_effect") && !score) continue;
      // 选填项无值跳过
      if (item.key === "score_learning_task_design" && !score) continue;

      html += `<tr>
        <td style="font-weight:500;">${escapeHtml(item.label)}</td>
        <td style="color:#555;font-size:11px;">${escapeHtml(item.description)}</td>
        <td style="text-align:center;">${renderScoreCircles(score)}</td>
      </tr>`;
    }
    html += "</table>";
  }

  // 二、课程亮点与评价
  html += `
  <h2 style="font-size:15px;font-weight:bold;color:#2c5282;margin:16px 0 10px 0;border-bottom:2px solid #2c5282;padding-bottom:4px;">二、课程亮点与评价</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:8px;font-size:12px;" border="1" cellpadding="8">
    <tr>
      <td style="background:#f0f4f8;font-weight:bold;width:25%;">最突出的教学亮点 <span style="color:red;">*</span></td>
      <td style="line-height:1.6;">${escapeHtml(ev.highlights) || '<span style="color:#999;">未填写</span>'}</td>
    </tr>
    <tr>
      <td style="background:#f0f4f8;font-weight:bold;">存在不足与提升建议 <span style="color:red;">*</span></td>
      <td style="line-height:1.6;">${escapeHtml(ev.suggestions) || '<span style="color:#999;">未填写</span>'}</td>
    </tr>
  </table>`;

  // 三、其他建议
  html += `
  <h2 style="font-size:15px;font-weight:bold;color:#2c5282;margin:16px 0 10px 0;border-bottom:2px solid #2c5282;padding-bottom:4px;">三、其他建议（可填）</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:8px;font-size:12px;" border="1" cellpadding="8">
    <tr>
      <td style="background:#f0f4f8;font-weight:bold;width:25%;">综合改进建议</td>
      <td style="line-height:1.6;">${escapeHtml(ev.improvement_suggestion) || '<span style="color:#999;">未填写</span>'}</td>
    </tr>
    <tr>
      <td style="background:#f0f4f8;font-weight:bold;">发展与支持建议</td>
      <td style="line-height:1.6;">${escapeHtml(ev.development_suggestion) || '<span style="color:#999;">未填写</span>'}</td>
    </tr>
  </table>`;

  html += "</div>";
  return html;
}

/**
 * 生成所有评价的 PDF HTML（每个评价一页）
 */
export function generateEvaluationPdfHtml(evaluations: EvaluationExportData[]): string {
  const submitted = evaluations.filter((e) => e.status === "submitted");

  if (submitted.length === 0) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="text-align:center;padding:60px;font-family:sans-serif;"><h2>暂无已提交的评价数据</h2></body></html>`;
  }

  let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    @page { size: A4; margin: 15mm 12mm; }
    body { margin: 0; padding: 0; }
    table { border-color: #ccc; }
    td, th { border-color: #ccc; }
  </style>
</head>
<body>
`;

  for (let i = 0; i < submitted.length; i++) {
    html += renderSingleEvaluationHtml(submitted[i]);
  }

  html += "</body></html>";
  return html;
}

/**
 * 调用 wkhtmltopdf 将评价 HTML 转为 PDF 二进制 Buffer
 */
export async function generateEvaluationPdfBuffer(evaluations: EvaluationExportData[]): Promise<Buffer> {
  const { execFile } = await import("child_process");
  const { promisify } = await import("util");
  const { writeFile, readFile, unlink } = await import("fs/promises");
  const { tmpdir } = await import("os");
  const { join } = await import("path");
  const execFileAsync = promisify(execFile);

  const html = generateEvaluationPdfHtml(evaluations);
  const tmpHtml = join(tmpdir(), `eval_${Date.now()}.html`);
  const tmpPdf = join(tmpdir(), `eval_${Date.now()}.pdf`);

  try {
    await writeFile(tmpHtml, html, "utf-8");
    await execFileAsync("wkhtmltopdf", [
      "--encoding", "utf-8",
      "--page-size", "A4",
      "--margin-top", "15mm",
      "--margin-bottom", "15mm",
      "--margin-left", "12mm",
      "--margin-right", "12mm",
      "--enable-local-file-access",
      "--quiet",
      tmpHtml,
      tmpPdf,
    ], { timeout: 60000 });
    const pdfBuffer = await readFile(tmpPdf);
    return pdfBuffer;
  } finally {
    await unlink(tmpHtml).catch(() => {});
    await unlink(tmpPdf).catch(() => {});
  }
}

/**
 * 生成统计汇总 Excel 文件（保留兼容）
 */
export function generateStatisticsExcel(
  evaluations: EvaluationExportData[],
  colleges: string[]
): Buffer {
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

  const worksheet = XLSX.utils.json_to_sheet(collegeStats);
  worksheet["!cols"] = [
    { wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "统计汇总");

  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
}
