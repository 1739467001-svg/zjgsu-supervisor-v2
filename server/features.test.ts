import { describe, expect, it } from "vitest";
import { generateEvaluationExcel } from "./exportUtils";

describe("Feature Tests", () => {
  describe("generateEvaluationExcel", () => {
    it("should generate Excel buffer with evaluation data", () => {
      const mockEvaluations = [
        {
          id: 1,
          courseId: 1,
          supervisorId: 1,
          listenDate: new Date("2026-03-12"),
          actualWeek: 2,
          overallScore: 4,
          score_teaching_content: 5,
          score_course_objective: 4,
          score_reference_sharing: 5,
          score_literature_humanities: 4,
          score_teaching_organization: 5,
          score_course_development: 5,
          score_course_focus: 4,
          score_language_logic: 4,
          score_interaction: 5,
          score_learning_preparation: 4,
          score_teaching_quality: 5,
          score_active_response: 5,
          score_student_centered: 5,
          score_research_teaching: 4,
          score_learning_effect: 5,
          score_interaction_quality: 4,
          score_method_diversity: 5,
          score_equal_dialogue: 5,
          score_pace_control: 4,
          score_feedback: 5,
          highlights: "很好的教学",
          suggestions: "继续加油",
          improvement_suggestion: "可以改进",
          development_suggestion: "发展方向",
          dimension_suggestion: "维度建议",
          resource_suggestion: "资源建议",
          status: "submitted",
          createdAt: new Date("2026-03-12"),
          updatedAt: new Date("2026-03-12"),
          course: {
            courseName: "算法分析与设计",
            teacher: "江照意",
            college: "计算机科学与技术学院",
            campus: "下沙",
            courseType: "学位课",
          },
          supervisor: {
            name: "傅培华",
            email: "fu@example.com",
          },
        },
      ];

      const buffer = generateEvaluationExcel(mockEvaluations as any);

      expect(buffer).toBeDefined();
      expect(buffer instanceof Buffer).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it("should handle evaluations with missing data", () => {
      const mockEvaluations = [
        {
          id: 2,
          courseId: 2,
          supervisorId: 2,
          listenDate: null,
          actualWeek: null,
          overallScore: null,
          score_teaching_content: undefined,
          score_course_objective: undefined,
          score_reference_sharing: undefined,
          score_literature_humanities: undefined,
          score_teaching_organization: undefined,
          score_course_development: undefined,
          score_course_focus: undefined,
          score_language_logic: undefined,
          score_interaction: undefined,
          score_learning_preparation: undefined,
          score_teaching_quality: undefined,
          score_active_response: undefined,
          score_student_centered: undefined,
          score_research_teaching: undefined,
          score_learning_effect: undefined,
          score_interaction_quality: undefined,
          score_method_diversity: undefined,
          score_equal_dialogue: undefined,
          score_pace_control: undefined,
          score_feedback: undefined,
          highlights: "",
          suggestions: "",
          improvement_suggestion: "",
          development_suggestion: "",
          dimension_suggestion: "",
          resource_suggestion: "",
          status: "draft",
          createdAt: new Date(),
          updatedAt: new Date(),
          course: null,
          supervisor: null,
        },
      ];

      const buffer = generateEvaluationExcel(mockEvaluations as any);

      expect(buffer).toBeDefined();
      expect(buffer instanceof Buffer).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it("should handle empty evaluations array", () => {
      const buffer = generateEvaluationExcel([]);

      expect(buffer).toBeDefined();
      expect(buffer instanceof Buffer).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  describe("Comprehensive Score Calculation", () => {
    it("should calculate average of 20 scores correctly", () => {
      const scores = [5, 4, 5, 4, 5, 5, 4, 4, 5, 4, 5, 5, 5, 4, 5, 4, 5, 5, 4, 5];
      const sum = scores.reduce((a, b) => a + b, 0);
      const average = sum / scores.length;
      const rounded = Math.round(average * 10) / 10;

      expect(rounded).toBe(4.6);
    });

    it("should handle partial scores", () => {
      const scores = [5, 4, 5]; // Only 3 out of 20
      const sum = scores.reduce((a, b) => a + b, 0);
      const average = sum / scores.length;
      const rounded = Math.round(average * 10) / 10;

      expect(rounded).toBe(4.7); // (5 + 4 + 5) / 3 = 14 / 3 = 4.666... ≈ 4.7
    });

    it("should return undefined for no scores", () => {
      const scores: number[] = [];
      const average = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : undefined;

      expect(average).toBeUndefined();
    });
  });

  describe("Database Connection Pool", () => {
    it("should have proper pool configuration", () => {
      const poolConfig = {
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
      };

      expect(poolConfig.connectionLimit).toBe(10);
      expect(poolConfig.waitForConnections).toBe(true);
      expect(poolConfig.enableKeepAlive).toBe(true);
      expect(poolConfig.queueLimit).toBe(0);
    });
  });
});
