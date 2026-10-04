CREATE TABLE `image` (
	`id` text PRIMARY KEY NOT NULL,
	`content` blob NOT NULL,
	`mime_type` text NOT NULL,
	`recipe_id` text,
	`ingredient_id` text,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipe`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredient`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "image_owner_check" CHECK(("image"."recipe_id" is null) <> ("image"."ingredient_id" is null))
);
--> statement-breakpoint
CREATE INDEX `image_recipe_id_idx` ON `image` (`recipe_id`);--> statement-breakpoint
CREATE INDEX `image_ingredient_id_idx` ON `image` (`ingredient_id`);--> statement-breakpoint
CREATE TABLE `ingredient` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ingredient_name_unique` ON `ingredient` (`name`);--> statement-breakpoint
CREATE TABLE `recipe` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`parent_id` text,
	`title` text NOT NULL,
	`source` text,
	`content` text DEFAULT '' NOT NULL,
	`yield` real,
	`yield_unit` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `recipe`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `recipe_parent_id_idx` ON `recipe` (`parent_id`);--> statement-breakpoint
CREATE INDEX `recipe_user_id_updated_at_idx` ON `recipe` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `recipe_ingredient` (
	`recipe_id` text NOT NULL,
	`ingredient_id` text NOT NULL,
	`quantity` real NOT NULL,
	`unit` text,
	PRIMARY KEY(`recipe_id`, `ingredient_id`),
	FOREIGN KEY (`recipe_id`) REFERENCES `recipe`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredient`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `recipe_ingredient_ingredient_id_idx` ON `recipe_ingredient` (`ingredient_id`);