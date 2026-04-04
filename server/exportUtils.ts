import XLSX from "xlsx";
import { CourseEvaluation } from "../drizzle/schema";
import { formatDateOnlyBJ } from "../shared/dateUtils";

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
// Excel 导出：按学院分类（每个学院一个 Sheet）
// ============================================================

/** 为工作表添加表头样式（蓝色背景、白色加粗字体、居中） */
function styleHeaderRow(ws: XLSX.WorkSheet, colCount: number): void {
  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
    fill: { fgColor: { rgb: "2C5282" }, patternType: "solid" as const },
    alignment: { horizontal: "center" as const, vertical: "center" as const, wrapText: true },
    border: {
      top: { style: "thin" as const, color: { rgb: "AAAAAA" } },
      bottom: { style: "thin" as const, color: { rgb: "AAAAAA" } },
      left: { style: "thin" as const, color: { rgb: "AAAAAA" } },
      right: { style: "thin" as const, color: { rgb: "AAAAAA" } },
    },
  };
  const dataStyle = {
    alignment: { vertical: "center" as const, wrapText: true },
    border: {
      top: { style: "thin" as const, color: { rgb: "DDDDDD" } },
      bottom: { style: "thin" as const, color: { rgb: "DDDDDD" } },
      left: { style: "thin" as const, color: { rgb: "DDDDDD" } },
      right: { style: "thin" as const, color: { rgb: "DDDDDD" } },
    },
  };
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[cellAddr]) ws[cellAddr] = { t: "z", v: "" };
      ws[cellAddr].s = R === 0 ? headerStyle : dataStyle;
    }
  }
  // 冻结首行
  ws["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft" };
}

