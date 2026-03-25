import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createEvaluation,
  createListeningPlan,
  createNotification,
  deleteEvaluation,
  deleteListeningPlan,
  getAdminStats,
  getAllEvaluations,
  getAllUsers,
  getCourseById,
  getCourseEvaluationProgress,
  getAllCollegeEvaluationProgress,
  getCourses,
  getDistinctColleges,
  getDistinctTeachers,
  getEvaluationById,
  getEvaluationsBySupervisor,
  getListeningPlansBySupervisor,
  getNotificationsByUser,
  getUnreadNotificationCount,
  getUserByEmployeeId,
  getUsersByRole,
  markAllNotificationsRead,
  markNotificationRead,
  updateEvaluation,
  updateListeningPlanStatus,
  updateUserPassword,
  updateUserRole,
  upsertUser,
} from "./db";
import { sdk } from "./_core/sdk";
import { generateEvaluationExcel } from "./exportUtils";

// ============================================================
// 角色权限中间件
// ============================================================
const supervisorProcedure = protectedProcedure.use(({ ctx, next }) => {
  const role = ctx.user?.role;
  if (!["supervisor_expert", "supervisor_leader", "graduate_admin", "admin"].includes(role || "")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "需要督导专家或以上权限" });
  }
  return next({ ctx });
});

const leaderProcedure = protectedProcedure.use(({ ctx, next }) => {
  const role = ctx.user?.role;
  if (!["supervisor_leader", "graduate_admin", "admin"].includes(role || "")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "需要督导组长或以上权限" });
  }
  return next({ ctx });
});

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  const role = ctx.user?.role;
  if (!["graduate_admin", "admin"].includes(role || "")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "需要研究生院主管权限" });
  }
  return next({ ctx });
});

// ============================================================
// 评价表单 Zod Schema
// ============================================================
const evaluationSchema = z.object({
  courseId: z.number(),
  planId: z.number().optional(),
  listenDate: z.string().optional(),
  actualWeek: z.number().optional(),
  overallScore: z.number().min(1).max(5).optional(),
  // 定量评分
  score_teaching_content: z.number().min(1).max(5).optional(),
  score_course_objective: z.number().min(1).max(5).optional(),
  score_reference_sharing: z.number().min(1).max(5).optional(),
  score_literature_humanities: z.number().min(1).max(5).optional(),
  score_teaching_organization: z.number().min(1).max(5).optional(),
  score_course_development: z.number().min(1).max(5).optional(),
  score_course_focus: z.number().min(1).max(5).optional(),
  score_language_logic: z.number().min(1).max(5).optional(),
  score_interaction: z.number().min(1).max(5).optional(),
  score_learning_preparation: z.number().min(1).max(5).optional(),
  score_teaching_quality: z.number().min(1).max(5).optional(),
  score_active_response: z.number().min(1).max(5).optional(),
  score_student_centered: z.number().min(1).max(5).optional(),
  score_research_teaching: z.number().min(1).max(5).optional(),
  score_learning_effect: z.number().min(1).max(5).optional(),
  score_emotional_motivation: z.number().min(1).max(5).optional(),
  score_teaching_diversity: z.number().min(1).max(5).optional(),
  score_rhythm_transition: z.number().min(1).max(5).optional(),
  score_key_summary: z.number().min(1).max(5).optional(),
  score_feedback_improvement: z.number().min(1).max(5).optional(),
  // 定性评价
  text_highlight: z.string().optional(),
  text_improvement: z.string().optional(),
  text_good_experience: z.string().optional(),
  text_improve_suggestion: z.string().optional(),
  text_improve_direction: z.string().optional(),
  text_other_suggestion: z.string().optional(),
  status: z.enum(["draft", "submitted"]).optional(),
});

