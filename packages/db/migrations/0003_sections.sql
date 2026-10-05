CREATE TABLE `recipe_section` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`title` text,
	`position` integer NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipe`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "recipe_section_title_check" CHECK("recipe_section"."title" is not null or "recipe_section"."position" = 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_section_recipe_id_position_unique` ON `recipe_section` (`recipe_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_section_recipe_id_title_unique` ON `recipe_section` (`recipe_id`,`title`);--> statement-breakpoint
-- Written by hand: each recipe with ingredients gets one section with no title, under the recipe's
-- own id, so its lines can point at it below.
INSERT INTO `recipe_section`("id", "recipe_id", "title", "position") SELECT DISTINCT "recipe_id", "recipe_id", NULL, 0 FROM `recipe_ingredient`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_recipe_ingredient` (
	`section_id` text NOT NULL,
	`ingredient_id` text NOT NULL,
	`quantity` real NOT NULL,
	`unit` text,
	`position` integer NOT NULL,
	PRIMARY KEY(`section_id`, `ingredient_id`),
	FOREIGN KEY (`section_id`) REFERENCES `recipe_section`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredient`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_recipe_ingredient`("section_id", "ingredient_id", "quantity", "unit", "position") SELECT "recipe_id", "ingredient_id", "quantity", "unit", "position" FROM `recipe_ingredient`;--> statement-breakpoint
DROP TABLE `recipe_ingredient`;--> statement-breakpoint
ALTER TABLE `__new_recipe_ingredient` RENAME TO `recipe_ingredient`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `recipe_ingredient_ingredient_id_idx` ON `recipe_ingredient` (`ingredient_id`);