export function generateEvaluationExcel(evaluations: EvaluationExportData[]): Buffer {
  const workbook = XLSX.utils.book_new();

  // 只导出已提交的评价
  const submitted = evaluations.filter((e) => e.status === "submitted");

  // 按学院分组
  const collegeMap = new Map<string, EvaluationExportData[]>();
  for (const ev of submitted) {
    const college = (ev as any).course?.college || "未分类学院";
    if (!collegeMap.has(college)) collegeMap.set(college, []);
    collegeMap.get(college)!.push(ev);
  }

  // 如果没有数据，创建空表
  if (collegeMap.size === 0) {
    const ws = XLSX.utils.aoa_to_sheet([["暂无已提交的评价数据"]]);
    XLSX.utils.book_append_sheet(workbook, ws, "无数据");
    return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
  }

  // 定义列头（简化版，去掉学院列，因为已按学院分 Sheet）
  const HEADER_COLS = [
    { key: "courseName",    label: "课程名称",   width: 24 },
    { key: "teacher",       label: "主讲教师",   width: 12 },
    { key: "studentMajor",  label: "学生专业",   width: 20 },
    { key: "courseType",    label: "课程性质",   width: 12 },
    { key: "campus",        label: "校区",       width: 10 },
    { key: "classId",       label: "班级编号",   width: 14 },
    { key: "classroom",     label: "教室",       width: 14 },
    { key: "weekdayPeriod", label: "上课时间",   width: 14 },
    { key: "studentCount",  label: "学生人数",   width: 10 },
    { key: "supervisor",    label: "督导专家",   width: 12 },
    { key: "listenDate",    label: "听课日期",   width: 12 },
    { key: "actualWeek",    label: "实际周次",   width: 10 },
    { key: "overallScore",  label: "综合评分",   width: 10 },
  ];

  // 为每个学院创建一个 Sheet
  for (const [college, evals] of Array.from(collegeMap.entries())) {
    // 构建二维数组（第一行为表头）
    const headerRow: string[] = [
      ...HEADER_COLS.map((c) => c.label),
      ...SCORE_COLUMNS.map((c) => c.label),
      "教学亮点", "不足与建议", "综合改进建议", "发展与支持建议",
    ];

    const dataRows = evals.map((ev: EvaluationExportData) => {
      const c = (ev as any).course || {};
      const s = (ev as any).supervisor || {};
      const baseRow = [
        c.courseName || "—",
        c.teacher || "—",
        c.studentMajor || "—",
        c.courseType || "—",
        c.campus || "—",
        c.classId || "—",
        c.classroom || "—",
        `${c.weekday || ""} ${c.period || ""}`.trim() || "—",
        c.studentCount ?? "—",
        s.name || "—",
        ev.listenDate ? formatDateOnlyBJ(ev.listenDate) : "—",
        ev.actualWeek ? `第${ev.actualWeek}周` : "—",
        ev.overallScore ?? "—",
      ];
      const scoreRow = SCORE_COLUMNS.map((col) => (ev as any)[col.key] ?? "—");
      const textRow = [
        ev.highlights || "—",
        ev.suggestions || "—",
        ev.improvement_suggestion || "—",
        ev.development_suggestion || "—",
      ];
      return [...baseRow, ...scoreRow, ...textRow];
    });

    const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);

    // 设置列宽
    const colWidths: { wch: number }[] = [
      ...HEADER_COLS.map((c) => ({ wch: c.width })),
      ...SCORE_COLUMNS.map(() => ({ wch: 12 })),
      { wch: 36 }, { wch: 36 }, { wch: 36 }, { wch: 36 },
    ];
    ws["!cols"] = colWidths;

    // 设置行高（表头行稍高）
    ws["!rows"] = [{ hpt: 22 }];

    // 应用样式
    styleHeaderRow(ws, headerRow.length);

    // Sheet 名称最多 31 字符
    const sheetName = college.length > 28 ? college.substring(0, 28) + "..." : college;
    XLSX.utils.book_append_sheet(workbook, ws, sheetName);
  }

  // 添加学院汇总 Sheet
  const summaryHeader = ["学院", "评价总数", "平均综合评分", "最高分", "最低分"];
  const summaryData = Array.from(collegeMap.entries()).map(([college, evals]) => {
    const scores = evals.filter((e) => e.overallScore != null).map((e) => e.overallScore!);
    const avgScore = scores.length > 0 ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)) : "—";
    return [
      college,
      evals.length,
      avgScore,
      scores.length > 0 ? parseFloat(Math.max(...scores).toFixed(1)) : "—",
      scores.length > 0 ? parseFloat(Math.min(...scores).toFixed(1)) : "—",
    ];
  });
  const summaryWs = XLSX.utils.aoa_to_sheet([summaryHeader, ...summaryData]);
  summaryWs["!cols"] = [{ wch: 28 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 10 }];
  summaryWs["!rows"] = [{ hpt: 22 }];
  styleHeaderRow(summaryWs, 5);
  XLSX.utils.book_append_sheet(workbook, summaryWs, "学院汇总");

  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
}

// ============================================================
// HTML 导出工具函数
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

function renderScoreBar(value: number | null | undefined, max = 5): string {
  if (!value) return '<span style="color:#999;font-size:12px;">未评分</span>';
  const pct = (value / max) * 100;
  const color = value >= 4 ? "#276749" : value >= 3 ? "#2c5282" : "#c05621";
  let circles = '<div style="display:inline-flex;gap:3px;vertical-align:middle;">';
  for (let i = 1; i <= max; i++) {
    const active = i <= value;
    circles += `<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;font-size:10px;font-weight:700;background:${active ? color : "#e8edf2"};color:${active ? "#fff" : "#aaa"};">${i}</span>`;
  }
  circles += `<span style="font-size:12px;font-weight:600;color:${color};margin-left:4px;">${value}/${max}</span></div>`;
  return circles;
}

