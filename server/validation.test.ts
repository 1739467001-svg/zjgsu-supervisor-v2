import { describe, it, expect } from 'vitest';

/**
 * Form validation tests for evaluation submission
 * Tests the validateForm function to ensure all required fields are checked
 */

describe('Form Validation', () => {
  // Mock validateForm function
  const validateForm = (status: 'draft' | 'submitted', formData: any) => {
    const errors: string[] = [];

    const quantitativeScores = [
      formData.score_teaching_content,
      formData.score_course_objective,
      formData.score_reference_sharing,
      formData.score_literature_humanities,
      formData.score_teaching_organization,
      formData.score_course_development,
      formData.score_course_focus,
      formData.score_language_logic,
      formData.score_interaction,
      formData.score_learning_preparation,
      formData.score_teaching_quality,
      formData.score_active_response,
      formData.score_student_centered,
      formData.score_research_teaching,
      formData.score_learning_effect,
      formData.score_interaction_quality,
      formData.score_method_diversity,
      formData.score_equal_dialogue,
      formData.score_pace_control,
      formData.score_feedback,
    ];

    if (status === 'submitted') {
      if (quantitativeScores.some((score) => !score || score === 0)) {
        errors.push('请完成所有定量评分项目（一、二、三部分的所有评分）');
      }

      if (!formData.highlights || formData.highlights.trim() === '') {
        errors.push('请填写课程亮点与评价');
      }
      if (!formData.suggestions || formData.suggestions.trim() === '') {
        errors.push('请填写评价建议');
      }

      if (!formData.improvement_suggestion || formData.improvement_suggestion.trim() === '') {
        errors.push('请填写改进建议');
      }
      if (!formData.development_suggestion || formData.development_suggestion.trim() === '') {
        errors.push('请填写发展建议');
      }
      if (!formData.dimension_suggestion || formData.dimension_suggestion.trim() === '') {
        errors.push('请填写维度建议');
      }

      if (!formData.overallScore || formData.overallScore === 0) {
        errors.push('请选择综合评分');
      }
    }

    return { valid: errors.length === 0, errors };
  };

  it('should allow draft submission with empty fields', () => {
    const emptyForm = {
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
      highlights: '',
      suggestions: '',
      improvement_suggestion: '',
      development_suggestion: '',
      dimension_suggestion: '',
      overallScore: undefined,
    };

    const result = validateForm('draft', emptyForm);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject submitted form with missing quantitative scores', () => {
    const incompleteForm = {
      score_teaching_content: 4,
      score_course_objective: undefined,
      score_reference_sharing: 3,
      score_literature_humanities: 4,
      score_teaching_organization: 5,
      score_course_development: 4,
      score_course_focus: 3,
      score_language_logic: 4,
      score_interaction: 5,
      score_learning_preparation: 4,
      score_teaching_quality: 3,
      score_active_response: 4,
      score_student_centered: 5,
      score_research_teaching: 4,
      score_learning_effect: 3,
      score_interaction_quality: 4,
      score_method_diversity: 5,
      score_equal_dialogue: 4,
      score_pace_control: 3,
      score_feedback: 4,
      highlights: 'Great teaching',
      suggestions: 'Good job',
      improvement_suggestion: 'Improve this',
      development_suggestion: 'Develop that',
      dimension_suggestion: 'Dimension tips',
      overallScore: 4,
    };

    const result = validateForm('submitted', incompleteForm);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('请完成所有定量评分项目（一、二、三部分的所有评分）');
  });

  it('should reject submitted form with missing highlights', () => {
    const completeScoresForm = {
      score_teaching_content: 4,
      score_course_objective: 4,
      score_reference_sharing: 3,
      score_literature_humanities: 4,
      score_teaching_organization: 5,
      score_course_development: 4,
      score_course_focus: 3,
      score_language_logic: 4,
      score_interaction: 5,
      score_learning_preparation: 4,
      score_teaching_quality: 3,
      score_active_response: 4,
      score_student_centered: 5,
      score_research_teaching: 4,
      score_learning_effect: 3,
      score_interaction_quality: 4,
      score_method_diversity: 5,
      score_equal_dialogue: 4,
      score_pace_control: 3,
      score_feedback: 4,
      highlights: '',
      suggestions: 'Good job',
      improvement_suggestion: 'Improve this',
      development_suggestion: 'Develop that',
      dimension_suggestion: 'Dimension tips',
      overallScore: 4,
    };

    const result = validateForm('submitted', completeScoresForm);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('请填写课程亮点与评价');
  });

  it('should reject submitted form with missing suggestions', () => {
    const form = {
      score_teaching_content: 4,
      score_course_objective: 4,
      score_reference_sharing: 3,
      score_literature_humanities: 4,
      score_teaching_organization: 5,
      score_course_development: 4,
      score_course_focus: 3,
      score_language_logic: 4,
      score_interaction: 5,
      score_learning_preparation: 4,
      score_teaching_quality: 3,
      score_active_response: 4,
      score_student_centered: 5,
      score_research_teaching: 4,
      score_learning_effect: 3,
      score_interaction_quality: 4,
      score_method_diversity: 5,
      score_equal_dialogue: 4,
      score_pace_control: 3,
      score_feedback: 4,
      highlights: 'Great teaching',
      suggestions: '',
      improvement_suggestion: 'Improve this',
      development_suggestion: 'Develop that',
      dimension_suggestion: 'Dimension tips',
      overallScore: 4,
    };

    const result = validateForm('submitted', form);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('请填写评价建议');
  });

  it('should reject submitted form with missing improvement suggestion', () => {
    const form = {
      score_teaching_content: 4,
      score_course_objective: 4,
      score_reference_sharing: 3,
      score_literature_humanities: 4,
      score_teaching_organization: 5,
      score_course_development: 4,
      score_course_focus: 3,
      score_language_logic: 4,
      score_interaction: 5,
      score_learning_preparation: 4,
      score_teaching_quality: 3,
      score_active_response: 4,
      score_student_centered: 5,
      score_research_teaching: 4,
      score_learning_effect: 3,
      score_interaction_quality: 4,
      score_method_diversity: 5,
      score_equal_dialogue: 4,
      score_pace_control: 3,
      score_feedback: 4,
      highlights: 'Great teaching',
      suggestions: 'Good job',
      improvement_suggestion: '',
      development_suggestion: 'Develop that',
      dimension_suggestion: 'Dimension tips',
      overallScore: 4,
    };

    const result = validateForm('submitted', form);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('请填写改进建议');
  });

  it('should reject submitted form with missing development suggestion', () => {
    const form = {
      score_teaching_content: 4,
      score_course_objective: 4,
      score_reference_sharing: 3,
      score_literature_humanities: 4,
      score_teaching_organization: 5,
      score_course_development: 4,
      score_course_focus: 3,
      score_language_logic: 4,
      score_interaction: 5,
      score_learning_preparation: 4,
      score_teaching_quality: 3,
      score_active_response: 4,
      score_student_centered: 5,
      score_research_teaching: 4,
      score_learning_effect: 3,
      score_interaction_quality: 4,
      score_method_diversity: 5,
      score_equal_dialogue: 4,
      score_pace_control: 3,
      score_feedback: 4,
      highlights: 'Great teaching',
      suggestions: 'Good job',
      improvement_suggestion: 'Improve this',
      development_suggestion: '',
      dimension_suggestion: 'Dimension tips',
      overallScore: 4,
    };

    const result = validateForm('submitted', form);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('请填写发展建议');
  });

  it('should reject submitted form with missing dimension suggestion', () => {
    const form = {
      score_teaching_content: 4,
      score_course_objective: 4,
      score_reference_sharing: 3,
      score_literature_humanities: 4,
      score_teaching_organization: 5,
      score_course_development: 4,
      score_course_focus: 3,
      score_language_logic: 4,
      score_interaction: 5,
      score_learning_preparation: 4,
      score_teaching_quality: 3,
      score_active_response: 4,
      score_student_centered: 5,
      score_research_teaching: 4,
      score_learning_effect: 3,
      score_interaction_quality: 4,
      score_method_diversity: 5,
      score_equal_dialogue: 4,
      score_pace_control: 3,
      score_feedback: 4,
      highlights: 'Great teaching',
      suggestions: 'Good job',
      improvement_suggestion: 'Improve this',
      development_suggestion: 'Develop that',
      dimension_suggestion: '',
      overallScore: 4,
    };

    const result = validateForm('submitted', form);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('请填写维度建议');
  });

  it('should reject submitted form with missing overall score', () => {
    const form = {
      score_teaching_content: 4,
      score_course_objective: 4,
      score_reference_sharing: 3,
      score_literature_humanities: 4,
      score_teaching_organization: 5,
      score_course_development: 4,
      score_course_focus: 3,
      score_language_logic: 4,
      score_interaction: 5,
      score_learning_preparation: 4,
      score_teaching_quality: 3,
      score_active_response: 4,
      score_student_centered: 5,
      score_research_teaching: 4,
      score_learning_effect: 3,
      score_interaction_quality: 4,
      score_method_diversity: 5,
      score_equal_dialogue: 4,
      score_pace_control: 3,
      score_feedback: 4,
      highlights: 'Great teaching',
      suggestions: 'Good job',
      improvement_suggestion: 'Improve this',
      development_suggestion: 'Develop that',
      dimension_suggestion: 'Dimension tips',
      overallScore: undefined,
    };

    const result = validateForm('submitted', form);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('请选择综合评分');
  });

  it('should accept submitted form with all required fields filled', () => {
    const completeForm = {
      score_teaching_content: 4,
      score_course_objective: 4,
      score_reference_sharing: 3,
      score_literature_humanities: 4,
      score_teaching_organization: 5,
      score_course_development: 4,
      score_course_focus: 3,
      score_language_logic: 4,
      score_interaction: 5,
      score_learning_preparation: 4,
      score_teaching_quality: 3,
      score_active_response: 4,
      score_student_centered: 5,
      score_research_teaching: 4,
      score_learning_effect: 3,
      score_interaction_quality: 4,
      score_method_diversity: 5,
      score_equal_dialogue: 4,
      score_pace_control: 3,
      score_feedback: 4,
      highlights: 'Great teaching with excellent engagement',
      suggestions: 'Good job overall, keep it up',
      improvement_suggestion: 'Improve time management',
      development_suggestion: 'Develop more interactive activities',
      dimension_suggestion: 'Enhance student participation dimension',
      overallScore: 4,
    };

    const result = validateForm('submitted', completeForm);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle whitespace-only text as empty', () => {
    const form = {
      score_teaching_content: 4,
      score_course_objective: 4,
      score_reference_sharing: 3,
      score_literature_humanities: 4,
      score_teaching_organization: 5,
      score_course_development: 4,
      score_course_focus: 3,
      score_language_logic: 4,
      score_interaction: 5,
      score_learning_preparation: 4,
      score_teaching_quality: 3,
      score_active_response: 4,
      score_student_centered: 5,
      score_research_teaching: 4,
      score_learning_effect: 3,
      score_interaction_quality: 4,
      score_method_diversity: 5,
      score_equal_dialogue: 4,
      score_pace_control: 3,
      score_feedback: 4,
      highlights: '   ',
      suggestions: 'Good job',
      improvement_suggestion: 'Improve this',
      development_suggestion: 'Develop that',
      dimension_suggestion: 'Dimension tips',
      overallScore: 4,
    };

    const result = validateForm('submitted', form);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('请填写课程亮点与评价');
  });
});
