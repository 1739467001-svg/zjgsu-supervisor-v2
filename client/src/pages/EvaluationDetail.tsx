import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useLocation, useParams } from "wouter";
import { ChevronLeft, Edit, Star, MapPin, Clock, User, Building2 } from "lucide-react";
import { formatDateOnlyBJ } from "@shared/dateUtils";
import DashboardLayout from "@/components/DashboardLayout";

const SCORE_SECTIONS = [
  {
    title: "（一）教学内容",
    items: [
      { key: "score_teaching_content", label: "1. 教学内容与能力" },
      { key: "score_course_objective", label: "2. 课程目标管理" },
      { key: "score_reference_sharing", label: "3. 参考资料分享" },
      { key: "score_literature_humanities", label: "4. 文献人文融入" },
      { key: "score_teaching_organization", label: "5. 教学组织力" },
    ],
  },
  {
    title: "（二）学生状态",
    items: [
      { key: "score_course_development", label: "6. 课程发展情况" },
      { key: "score_course_focus", label: "7. 课程专注度" },
      { key: "score_language_logic", label: "8. 语言逻辑能力" },
      { key: "score_interaction", label: "9. 互动参与情况" },
      { key: "score_learning_preparation", label: "10. 学习准备充分" },
    ],
  },
  {
    title: "（三）课程内容",
    items: [
      { key: "score_teaching_quality", label: "11. 教学质量水平" },
      { key: "score_active_response", label: "12. 积极回应情况" },
      { key: "score_student_centered", label: "13. 以学生为中心" },
      { key: "score_research_teaching", label: "14. 科研教学融合" },
      { key: "score_learning_effect", label: "15. 学习效果评估" },
    ],
  },
  {
    title: "（四）教学过程",
    items: [
      { key: "score_emotional_motivation", label: "16. 情感激励动力" },
      { key: "score_teaching_diversity", label: "17. 教学多样性" },
      { key: "score_rhythm_transition", label: "18. 节奏过渡流畅" },
      { key: "score_key_summary", label: "19. 重点总结归纳" },
      { key: "score_feedback_improvement", label: "20. 反馈改进机制" },
    ],
  },
];

function ScoreDisplay({ value, max = 5 }: { value?: number | null; max?: number }) {
  if (!value) return <span className="text-xs" style={{ color: "oklch(0.65 0.02 240)" }}>未评分</span>;
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-1">
        {Array.from({ length: max }).map((_, i) => (
          <div key={i} className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium" style={{
            background: i < value ? "oklch(0.35 0.13 245)" : "oklch(0.93 0.01 240)",
            color: i < value ? "white" : "oklch(0.65 0.02 240)",
          }}>
            {i + 1}
          </div>
        ))}
      </div>
      <span className="text-xs font-medium" style={{ color: "oklch(0.35 0.13 245)" }}>{value}/{max}</span>
    </div>
  );
}