function renderSingleEvaluationHtml(ev: EvaluationExportData, index: number, total: number): string {
  const c = (ev as any).course || {};
  const s = (ev as any).supervisor || {};
  const isLast = index === total - 1;

  // 计算各维度平均分
  const dimAvgs = SCORE_DIMENSIONS.map((dim) => {
    const scores = dim.items
      .map((item) => (ev as any)[item.key])
      .filter((v): v is number => v != null && v > 0);
    return scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  });

  let html = `
<div class="eval-page" style="page-break-after:${isLast ? "avoid" : "always"};max-width:760px;margin:0 auto 0 auto;font-family:'SimSun','Microsoft YaHei','PingFang SC',Arial,sans-serif;color:#1a202c;padding:20px 24px;">

  <!-- 页眉 -->
  <div style="text-align:center;border-bottom:3px double #2c5282;padding-bottom:12px;margin-bottom:16px;">
    <div style="font-size:13px;color:#555;margin-bottom:4px;">浙江工商大学研究生院</div>
    <h1 style="font-size:20px;font-weight:bold;margin:0;color:#1a202c;letter-spacing:2px;">研究生课程督导评价表</h1>
    <div style="font-size:11px;color:#888;margin-top:4px;">第 ${index + 1} 份 / 共 ${total} 份</div>
  </div>

  <!-- 课程基本信息 -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:14px;font-size:12.5px;" cellpadding="6">
    <colgroup><col style="width:13%"><col style="width:37%"><col style="width:13%"><col style="width:37%"></colgroup>
    <tr style="background:#eef2f8;">
      <td style="font-weight:bold;border:1px solid #c8d4e8;padding:6px 8px;">课程名称</td>
      <td style="border:1px solid #c8d4e8;padding:6px 8px;font-weight:600;">${escapeHtml(c.courseName) || "—"}</td>
      <td style="font-weight:bold;border:1px solid #c8d4e8;padding:6px 8px;">主讲教师</td>
      <td style="border:1px solid #c8d4e8;padding:6px 8px;">${escapeHtml(c.teacher) || "—"}</td>
    </tr>
    <tr>
      <td style="font-weight:bold;border:1px solid #c8d4e8;padding:6px 8px;background:#eef2f8;">所属学院</td>
      <td style="border:1px solid #c8d4e8;padding:6px 8px;">${escapeHtml(c.college) || "—"}</td>
      <td style="font-weight:bold;border:1px solid #c8d4e8;padding:6px 8px;background:#eef2f8;">课程性质</td>
      <td style="border:1px solid #c8d4e8;padding:6px 8px;">${escapeHtml(c.courseType) || "—"}</td>
    </tr>
    <tr style="background:#eef2f8;">
      <td style="font-weight:bold;border:1px solid #c8d4e8;padding:6px 8px;">校区</td>
      <td style="border:1px solid #c8d4e8;padding:6px 8px;">${escapeHtml(c.campus) || "—"}</td>
      <td style="font-weight:bold;border:1px solid #c8d4e8;padding:6px 8px;">教室</td>
      <td style="border:1px solid #c8d4e8;padding:6px 8px;">${escapeHtml(c.classroom) || "—"}</td>
    </tr>
    <tr>
      <td style="font-weight:bold;border:1px solid #c8d4e8;padding:6px 8px;background:#eef2f8;">上课时间</td>
      <td style="border:1px solid #c8d4e8;padding:6px 8px;">${escapeHtml(c.weekday) || ""} ${escapeHtml(c.period) || ""}</td>
      <td style="font-weight:bold;border:1px solid #c8d4e8;padding:6px 8px;background:#eef2f8;">选课人数</td>
      <td style="border:1px solid #c8d4e8;padding:6px 8px;">${c.studentCount || "—"}</td>
    </tr>
    <tr style="background:#eef2f8;">
      <td style="font-weight:bold;border:1px solid #c8d4e8;padding:6px 8px;">督导专家</td>
      <td style="border:1px solid #c8d4e8;padding:6px 8px;">${escapeHtml(s.name) || "—"}</td>
      <td style="font-weight:bold;border:1px solid #c8d4e8;padding:6px 8px;">听课日期</td>
      <td style="border:1px solid #c8d4e8;padding:6px 8px;">${ev.listenDate ? formatDateOnlyBJ(ev.listenDate) : "—"}</td>
    </tr>
    <tr>
      <td style="font-weight:bold;border:1px solid #c8d4e8;padding:6px 8px;background:#eef2f8;">实际周次</td>
      <td style="border:1px solid #c8d4e8;padding:6px 8px;">${ev.actualWeek ? `第 ${ev.actualWeek} 周` : "—"}</td>
      <td style="font-weight:bold;border:1px solid #c8d4e8;padding:6px 8px;background:#eef2f8;">综合评分</td>
      <td style="border:1px solid #c8d4e8;padding:6px 8px;font-weight:bold;color:${ev.overallScore && ev.overallScore >= 4 ? "#276749" : ev.overallScore && ev.overallScore >= 3 ? "#2c5282" : "#c05621"};">
        ${ev.overallScore ? `${ev.overallScore.toFixed(1)} / 5.0 分` : "—"}
      </td>
    </tr>
  </table>

  <!-- 维度评分概览 -->
  <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
    ${SCORE_DIMENSIONS.map((dim, i) => {
      const avg = dimAvgs[i];
      const color = avg && avg >= 4 ? "#276749" : avg && avg >= 3 ? "#2c5282" : "#c05621";
      return `<div style="flex:1;min-width:120px;background:#f7fafc;border:1px solid #c8d4e8;border-radius:6px;padding:8px 10px;text-align:center;">
        <div style="font-size:11px;color:#555;margin-bottom:4px;">${dim.title}</div>
        <div style="font-size:18px;font-weight:bold;color:${avg ? color : "#999"};">${avg ? avg.toFixed(1) : "—"}</div>
        <div style="font-size:10px;color:#999;">/ 5.0</div>
      </div>`;
    }).join("")}
  </div>

  <!-- 一、定量督导评分 -->
  <div style="margin-bottom:14px;">
    <h2 style="font-size:14px;font-weight:bold;color:#fff;background:#2c5282;margin:0 0 0 0;padding:7px 12px;border-radius:4px 4px 0 0;">一、定量督导评分</h2>
`;

  for (const dim of SCORE_DIMENSIONS) {
    html += `
    <div style="margin-bottom:10px;">
      <div style="font-size:12.5px;font-weight:bold;color:#2c5282;background:#eef2f8;padding:5px 10px;border-left:3px solid #2c5282;">${dim.title}</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;" cellpadding="0" cellspacing="0">
        <tr style="background:#f7fafc;">
          <th style="border:1px solid #c8d4e8;padding:5px 8px;text-align:left;width:32%;font-weight:600;">评价指标</th>
          <th style="border:1px solid #c8d4e8;padding:5px 8px;text-align:left;width:42%;font-weight:600;">说明</th>
          <th style="border:1px solid #c8d4e8;padding:5px 8px;text-align:center;width:26%;font-weight:600;">评分</th>
        </tr>`;

    for (const item of dim.items) {
      const score = (ev as any)[item.key];
      // 4.1/4.2 二选一：无值的跳过
      if ((item.key === "score_research_teaching" || item.key === "score_learning_effect") && !score) continue;
      // 选填项无值跳过
      if (item.key === "score_learning_task_design" && !score) continue;

      html += `
        <tr>
          <td style="border:1px solid #c8d4e8;padding:5px 8px;font-weight:500;">${escapeHtml(item.label)}</td>
          <td style="border:1px solid #c8d4e8;padding:5px 8px;color:#555;font-size:11px;line-height:1.4;">${escapeHtml(item.description)}</td>
          <td style="border:1px solid #c8d4e8;padding:5px 8px;text-align:center;">${renderScoreBar(score)}</td>
        </tr>`;
    }
    html += `</table></div>`;
  }

  html += `</div>`;

  // 二、课程亮点与评价
  html += `
  <div style="margin-bottom:14px;">
    <h2 style="font-size:14px;font-weight:bold;color:#fff;background:#2c5282;margin:0 0 0 0;padding:7px 12px;border-radius:4px 4px 0 0;">二、课程亮点与评价</h2>
    <table style="width:100%;border-collapse:collapse;font-size:12px;" cellpadding="0" cellspacing="0">
      <tr>
        <td style="border:1px solid #c8d4e8;padding:8px 10px;background:#eef2f8;font-weight:bold;width:22%;vertical-align:top;">最突出的教学亮点 <span style="color:#e53e3e;">*</span></td>
        <td style="border:1px solid #c8d4e8;padding:8px 10px;line-height:1.7;min-height:50px;">${escapeHtml(ev.highlights) || '<span style="color:#bbb;">未填写</span>'}</td>
      </tr>
      <tr>
        <td style="border:1px solid #c8d4e8;padding:8px 10px;background:#eef2f8;font-weight:bold;vertical-align:top;">存在不足与提升建议 <span style="color:#e53e3e;">*</span></td>
        <td style="border:1px solid #c8d4e8;padding:8px 10px;line-height:1.7;min-height:50px;">${escapeHtml(ev.suggestions) || '<span style="color:#bbb;">未填写</span>'}</td>
      </tr>
    </table>
  </div>`;

  // 三、具体建议
  html += `
  <div style="margin-bottom:14px;">
    <h2 style="font-size:14px;font-weight:bold;color:#fff;background:#2c5282;margin:0 0 0 0;padding:7px 12px;border-radius:4px 4px 0 0;">三、具体建议</h2>
    <table style="width:100%;border-collapse:collapse;font-size:12px;" cellpadding="0" cellspacing="0">
      <tr>
        <td style="border:1px solid #c8d4e8;padding:8px 10px;background:#eef2f8;font-weight:bold;width:22%;vertical-align:top;">针对性改进建议 <span style="color:#e53e3e;">*</span></td>
        <td style="border:1px solid #c8d4e8;padding:8px 10px;line-height:1.7;min-height:40px;">${escapeHtml(ev.improvement_suggestion) || '<span style="color:#bbb;">未填写</span>'}</td>
      </tr>
      <tr>
        <td style="border:1px solid #c8d4e8;padding:8px 10px;background:#eef2f8;font-weight:bold;vertical-align:top;">拓展性发展建议 <span style="color:#e53e3e;">*</span></td>
        <td style="border:1px solid #c8d4e8;padding:8px 10px;line-height:1.7;min-height:40px;">${escapeHtml(ev.development_suggestion) || '<span style="color:#bbb;">未填写</span>'}</td>
      </tr>

    </table>
  </div>`;

  // 签名栏
  html += `
  <div style="display:flex;justify-content:space-between;margin-top:18px;padding-top:10px;border-top:1px dashed #c8d4e8;font-size:12px;color:#555;">
    <div>督导专家签名：<span style="display:inline-block;width:100px;border-bottom:1px solid #999;"></span></div>
    <div>评价日期：${ev.listenDate ? formatDateOnlyBJ(ev.listenDate) : "　　　　年　　月　　日"}</div>
    <div>评价状态：<span style="font-weight:bold;color:${ev.status === "submitted" ? "#276749" : "#c05621"};">${ev.status === "submitted" ? "已提交" : "草稿"}</span></div>
  </div>

</div>`;

  return html;
}