export const appRouter = router({
  system: systemRouter,

  // ============================================================
  // 认证
  // ============================================================
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    // 工号登录
    loginByEmployeeId: publicProcedure
      .input(z.object({ employeeId: z.string().min(1), password: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByEmployeeId(input.employeeId.trim());
        if (!user) {
          throw new TRPCError({ code: "NOT_FOUND", message: "工号不存在，请联系管理员" });
        }

        // 验证密码（默认密码为工号）
        const expectedPassword = user.password || user.employeeId || "";
        if (input.password !== expectedPassword) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "密码错误，默认密码为工号" });
        }

        // 更新最后登录时间
        await upsertUser({ ...user, lastSignedIn: new Date() });

        // 签发JWT（使用sdk.createSessionToken，openId格式为emp_工号）
        const token = await sdk.createSessionToken(user.openId, { name: user.name || user.employeeId || "" });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, cookieOptions);

        return { success: true, user };
      }),

    // 修改密码
    changePassword: protectedProcedure
      .input(z.object({ oldPassword: z.string().min(1), newPassword: z.string().min(6) }))
      .mutation(async ({ input, ctx }) => {
        const user = ctx.user!;
        const dbUser = await getUserByEmployeeId(user.employeeId || "");
        if (!dbUser) throw new TRPCError({ code: "NOT_FOUND", message: "用户不存在" });
        const expectedPassword = dbUser.password || dbUser.employeeId || "";
        if (input.oldPassword !== expectedPassword) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "原密码错误" });
        }
        // 使用专用的updateUserPassword函数，确保密码可靠写入数据库
        await updateUserPassword(dbUser.id, input.newPassword);
        return { success: true };
      }),
  }),

  // ============================================================
  // 课程
  // ============================================================
  courses: router({
    list: protectedProcedure
      .input(
        z.object({
          college: z.string().optional(),
          campus: z.string().optional(),
          weekday: z.string().optional(),
          week: z.number().optional(),
          teacher: z.string().optional(),
          courseName: z.string().optional(),
          page: z.number().default(1),
          pageSize: z.number().default(20),
        })
      )
      .query(async ({ input, ctx }) => {
        // 学院教学秘书只能查看本学院课程
        const user = ctx.user!;
        let college = input.college;
        if (user.role === "college_secretary" && user.college) {
          college = user.college;
        }
        return getCourses({ ...input, college });
      }),

    getById: protectedProcedure.input(z.number()).query(async ({ input }) => {
      if (input <= 0) return null;
      const course = await getCourseById(input);
      return course || null;
    }),

    getColleges: protectedProcedure.query(async () => {
      const colleges = await getDistinctColleges();
      return colleges || [];
    }),

    getTeachers: protectedProcedure
      .input(z.object({ college: z.string().optional() }))
      .query(async ({ input }) => {
        const teachers = await getDistinctTeachers(input.college);
        return teachers || [];
      }),
  }),

  // ============================================================
  // 听课计划
  // ============================================================
  plans: router({
    create: supervisorProcedure
      .input(
        z.object({
          courseId: z.number(),
          planWeek: z.number().optional(),
          note: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return createListeningPlan({
          supervisorId: ctx.user!.id,
          courseId: input.courseId,
          planWeek: input.planWeek,
          note: input.note,
          status: "pending",
        });
      }),

    myPlans: supervisorProcedure.query(async ({ ctx }) => {
      return getListeningPlansBySupervisor(ctx.user!.id);
    }),

    updateStatus: supervisorProcedure
      .input(z.object({ planId: z.number(), status: z.enum(["pending", "completed", "cancelled"]) }))
      .mutation(async ({ input }) => {
        await updateListeningPlanStatus(input.planId, input.status);
        return { success: true };
      }),

    delete: supervisorProcedure.input(z.number()).mutation(async ({ input }) => {
      await deleteListeningPlan(input);
      return { success: true };
    }),
  }),

  // ============================================================
  // 课程评价
  // ============================================================
  evaluations: router({
    create: supervisorProcedure.input(evaluationSchema).mutation(async ({ input, ctx }) => {
      const evaluation = await createEvaluation({
        ...input,
        supervisorId: ctx.user!.id,
        listenDate: input.listenDate ? new Date(input.listenDate) : undefined,
      });

      // 如果提交评价，发送通知
      if (input.status === "submitted" && evaluation) {
        const course = await getCourseById(input.courseId);

        // 通知研究生院主管
        const admins = await getUsersByRole("graduate_admin");
        for (const admin of admins) {
          await createNotification({
            recipientId: admin.id,
            senderId: ctx.user!.id,
            type: "evaluation_complete",
            title: "新督导评价提交",
            content: `${ctx.user!.name} 完成了对 ${course?.courseName || "课程"} (${course?.teacher || ""}) 的督导评价`,
            evaluationId: evaluation.id,
          });
        }

        // 通知相关学院教学秘书
        if (course?.college) {
          const secretaries = await getUsersByRole("college_secretary");
          const collegeSecretaries = secretaries.filter(
            (s) => s.college && course.college && s.college.includes(course.college.replace(/（.*?）/g, "").replace(/\(.*?\)/g, ""))
          );
          for (const secretary of collegeSecretaries) {
            await createNotification({
              recipientId: secretary.id,
              senderId: ctx.user!.id,
              type: "evaluation_complete",
              title: "本学院课程督导评价",
              content: `${ctx.user!.name} 完成了对 ${course.courseName} (${course.teacher}) 的督导评价，请查看`,
              evaluationId: evaluation.id,
            });
          }
        }
      }

      return evaluation;
    }),

    update: supervisorProcedure
      .input(z.object({ id: z.number(), data: evaluationSchema }))
      .mutation(async ({ input, ctx }) => {
        const existing = await getEvaluationById(input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        if (existing.supervisorId !== ctx.user!.id && !["supervisor_leader", "graduate_admin", "admin"].includes(ctx.user!.role || "")) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await updateEvaluation(input.id, {
          ...input.data,
          listenDate: input.data.listenDate ? new Date(input.data.listenDate) : undefined,
        });
        return { success: true };
      }),

    delete: supervisorProcedure.input(z.number()).mutation(async ({ input, ctx }) => {
      const existing = await getEvaluationById(input);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.supervisorId !== ctx.user!.id && ctx.user!.role !== "graduate_admin" && ctx.user!.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await deleteEvaluation(input);
      return { success: true };
    }),

    getById: protectedProcedure.input(z.number()).query(async ({ input, ctx }) => {
      const evaluation = await getEvaluationById(input);
      if (!evaluation) throw new TRPCError({ code: "NOT_FOUND" });

      // 学院教学秘书只能查看本学院的评价
      if (ctx.user!.role === "college_secretary") {
        const course = await getCourseById(evaluation.courseId);
        if (!course || !ctx.user!.college) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        // 秘书的college字段可能包含多个学院（用顿号/逗号分隔），逐一比对
        const secretaryColleges = ctx.user!.college
          .split(/[、,，]/)  
          .map((c: string) => c.trim().replace(/（.*?）/g, "").replace(/\(.*?\)/g, ""))
          .filter(Boolean);
        const courseCollege = (course.college || "").replace(/（.*?）/g, "").replace(/\(.*?\)/g, "").trim();
        const hasAccess = secretaryColleges.some((sc: string) => courseCollege.includes(sc) || sc.includes(courseCollege));
        if (!hasAccess) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }
      
      // 关联课程和督导专家数据
      const course = await getCourseById(evaluation.courseId);
      const allUsers = await getAllUsers();
      const supervisor = allUsers.find((u) => u.id === evaluation.supervisorId);
      
      return { ...evaluation, course, supervisor };
    }),

    myEvaluations: supervisorProcedure.query(async ({ ctx }) => {
      return getEvaluationsBySupervisor(ctx.user!.id);
    }),

    // 督导组长/主管/学院秘书查看所有评价
    allEvaluations: protectedProcedure
      .input(z.object({ college: z.string().optional(), supervisorId: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        const user = ctx.user!;
        // 督导专家只能查看自己的
        if (user.role === "supervisor_expert") {
          return getEvaluationsBySupervisor(user.id);
        }
        // 学院教学秘书只能查看本学院
        if (user.role === "college_secretary") {
          return getAllEvaluations({ college: user.college || undefined });
        }
        return getAllEvaluations(input);
      }),

    exportToExcel: protectedProcedure
      .input(z.object({ college: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const user = ctx.user!;
        let evaluations;
        if (user.role === "supervisor_expert") {
          evaluations = await getEvaluationsBySupervisor(user.id);
        } else if (user.role === "college_secretary") {
          evaluations = await getAllEvaluations({ college: user.college || undefined });
        } else if (["supervisor_leader", "graduate_admin", "admin"].includes(user.role || "")) {
          evaluations = await getAllEvaluations({ college: input.college });
        } else {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        const allUsers = await getAllUsers();
        const enrichedEvaluations = await Promise.all(
          evaluations.map(async (evaluation) => {
            const course = await getCourseById(evaluation.courseId);
            const supervisor = allUsers.find((u) => u.id === evaluation.supervisorId);
            return { ...evaluation, course, supervisor };
          })
        );

        const buffer = generateEvaluationExcel(enrichedEvaluations);
        return { buffer: buffer.toString("base64"), filename: `evaluations_${new Date().toISOString().split("T")[0]}.xlsx` };
      }),
  }),

  // ============================================================
  // 统计（研究生院主管）
  // ============================================================
   stats: router({
    adminDashboard: adminProcedure.query(async () => {
      return getAdminStats();
    }),
    collegeStats: protectedProcedure
      .input(z.object({ college: z.string().optional() }))
      .query(async ({ input, ctx }) => {
        const user = ctx.user!;
        const college = user.role === "college_secretary" ? (user.college || undefined) : input.college;
        const evals = await getAllEvaluations({ college });
        return {
          total: evals.length,
          submitted: evals.filter((e) => e.status === "submitted").length,
          evaluations: evals,
        };
      }),
    // 课程评价进度（学院秘书查本学院，主管查指定学院）
    courseProgress: protectedProcedure
      .input(z.object({ college: z.string().optional() }))
      .query(async ({ input, ctx }) => {
        const user = ctx.user!;
        let college: string | undefined;
        if (user.role === "college_secretary") {
          college = user.college || undefined;
        } else if (["graduate_admin", "admin"].includes(user.role || "")) {
          college = input.college;
        } else {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return getCourseEvaluationProgress(college);
      }),
    // 全校各学院评价进度汇总（研究生院主管专用）
    allCollegeProgress: adminProcedure.query(async () => {
      return getAllCollegeEvaluationProgress();
    }),
  }),

  // ============================================================
  // 通知
  // ============================================================
  notifications: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getNotificationsByUser(ctx.user!.id);
    }),

    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      return getUnreadNotificationCount(ctx.user!.id);
    }),

    markRead: protectedProcedure.input(z.number()).mutation(async ({ input }) => {
      await markNotificationRead(input);
      return { success: true };
    }),

    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      await markAllNotificationsRead(ctx.user!.id);
      return { success: true };
    }),
  }),

  // ============================================================
  // 用户管理（研究生院主管）
  // ============================================================
  users: router({
    list: adminProcedure.query(async () => {
      return getAllUsers();
    }),

    updateRole: adminProcedure
      .input(z.object({ userId: z.number(), role: z.string() }))
      .mutation(async ({ input }) => {
        await updateUserRole(input.userId, input.role);
        return { success: true };
      }),

    getSupervisors: protectedProcedure.query(async () => {
      const experts = await getUsersByRole("supervisor_expert");
      const leaders = await getUsersByRole("supervisor_leader");
      return [...leaders, ...experts];
    }),
  }),
});

export type AppRouter = typeof appRouter;
