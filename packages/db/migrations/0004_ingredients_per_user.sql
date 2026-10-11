-- Written by hand. The ingredients were one catalog for everyone, and now each user has their own.
-- Every user gets a copy of each ingredient their recipes list, with its photo. The first user keeps
-- the row and the photo as they were, so their ids do not change. An ingredient no recipe lists
-- belongs to no one, and it goes with its photo.
--
-- D1 keeps foreign keys on, so dropping `ingredient` while a table points at it would delete it
-- row by row and cascade to the photos. So the new tables point at `__new_ingredient`, the old ones
-- go first, and renaming `__new_ingredient` to `ingredient` renames those references with it.
CREATE TABLE `__ingredient_owner` (
	`ingredient_id` text NOT NULL,
	`user_id` text NOT NULL,
	`id` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__ingredient_owner`("ingredient_id", "user_id", "id")
SELECT "ingredient_id", "user_id",
	CASE WHEN row_number() OVER (PARTITION BY "ingredient_id" ORDER BY "user_id") = 1 THEN "ingredient_id"
	ELSE lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + abs(random()) % 4, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))
	END
FROM (
	SELECT DISTINCT ri."ingredient_id", r."user_id"
	FROM `recipe_ingredient` ri
	JOIN `recipe_section` s ON s."id" = ri."section_id"
	JOIN `recipe` r ON r."id" = s."recipe_id"
);
--> statement-breakpoint
CREATE TABLE `__new_ingredient` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_ingredient`("id", "user_id", "name")
SELECT o."id", o."user_id", i."name" FROM `__ingredient_owner` o JOIN `ingredient` i ON i."id" = o."ingredient_id";
--> statement-breakpoint
CREATE TABLE `__new_recipe_ingredient` (
	`section_id` text NOT NULL,
	`ingredient_id` text NOT NULL,
	`quantity` real NOT NULL,
	`unit` text,
	`position` integer NOT NULL,
	PRIMARY KEY(`section_id`, `ingredient_id`),
	FOREIGN KEY (`section_id`) REFERENCES `recipe_section`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ingredient_id`) REFERENCES `__new_ingredient`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_recipe_ingredient`("section_id", "ingredient_id", "quantity", "unit", "position")
SELECT ri."section_id", o."id", ri."quantity", ri."unit", ri."position"
FROM `recipe_ingredient` ri
JOIN `recipe_section` s ON s."id" = ri."section_id"
JOIN `recipe` r ON r."id" = s."recipe_id"
JOIN `__ingredient_owner` o ON o."ingredient_id" = ri."ingredient_id" AND o."user_id" = r."user_id";
--> statement-breakpoint
CREATE TABLE `__new_image` (
	`id` text PRIMARY KEY NOT NULL,
	`content` blob NOT NULL,
	`mime_type` text NOT NULL,
	`recipe_id` text,
	`ingredient_id` text,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipe`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ingredient_id`) REFERENCES `__new_ingredient`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "image_owner_check" CHECK(("recipe_id" is null) <> ("ingredient_id" is null))
);
--> statement-breakpoint
INSERT INTO `__new_image`("id", "content", "mime_type", "recipe_id", "ingredient_id")
SELECT "id", "content", "mime_type", "recipe_id", NULL FROM `image` WHERE "recipe_id" IS NOT NULL;
--> statement-breakpoint
INSERT INTO `__new_image`("id", "content", "mime_type", "recipe_id", "ingredient_id")
SELECT
	CASE WHEN o."id" = o."ingredient_id" THEN img."id"
	ELSE lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + abs(random()) % 4, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))
	END,
	img."content", img."mime_type", NULL, o."id"
FROM `image` img JOIN `__ingredient_owner` o ON o."ingredient_id" = img."ingredient_id";
--> statement-breakpoint
DROP TABLE `recipe_ingredient`;--> statement-breakpoint
DROP TABLE `image`;--> statement-breakpoint
DROP TABLE `ingredient`;--> statement-breakpoint
DROP TABLE `__ingredient_owner`;--> statement-breakpoint
ALTER TABLE `__new_ingredient` RENAME TO `ingredient`;--> statement-breakpoint
ALTER TABLE `__new_recipe_ingredient` RENAME TO `recipe_ingredient`;--> statement-breakpoint
ALTER TABLE `__new_image` RENAME TO `image`;--> statement-breakpoint
CREATE UNIQUE INDEX `ingredient_user_id_name_unique` ON `ingredient` (`user_id`,`name`);--> statement-breakpoint
CREATE INDEX `recipe_ingredient_ingredient_id_idx` ON `recipe_ingredient` (`ingredient_id`);--> statement-breakpoint
CREATE INDEX `image_recipe_id_idx` ON `image` (`recipe_id`);--> statement-breakpoint
CREATE INDEX `image_ingredient_id_idx` ON `image` (`ingredient_id`);
