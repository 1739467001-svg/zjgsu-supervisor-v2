ALTER TABLE `course_evaluations` ADD `highlights` text;--> statement-breakpoint
ALTER TABLE `course_evaluations` ADD `suggestions` text;--> statement-breakpoint
ALTER TABLE `course_evaluations` ADD `improvement_suggestion` text;--> statement-breakpoint
ALTER TABLE `course_evaluations` ADD `development_suggestion` text;--> statement-breakpoint
ALTER TABLE `course_evaluations` ADD `dimension_suggestion` text;--> statement-breakpoint
ALTER TABLE `course_evaluations` ADD `resource_suggestion` text;--> statement-breakpoint
ALTER TABLE `course_evaluations` DROP COLUMN `text_highlight`;--> statement-breakpoint
ALTER TABLE `course_evaluations` DROP COLUMN `text_improvement`;--> statement-breakpoint
ALTER TABLE `course_evaluations` DROP COLUMN `text_good_experience`;--> statement-breakpoint
ALTER TABLE `course_evaluations` DROP COLUMN `text_improve_suggestion`;--> statement-breakpoint
ALTER TABLE `course_evaluations` DROP COLUMN `text_improve_direction`;--> statement-breakpoint
ALTER TABLE `course_evaluations` DROP COLUMN `text_other_suggestion`;