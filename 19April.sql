-- 19 April 2026 — Updated table structures
-- Only tables that have changed since 16-04-2026.sql snapshot
-- New columns: order_items.status, order_items.batch_id, order_items.gst_rate
--              menu_items.gst_category
--              outlets.gst_number, outlets.gst_categories

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES  */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

-- ----------------------------
-- Updated structure for table public.menu_items
-- Change: added gst_category column for per-item GST classification
-- ----------------------------
CREATE TABLE IF NOT EXISTS "menu_items" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"outlet_id" UUID NOT NULL,
	"category_id" UUID NULL DEFAULT NULL,
	"name" TEXT NOT NULL,
	"description" TEXT NULL DEFAULT NULL,
	"base_price" NUMERIC(10,2) NOT NULL,
	"image_url" TEXT NULL DEFAULT NULL,
	"is_veg" BOOLEAN NOT NULL DEFAULT true,
	"is_available" BOOLEAN NOT NULL DEFAULT true,
	"prep_time_mins" INTEGER NULL DEFAULT 15,
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
	"updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
	"is_special" BOOLEAN NOT NULL DEFAULT false,
	"special_label" TEXT NOT NULL DEFAULT 'Today''s Special',
	"offer_label" TEXT NULL DEFAULT NULL,
	"offer_price" NUMERIC(10,2) NULL DEFAULT NULL::numeric,
	"gst_category" TEXT NULL DEFAULT NULL,
	PRIMARY KEY ("id"),
	CONSTRAINT "menu_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "menu_categories" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
	CONSTRAINT "menu_items_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);

-- ----------------------------
-- Updated structure for table public.order_items
-- Changes: added status, batch_id, gst_rate columns
-- ----------------------------
CREATE TABLE IF NOT EXISTS "order_items" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"order_id" UUID NOT NULL,
	"menu_item_id" UUID NOT NULL,
	"item_name" TEXT NOT NULL,
	"quantity" INTEGER NOT NULL DEFAULT 1,
	"unit_price" NUMERIC NOT NULL,
	"total_price" NUMERIC NOT NULL,
	"notes" TEXT NULL DEFAULT NULL,
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
	"status" TEXT NOT NULL DEFAULT 'pending',
	"batch_id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"gst_rate" NUMERIC(5,2) NOT NULL DEFAULT 0,
	PRIMARY KEY ("id"),
	CONSTRAINT "order_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
	CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);

-- ----------------------------
-- Updated structure for table public.outlets
-- Changes: added gst_number and gst_categories columns
-- ----------------------------
CREATE TABLE IF NOT EXISTS "outlets" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"owner_id" UUID NOT NULL,
	"name" TEXT NOT NULL,
	"address" TEXT NULL DEFAULT NULL,
	"phone" TEXT NULL DEFAULT NULL,
	"opening_time" TIME NULL DEFAULT NULL,
	"closing_time" TIME NULL DEFAULT NULL,
	"is_active" BOOLEAN NOT NULL DEFAULT true,
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
	"updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
	"latitude" NUMERIC(10,7) NULL DEFAULT NULL::numeric,
	"longitude" NUMERIC(10,7) NULL DEFAULT NULL::numeric,
	"gst_number" TEXT NULL DEFAULT NULL,
	"gst_categories" JSONB NULL DEFAULT NULL,
	PRIMARY KEY ("id"),
	CONSTRAINT "outlets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);

/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;

-- ----------------------------
-- 19 April 2026 addendum (mobile app implementation phase)
-- No additional database table/column/index/constraint changes were introduced.
-- ----------------------------