export default function EvaluationDetail() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const evalId = parseInt(params.id || "0");
  const { data: evaluation, isLoading, error } = trpc.evaluations.getById.useQuery(evalId, { enabled: evalId > 0 });
  const canEdit = ["supervisor_expert", "supervisor_leader", "admin"].includes(user?.role || "") && evaluation?.supervisorId === user?.id;

  // Handle invalid ID - 直接跳转，不显示中转页
  if (evalId <= 0) {
    navigate('/evaluations', { replace: true });
    return null;
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  // Handle query error or evaluation not found
  // 评价不存在或已删除 - 直接跳转，不显示中转页
  if (error || !evaluation) {
    navigate('/evaluations', { replace: true });
    return null;
  }

  const course = (evaluation as any).course;
  const supervisor = (evaluation as any).supervisor;

  // 计算各维度平均分
  const sectionAverages = SCORE_SECTIONS.map((section) => {
    const scores = section.items.map((item) => (evaluation as any)[item.key]).filter((s): s is number => s != null);
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    return { title: section.title, avg };
  });


  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto page-transition">
        <div className="flex items-center justify-between mb-5">
          <button onClick={() => navigate('/evaluations')} className="flex items-center gap-1.5 text-sm hover:opacity-70 transition-opacity" style={{ color: "oklch(0.35 0.13 245)" }}>
            <ChevronLeft className="w-4 h-4" />返回
          </button>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => navigate(`/evaluations/${evalId}/edit`)}>
              <Edit className="w-4 h-4 mr-1.5" />
              {evaluation?.status === "submitted" ? "修改评价" : "继续评价"}
            </Button>
          )}
        </div>

        {/* 课程信息 */}
        <div className="bg-white rounded-xl p-5 mb-4" style={{ border: "1px solid oklch(0.90 0.01 240)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h1 className="text-lg font-bold" style={{ color: "oklch(0.18 0.025 240)" }}>{course?.courseName || "未知课程"}</h1>
              <div className="flex flex-wrap gap-3 mt-2 text-xs" style={{ color: "oklch(0.52 0.025 240)" }}>
                {course?.teacher && <span className="flex items-center gap-1"><User className="w-3 h-3" />{course.teacher}</span>}
                {course?.college && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{course.college}</span>}
                {course?.campus && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{course.campus}</span>}
                {course?.weekday && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{course.weekday} {course.period}</span>}
              </div>
            </div>
                 <div className="text-right flex-shrink-0">
              {evaluation.overallScore && (
                <>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="w-4 h-4" fill={i < evaluation.overallScore! ? "oklch(0.72 0.14 85)" : "none"} style={{ color: "oklch(0.72 0.14 85)" }} />
                    ))}
                  </div>
                  <p className="text-xs mt-1" style={{ color: "oklch(0.52 0.025 240)" }}>总体 {(evaluation.overallScore || 0).toFixed(1)}/5</p>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-4 text-xs" style={{ borderTop: "1px solid oklch(0.93 0.006 240)" }}>
            <div><span style={{ color: "oklch(0.52 0.025 240)" }}>督导专家：</span><span className="font-medium" style={{ color: "oklch(0.20 0.025 240)" }}>{supervisor?.name || "-"}</span></div>
            <div><span style={{ color: "oklch(0.52 0.025 240)" }}>听课日期：</span><span className="font-medium" style={{ color: "oklch(0.20 0.025 240)" }}>{evaluation.listenDate ? formatDateOnlyBJ(evaluation.listenDate) : "-"}</span></div>
            <div><span style={{ color: "oklch(0.52 0.025 240)" }}>实际周次：</span><span className="font-medium" style={{ color: "oklch(0.20 0.025 240)" }}>{evaluation.actualWeek ? `第${evaluation.actualWeek}周` : "-"}</span></div>
            <div><span style={{ color: "oklch(0.52 0.025 240)" }}>评价状态：</span>
              <span className="font-medium px-1.5 py-0.5 rounded-full text-xs" style={{
                background: evaluation.status === "submitted" ? "oklch(0.93 0.018 160)" : "oklch(0.93 0.01 240)",
                color: evaluation.status === "submitted" ? "oklch(0.42 0.14 160)" : "oklch(0.52 0.025 240)",
              }}>
                {evaluation.status === "submitted" ? "已提交" : "草稿"}
              </span>
            </div>
          </div>
        </div>

        {/* 维度得分概览 */}
        <div className="bg-white rounded-xl p-5 mb-4" style={{ border: "1px solid oklch(0.90 0.01 240)" }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: "oklch(0.18 0.025 240)" }}>各维度评分概览</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {sectionAverages.map(({ title, avg }) => (
              <div key={title} className="text-center p-3 rounded-lg" style={{ background: "oklch(0.97 0.004 240)" }}>
                <div className="text-xl font-bold mb-1" style={{ color: avg ? "oklch(0.35 0.13 245)" : "oklch(0.65 0.02 240)" }}>
                  {avg ? avg.toFixed(1) : "-"}
                </div>
                <div className="text-xs" style={{ color: "oklch(0.52 0.025 240)" }}>{title.replace(/（.*?）/, "")}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 详细评分 */}
        <div className="bg-white rounded-xl overflow-hidden mb-4" style={{ border: "1px solid oklch(0.90 0.01 240)" }}>
          <div className="px-5 py-4" style={{ background: "oklch(0.35 0.13 245)", color: "white" }}>
            <h2 className="font-semibold text-sm">一、定量督导详细评分</h2>
          </div>
          {SCORE_SECTIONS.map((section) => (
            <div key={section.title}>
              <div className="px-5 py-3" style={{ background: "oklch(0.96 0.008 240)", borderBottom: "1px solid oklch(0.90 0.01 240)" }}>
                <h3 className="text-xs font-semibold" style={{ color: "oklch(0.35 0.13 245)" }}>{section.title}</h3>
              </div>
              {section.items.map((item) => (
                <div key={item.key} className="px-5 py-3 flex items-center justify-between gap-3" style={{ borderBottom: "1px solid oklch(0.93 0.006 240)" }}>
                  <span className="text-sm" style={{ color: "oklch(0.30 0.04 240)" }}>{item.label}</span>
                  <ScoreDisplay value={(evaluation as any)[item.key]} max={(item as any).max || 5} />
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* 定性评价 */}
        <div className="bg-white rounded-xl overflow-hidden mb-4" style={{ border: "1px solid oklch(0.90 0.01 240)" }}>
          <div className="px-5 py-4" style={{ background: "oklch(0.35 0.13 245)", color: "white" }}>
            <h2 className="font-semibold text-sm">二、课程督导评价</h2>
          </div>
          <div className="px-5 py-4 space-y-4">
            {[
              { key: "highlights", label: "最突出的教学亮点" },
              { key: "suggestions", label: "存在不足与提升建议" },
            ].map(({ key, label }) => (
              <div key={key}>
                <h4 className="text-xs font-semibold mb-2" style={{ color: "oklch(0.35 0.13 245)" }}>{label}</h4>
                <div className="p-3 rounded-lg text-sm leading-relaxed" style={{ background: "oklch(0.97 0.004 240)", color: "oklch(0.25 0.025 240)", minHeight: "60px" }}>
                  {(evaluation as any)[key] || <span style={{ color: "oklch(0.65 0.02 240)" }}>未填写</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 具体建议 */}
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: "1px solid oklch(0.90 0.01 240)" }}>
          <div className="px-5 py-4" style={{ background: "oklch(0.35 0.13 245)", color: "white" }}>
            <h2 className="font-semibold text-sm">三、具体建议</h2>
          </div>
          <div className="px-5 py-4 space-y-4">
            {[
              { key: "improvement_suggestion", label: "针对性改进建议" },
              { key: "development_suggestion", label: "拓展性发展建议" },
              { key: "dimension_suggestion", label: "针对定量评价维度的改进建议" },
              { key: "resource_suggestion", label: "资源或支持建议" },
            ].map(({ key, label }) => (
              <div key={key}>
                <h4 className="text-xs font-semibold mb-2" style={{ color: "oklch(0.35 0.13 245)" }}>{label}</h4>
                <div className="p-3 rounded-lg text-sm leading-relaxed" style={{ background: "oklch(0.97 0.004 240)", color: "oklch(0.25 0.025 240)", minHeight: "50px" }}>
                  {(evaluation as any)[key] || <span style={{ color: "oklch(0.65 0.02 240)" }}>未填写</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