// ============================================================
// 生成批量评价 HTML（每份评价一页，支持打印为 PDF）
// ============================================================
export function generateEvaluationPdfHtml(evaluations: EvaluationExportData[]): string {
  const submitted = evaluations.filter((e) => e.status === "submitted");

  if (submitted.length === 0) {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <title>督导评价报表</title>
  <style>body{text-align:center;padding:80px;font-family:"Microsoft YaHei",sans-serif;color:#555;}</style>
</head>
<body>
  <h2 style="color:#2c5282;">暂无已提交的评价数据</h2>
  <p>请确认已有督导专家提交评价后再导出。</p>
</body>
</html>`;
  }

  const todayStr = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());

  let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <title>浙江工商大学研究生院督导评价报表 - ${todayStr}</title>
  <style>
    @page {
      size: A4;
      margin: 12mm 10mm;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .eval-page {
      background: #fff;
    }
    @media print {
      .no-print { display: none !important; }
      .eval-page { page-break-after: always; }
      .eval-page:last-child { page-break-after: avoid; }
    }
    /* 打印工具栏（仅屏幕显示） */
    .print-toolbar {
      position: fixed;
      top: 0; left: 0; right: 0;
      background: #2c5282;
      color: white;
      padding: 10px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 9999;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .print-toolbar h3 { margin: 0; font-size: 15px; }
    .print-toolbar .info { font-size: 12px; opacity: 0.85; }
    .print-btn {
      background: #fff;
      color: #2c5282;
      border: none;
      padding: 8px 20px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .print-btn:hover { background: #ebf4ff; }
    .dl-btn {
      background: transparent;
      color: #fff;
      border: 1px solid rgba(255,255,255,0.6);
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
      margin-right: 8px;
    }
    .dl-btn:hover { background: rgba(255,255,255,0.15); }
    .content-wrapper {
      padding-top: 56px;
    }
    @media print {
      .print-toolbar { display: none; }
      .content-wrapper { padding-top: 0; }
    }
  </style>
</head>
<body>

<!-- 打印工具栏（屏幕显示，打印时隐藏） -->
<div class="print-toolbar no-print">
  <div>
    <h3>浙江工商大学研究生院 · 督导评价报表</h3>
    <div class="info">共 ${submitted.length} 份评价 · 导出时间：${todayStr}</div>
  </div>
  <div style="display:flex;align-items:center;">
    <button class="dl-btn" onclick="downloadHtml()">⬇ 下载 HTML 文件</button>
    <button class="print-btn" onclick="window.print()">🖨 打印 / 另存为 PDF</button>
  </div>
</div>

<div class="content-wrapper">
`;

  for (let i = 0; i < submitted.length; i++) {
    html += renderSingleEvaluationHtml(submitted[i], i, submitted.length);
  }

  html += `
</div>

<script>
function downloadHtml() {
  var blob = new Blob([document.documentElement.outerHTML], {type: 'text/html;charset=utf-8'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '督导评价报表_${todayStr.replace(/\//g, "-")}.html';
  a.click();
}
// 页面加载后提示用户
window.addEventListener('load', function() {
  console.log('督导评价报表已加载，共 ${submitted.length} 份。点击"打印 / 另存为 PDF"按钮导出 PDF。');
});
</script>
</body>
</html>`;

  return html;
}

// ============================================================
// 生成单份评价 HTML（用于单份导出，与批量格式一致）
// ============================================================
export function generateSingleEvaluationHtml(ev: EvaluationExportData): string {
  const c = (ev as any).course || {};
  const s = (ev as any).supervisor || {};
  const courseName = c.courseName || "督导评价";
  const todayStr = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());

  const body = renderSingleEvaluationHtml(ev, 0, 1);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(courseName)} - 督导评价</title>
  <style>
    @page { size: A4; margin: 12mm 10mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 0; background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .print-toolbar {
      position: fixed;
      top: 0; left: 0; right: 0;
      background: #2c5282;
      color: white;
      padding: 10px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 9999;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .print-toolbar h3 { margin: 0; font-size: 15px; }
    .print-btn {
      background: #fff; color: #2c5282;
      border: none; padding: 8px 20px;
      border-radius: 6px; font-size: 14px;
      font-weight: bold; cursor: pointer;
    }
    .print-btn:hover { background: #ebf4ff; }
    .dl-btn {
      background: transparent; color: #fff;
      border: 1px solid rgba(255,255,255,0.6);
      padding: 8px 16px; border-radius: 6px;
      font-size: 13px; cursor: pointer; margin-right: 8px;
    }
    .content-wrapper { padding-top: 56px; }
    @media print {
      .print-toolbar { display: none; }
      .content-wrapper { padding-top: 0; }
    }
  </style>
</head>
<body>
<div class="print-toolbar">
  <div>
    <h3>${escapeHtml(courseName)} · 督导评价</h3>
    <div style="font-size:12px;opacity:0.85;">督导专家：${escapeHtml(s.name) || "—"} · ${todayStr}</div>
  </div>
  <div style="display:flex;align-items:center;">
    <button class="dl-btn" onclick="downloadHtml()">⬇ 下载 HTML</button>
    <button class="print-btn" onclick="window.print()">🖨 打印 / 另存为 PDF</button>
  </div>
</div>
<div class="content-wrapper">
${body}
</div>
<script>
function downloadHtml() {
  var blob = new Blob([document.documentElement.outerHTML], {type: 'text/html;charset=utf-8'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '督导评价_${(courseName).replace(/[/\\?%*:|"<>]/g, "-")}.html';
  a.click();
}
</script>
</body>
</html>`;
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
