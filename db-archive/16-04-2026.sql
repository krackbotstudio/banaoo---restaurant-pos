-- --------------------------------------------------------
-- Host:                         api.banaoo.in
-- Server version:               PostgreSQL 15.8 on x86_64-pc-linux-gnu, compiled by gcc (GCC) 13.2.0, 64-bit
-- Server OS:                    
-- HeidiSQL Version:             12.16.0.7229
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES  */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

-- Dumping structure for table public.affiliate_commissions
CREATE TABLE IF NOT EXISTS "affiliate_commissions" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"affiliate_id" UUID NOT NULL,
	"referral_id" UUID NOT NULL,
	"subscription_payment_id" TEXT NULL DEFAULT NULL,
	"amount" NUMERIC NOT NULL DEFAULT 0,
	"status" TEXT NOT NULL DEFAULT 'pending',
	"period_start" TIMESTAMPTZ NULL DEFAULT NULL,
	"period_end" TIMESTAMPTZ NULL DEFAULT NULL,
	"paid_at" TIMESTAMPTZ NULL DEFAULT NULL,
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
	PRIMARY KEY ("id"),
	CONSTRAINT "affiliate_commissions_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
	CONSTRAINT "affiliate_commissions_referral_id_fkey" FOREIGN KEY ("referral_id") REFERENCES "affiliate_referrals" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
)
CREATE INDEX "idx_affiliate_commissions_affiliate_id" ON "" ("affiliate_id");;

-- Dumping data for table public.affiliate_commissions: -1 rows

-- Dumping structure for table public.affiliate_payouts
CREATE TABLE IF NOT EXISTS "affiliate_payouts" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"affiliate_id" UUID NOT NULL,
	"amount" NUMERIC NOT NULL DEFAULT 0,
	"status" TEXT NOT NULL DEFAULT 'requested',
	"payment_method" TEXT NOT NULL DEFAULT 'upi',
	"payment_details" JSONB NULL DEFAULT '{}',
	"transaction_id" TEXT NULL DEFAULT NULL,
	"requested_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
	"processed_at" TIMESTAMPTZ NULL DEFAULT NULL,
	"notes" TEXT NULL DEFAULT NULL,
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
	PRIMARY KEY ("id"),
	CONSTRAINT "affiliate_payouts_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
)
CREATE INDEX "idx_affiliate_payouts_affiliate_id" ON "" ("affiliate_id");
CREATE INDEX "idx_affiliate_payouts_status" ON "" ("status");;

-- Dumping data for table public.affiliate_payouts: -1 rows

-- Dumping structure for table public.affiliate_referrals
CREATE TABLE IF NOT EXISTS "affiliate_referrals" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"affiliate_id" UUID NOT NULL,
	"referred_user_id" UUID NOT NULL,
	"referred_outlet_id" UUID NULL DEFAULT NULL,
	"referral_date" TIMESTAMPTZ NOT NULL DEFAULT now(),
	"status" TEXT NOT NULL DEFAULT 'pending',
	PRIMARY KEY ("id"),
	CONSTRAINT "affiliate_referrals_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
	CONSTRAINT "affiliate_referrals_referred_outlet_id_fkey" FOREIGN KEY ("referred_outlet_id") REFERENCES "outlets" ("id") ON UPDATE NO ACTION ON DELETE SET NULL
)
CREATE INDEX "idx_affiliate_referrals_affiliate_id" ON "" ("affiliate_id");;

-- Dumping data for table public.affiliate_referrals: -1 rows

-- Dumping structure for table public.affiliates
CREATE TABLE IF NOT EXISTS "affiliates" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"user_id" UUID NOT NULL,
	"referral_code" TEXT NOT NULL,
	"payment_details" JSONB NULL DEFAULT '{}',
	"status" TEXT NOT NULL DEFAULT 'pending',
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
	"approved_at" TIMESTAMPTZ NULL DEFAULT NULL,
	PRIMARY KEY ("id"),
	UNIQUE ("referral_code")
)
CREATE INDEX "idx_affiliates_referral_code" ON "" ("referral_code");;

-- Dumping data for table public.affiliates: -1 rows

-- Dumping structure for function public.auto_confirm_staff_email
DELIMITER //
CREATE FUNCTION "auto_confirm_staff_email"() RETURNS UNKNOWN AS $$ 
BEGIN
  IF NEW.email LIKE '%@banaoo-staff.app' THEN
    NEW.email_confirmed_at := NOW();
  END IF;
  RETURN NEW;
END;
 $$//
DELIMITER ;

-- Dumping structure for table public.customer_addresses
CREATE TABLE IF NOT EXISTS "customer_addresses" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"customer_id" UUID NOT NULL,
	"label" TEXT NOT NULL DEFAULT 'Home',
	"address_text" TEXT NOT NULL,
	"lat" NUMERIC(10,7) NULL DEFAULT NULL::numeric,
	"lng" NUMERIC(10,7) NULL DEFAULT NULL::numeric,
	"is_default" BOOLEAN NOT NULL DEFAULT true,
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
	PRIMARY KEY ("id"),
	CONSTRAINT "customer_addresses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);

-- Dumping data for table public.customer_addresses: -1 rows

-- Dumping structure for table public.customers
CREATE TABLE IF NOT EXISTS "customers" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"phone" TEXT NOT NULL,
	"name" TEXT NULL DEFAULT NULL,
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
	"updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
	PRIMARY KEY ("id"),
	UNIQUE ("phone")
);

-- Dumping data for table public.customers: -1 rows

-- Dumping structure for function public.generate_order_number
DELIMITER //
CREATE FUNCTION "generate_order_number"(outlet_id UUID) RETURNS TEXT AS $$ 
DECLARE
  today_count integer;
  order_num text;
BEGIN
  SELECT COUNT(*) + 1 INTO today_count
  FROM public.orders o
  WHERE o.outlet_id = outlet_id
    AND DATE(o.created_at) = CURRENT_DATE;

  order_num := to_char(CURRENT_DATE, 'MMDD') || '-' || LPAD(today_count::text, 3, '0');

  RETURN order_num;
END;
 $$//
DELIMITER ;

-- Dumping structure for function public.handle_new_user
DELIMITER //
CREATE FUNCTION "handle_new_user"() RETURNS UNKNOWN AS $$ 
DECLARE
  v_staff         RECORD;
  v_profile_role  TEXT := 'owner';
  v_outlet_link   RECORD;
  v_staff_id      UUID;
BEGIN
  -- 1. SYNC TO PUBLIC.USERS
  INSERT INTO public.users (id, email, created_at)
  VALUES (NEW.id, NEW.email, NEW.created_at)
  ON CONFLICT (id) DO NOTHING;

  -- 2. IDENTIFY STAFF
  v_staff_id := (NEW.raw_user_meta_data ->> 'staff_member_id')::UUID;

  IF v_staff_id IS NOT NULL THEN
    SELECT sm.id, sm.role, sm.owner_id
      INTO v_staff
      FROM public.staff_members sm
     WHERE sm.id = v_staff_id
       AND sm.is_active = true;

    IF FOUND THEN
      v_profile_role := CASE v_staff.role
        WHEN 'manager'  THEN 'manager'
        WHEN 'chef'     THEN 'kitchen'
        WHEN 'waiter'   THEN 'service'
        WHEN 'cashier'  THEN 'service'
        ELSE 'service'
      END;
    END IF;

  ELSE
    -- ⚠️ FIXED: parentheses added
    SELECT sm.id, sm.role, sm.owner_id
      INTO v_staff
      FROM public.staff_members sm
     WHERE (
            lower(sm.email) = lower(NEW.email)
         OR lower(sm.system_email) = lower(NEW.email)
           )
       AND sm.is_active = true
     LIMIT 1;

    IF FOUND THEN
      v_profile_role := CASE v_staff.role
        WHEN 'manager'  THEN 'manager'
        WHEN 'chef'     THEN 'kitchen'
        WHEN 'waiter'   THEN 'service'
        WHEN 'cashier'  THEN 'service'
        ELSE 'service'
      END;
    END IF;
  END IF;

  -- 3. INSERT PROFILE
  INSERT INTO public.profiles (user_id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      split_part(NEW.email, '@', 1)
    ),
    v_profile_role
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- 4. AUTO-ASSIGN OUTLETS
  IF v_staff.id IS NOT NULL THEN
    FOR v_outlet_link IN
      SELECT outlet_id
      FROM public.staff_outlet_links
      WHERE staff_member_id = v_staff.id
    LOOP
      INSERT INTO public.staff_outlet_assignments (user_id, outlet_id)
      VALUES (NEW.id, v_outlet_link.outlet_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN NEW;
END;
 $$//
DELIMITER ;

-- Dumping structure for function public.is_admin
DELIMITER //
CREATE FUNCTION "is_admin"() RETURNS BOOLEAN AS $$ 
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = auth.uid()
      AND is_admin = true
  );
 $$//
DELIMITER ;

-- Dumping structure for function public.is_staff_of_outlet
DELIMITER //
CREATE FUNCTION "is_staff_of_outlet"(_user_id UUID, _outlet_id UUID) RETURNS BOOLEAN AS $$ 
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_outlet_assignments
    WHERE user_id = _user_id
      AND outlet_id = _outlet_id
  );
 $$//
DELIMITER ;

-- Dumping structure for table public.menu_categories
CREATE TABLE IF NOT EXISTS "menu_categories" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"outlet_id" UUID NOT NULL,
	"name" TEXT NOT NULL,
	"sort_order" INTEGER NOT NULL DEFAULT 0,
	"is_active" BOOLEAN NOT NULL DEFAULT true,
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
	PRIMARY KEY ("id"),
	CONSTRAINT "menu_categories_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);

-- Dumping data for table public.menu_categories: -1 rows
INSERT INTO "menu_categories" ("id", "outlet_id", "name", "sort_order", "is_active", "created_at") VALUES
	('0053177a-bc31-476d-b25d-72dcb56a227f', '7524750f-332c-4d0b-aa9d-956d950e2e1c', 'Beverage', 0, 'true', '2026-03-31 07:35:29.485618+00'),
	('010fafcf-6cb6-4363-89d9-95202d0e228d', '7524750f-332c-4d0b-aa9d-956d950e2e1c', 'Appetizers', 0, 'true', '2026-03-31 07:35:29.41087+00'),
	('1f5f3a7c-9988-47bc-ad37-ae613b52387c', '7524750f-332c-4d0b-aa9d-956d950e2e1c', 'main course', 0, 'true', '2026-03-30 20:44:19.95616+00'),
	('2d87933c-66ff-4337-9872-f415c05dda0b', 'c1be311f-e30c-4e11-b173-e393f2155594', 'Egg Starters', 0, 'true', '2026-04-06 09:37:41.129474+00'),
	('446f8f18-37f3-4f39-b507-326c49b59a4f', 'd776e4e4-4e69-4d69-b796-9c8018fc898d', 'main course', 0, 'true', '2026-03-29 20:51:42.711242+00'),
	('48a4a418-813b-4f77-a064-e9d41dd25dbf', 'fe9adce2-5d31-4523-b788-0b624a9ce3a7', 'Bucket Biryani''s', 0, 'true', '2026-04-05 12:23:19.219623+00'),
	('6354d744-d197-4480-8b65-7c721d504984', 'c1be311f-e30c-4e11-b173-e393f2155594', 'Non Veg Curries', 0, 'true', '2026-04-06 09:37:16.098793+00'),
	('65db2bf6-1640-4daa-8d66-f7a2f53a11d8', 'fe9adce2-5d31-4523-b788-0b624a9ce3a7', 'Veg Curres', 0, 'true', '2026-04-05 12:23:19.176359+00'),
	('6696188e-9503-46b8-9815-458a1c1acecd', 'c1be311f-e30c-4e11-b173-e393f2155594', 'Sea Starters', 0, 'true', '2026-04-06 09:36:51.364024+00'),
	('6dce255f-bddb-4d06-9209-2b3f059c9f2c', 'c1be311f-e30c-4e11-b173-e393f2155594', 'Non-Veg Biryani''s', 0, 'true', '2026-04-06 09:35:54.181317+00'),
	('6eaea60c-46a8-4a45-a921-d0ac542468f8', 'c1be311f-e30c-4e11-b173-e393f2155594', 'Veg Biryani''s', 0, 'true', '2026-04-06 09:35:54.120025+00'),
	('716662e9-5258-48e0-ad88-36f7e04a0917', 'c1be311f-e30c-4e11-b173-e393f2155594', 'Tandoori Items', 0, 'true', '2026-04-06 09:37:41.205179+00'),
	('756e529c-1f60-4fc9-ba25-858618c91279', 'c1be311f-e30c-4e11-b173-e393f2155594', 'Veg Starters', 0, 'true', '2026-04-06 09:36:51.304594+00'),
	('852dc3f7-6559-4a1c-ae0b-bf4a496c1250', 'c1be311f-e30c-4e11-b173-e393f2155594', 'Chinesse', 0, 'true', '2026-04-06 09:37:41.27822+00'),
	('94670ff0-7c83-47f9-b1f3-ea7f72a51087', 'c1be311f-e30c-4e11-b173-e393f2155594', 'Veg Curres', 0, 'true', '2026-04-06 09:35:09.45517+00'),
	('9f124c6a-8567-410e-a6ff-ff0072a34de1', 'c1be311f-e30c-4e11-b173-e393f2155594', 'Non Veg Starters', 0, 'true', '2026-04-06 09:36:27.495742+00'),
	('cd082ac8-713e-4c3f-8dc4-abd02cf025e9', 'c1be311f-e30c-4e11-b173-e393f2155594', 'Roti Items', 0, 'true', '2026-04-06 09:37:16.040243+00'),
	('e7803acc-9474-41bd-ac92-7e15183a020f', 'c1be311f-e30c-4e11-b173-e393f2155594', 'Bucket Biryani''s', 0, 'true', '2026-04-06 09:35:09.532897+00');

-- Dumping structure for table public.menu_item_images
CREATE TABLE IF NOT EXISTS "menu_item_images" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"search_term" TEXT NOT NULL,
	"image_url" TEXT NOT NULL,
	"thumb_url" TEXT NOT NULL,
	"source" TEXT NOT NULL DEFAULT 'unknown',
	"created_at" TIMESTAMPTZ NULL DEFAULT now(),
	PRIMARY KEY ("id"),
	UNIQUE ("search_term", "image_url")
)
CREATE INDEX "idx_menu_item_images_search_term" ON "" ("search_term");;

-- Dumping data for table public.menu_item_images: -1 rows
INSERT INTO "menu_item_images" ("id", "search_term", "image_url", "thumb_url", "source", "created_at") VALUES
	('02afa191-9f06-4274-8dd6-d838103d7dc5', 'sandwich', 'https://www.themealdb.com/images/media/meals/ae6clc1760524712.jpg', 'https://www.themealdb.com/images/media/meals/ae6clc1760524712.jpg', 'TheMealDB', '2026-03-31 07:35:42.445444+00'),
	('09e548a5-1cbf-4563-a5ae-09bad18f1f49', 'dal fry', 'https://www.themealdb.com/images/media/meals/wuxrtu1483564410.jpg', 'https://www.themealdb.com/images/media/meals/wuxrtu1483564410.jpg', 'TheMealDB', '2026-04-05 12:23:38.79372+00'),
	('0c089ba2-7e7e-4549-ae0c-71dfd264960b', 'cocktails', 'https://upload.wikimedia.org/wikipedia/commons/8/80/15-09-26-RalfR-WLC-0084.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/15-09-26-RalfR-WLC-0084.jpg/330px-15-09-26-RalfR-WLC-0084.jpg', 'Wikipedia', '2026-03-31 07:35:40.700951+00'),
	('0ce62191-daba-498d-9547-ee19982b73e3', 'paneer tikka', 'https://upload.wikimedia.org/wikipedia/commons/f/f2/Paneer_tikka.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Paneer_tikka.jpg/330px-Paneer_tikka.jpg', 'Wikipedia', '2026-04-06 09:37:17.398547+00'),
	('170d521e-6fa3-42a3-9076-4648b847a089', 'sandwich', 'https://www.themealdb.com/images/media/meals/xr0n4r1576788363.jpg', 'https://www.themealdb.com/images/media/meals/xr0n4r1576788363.jpg', 'TheMealDB', '2026-03-31 07:35:42.441671+00'),
	('1ac0a2fb-4f84-402d-80e0-e0e5c1e37e8a', 'mushroom curry', 'https://upload.wikimedia.org/wikipedia/commons/6/65/Sparrige_Sch%C3%BCppling_%28Pholiota_squarrosa%29.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Sparrige_Sch%C3%BCppling_%28Pholiota_squarrosa%29.jpg/330px-Sparrige_Sch%C3%BCppling_%28Pholiota_squarrosa%29.jpg', 'Wikipedia', '2026-04-05 12:23:41.233399+00'),
	('21ae2c41-7725-4ab9-ae80-5c5aa138b77e', 'mutton biryani', 'https://upload.wikimedia.org/wikipedia/commons/5/5a/%22Hyderabadi_Dum_Biryani%22.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/%22Hyderabadi_Dum_Biryani%22.jpg/330px-%22Hyderabadi_Dum_Biryani%22.jpg', 'Wikipedia', '2026-04-05 12:23:47.965864+00'),
	('2d22ef33-2bd6-4520-98fb-61d84b980c5e', 'chicken curry', 'https://www.themealdb.com/images/media/meals/yxsurp1511304301.jpg', 'https://www.themealdb.com/images/media/meals/yxsurp1511304301.jpg', 'TheMealDB', '2026-04-06 09:37:35.083046+00'),
	('35470765-7efc-4d77-b77c-623a14f228ae', 'white rice', 'https://upload.wikimedia.org/wikipedia/commons/a/af/Half_a_cup_of_rice._Brown_rice_is_the_best_choice.JPG', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Half_a_cup_of_rice._Brown_rice_is_the_best_choice.JPG/330px-Half_a_cup_of_rice._Brown_rice_is_the_best_choice.JPG', 'Wikipedia', '2026-04-06 09:38:16.905061+00'),
	('36ffe30e-cafb-485f-88ba-c86123a09ddd', 'pepper chicken', 'https://upload.wikimedia.org/wikipedia/en/8/80/Pepper_Chicken_%28film_cover%29.jpg', 'https://upload.wikimedia.org/wikipedia/en/8/80/Pepper_Chicken_%28film_cover%29.jpg', 'Wikipedia', '2026-04-06 09:36:40.928945+00'),
	('37ae800b-5eb5-412d-9736-17ef8a408d37', 'iced tea', 'https://upload.wikimedia.org/wikipedia/commons/3/37/Y%C3%AAn_H%C3%B2a_Parkview_City_29-07-2025_Mme_Th%E1%BB%A7y_Iced_Tea_E03.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Y%C3%AAn_H%C3%B2a_Parkview_City_29-07-2025_Mme_Th%E1%BB%A7y_Iced_Tea_E03.jpg/330px-Y%C3%AAn_H%C3%B2a_Parkview_City_29-07-2025_Mme_Th%E1%BB%A7y_Iced_Tea_E03.jpg', 'Wikipedia', '2026-03-31 07:35:45.620929+00'),
	('39cb5fe1-2312-4eb2-b46d-fd68810ab6d8', 'chicken tikka', 'https://upload.wikimedia.org/wikipedia/commons/b/bd/Tandoorimumbai.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Tandoorimumbai.jpg/330px-Tandoorimumbai.jpg', 'Wikipedia', '2026-04-06 09:38:03.724123+00'),
	('402d8b8c-afb1-451c-ad61-3fc8117ecc9a', 'sandwich', 'https://www.themealdb.com/images/media/meals/xutquv1505330523.jpg', 'https://www.themealdb.com/images/media/meals/xutquv1505330523.jpg', 'TheMealDB', '2026-03-31 07:35:42.444285+00'),
	('4082da88-e14b-445d-bf09-3572ee19ad88', 'chicken lollipop', 'https://upload.wikimedia.org/wikipedia/commons/a/a0/Chicken_lollipop_in_Goa.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Chicken_lollipop_in_Goa.jpg/330px-Chicken_lollipop_in_Goa.jpg', 'Wikipedia', '2026-04-06 09:36:29.011023+00'),
	('430730cc-db20-462b-b3bc-e5b6bc2fbdf2', 'orange juice', 'https://upload.wikimedia.org/wikipedia/commons/0/05/Orangejuice.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Orangejuice.jpg/330px-Orangejuice.jpg', 'Wikipedia', '2026-03-31 07:35:46.914609+00'),
	('45987826-ceda-4c5a-989e-42000c71b088', 'palak paneer', 'https://upload.wikimedia.org/wikipedia/commons/b/b7/Palakpaneer_Rayagada_Odisha_0009.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Palakpaneer_Rayagada_Odisha_0009.jpg/330px-Palakpaneer_Rayagada_Odisha_0009.jpg', 'Wikipedia', '2026-04-05 12:23:27.686319+00'),
	('471bc26a-3445-449b-a283-508486c0e981', 'cheese sandwich', 'https://www.themealdb.com/images/media/meals/xutquv1505330523.jpg', 'https://www.themealdb.com/images/media/meals/xutquv1505330523.jpg', 'TheMealDB', '2026-03-31 07:35:32.328067+00'),
	('4f83f360-ac52-4948-9aab-93bb08ba7fef', 'chicken curry', 'https://www.themealdb.com/images/media/meals/vwrpps1503068729.jpg', 'https://www.themealdb.com/images/media/meals/vwrpps1503068729.jpg', 'TheMealDB', '2026-04-06 09:37:35.081372+00'),
	('5f86ee21-1c49-4253-a5bf-df11d20bf890', 'paneer butter masala', 'https://upload.wikimedia.org/wikipedia/commons/a/ad/Shahi_panner.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Shahi_panner.jpg/330px-Shahi_panner.jpg', 'Wikipedia', '2026-04-05 12:23:26.079934+00'),
	('61aa3386-66d9-4895-bbdb-bc5db4027d8a', 'kadai paneer', 'https://upload.wikimedia.org/wikipedia/commons/7/7d/Kadai_Paneer-Delhi-12.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Kadai_Paneer-Delhi-12.jpg/330px-Kadai_Paneer-Delhi-12.jpg', 'Wikipedia', '2026-04-05 12:23:36.229542+00'),
	('639328ad-fbd0-44c2-b5f5-ebcd8b53e9af', 'chicken manchurian', 'https://upload.wikimedia.org/wikipedia/commons/b/bb/Chicken_Manchurian_%28Hyderabad_Style%29_%2811960049916%29.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/Chicken_Manchurian_%28Hyderabad_Style%29_%2811960049916%29.jpg/330px-Chicken_Manchurian_%28Hyderabad_Style%29_%2811960049916%29.jpg', 'Wikipedia', '2026-04-06 09:36:39.648232+00'),
	('6bfe8324-1193-4b4d-955a-b6bcd48a575d', 'chicken curry', 'https://www.themealdb.com/images/media/meals/0dhtwr1763371444.jpg', 'https://www.themealdb.com/images/media/meals/0dhtwr1763371444.jpg', 'TheMealDB', '2026-04-06 09:37:35.084398+00'),
	('78b6de82-6d95-44b7-9fdd-b4d17a0d2929', 'cheese sandwich', 'https://upload.wikimedia.org/wikipedia/commons/3/37/Cheese_roll_at_The_Original_Tea_Hut_at_High_Beach%2C_Essex%2C_England.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Cheese_roll_at_The_Original_Tea_Hut_at_High_Beach%2C_Essex%2C_England.jpg/330px-Cheese_roll_at_The_Original_Tea_Hut_at_High_Beach%2C_Essex%2C_England.jpg', 'Wikipedia', '2026-03-31 07:35:32.331052+00'),
	('7f8ef2de-71e9-4235-84bd-192b1efc56a4', 'spicy chicken', 'https://upload.wikimedia.org/wikipedia/commons/5/57/Chickens_in_market.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Chickens_in_market.jpg/330px-Chickens_in_market.jpg', 'Wikipedia', '2026-03-31 07:35:36.878094+00'),
	('83c5eca8-18db-4936-b9b4-7821382337e2', 'sandwich', 'https://www.themealdb.com/images/media/meals/j80gmw1764372176.jpg', 'https://www.themealdb.com/images/media/meals/j80gmw1764372176.jpg', 'TheMealDB', '2026-03-31 07:35:42.439887+00'),
	('96c23975-d70d-46b8-8b8c-c7dbf4bef1ee', 'iced coffee', 'https://upload.wikimedia.org/wikipedia/commons/a/ac/Affogato_al_Caffe.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Affogato_al_Caffe.jpg/330px-Affogato_al_Caffe.jpg', 'Wikipedia', '2026-03-31 07:35:50.174469+00'),
	('aac37bff-2d2e-4aba-b930-e802499d0e27', 'prawn curry', 'https://www.themealdb.com/images/media/meals/qqlwv91763501559.jpg', 'https://www.themealdb.com/images/media/meals/qqlwv91763501559.jpg', 'TheMealDB', '2026-04-06 09:37:57.140371+00'),
	('ac0ac78d-9527-4c5a-8c7c-4a2d6f9b3254', 'mutton curry', 'https://upload.wikimedia.org/wikipedia/commons/8/80/Bengali_Mutton_Curry.JPG', 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Bengali_Mutton_Curry.JPG/330px-Bengali_Mutton_Curry.JPG', 'Wikipedia', '2026-04-06 09:37:54.247154+00'),
	('ac1e010d-3192-4c1c-acce-beaf0f21d213', 'egg biryani', 'https://upload.wikimedia.org/wikipedia/commons/5/5a/%22Hyderabadi_Dum_Biryani%22.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/%22Hyderabadi_Dum_Biryani%22.jpg/330px-%22Hyderabadi_Dum_Biryani%22.jpg', 'Wikipedia', '2026-04-06 09:36:09.873349+00'),
	('b6d18ef4-59f1-4b97-a610-6e7b8d11e010', 'hot dog', 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Hot_dog_with_mustard.png', 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Hot_dog_with_mustard.png/330px-Hot_dog_with_mustard.png', 'Wikipedia', '2026-03-31 07:35:38.710184+00'),
	('c1b8e447-959d-4614-9b3d-0b35a9745ac3', 'butter chicken', 'https://upload.wikimedia.org/wikipedia/commons/4/41/Butter_Chicken_%26_Butter_Naan_-_Home_-_Chandigarh_-_India_-_0006.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Butter_Chicken_%26_Butter_Naan_-_Home_-_Chandigarh_-_India_-_0006.jpg/330px-Butter_Chicken_%26_Butter_Naan_-_Home_-_Chandigarh_-_India_-_0006.jpg', 'Wikipedia', '2026-04-06 09:37:36.492853+00'),
	('c8ae5c90-c5fd-463e-96bc-61623340b2cc', 'lemon chicken', 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Lemonchicken.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Lemonchicken.jpg/330px-Lemonchicken.jpg', 'Wikipedia', '2026-04-06 09:36:43.488255+00'),
	('cab09aeb-4303-4685-8a24-29d6660741e1', 'milk shake', 'https://upload.wikimedia.org/wikipedia/commons/6/68/Strawberry_milk_shake_%28cropped%29.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/Strawberry_milk_shake_%28cropped%29.jpg/330px-Strawberry_milk_shake_%28cropped%29.jpg', 'Wikipedia', '2026-03-31 07:35:44.532729+00'),
	('cb1c59e7-88c7-4d3d-98f2-55715c223360', 'sandwich', 'https://www.themealdb.com/images/media/meals/sbx7n71587673021.jpg', 'https://www.themealdb.com/images/media/meals/sbx7n71587673021.jpg', 'TheMealDB', '2026-03-31 07:35:42.442836+00'),
	('d262666e-8b2b-41e3-ada3-8ace8430eef9', 'french fries', 'https://upload.wikimedia.org/wikipedia/commons/8/83/French_Fries.JPG', 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/French_Fries.JPG/330px-French_Fries.JPG', 'Wikipedia', '2026-03-31 07:35:43.490312+00'),
	('dbcc671a-3eac-4383-9084-693e1e94d935', 'paneer chilli', 'https://upload.wikimedia.org/wikipedia/commons/8/8d/ChineseDishLogo.png', 'https://upload.wikimedia.org/wikipedia/commons/8/8d/ChineseDishLogo.png', 'Wikipedia', '2026-04-06 09:37:02.970646+00'),
	('e93f133d-fec4-4ec5-a052-769296a3dfb1', 'cheeseburger', 'https://upload.wikimedia.org/wikipedia/commons/4/4d/Cheeseburger.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Cheeseburger.jpg/330px-Cheeseburger.jpg', 'Wikipedia', '2026-03-31 07:35:30.932361+00'),
	('ff101d71-fb3d-4c31-a980-8c29144470e7', 'chicken fried rice', 'https://www.themealdb.com/images/media/meals/wuyd2h1765655837.jpg', 'https://www.themealdb.com/images/media/meals/wuyd2h1765655837.jpg', 'TheMealDB', '2026-04-06 09:38:10.349164+00');

-- Dumping structure for table public.menu_items
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
	PRIMARY KEY ("id"),
	CONSTRAINT "menu_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "menu_categories" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
	CONSTRAINT "menu_items_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);

-- Dumping data for table public.menu_items: 227 rows
INSERT INTO "menu_items" ("id", "outlet_id", "category_id", "name", "description", "base_price", "image_url", "is_veg", "is_available", "prep_time_mins", "created_at", "updated_at", "is_special", "special_label", "offer_label", "offer_price") VALUES
	('009f1c65-a6c7-4faf-8c30-2116e41b7140', 'c1be311f-e30c-4e11-b173-e393f2155594', '94670ff0-7c83-47f9-b1f3-ea7f72a51087', 'Paneer Chatpat', NULL, 180.00, NULL, 'true', 'true', 15, '2026-04-06 09:35:09.688262+00', '2026-04-06 09:35:09.688262+00', 'false', 'Today''s Special', NULL, NULL),
	('0275b74b-782d-4308-acd7-65155ca44484', 'c1be311f-e30c-4e11-b173-e393f2155594', 'cd082ac8-713e-4c3f-8dc4-abd02cf025e9', 'Paneer Kulcha', NULL, 80.00, NULL, 'true', 'true', 15, '2026-04-06 09:37:16.213419+00', '2026-04-06 09:37:16.213419+00', 'false', 'Today''s Special', NULL, NULL),
	('02fc0c27-df6f-44e5-9b1a-a8efa99e1605', 'c1be311f-e30c-4e11-b173-e393f2155594', '6dce255f-bddb-4d06-9209-2b3f059c9f2c', 'Tandi Biryani', NULL, 250.00, NULL, 'false', 'true', 15, '2026-04-06 09:35:54.297735+00', '2026-04-06 09:35:54.297735+00', 'false', 'Today''s Special', NULL, NULL),
	('03b791c2-db4d-47a2-9ba1-19f3b38276ec', '7524750f-332c-4d0b-aa9d-956d950e2e1c', '010fafcf-6cb6-4363-89d9-95202d0e228d', 'Sandwich', NULL, 13.00, 'https://www.themealdb.com/images/media/meals/ae6clc1760524712.jpg', 'true', 'true', 15, '2026-03-31 07:35:29.573572+00', '2026-03-31 07:35:29.573572+00', 'false', 'Today''s Special', NULL, NULL),
	('066527b2-4539-4db2-a5e2-98ae7f35c3e0', 'c1be311f-e30c-4e11-b173-e393f2155594', '6dce255f-bddb-4d06-9209-2b3f059c9f2c', 'Natu kodi Roast Biryani', NULL, 350.00, NULL, 'false', 'true', 15, '2026-04-06 09:35:54.297735+00', '2026-04-06 09:35:54.297735+00', 'false', 'Today''s Special', NULL, NULL),
	('08b5e1d0-94e4-432e-a5a7-3ab2920ed1df', 'c1be311f-e30c-4e11-b173-e393f2155594', '756e529c-1f60-4fc9-ba25-858618c91279', 'Onion Pakoda', NULL, 150.00, NULL, 'true', 'true', 15, '2026-04-06 09:36:51.476443+00', '2026-04-06 09:36:51.476443+00', 'false', 'Today''s Special', NULL, NULL),
	('0bbbadf5-f0e4-4f94-a284-9f36be96b172', 'c1be311f-e30c-4e11-b173-e393f2155594', '94670ff0-7c83-47f9-b1f3-ea7f72a51087', 'Veg chatpata', NULL, 160.00, NULL, 'true', 'true', 15, '2026-04-06 09:35:09.688262+00', '2026-04-06 09:35:09.688262+00', 'false', 'Today''s Special', NULL, NULL),
	('0c105935-f775-4af6-9543-cc7c5013cc40', 'c1be311f-e30c-4e11-b173-e393f2155594', '716662e9-5258-48e0-ad88-36f7e04a0917', 'Tandoori Full', NULL, 450.00, NULL, 'false', 'true', 15, '2026-04-06 09:37:41.410452+00', '2026-04-06 09:37:41.410452+00', 'false', 'Today''s Special', NULL, NULL),
	('0d5fd45a-75dd-4301-848e-356dd4238ff9', 'c1be311f-e30c-4e11-b173-e393f2155594', 'e7803acc-9474-41bd-ac92-7e15183a020f', 'Tangdi Biryani', NULL, 750.00, NULL, 'false', 'true', 15, '2026-04-06 09:35:09.688262+00', '2026-04-06 09:35:09.688262+00', 'false', 'Today''s Special', NULL, NULL),
	('0e1b6ab4-8bfb-4a7c-b27b-6fcb0f256df4', 'c1be311f-e30c-4e11-b173-e393f2155594', '6dce255f-bddb-4d06-9209-2b3f059c9f2c', 'S/P Chicken Biryani', NULL, 240.00, NULL, 'false', 'true', 15, '2026-04-06 09:35:54.297735+00', '2026-04-06 09:35:54.297735+00', 'false', 'Today''s Special', NULL, NULL),
	('0f16b6f9-c74e-4372-9140-931a082af43f', 'c1be311f-e30c-4e11-b173-e393f2155594', '852dc3f7-6559-4a1c-ae0b-bf4a496c1250', 'Veg Fried Rice', NULL, 100.00, NULL, 'true', 'true', 15, '2026-04-06 09:37:41.410452+00', '2026-04-06 09:37:41.410452+00', 'false', 'Today''s Special', NULL, NULL),
	('0f51adcb-d8bb-486d-9b05-a5c1d6a3efb2', 'c1be311f-e30c-4e11-b173-e393f2155594', '6354d744-d197-4480-8b65-7c721d504984', 'Mutton Curry', NULL, 320.00, 'https://upload.wikimedia.org/wikipedia/commons/8/80/Bengali_Mutton_Curry.JPG', 'false', 'true', 15, '2026-04-06 09:37:16.213419+00', '2026-04-06 09:37:16.213419+00', 'false', 'Today''s Special', NULL, NULL),
	('0f657958-7cbe-4b7c-b65d-5c6fbd92c81d', 'c1be311f-e30c-4e11-b173-e393f2155594', '9f124c6a-8567-410e-a6ff-ff0072a34de1', 'Peanut Chicken', NULL, 360.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:27.618396+00', '2026-04-06 09:36:27.618396+00', 'false', 'Today''s Special', NULL, NULL),
	('10cab467-e173-455a-bdc9-6b3501c893c7', 'c1be311f-e30c-4e11-b173-e393f2155594', '2d87933c-66ff-4337-9872-f415c05dda0b', 'Egg Masala', NULL, 150.00, NULL, 'false', 'true', 15, '2026-04-06 09:37:41.410452+00', '2026-04-06 09:37:41.410452+00', 'false', 'Today''s Special', NULL, NULL),
	('11de8fd0-4fb1-4c20-a076-71dc9f2cda52', 'c1be311f-e30c-4e11-b173-e393f2155594', '6dce255f-bddb-4d06-9209-2b3f059c9f2c', 'Mutton Fry Biryani', NULL, 340.00, NULL, 'false', 'true', 15, '2026-04-06 09:35:54.297735+00', '2026-04-06 09:35:54.297735+00', 'false', 'Today''s Special', NULL, NULL),
	('120aadbc-ac1c-4a53-bb5d-c04b9bc6c09e', 'c1be311f-e30c-4e11-b173-e393f2155594', '2d87933c-66ff-4337-9872-f415c05dda0b', 'Egg Keema Curry', NULL, 150.00, NULL, 'false', 'true', 15, '2026-04-06 09:37:41.410452+00', '2026-04-06 09:37:41.410452+00', 'false', 'Today''s Special', NULL, NULL),
	('13bf4115-3740-4a46-83fa-8f3090a1ecb7', '7524750f-332c-4d0b-aa9d-956d950e2e1c', '0053177a-bc31-476d-b25d-72dcb56a227f', 'Orange Juice', NULL, 24.00, 'https://upload.wikimedia.org/wikipedia/commons/0/05/Orangejuice.jpg', 'true', 'true', 15, '2026-03-31 07:35:29.573572+00', '2026-03-31 07:35:29.573572+00', 'false', 'Today''s Special', NULL, NULL),
	('13f56431-14bc-4c94-89c8-bbfb883a2d03', 'fe9adce2-5d31-4523-b788-0b624a9ce3a7', '65db2bf6-1640-4daa-8d66-f7a2f53a11d8', 'Mushroom Curry', NULL, 180.00, 'https://upload.wikimedia.org/wikipedia/commons/6/65/Sparrige_Sch%C3%BCppling_%28Pholiota_squarrosa%29.jpg', 'true', 'true', 15, '2026-04-05 12:23:19.295562+00', '2026-04-05 12:23:19.295562+00', 'false', 'Today''s Special', NULL, NULL),
	('145b809f-df58-496c-8948-12a2c73d9fa2', 'fe9adce2-5d31-4523-b788-0b624a9ce3a7', '65db2bf6-1640-4daa-8d66-f7a2f53a11d8', 'Mini Veg Curry', NULL, 150.00, NULL, 'true', 'true', 15, '2026-04-05 12:23:19.295562+00', '2026-04-05 12:23:19.295562+00', 'false', 'Today''s Special', NULL, NULL),
	('153117c9-0a5e-401c-8b63-57cb65f7fff0', 'c1be311f-e30c-4e11-b173-e393f2155594', 'e7803acc-9474-41bd-ac92-7e15183a020f', 'Bucket Dum Biryani', '(Half Chicken Starter, Half Chicken Curry, Roti 3)', 750.00, NULL, 'false', 'true', 15, '2026-04-06 09:35:09.688262+00', '2026-04-06 09:35:09.688262+00', 'false', 'Today''s Special', NULL, NULL),
	('16dd356d-9e51-4d01-8f11-3a9e54dd74e9', 'fe9adce2-5d31-4523-b788-0b624a9ce3a7', '48a4a418-813b-4f77-a064-e9d41dd25dbf', 'Mutton Biryani', '(Mutton Fry Biryani, Mutton Curry Half, Roti 3)', 1280.00, 'https://upload.wikimedia.org/wikipedia/commons/5/5a/%22Hyderabadi_Dum_Biryani%22.jpg', 'false', 'true', 15, '2026-04-05 12:23:19.295562+00', '2026-04-05 12:23:19.295562+00', 'false', 'Today''s Special', NULL, NULL),
	('18c0dcfc-ed2b-4822-959a-70a74def337f', 'c1be311f-e30c-4e11-b173-e393f2155594', '6eaea60c-46a8-4a45-a921-d0ac542468f8', 'Kaju Mashuroom Biryani', NULL, 220.00, NULL, 'true', 'true', 15, '2026-04-06 09:35:54.297735+00', '2026-04-06 09:35:54.297735+00', 'false', 'Today''s Special', NULL, NULL),
	('1931ea93-6777-4155-bd99-3c7e57666930', 'c1be311f-e30c-4e11-b173-e393f2155594', '6696188e-9503-46b8-9815-458a1c1acecd', 'Pepper Fish Fry', NULL, 220.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:51.476443+00', '2026-04-06 09:36:51.476443+00', 'false', 'Today''s Special', NULL, NULL),
	('1a774ff9-2816-45e1-a249-6b10c4bbfc54', '7524750f-332c-4d0b-aa9d-956d950e2e1c', '1f5f3a7c-9988-47bc-ad37-ae613b52387c', 'Cheese Sandwich', NULL, 22.00, 'https://upload.wikimedia.org/wikipedia/commons/3/37/Cheese_roll_at_The_Original_Tea_Hut_at_High_Beach%2C_Essex%2C_England.jpg', 'true', 'true', 15, '2026-03-31 07:35:29.573572+00', '2026-03-31 07:35:29.573572+00', 'false', 'Today''s Special', NULL, NULL),
	('1bc00fdf-ea72-4941-b461-48783046fed3', 'c1be311f-e30c-4e11-b173-e393f2155594', '9f124c6a-8567-410e-a6ff-ff0072a34de1', 'Salt & pepper Chicken', NULL, 240.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:27.618396+00', '2026-04-06 09:36:27.618396+00', 'false', 'Today''s Special', NULL, NULL),
	('1c572ce1-7e2a-4713-982c-36811525e072', 'c1be311f-e30c-4e11-b173-e393f2155594', '6696188e-9503-46b8-9815-458a1c1acecd', 'Fish Dynamte', NULL, 260.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:51.476443+00', '2026-04-06 09:36:51.476443+00', 'false', 'Today''s Special', NULL, NULL),
	('1e82122d-5a77-4ab9-ae27-95fe9222433c', '7524750f-332c-4d0b-aa9d-956d950e2e1c', '1f5f3a7c-9988-47bc-ad37-ae613b52387c', 'Spicy Chicken', NULL, 33.00, 'https://upload.wikimedia.org/wikipedia/commons/5/57/Chickens_in_market.jpg', 'false', 'true', 15, '2026-03-31 07:35:29.573572+00', '2026-03-31 07:35:29.573572+00', 'false', 'Today''s Special', NULL, NULL),
	('1f302c0f-b13d-4daa-b180-4dca51ccf85e', 'c1be311f-e30c-4e11-b173-e393f2155594', '756e529c-1f60-4fc9-ba25-858618c91279', 'Creamup Veg', NULL, 180.00, NULL, 'true', 'true', 15, '2026-04-06 09:36:51.476443+00', '2026-04-06 09:36:51.476443+00', 'false', 'Today''s Special', NULL, NULL),
	('20817663-3285-407d-8187-3763948c88fb', 'c1be311f-e30c-4e11-b173-e393f2155594', '9f124c6a-8567-410e-a6ff-ff0072a34de1', 'Chicken 555', NULL, 240.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:27.618396+00', '2026-04-06 09:36:27.618396+00', 'false', 'Today''s Special', NULL, NULL),
	('21bdc950-99fb-4d80-9bd3-47c989d13a62', 'c1be311f-e30c-4e11-b173-e393f2155594', '9f124c6a-8567-410e-a6ff-ff0072a34de1', 'Chicken Fry', NULL, 220.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:27.618396+00', '2026-04-06 09:36:27.618396+00', 'false', 'Today''s Special', NULL, NULL),
	('2389e1b3-3515-4d41-93b1-b7b132a64e34', 'c1be311f-e30c-4e11-b173-e393f2155594', '94670ff0-7c83-47f9-b1f3-ea7f72a51087', 'Dal Fry', NULL, 140.00, 'https://www.themealdb.com/images/media/meals/wuxrtu1483564410.jpg', 'true', 'true', 15, '2026-04-06 09:35:09.688262+00', '2026-04-06 09:35:09.688262+00', 'false', 'Today''s Special', NULL, NULL),
	('2567c70c-f6f5-4eeb-b5fe-c49d5d736918', 'c1be311f-e30c-4e11-b173-e393f2155594', '94670ff0-7c83-47f9-b1f3-ea7f72a51087', 'Plain Palak', NULL, 120.00, NULL, 'true', 'true', 15, '2026-04-06 09:35:09.688262+00', '2026-04-06 09:35:09.688262+00', 'false', 'Today''s Special', NULL, NULL),
	('2684e65c-8f30-4898-95fc-1428c9af58d3', 'c1be311f-e30c-4e11-b173-e393f2155594', '9f124c6a-8567-410e-a6ff-ff0072a34de1', 'Diced Chicken', NULL, 250.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:27.618396+00', '2026-04-06 09:36:27.618396+00', 'false', 'Today''s Special', NULL, NULL),
	('268c516e-87f2-4413-a24a-a382cdc927ad', 'c1be311f-e30c-4e11-b173-e393f2155594', '9f124c6a-8567-410e-a6ff-ff0072a34de1', 'Crispy Honey Chicken', NULL, 250.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:27.618396+00', '2026-04-06 09:36:27.618396+00', 'false', 'Today''s Special', NULL, NULL),
	('27194048-a197-4799-9eb8-f8f553380936', 'fe9adce2-5d31-4523-b788-0b624a9ce3a7', '48a4a418-813b-4f77-a064-e9d41dd25dbf', 'Bucket Spl Biryani', '(Half Chicken Starter, Half Chicken Curry, Roti 3)', 950.00, NULL, 'false', 'true', 15, '2026-04-05 12:23:19.295562+00', '2026-04-05 12:23:19.295562+00', 'false', 'Today''s Special', NULL, NULL),
	('294cb362-5166-4949-84bf-d908b8d1a2ae', 'c1be311f-e30c-4e11-b173-e393f2155594', '6354d744-d197-4480-8b65-7c721d504984', 'Butter Chicken', NULL, 220.00, 'https://upload.wikimedia.org/wikipedia/commons/4/41/Butter_Chicken_%26_Butter_Naan_-_Home_-_Chandigarh_-_India_-_0006.jpg', 'false', 'true', 15, '2026-04-06 09:37:16.213419+00', '2026-04-06 09:37:16.213419+00', 'false', 'Today''s Special', NULL, NULL),
	('2b05f7dc-76f3-45ee-ae33-95481c1ba3d1', 'fe9adce2-5d31-4523-b788-0b624a9ce3a7', '48a4a418-813b-4f77-a064-e9d41dd25dbf', 'Chicken Tanduri', '(Bucket Dum Biryani, Half Tanduri, Half Tikka)', 950.00, NULL, 'false', 'true', 15, '2026-04-05 12:23:19.295562+00', '2026-04-05 12:23:19.295562+00', 'false', 'Today''s Special', NULL, NULL),
	('2cc80724-dcdb-4664-a97e-2edcdbe6034c', 'c1be311f-e30c-4e11-b173-e393f2155594', '6dce255f-bddb-4d06-9209-2b3f059c9f2c', 'Joint Biryani', NULL, 250.00, NULL, 'false', 'true', 15, '2026-04-06 09:35:54.297735+00', '2026-04-06 09:35:54.297735+00', 'false', 'Today''s Special', NULL, NULL),
	('2cfffee3-19e8-413f-9458-69e721684f07', 'c1be311f-e30c-4e11-b173-e393f2155594', '6696188e-9503-46b8-9815-458a1c1acecd', 'Fish Mejestic', NULL, 240.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:51.476443+00', '2026-04-06 09:36:51.476443+00', 'false', 'Today''s Special', NULL, NULL),
	('2d09040a-fe14-4b46-b679-c6c432c7a68f', 'c1be311f-e30c-4e11-b173-e393f2155594', '6696188e-9503-46b8-9815-458a1c1acecd', 'Dragon Fish', NULL, 250.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:51.476443+00', '2026-04-06 09:36:51.476443+00', 'false', 'Today''s Special', NULL, NULL),
	('2e416364-8b40-49a4-aa1c-5771d5a2fde3', '7524750f-332c-4d0b-aa9d-956d950e2e1c', '0053177a-bc31-476d-b25d-72dcb56a227f', 'Iced Tea', NULL, 22.00, 'https://upload.wikimedia.org/wikipedia/commons/3/37/Y%C3%AAn_H%C3%B2a_Parkview_City_29-07-2025_Mme_Th%E1%BB%A7y_Iced_Tea_E03.jpg', 'true', 'true', 15, '2026-03-31 07:35:29.573572+00', '2026-03-31 07:35:29.573572+00', 'false', 'Today''s Special', NULL, NULL),
	('2eb35f3f-f0bc-4c56-94e4-6d5a932bed8d', 'c1be311f-e30c-4e11-b173-e393f2155594', '756e529c-1f60-4fc9-ba25-858618c91279', 'Kaju Paneer Pakoda', NULL, 240.00, NULL, 'true', 'true', 15, '2026-04-06 09:36:51.476443+00', '2026-04-06 09:36:51.476443+00', 'false', 'Today''s Special', NULL, NULL),
	('30b9a4cb-c059-460c-b1e1-7662c7411a2c', 'c1be311f-e30c-4e11-b173-e393f2155594', '6696188e-9503-46b8-9815-458a1c1acecd', 'Apollo Fish Dry', NULL, 220.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:51.476443+00', '2026-04-06 09:36:51.476443+00', 'false', 'Today''s Special', NULL, NULL),
	('32b6dc06-e5dc-45bf-a6b6-23af86030a48', '7524750f-332c-4d0b-aa9d-956d950e2e1c', '0053177a-bc31-476d-b25d-72dcb56a227f', 'Lemon Tea', NULL, 33.00, NULL, 'true', 'true', 15, '2026-03-31 07:35:29.573572+00', '2026-03-31 07:35:29.573572+00', 'false', 'Today''s Special', NULL, NULL),
	('3387b0f1-fb01-4331-9133-f5685be881bf', 'c1be311f-e30c-4e11-b173-e393f2155594', 'e7803acc-9474-41bd-ac92-7e15183a020f', 'Chicken Tanduri', '(Bucket Dum Biryani, Half Tanduri, Half Tikka)', 950.00, NULL, 'false', 'true', 15, '2026-04-06 09:35:09.688262+00', '2026-04-06 09:35:09.688262+00', 'false', 'Today''s Special', NULL, NULL),
	('34a0d6d4-c319-43ab-9ef5-2abfbe5ffcfc', 'c1be311f-e30c-4e11-b173-e393f2155594', '6354d744-d197-4480-8b65-7c721d504984', 'Punjabi Chicken', NULL, 220.00, NULL, 'false', 'true', 15, '2026-04-06 09:37:16.213419+00', '2026-04-06 09:37:16.213419+00', 'false', 'Today''s Special', NULL, NULL),
	('35233796-00b2-4a79-b629-43f1e2b3e1b1', 'c1be311f-e30c-4e11-b173-e393f2155594', '94670ff0-7c83-47f9-b1f3-ea7f72a51087', 'Kaju Butter Masala', NULL, 240.00, NULL, 'true', 'true', 15, '2026-04-06 09:35:09.688262+00', '2026-04-06 09:35:09.688262+00', 'false', 'Today''s Special', NULL, NULL),
	('3653b7a8-5238-4012-8ddb-ff5f60e85a9a', 'fe9adce2-5d31-4523-b788-0b624a9ce3a7', '48a4a418-813b-4f77-a064-e9d41dd25dbf', 'Bucket Fry Biryani', '(Half Chicken Starter, Half Chicken Curry, Roti 3)', 850.00, NULL, 'false', 'true', 15, '2026-04-05 12:23:19.295562+00', '2026-04-05 12:23:19.295562+00', 'false', 'Today''s Special', NULL, NULL),
	('3b20c36e-0a24-4f2d-9577-f371fe5d530c', 'c1be311f-e30c-4e11-b173-e393f2155594', '9f124c6a-8567-410e-a6ff-ff0072a34de1', 'Chicken Dynamite', NULL, 260.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:27.618396+00', '2026-04-06 09:36:27.618396+00', 'false', 'Today''s Special', NULL, NULL),
	('3da0f4e7-98da-48e2-b4c7-2be949a9f65b', 'c1be311f-e30c-4e11-b173-e393f2155594', '9f124c6a-8567-410e-a6ff-ff0072a34de1', 'Dragon Chicken', NULL, 250.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:27.618396+00', '2026-04-06 09:36:27.618396+00', 'false', 'Today''s Special', NULL, NULL),
	('3de5cd09-2377-47ee-877d-0a844e756c5b', 'fe9adce2-5d31-4523-b788-0b624a9ce3a7', '65db2bf6-1640-4daa-8d66-f7a2f53a11d8', 'Paneer Chatpat', NULL, 180.00, NULL, 'true', 'true', 15, '2026-04-05 12:23:19.295562+00', '2026-04-05 12:23:19.295562+00', 'false', 'Today''s Special', NULL, NULL),
	('3df59b46-77e7-49ab-bb7b-b36312f494e7', 'c1be311f-e30c-4e11-b173-e393f2155594', '6dce255f-bddb-4d06-9209-2b3f059c9f2c', 'Natu kodi Biryani', NULL, 320.00, NULL, 'false', 'true', 15, '2026-04-06 09:35:54.297735+00', '2026-04-06 09:35:54.297735+00', 'false', 'Today''s Special', NULL, NULL),
	('421b2fa7-0df1-4d57-b2e4-69b06293e715', 'c1be311f-e30c-4e11-b173-e393f2155594', '94670ff0-7c83-47f9-b1f3-ea7f72a51087', 'Aloo Masala curry', NULL, 160.00, NULL, 'true', 'true', 15, '2026-04-06 09:35:09.688262+00', '2026-04-06 09:35:09.688262+00', 'false', 'Today''s Special', NULL, NULL),
	('432ef614-aece-4f46-b16c-b641cf189ecc', 'c1be311f-e30c-4e11-b173-e393f2155594', '756e529c-1f60-4fc9-ba25-858618c91279', 'Gobi Dragon', NULL, 180.00, NULL, 'true', 'true', 15, '2026-04-06 09:36:51.476443+00', '2026-04-06 09:36:51.476443+00', 'false', 'Today''s Special', NULL, NULL),
	('449cb29f-131e-4250-acd3-8e11f0f42e66', 'c1be311f-e30c-4e11-b173-e393f2155594', 'cd082ac8-713e-4c3f-8dc4-abd02cf025e9', 'Masala Kulcha', NULL, 80.00, NULL, 'true', 'true', 15, '2026-04-06 09:37:16.213419+00', '2026-04-06 09:37:16.213419+00', 'false', 'Today''s Special', NULL, NULL),
	('457480f8-daa5-47bb-b787-114d60ddf5b2', 'c1be311f-e30c-4e11-b173-e393f2155594', '716662e9-5258-48e0-ad88-36f7e04a0917', 'Spl Tandoori Platter', 'Half Tandoori + Half Tangdi + Half Chicken + Half Malai Tikka', 700.00, NULL, 'false', 'true', 15, '2026-04-06 09:37:41.410452+00', '2026-04-06 09:37:41.410452+00', 'false', 'Today''s Special', NULL, NULL),
	('4591b362-7253-4c77-a7dd-c4d328983a0a', 'c1be311f-e30c-4e11-b173-e393f2155594', '94670ff0-7c83-47f9-b1f3-ea7f72a51087', 'Veg kadai', NULL, 160.00, NULL, 'true', 'true', 15, '2026-04-06 09:35:09.688262+00', '2026-04-06 09:35:09.688262+00', 'false', 'Today''s Special', NULL, NULL),
	('46da2d32-7d7c-4e1c-b327-bc77b698083f', 'c1be311f-e30c-4e11-b173-e393f2155594', '6dce255f-bddb-4d06-9209-2b3f059c9f2c', 'Prawns Fry Biryani', NULL, 350.00, NULL, 'false', 'true', 15, '2026-04-06 09:35:54.297735+00', '2026-04-06 09:35:54.297735+00', 'false', 'Today''s Special', NULL, NULL),
	('473affe3-5150-4281-9af6-2e78272d9399', 'c1be311f-e30c-4e11-b173-e393f2155594', '756e529c-1f60-4fc9-ba25-858618c91279', 'Mushroom Chilli', NULL, 180.00, NULL, 'true', 'true', 15, '2026-04-06 09:36:51.476443+00', '2026-04-06 09:36:51.476443+00', 'false', 'Today''s Special', NULL, NULL),
	('478cc5cd-6491-4e2d-9c55-2160ba9fafbf', 'fe9adce2-5d31-4523-b788-0b624a9ce3a7', '65db2bf6-1640-4daa-8d66-f7a2f53a11d8', 'Aloo Masala curry', NULL, 160.00, NULL, 'true', 'true', 15, '2026-04-05 12:23:19.295562+00', '2026-04-05 12:23:19.295562+00', 'false', 'Today''s Special', NULL, NULL),
	('4961e370-329b-4a0f-942a-9f5118ec0645', 'c1be311f-e30c-4e11-b173-e393f2155594', '94670ff0-7c83-47f9-b1f3-ea7f72a51087', 'Palak Paneer', NULL, 180.00, 'https://upload.wikimedia.org/wikipedia/commons/b/b7/Palakpaneer_Rayagada_Odisha_0009.jpg', 'true', 'true', 15, '2026-04-06 09:35:09.688262+00', '2026-04-06 09:35:09.688262+00', 'false', 'Today''s Special', NULL, NULL),
	('49d21038-371e-4681-9ef4-09a55a17f00f', 'c1be311f-e30c-4e11-b173-e393f2155594', '9f124c6a-8567-410e-a6ff-ff0072a34de1', 'Natukodi Roast', NULL, 360.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:27.618396+00', '2026-04-06 09:36:27.618396+00', 'false', 'Today''s Special', NULL, NULL),
	('4ac18ba4-b1fd-41e5-8132-941305befcd1', 'd776e4e4-4e69-4d69-b796-9c8018fc898d', '446f8f18-37f3-4f39-b507-326c49b59a4f', 'test', NULL, 123.00, '/uploads/1774817546220-270070168.jpeg', 'true', 'true', 15, '2026-03-29 20:52:11.328454+00', '2026-03-29 21:26:43.274337+00', 'true', 'Today''s Special', NULL, NULL),
	('4ac8920f-d5e6-4fad-93c4-6b626e372154', 'c1be311f-e30c-4e11-b173-e393f2155594', '716662e9-5258-48e0-ad88-36f7e04a0917', 'Tandoori Half', NULL, 250.00, NULL, 'false', 'true', 15, '2026-04-06 09:37:41.410452+00', '2026-04-06 09:37:41.410452+00', 'false', 'Today''s Special', NULL, NULL),
	('4df32017-2259-4889-b46e-6a0ee01d1acc', 'c1be311f-e30c-4e11-b173-e393f2155594', '6354d744-d197-4480-8b65-7c721d504984', 'Gongura Chicken', NULL, 240.00, NULL, 'false', 'true', 15, '2026-04-06 09:37:16.213419+00', '2026-04-06 09:37:16.213419+00', 'false', 'Today''s Special', NULL, NULL),
	('4eff91f5-7f0b-48b1-9881-b8f15dd9cb0d', 'c1be311f-e30c-4e11-b173-e393f2155594', '6eaea60c-46a8-4a45-a921-d0ac542468f8', 'Kaju Paneer Biryani', NULL, 220.00, NULL, 'true', 'true', 15, '2026-04-06 09:35:54.297735+00', '2026-04-06 09:35:54.297735+00', 'false', 'Today''s Special', NULL, NULL),
	('528c6e9f-a5c1-4250-9539-e1873c97b0ac', 'c1be311f-e30c-4e11-b173-e393f2155594', '9f124c6a-8567-410e-a6ff-ff0072a34de1', 'Mutton Roast', NULL, 400.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:27.618396+00', '2026-04-06 09:36:27.618396+00', 'false', 'Today''s Special', NULL, NULL),
	('5356160d-5a74-4278-b889-07bff22a422e', 'c1be311f-e30c-4e11-b173-e393f2155594', '6696188e-9503-46b8-9815-458a1c1acecd', 'Chilli Prawns', NULL, 350.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:51.476443+00', '2026-04-06 09:36:51.476443+00', 'false', 'Today''s Special', NULL, NULL),
	('53dda885-e0d0-4e0b-b4ae-0f6dcbe85a66', 'c1be311f-e30c-4e11-b173-e393f2155594', '6696188e-9503-46b8-9815-458a1c1acecd', 'Chili Fish', NULL, 240.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:51.476443+00', '2026-04-06 09:36:51.476443+00', 'false', 'Today''s Special', NULL, NULL),
	('54c966ae-c144-45d6-9d9f-07c403084e11', 'fe9adce2-5d31-4523-b788-0b624a9ce3a7', '65db2bf6-1640-4daa-8d66-f7a2f53a11d8', 'Plain Palak', NULL, 120.00, NULL, 'true', 'true', 15, '2026-04-05 12:23:19.295562+00', '2026-04-05 12:23:19.295562+00', 'false', 'Today''s Special', NULL, NULL),
	('552b0221-5efe-443f-b60c-9cd5871fce36', 'c1be311f-e30c-4e11-b173-e393f2155594', '6eaea60c-46a8-4a45-a921-d0ac542468f8', 'Paneer Biryani', NULL, 180.00, NULL, 'true', 'true', 15, '2026-04-06 09:35:54.297735+00', '2026-04-06 09:35:54.297735+00', 'false', 'Today''s Special', NULL, NULL),
	('571e33da-8429-4aee-9747-fb64e690e97a', 'fe9adce2-5d31-4523-b788-0b624a9ce3a7', '65db2bf6-1640-4daa-8d66-f7a2f53a11d8', 'Dal Fry', NULL, 140.00, 'https://www.themealdb.com/images/media/meals/wuxrtu1483564410.jpg', 'true', 'true', 15, '2026-04-05 12:23:19.295562+00', '2026-04-05 12:23:19.295562+00', 'false', 'Today''s Special', NULL, NULL),
	('58b48d53-8c3d-4ff1-b439-8c218f858085', 'c1be311f-e30c-4e11-b173-e393f2155594', '6dce255f-bddb-4d06-9209-2b3f059c9f2c', 'Egg Biryani', NULL, 150.00, 'https://upload.wikimedia.org/wikipedia/commons/5/5a/%22Hyderabadi_Dum_Biryani%22.jpg', 'false', 'true', 15, '2026-04-06 09:35:54.297735+00', '2026-04-06 09:35:54.297735+00', 'false', 'Today''s Special', NULL, NULL),
	('5918380b-888f-4356-bd92-baa1b946f73e', 'c1be311f-e30c-4e11-b173-e393f2155594', '716662e9-5258-48e0-ad88-36f7e04a0917', 'Chicken Tikka', NULL, 280.00, 'https://upload.wikimedia.org/wikipedia/commons/b/bd/Tandoorimumbai.jpg', 'false', 'true', 15, '2026-04-06 09:37:41.410452+00', '2026-04-06 09:37:41.410452+00', 'false', 'Today''s Special', NULL, NULL),
	('59e15fa9-c45e-49ae-8d7c-372be6c7f8a9', 'c1be311f-e30c-4e11-b173-e393f2155594', '6696188e-9503-46b8-9815-458a1c1acecd', 'Alpha Fish', NULL, 250.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:51.476443+00', '2026-04-06 09:36:51.476443+00', 'false', 'Today''s Special', NULL, NULL),
	('5c1e7775-79c7-47ed-b3eb-8c34afcdbdd8', 'c1be311f-e30c-4e11-b173-e393f2155594', '9f124c6a-8567-410e-a6ff-ff0072a34de1', 'Cream up Chicken', NULL, 260.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:27.618396+00', '2026-04-06 09:36:27.618396+00', 'false', 'Today''s Special', NULL, NULL),
	('5c3a8ab3-7aee-4140-aeef-3ce2c78d9b47', 'c1be311f-e30c-4e11-b173-e393f2155594', '6eaea60c-46a8-4a45-a921-d0ac542468f8', 'Kaju Biryani', NULL, 240.00, NULL, 'true', 'true', 15, '2026-04-06 09:35:54.297735+00', '2026-04-06 09:35:54.297735+00', 'false', 'Today''s Special', NULL, NULL),
	('5e41a622-8850-4d84-8e70-4792b6997e29', 'c1be311f-e30c-4e11-b173-e393f2155594', '6354d744-d197-4480-8b65-7c721d504984', 'Natukodi Curry', NULL, 320.00, NULL, 'false', 'true', 15, '2026-04-06 09:37:16.213419+00', '2026-04-06 09:37:16.213419+00', 'false', 'Today''s Special', NULL, NULL),
	('5ef2341c-928f-40f8-b05d-b2c5d332c23d', 'c1be311f-e30c-4e11-b173-e393f2155594', 'e7803acc-9474-41bd-ac92-7e15183a020f', 'Mutton Biryani', '(Mutton Fry Biryani, Mutton Curry Half, Roti 3)', 1280.00, 'https://upload.wikimedia.org/wikipedia/commons/5/5a/%22Hyderabadi_Dum_Biryani%22.jpg', 'false', 'true', 15, '2026-04-06 09:35:09.688262+00', '2026-04-06 09:35:09.688262+00', 'false', 'Today''s Special', NULL, NULL),
	('6174ead7-390d-4cbf-982d-121be7928542', 'c1be311f-e30c-4e11-b173-e393f2155594', '6354d744-d197-4480-8b65-7c721d504984', 'Chicken Chatpat', NULL, 220.00, NULL, 'false', 'true', 15, '2026-04-06 09:37:16.213419+00', '2026-04-06 09:37:16.213419+00', 'false', 'Today''s Special', NULL, NULL),
	('623ad6bb-0a79-4abd-8e91-c31dc4f44108', 'c1be311f-e30c-4e11-b173-e393f2155594', '94670ff0-7c83-47f9-b1f3-ea7f72a51087', 'Mushroom Curry', NULL, 180.00, 'https://upload.wikimedia.org/wikipedia/commons/6/65/Sparrige_Sch%C3%BCppling_%28Pholiota_squarrosa%29.jpg', 'true', 'true', 15, '2026-04-06 09:35:09.688262+00', '2026-04-06 09:35:09.688262+00', 'false', 'Today''s Special', NULL, NULL),
	('627adc0b-3199-4a87-b1f0-15464163ee1b', 'c1be311f-e30c-4e11-b173-e393f2155594', '6696188e-9503-46b8-9815-458a1c1acecd', 'Cream up Fish', NULL, 240.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:51.476443+00', '2026-04-06 09:36:51.476443+00', 'false', 'Today''s Special', NULL, NULL),
	('6315c1c2-3996-4f97-8ffd-8de22ee57b44', 'c1be311f-e30c-4e11-b173-e393f2155594', '852dc3f7-6559-4a1c-ae0b-bf4a496c1250', 'Paneer Fried Rice', NULL, 150.00, NULL, 'true', 'true', 15, '2026-04-06 09:37:41.410452+00', '2026-04-06 09:37:41.410452+00', 'false', 'Today''s Special', NULL, NULL),
	('63bc7849-eba8-4b59-9f90-3654c14bf57d', 'c1be311f-e30c-4e11-b173-e393f2155594', '6696188e-9503-46b8-9815-458a1c1acecd', 'Apollo Fish Sauce', NULL, 240.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:51.476443+00', '2026-04-06 09:36:51.476443+00', 'false', 'Today''s Special', NULL, NULL),
	('641b6d8e-b56b-4cf9-8de4-4134744eed38', 'fe9adce2-5d31-4523-b788-0b624a9ce3a7', '65db2bf6-1640-4daa-8d66-f7a2f53a11d8', 'Methi Chaman', NULL, 200.00, NULL, 'true', 'true', 15, '2026-04-05 12:23:19.295562+00', '2026-04-05 12:23:19.295562+00', 'false', 'Today''s Special', NULL, NULL),
	('6817dd6f-4766-4413-bd8f-b88eb0820c9b', 'c1be311f-e30c-4e11-b173-e393f2155594', '9f124c6a-8567-410e-a6ff-ff0072a34de1', 'Crispy Chicken Majestic', NULL, 300.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:27.618396+00', '2026-04-06 09:36:27.618396+00', 'false', 'Today''s Special', NULL, NULL),
	('692030fb-6c9a-4695-96b0-d127263ff830', 'c1be311f-e30c-4e11-b173-e393f2155594', 'cd082ac8-713e-4c3f-8dc4-abd02cf025e9', 'Garlic Naan', NULL, 80.00, NULL, 'true', 'true', 15, '2026-04-06 09:37:16.213419+00', '2026-04-06 09:37:16.213419+00', 'false', 'Today''s Special', NULL, NULL),
	('6a046434-445b-49f0-81d0-64fbf9e52544', 'fe9adce2-5d31-4523-b788-0b624a9ce3a7', '65db2bf6-1640-4daa-8d66-f7a2f53a11d8', 'Paneer Butter Masala', NULL, 180.00, 'https://upload.wikimedia.org/wikipedia/commons/a/ad/Shahi_panner.jpg', 'true', 'true', 15, '2026-04-05 12:23:19.295562+00', '2026-04-05 12:23:19.295562+00', 'false', 'Today''s Special', NULL, NULL),
	('6abeaba5-7fe3-4ba1-a5b5-e5df5a2b3230', 'c1be311f-e30c-4e11-b173-e393f2155594', '716662e9-5258-48e0-ad88-36f7e04a0917', 'Malai Tikka', NULL, 280.00, NULL, 'false', 'true', 15, '2026-04-06 09:37:41.410452+00', '2026-04-06 09:37:41.410452+00', 'false', 'Today''s Special', NULL, NULL),
	('6b7c5f9e-a5cc-4ff5-94d3-bfa7f6fcc2c6', 'c1be311f-e30c-4e11-b173-e393f2155594', '94670ff0-7c83-47f9-b1f3-ea7f72a51087', 'Kaju Curry', NULL, 240.00, NULL, 'true', 'true', 15, '2026-04-06 09:35:09.688262+00', '2026-04-06 09:35:09.688262+00', 'false', 'Today''s Special', NULL, NULL),
	('6b80a38f-90d7-4d9f-8aff-11076e612a2f', 'c1be311f-e30c-4e11-b173-e393f2155594', '94670ff0-7c83-47f9-b1f3-ea7f72a51087', 'Tomato Kaju Curry', NULL, 160.00, NULL, 'true', 'true', 15, '2026-04-06 09:35:09.688262+00', '2026-04-06 09:35:09.688262+00', 'false', 'Today''s Special', NULL, NULL),
	('6b993c79-2458-400d-a5c7-05d49b0ac5f0', 'c1be311f-e30c-4e11-b173-e393f2155594', '6354d744-d197-4480-8b65-7c721d504984', 'Chicken Curry', NULL, 180.00, 'https://www.themealdb.com/images/media/meals/vwrpps1503068729.jpg', 'false', 'true', 15, '2026-04-06 09:37:16.213419+00', '2026-04-06 09:37:16.213419+00', 'false', 'Today''s Special', NULL, NULL),
	('6c111a19-f6ed-4063-82d2-371b1b9d9870', 'c1be311f-e30c-4e11-b173-e393f2155594', '2d87933c-66ff-4337-9872-f415c05dda0b', 'Egg Rayalasemma', NULL, 150.00, NULL, 'false', 'true', 15, '2026-04-06 09:37:41.410452+00', '2026-04-06 09:37:41.410452+00', 'false', 'Today''s Special', NULL, NULL),
	('6f522425-d06d-43f3-8f2a-c8052c1898c0', 'c1be311f-e30c-4e11-b173-e393f2155594', 'e7803acc-9474-41bd-ac92-7e15183a020f', 'Bucket Roast Biryani', '(Half Chicken Starter, Half Chicken Curry, Roti 3)', 850.00, NULL, 'false', 'true', 15, '2026-04-06 09:35:09.688262+00', '2026-04-06 09:35:09.688262+00', 'false', 'Today''s Special', NULL, NULL),
	('70f27ae1-b17b-4110-bf92-57ab79e97f50', 'fe9adce2-5d31-4523-b788-0b624a9ce3a7', '65db2bf6-1640-4daa-8d66-f7a2f53a11d8', 'Veg kadai', NULL, 160.00, NULL, 'true', 'true', 15, '2026-04-05 12:23:19.295562+00', '2026-04-05 12:23:19.295562+00', 'false', 'Today''s Special', NULL, NULL),
	('72443a5b-a56d-4e95-a486-64931b338cb9', 'c1be311f-e30c-4e11-b173-e393f2155594', '6354d744-d197-4480-8b65-7c721d504984', 'Kadai Chicken', NULL, 240.00, NULL, 'false', 'true', 15, '2026-04-06 09:37:16.213419+00', '2026-04-06 09:37:16.213419+00', 'false', 'Today''s Special', NULL, NULL),
	('73544bdb-d79e-4fd2-9413-2ce22182a310', 'c1be311f-e30c-4e11-b173-e393f2155594', '2d87933c-66ff-4337-9872-f415c05dda0b', 'Egg 65', NULL, 150.00, NULL, 'false', 'true', 15, '2026-04-06 09:37:41.410452+00', '2026-04-06 09:37:41.410452+00', 'false', 'Today''s Special', NULL, NULL),
	('736fe921-8902-47ba-972f-0cc9ab751c54', 'c1be311f-e30c-4e11-b173-e393f2155594', 'cd082ac8-713e-4c3f-8dc4-abd02cf025e9', 'Tandoori Roti', NULL, 20.00, NULL, 'true', 'true', 15, '2026-04-06 09:37:16.213419+00', '2026-04-06 09:37:16.213419+00', 'false', 'Today''s Special', NULL, NULL),
	('742b0d92-fed6-474f-9576-3e2bdf581a9a', 'c1be311f-e30c-4e11-b173-e393f2155594', '2d87933c-66ff-4337-9872-f415c05dda0b', 'Boiled Egg (4)', NULL, 80.00, NULL, 'false', 'true', 15, '2026-04-06 09:37:41.410452+00', '2026-04-06 09:37:41.410452+00', 'false', 'Today''s Special', NULL, NULL),
	('74e9d4b0-b76f-467f-8403-414a16b0e5d1', 'c1be311f-e30c-4e11-b173-e393f2155594', 'e7803acc-9474-41bd-ac92-7e15183a020f', 'Veg Biryani', '(Gobi Manchuria Half, Mushroom Curry Half, Roti 3)', 700.00, NULL, 'true', 'true', 15, '2026-04-06 09:35:09.688262+00', '2026-04-06 09:35:09.688262+00', 'false', 'Today''s Special', NULL, NULL),
	('769dbac0-9bdf-4507-854c-304544101bca', 'c1be311f-e30c-4e11-b173-e393f2155594', '9f124c6a-8567-410e-a6ff-ff0072a34de1', 'SR SP Chicken', NULL, 250.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:27.618396+00', '2026-04-06 09:36:27.618396+00', 'false', 'Today''s Special', NULL, NULL),
	('76ff40de-3b5f-4bc3-b70f-0841cb191fc6', 'c1be311f-e30c-4e11-b173-e393f2155594', '756e529c-1f60-4fc9-ba25-858618c91279', 'Gobi (Chili, Manchura)', NULL, 140.00, NULL, 'true', 'true', 15, '2026-04-06 09:36:51.476443+00', '2026-04-06 09:36:51.476443+00', 'false', 'Today''s Special', NULL, NULL),
	('7736be28-7ae6-4177-834c-a7fe0dfedab3', 'fe9adce2-5d31-4523-b788-0b624a9ce3a7', '48a4a418-813b-4f77-a064-e9d41dd25dbf', 'Veg Biryani', '(Gobi Manchuria Half, Mushroom Curry Half, Roti 3)', 700.00, NULL, 'true', 'true', 15, '2026-04-05 12:23:19.295562+00', '2026-04-05 12:23:19.295562+00', 'false', 'Today''s Special', NULL, NULL),
	('781c0128-2de7-417d-bb3f-1049e2c9f694', 'c1be311f-e30c-4e11-b173-e393f2155594', '6dce255f-bddb-4d06-9209-2b3f059c9f2c', 'Fish Biryani', NULL, 280.00, NULL, 'false', 'true', 15, '2026-04-06 09:35:54.297735+00', '2026-04-06 09:35:54.297735+00', 'false', 'Today''s Special', NULL, NULL),
	('78e83734-1e21-46bc-bb97-55387771d8ba', 'c1be311f-e30c-4e11-b173-e393f2155594', '756e529c-1f60-4fc9-ba25-858618c91279', 'Cream Gobi', NULL, 160.00, NULL, 'true', 'true', 15, '2026-04-06 09:36:51.476443+00', '2026-04-06 09:36:51.476443+00', 'false', 'Today''s Special', NULL, NULL),
	('78f1d183-610e-4655-88b0-21bfc3f3f898', 'c1be311f-e30c-4e11-b173-e393f2155594', 'cd082ac8-713e-4c3f-8dc4-abd02cf025e9', 'Plain Naan', NULL, 35.00, NULL, 'true', 'true', 15, '2026-04-06 09:37:16.213419+00', '2026-04-06 09:37:16.213419+00', 'false', 'Today''s Special', NULL, NULL),
	('79c4173a-60ad-451d-a2a4-9996a10eb23d', 'fe9adce2-5d31-4523-b788-0b624a9ce3a7', '65db2bf6-1640-4daa-8d66-f7a2f53a11d8', 'Tomato Kaju Curry', NULL, 220.00, NULL, 'true', 'true', 15, '2026-04-05 12:23:19.295562+00', '2026-04-05 12:23:19.295562+00', 'false', 'Today''s Special', NULL, NULL),
	('7cf7ad71-c064-4141-bb0f-e47331155994', 'c1be311f-e30c-4e11-b173-e393f2155594', '6dce255f-bddb-4d06-9209-2b3f059c9f2c', 'Lollypop Biryani', NULL, 240.00, NULL, 'false', 'true', 15, '2026-04-06 09:35:54.297735+00', '2026-04-06 09:35:54.297735+00', 'false', 'Today''s Special', NULL, NULL),
	('7e0b0395-6193-49e4-b55b-e142493025c7', 'c1be311f-e30c-4e11-b173-e393f2155594', '6dce255f-bddb-4d06-9209-2b3f059c9f2c', 'Chicken Fry Biryani', NULL, 220.00, NULL, 'false', 'true', 15, '2026-04-06 09:35:54.297735+00', '2026-04-06 09:35:54.297735+00', 'false', 'Today''s Special', NULL, NULL),
	('805fec37-bb53-4953-96cf-c45c023456f8', 'c1be311f-e30c-4e11-b173-e393f2155594', '94670ff0-7c83-47f9-b1f3-ea7f72a51087', 'Kadai Paneer', NULL, 180.00, 'https://upload.wikimedia.org/wikipedia/commons/7/7d/Kadai_Paneer-Delhi-12.jpg', 'true', 'true', 15, '2026-04-06 09:35:09.688262+00', '2026-04-06 09:35:09.688262+00', 'false', 'Today''s Special', NULL, NULL),
	('8158ac4f-20e9-4309-a5b6-0f865b6dec45', 'c1be311f-e30c-4e11-b173-e393f2155594', '2d87933c-66ff-4337-9872-f415c05dda0b', 'Egg Burji', NULL, 130.00, NULL, 'false', 'true', 15, '2026-04-06 09:37:41.410452+00', '2026-04-06 09:37:41.410452+00', 'false', 'Today''s Special', NULL, NULL),
	('822802e6-5daa-4587-9552-79eb0db68833', 'c1be311f-e30c-4e11-b173-e393f2155594', '756e529c-1f60-4fc9-ba25-858618c91279', 'Crispy Panner', NULL, 180.00, NULL, 'true', 'true', 15, '2026-04-06 09:36:51.476443+00', '2026-04-06 09:36:51.476443+00', 'false', 'Today''s Special', NULL, NULL),
	('8292ca29-709d-4a8b-9bc3-68cbd8ba1365', 'c1be311f-e30c-4e11-b173-e393f2155594', '6354d744-d197-4480-8b65-7c721d504984', 'Achari chicken', NULL, 220.00, NULL, 'false', 'true', 15, '2026-04-06 09:37:16.213419+00', '2026-04-06 09:37:16.213419+00', 'false', 'Today''s Special', NULL, NULL),
	('830cba72-38e7-4a33-a2db-502fc4474db2', '7524750f-332c-4d0b-aa9d-956d950e2e1c', '010fafcf-6cb6-4363-89d9-95202d0e228d', 'French Fries', NULL, 15.00, 'https://upload.wikimedia.org/wikipedia/commons/8/83/French_Fries.JPG', 'true', 'true', 15, '2026-03-31 07:35:29.573572+00', '2026-03-31 07:35:29.573572+00', 'false', 'Today''s Special', NULL, NULL),
	('83d02a1a-5bea-433c-b9e9-a283eedf76fc', 'c1be311f-e30c-4e11-b173-e393f2155594', '6696188e-9503-46b8-9815-458a1c1acecd', 'Loose Prawns', NULL, 350.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:51.476443+00', '2026-04-06 09:36:51.476443+00', 'false', 'Today''s Special', NULL, NULL),
	('852bad70-50c1-4227-b50c-27971b005a68', 'c1be311f-e30c-4e11-b173-e393f2155594', '9f124c6a-8567-410e-a6ff-ff0072a34de1', 'Alpha Chicken', NULL, 260.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:27.618396+00', '2026-04-06 09:36:27.618396+00', 'false', 'Today''s Special', NULL, NULL),
	('853bbc98-8ffb-42e3-a3ff-9dd80ff2b4a4', 'c1be311f-e30c-4e11-b173-e393f2155594', '94670ff0-7c83-47f9-b1f3-ea7f72a51087', 'Kaju Paneer', NULL, 220.00, NULL, 'true', 'true', 15, '2026-04-06 09:35:09.688262+00', '2026-04-06 09:35:09.688262+00', 'false', 'Today''s Special', NULL, NULL),
	('8624341c-f489-4b66-b86d-6e77cf32bf9d', 'c1be311f-e30c-4e11-b173-e393f2155594', '6dce255f-bddb-4d06-9209-2b3f059c9f2c', 'Roast Family Pack Biryani', NULL, 700.00, NULL, 'false', 'true', 15, '2026-04-06 09:35:54.297735+00', '2026-04-06 09:35:54.297735+00', 'false', 'Today''s Special', NULL, NULL),
	('86759532-aeee-49b7-9700-d4e51e495ecc', 'c1be311f-e30c-4e11-b173-e393f2155594', '9f124c6a-8567-410e-a6ff-ff0072a34de1', 'R.R. Chicken', NULL, 220.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:27.618396+00', '2026-04-06 09:36:27.618396+00', 'false', 'Today''s Special', NULL, NULL),
	('87cd49d2-98e4-4416-a71e-76357eef53ef', 'c1be311f-e30c-4e11-b173-e393f2155594', '9f124c6a-8567-410e-a6ff-ff0072a34de1', 'Lemon Cream up Chicken', NULL, 260.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:27.618396+00', '2026-04-06 09:36:27.618396+00', 'false', 'Today''s Special', NULL, NULL),
	('8cf4dd65-3ac5-4b00-b557-ef323df55e95', 'c1be311f-e30c-4e11-b173-e393f2155594', '756e529c-1f60-4fc9-ba25-858618c91279', 'Honey Chilli Potato', NULL, 180.00, NULL, 'true', 'true', 15, '2026-04-06 09:36:51.476443+00', '2026-04-06 09:36:51.476443+00', 'false', 'Today''s Special', NULL, NULL),
	('8d0b81fc-1b7f-4ebc-a0bc-dd73123ca08b', 'c1be311f-e30c-4e11-b173-e393f2155594', '94670ff0-7c83-47f9-b1f3-ea7f72a51087', 'Methi Chaman', NULL, 200.00, NULL, 'true', 'true', 15, '2026-04-06 09:35:09.688262+00', '2026-04-06 09:35:09.688262+00', 'false', 'Today''s Special', NULL, NULL),
	('8e954429-46f9-43d5-a312-0bdcd3180fc5', 'c1be311f-e30c-4e11-b173-e393f2155594', 'e7803acc-9474-41bd-ac92-7e15183a020f', 'Bucket Spl Biryani', '(Half Chicken Starter, Half Chicken Curry, Roti 3)', 950.00, NULL, 'false', 'true', 15, '2026-04-06 09:35:09.688262+00', '2026-04-06 09:35:09.688262+00', 'false', 'Today''s Special', NULL, NULL),
	('91bdd00b-1855-4bdc-b1f8-6150a1a0bab3', 'c1be311f-e30c-4e11-b173-e393f2155594', '9f124c6a-8567-410e-a6ff-ff0072a34de1', 'Kaju Chicken', NULL, 250.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:27.618396+00', '2026-04-06 09:36:27.618396+00', 'false', 'Today''s Special', NULL, NULL),
	('9288e477-8b0f-4a10-9f7c-0902512f9399', 'c1be311f-e30c-4e11-b173-e393f2155594', '94670ff0-7c83-47f9-b1f3-ea7f72a51087', 'Mix Veg Curry', NULL, 140.00, NULL, 'true', 'true', 15, '2026-04-06 09:35:09.688262+00', '2026-04-06 09:35:09.688262+00', 'false', 'Today''s Special', NULL, NULL),
	('957d88fe-b493-4521-8943-0247b1ac49fc', 'c1be311f-e30c-4e11-b173-e393f2155594', '6696188e-9503-46b8-9815-458a1c1acecd', 'Dragon Prawns', NULL, 360.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:51.476443+00', '2026-04-06 09:36:51.476443+00', 'false', 'Today''s Special', NULL, NULL),
	('95c20412-8356-469f-853a-ea6d141b9171', 'c1be311f-e30c-4e11-b173-e393f2155594', '9f124c6a-8567-410e-a6ff-ff0072a34de1', 'Corriandar Chicken', NULL, 250.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:27.618396+00', '2026-04-06 09:36:27.618396+00', 'false', 'Today''s Special', NULL, NULL),
	('96201bce-9aeb-4de4-8023-847da5037d4e', 'fe9adce2-5d31-4523-b788-0b624a9ce3a7', '65db2bf6-1640-4daa-8d66-f7a2f53a11d8', 'Tomato Curry', NULL, 120.00, NULL, 'true', 'true', 15, '2026-04-05 12:23:19.295562+00', '2026-04-05 12:23:19.295562+00', 'false', 'Today''s Special', NULL, NULL),
	('96ac29d1-9e61-494e-b8e4-b10042a2945e', 'c1be311f-e30c-4e11-b173-e393f2155594', '94670ff0-7c83-47f9-b1f3-ea7f72a51087', 'Mini Veg Curry', NULL, 150.00, NULL, 'true', 'true', 15, '2026-04-06 09:35:09.688262+00', '2026-04-06 09:35:09.688262+00', 'false', 'Today''s Special', NULL, NULL),
	('9779c373-d84c-4eeb-9443-9bbe590e21c1', 'c1be311f-e30c-4e11-b173-e393f2155594', 'cd082ac8-713e-4c3f-8dc4-abd02cf025e9', 'Aloo Paratha', NULL, 80.00, NULL, 'true', 'true', 15, '2026-04-06 09:37:16.213419+00', '2026-04-06 09:37:16.213419+00', 'false', 'Today''s Special', NULL, NULL),
	('97c873a2-ed22-418d-a369-be14cae172b3', 'c1be311f-e30c-4e11-b173-e393f2155594', '756e529c-1f60-4fc9-ba25-858618c91279', 'Paneer Tikka', NULL, 300.00, 'https://upload.wikimedia.org/wikipedia/commons/f/f2/Paneer_tikka.jpg', 'true', 'true', 15, '2026-04-06 09:36:51.476443+00', '2026-04-06 09:36:51.476443+00', 'false', 'Today''s Special', NULL, NULL),
	('98830ba6-ce79-4daf-a414-5ec1228c9b9f', 'fe9adce2-5d31-4523-b788-0b624a9ce3a7', '48a4a418-813b-4f77-a064-e9d41dd25dbf', 'Bucket Roast Biryani', '(Half Chicken Starter, Half Chicken Curry, Roti 3)', 850.00, NULL, 'false', 'true', 15, '2026-04-05 12:23:19.295562+00', '2026-04-05 12:23:19.295562+00', 'false', 'Today''s Special', NULL, NULL),
	('98f19f1d-31d7-4a0d-8b79-c77db939cf7a', 'c1be311f-e30c-4e11-b173-e393f2155594', 'cd082ac8-713e-4c3f-8dc4-abd02cf025e9', 'Lacha Paratha', NULL, 60.00, NULL, 'true', 'true', 15, '2026-04-06 09:37:16.213419+00', '2026-04-06 09:37:16.213419+00', 'false', 'Today''s Special', NULL, NULL),
	('99d24dd1-940b-41a4-a6e4-92aefd56fb32', 'c1be311f-e30c-4e11-b173-e393f2155594', '9f124c6a-8567-410e-a6ff-ff0072a34de1', 'Guntur Chicken', NULL, 300.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:27.618396+00', '2026-04-06 09:36:27.618396+00', 'false', 'Today''s Special', NULL, NULL),
	('99e66e30-b5a4-4d98-b476-e97178ed4de9', 'c1be311f-e30c-4e11-b173-e393f2155594', '6dce255f-bddb-4d06-9209-2b3f059c9f2c', 'Moghulai Biryani', NULL, 240.00, NULL, 'false', 'true', 15, '2026-04-06 09:35:54.297735+00', '2026-04-06 09:35:54.297735+00', 'false', 'Today''s Special', NULL, NULL),
	('9aacec76-e4bf-49af-9f67-8daf39ca95f7', '7524750f-332c-4d0b-aa9d-956d950e2e1c', '0053177a-bc31-476d-b25d-72dcb56a227f', 'Milk Shake', NULL, 34.00, 'https://upload.wikimedia.org/wikipedia/commons/6/68/Strawberry_milk_shake_%28cropped%29.jpg', 'true', 'true', 15, '2026-03-31 07:35:29.573572+00', '2026-03-31 07:35:29.573572+00', 'false', 'Today''s Special', NULL, NULL),
	('9b6a1e68-e92f-4437-aaf2-cb4ac77bea2f', 'c1be311f-e30c-4e11-b173-e393f2155594', '9f124c6a-8567-410e-a6ff-ff0072a34de1', 'Pepper Chilli Chicken', NULL, 240.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:27.618396+00', '2026-04-06 09:36:27.618396+00', 'false', 'Today''s Special', NULL, NULL),
	('9cdc5100-86f4-47a0-9d97-ad337dc4911f', 'c1be311f-e30c-4e11-b173-e393f2155594', '94670ff0-7c83-47f9-b1f3-ea7f72a51087', 'Dal Thadka', NULL, 140.00, NULL, 'true', 'true', 15, '2026-04-06 09:35:09.688262+00', '2026-04-06 09:35:09.688262+00', 'false', 'Today''s Special', NULL, NULL),
	('a0a2de8e-2172-4338-b8eb-752c2337cf8c', 'c1be311f-e30c-4e11-b173-e393f2155594', '9f124c6a-8567-410e-a6ff-ff0072a34de1', 'Allahuddian Chicken', NULL, 260.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:27.618396+00', '2026-04-06 09:36:27.618396+00', 'false', 'Today''s Special', NULL, NULL),
	('a0eb9e9c-72f6-4664-8f03-318ca0506d76', 'c1be311f-e30c-4e11-b173-e393f2155594', '9f124c6a-8567-410e-a6ff-ff0072a34de1', 'Mutton Fry', NULL, 360.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:27.618396+00', '2026-04-06 09:36:27.618396+00', 'false', 'Today''s Special', NULL, NULL),
	('a16ee65a-3b31-44bf-8901-e27de056c32b', '7524750f-332c-4d0b-aa9d-956d950e2e1c', '010fafcf-6cb6-4363-89d9-95202d0e228d', 'Nuggets', NULL, 14.00, NULL, 'false', 'true', 15, '2026-03-31 07:35:29.573572+00', '2026-03-31 07:35:29.573572+00', 'false', 'Today''s Special', NULL, NULL),
	('a2b28773-e3f1-4e27-a74a-5923c4e02faa', 'c1be311f-e30c-4e11-b173-e393f2155594', '2d87933c-66ff-4337-9872-f415c05dda0b', 'Egg Biryani', NULL, 150.00, 'https://upload.wikimedia.org/wikipedia/commons/5/5a/%22Hyderabadi_Dum_Biryani%22.jpg', 'false', 'true', 15, '2026-04-06 09:37:41.410452+00', '2026-04-06 09:37:41.410452+00', 'false', 'Today''s Special', NULL, NULL),
	('a4b1bdaa-08f6-4a25-8cb4-1f083b9282ff', 'c1be311f-e30c-4e11-b173-e393f2155594', '6dce255f-bddb-4d06-9209-2b3f059c9f2c', 'Dum Family Pack', NULL, 600.00, NULL, 'false', 'true', 15, '2026-04-06 09:35:54.297735+00', '2026-04-06 09:35:54.297735+00', 'false', 'Today''s Special', NULL, NULL),
	('a61645bc-0d64-47d8-b917-4cca26f85917', 'c1be311f-e30c-4e11-b173-e393f2155594', '9f124c6a-8567-410e-a6ff-ff0072a34de1', 'Chicken Mejestick', NULL, 250.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:27.618396+00', '2026-04-06 09:36:27.618396+00', 'false', 'Today''s Special', NULL, NULL),
	('a67c9592-c205-48fc-9a94-694ea96e11d1', 'c1be311f-e30c-4e11-b173-e393f2155594', '716662e9-5258-48e0-ad88-36f7e04a0917', 'Tangdi Half', NULL, 150.00, NULL, 'false', 'true', 15, '2026-04-06 09:37:41.410452+00', '2026-04-06 09:37:41.410452+00', 'false', 'Today''s Special', NULL, NULL),
	('a7018a30-c7d5-477c-b1e0-3b80ba57d0eb', 'c1be311f-e30c-4e11-b173-e393f2155594', '756e529c-1f60-4fc9-ba25-858618c91279', 'Paneer Chilli', NULL, 180.00, 'https://upload.wikimedia.org/wikipedia/commons/8/8d/ChineseDishLogo.png', 'true', 'true', 15, '2026-04-06 09:36:51.476443+00', '2026-04-06 09:36:51.476443+00', 'false', 'Today''s Special', NULL, NULL),
	('a7f7ddf3-a7a4-4b5c-a783-457b86969626', 'c1be311f-e30c-4e11-b173-e393f2155594', '6354d744-d197-4480-8b65-7c721d504984', 'Fish Curry', NULL, 220.00, NULL, 'false', 'true', 15, '2026-04-06 09:37:16.213419+00', '2026-04-06 09:37:16.213419+00', 'false', 'Today''s Special', NULL, NULL),
	('a8de9bb9-f3ae-4b68-ae1b-105dd713c82a', 'fe9adce2-5d31-4523-b788-0b624a9ce3a7', '65db2bf6-1640-4daa-8d66-f7a2f53a11d8', 'Mix Veg Curry', NULL, 140.00, NULL, 'true', 'true', 15, '2026-04-05 12:23:19.295562+00', '2026-04-05 12:23:19.295562+00', 'false', 'Today''s Special', NULL, NULL),
	('a9985d38-f678-4f6f-b3cb-8988d17632e4', 'c1be311f-e30c-4e11-b173-e393f2155594', '6dce255f-bddb-4d06-9209-2b3f059c9f2c', 'Chicken Moghalai Biryani', NULL, 240.00, NULL, 'false', 'true', 15, '2026-04-06 09:35:54.297735+00', '2026-04-06 09:35:54.297735+00', 'false', 'Today''s Special', NULL, NULL),
	('aa3573f1-7cfe-4c74-8743-dacc74f32811', 'c1be311f-e30c-4e11-b173-e393f2155594', 'e7803acc-9474-41bd-ac92-7e15183a020f', 'Bucket Fry Biryani', '(Half Chicken Starter, Half Chicken Curry, Roti 3)', 850.00, NULL, 'false', 'true', 15, '2026-04-06 09:35:09.688262+00', '2026-04-06 09:35:09.688262+00', 'false', 'Today''s Special', NULL, NULL),
	('abdeeb33-6305-4e36-bc87-a3143fc93cde', 'c1be311f-e30c-4e11-b173-e393f2155594', '852dc3f7-6559-4a1c-ae0b-bf4a496c1250', 'White Rice', NULL, 50.00, 'https://upload.wikimedia.org/wikipedia/commons/a/af/Half_a_cup_of_rice._Brown_rice_is_the_best_choice.JPG', 'true', 'true', 15, '2026-04-06 09:37:41.410452+00', '2026-04-06 09:37:41.410452+00', 'false', 'Today''s Special', NULL, NULL),
	('ac9b60b5-ca1c-4225-b467-113d941d95b2', 'd776e4e4-4e69-4d69-b796-9c8018fc898d', NULL, 'test', NULL, 200.00, NULL, 'true', 'true', 15, '2026-03-30 08:09:21.613455+00', '2026-03-30 08:09:21.613455+00', 'false', 'Today''s Special', NULL, NULL),
	('ac9d123f-42a9-4d1b-bb09-79dd54ac10eb', 'c1be311f-e30c-4e11-b173-e393f2155594', '2d87933c-66ff-4337-9872-f415c05dda0b', 'Egg Chilli', NULL, 150.00, NULL, 'false', 'true', 15, '2026-04-06 09:37:41.410452+00', '2026-04-06 09:37:41.410452+00', 'false', 'Today''s Special', NULL, NULL),
	('aee7d269-67be-453f-87ce-7ee273cc6cae', 'c1be311f-e30c-4e11-b173-e393f2155594', '756e529c-1f60-4fc9-ba25-858618c91279', 'Mushroom Pepper', NULL, 180.00, NULL, 'true', 'true', 15, '2026-04-06 09:36:51.476443+00', '2026-04-06 09:36:51.476443+00', 'false', 'Today''s Special', NULL, NULL),
	('af2ba4cc-c8be-453d-8466-8b137509da80', 'c1be311f-e30c-4e11-b173-e393f2155594', '2d87933c-66ff-4337-9872-f415c05dda0b', 'Egg Fry', NULL, 130.00, NULL, 'false', 'true', 15, '2026-04-06 09:37:41.410452+00', '2026-04-06 09:37:41.410452+00', 'false', 'Today''s Special', NULL, NULL),
	('b03704c4-462b-4116-bb32-fd27afe7e4d5', 'c1be311f-e30c-4e11-b173-e393f2155594', '6dce255f-bddb-4d06-9209-2b3f059c9f2c', 'Fry Family Pack', NULL, 650.00, NULL, 'false', 'true', 15, '2026-04-06 09:35:54.297735+00', '2026-04-06 09:35:54.297735+00', 'false', 'Today''s Special', NULL, NULL),
	('b229df65-46f1-4e74-bf17-bcc69649d063', 'c1be311f-e30c-4e11-b173-e393f2155594', 'cd082ac8-713e-4c3f-8dc4-abd02cf025e9', 'Kothimeera Roti', NULL, 40.00, NULL, 'true', 'true', 15, '2026-04-06 09:37:16.213419+00', '2026-04-06 09:37:16.213419+00', 'false', 'Today''s Special', NULL, NULL),
	('b2e47534-9a0d-457a-ae28-ca962576e1da', 'c1be311f-e30c-4e11-b173-e393f2155594', '756e529c-1f60-4fc9-ba25-858618c91279', 'Veg Basket', NULL, 180.00, NULL, 'true', 'true', 15, '2026-04-06 09:36:51.476443+00', '2026-04-06 09:36:51.476443+00', 'false', 'Today''s Special', NULL, NULL),
	('b3eb3069-bc1c-4348-8bff-3f4052ab8574', 'c1be311f-e30c-4e11-b173-e393f2155594', '756e529c-1f60-4fc9-ba25-858618c91279', 'Paneer Manchurian', NULL, 200.00, NULL, 'true', 'true', 15, '2026-04-06 09:36:51.476443+00', '2026-04-06 09:36:51.476443+00', 'false', 'Today''s Special', NULL, NULL),
	('b5118d1a-547e-4535-9cca-9e39ca322e9d', 'c1be311f-e30c-4e11-b173-e393f2155594', '6354d744-d197-4480-8b65-7c721d504984', 'Chicken Afghoni', NULL, 240.00, NULL, 'false', 'true', 15, '2026-04-06 09:37:16.213419+00', '2026-04-06 09:37:16.213419+00', 'false', 'Today''s Special', NULL, NULL),
	('b8a0c9a7-5e20-4341-bfd1-621cf0e79ad4', 'c1be311f-e30c-4e11-b173-e393f2155594', 'cd082ac8-713e-4c3f-8dc4-abd02cf025e9', 'Butter Naan', NULL, 40.00, NULL, 'true', 'true', 15, '2026-04-06 09:37:16.213419+00', '2026-04-06 09:37:16.213419+00', 'false', 'Today''s Special', NULL, NULL),
	('b8bd51bc-624c-4457-9155-f9761f7728ef', 'c1be311f-e30c-4e11-b173-e393f2155594', '9f124c6a-8567-410e-a6ff-ff0072a34de1', 'Chilli Chicken', NULL, 220.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:27.618396+00', '2026-04-06 09:36:27.618396+00', 'false', 'Today''s Special', NULL, NULL),
	('b99d9c39-8862-44ce-a4aa-71b45f5a5ead', 'c1be311f-e30c-4e11-b173-e393f2155594', '756e529c-1f60-4fc9-ba25-858618c91279', 'Mushroom Dragon', NULL, 180.00, NULL, 'true', 'true', 15, '2026-04-06 09:36:51.476443+00', '2026-04-06 09:36:51.476443+00', 'false', 'Today''s Special', NULL, NULL),
	('ba63ee06-e3a1-4eb9-889a-ce6f003d1755', 'c1be311f-e30c-4e11-b173-e393f2155594', '756e529c-1f60-4fc9-ba25-858618c91279', 'Creamup Paneer', NULL, 220.00, NULL, 'true', 'true', 15, '2026-04-06 09:36:51.476443+00', '2026-04-06 09:36:51.476443+00', 'false', 'Today''s Special', NULL, NULL),
	('bba95d14-695a-493c-b664-637b8edcc260', 'c1be311f-e30c-4e11-b173-e393f2155594', '94670ff0-7c83-47f9-b1f3-ea7f72a51087', 'Paneer Butter Masala', NULL, 180.00, 'https://upload.wikimedia.org/wikipedia/commons/a/ad/Shahi_panner.jpg', 'true', 'true', 15, '2026-04-06 09:35:09.688262+00', '2026-04-06 09:35:09.688262+00', 'false', 'Today''s Special', NULL, NULL),
	('bbed5e44-851c-4e0e-bd91-19dbaeb875e3', 'c1be311f-e30c-4e11-b173-e393f2155594', '94670ff0-7c83-47f9-b1f3-ea7f72a51087', 'Tomato Curry', NULL, 120.00, NULL, 'true', 'true', 15, '2026-04-06 09:35:09.688262+00', '2026-04-06 09:35:09.688262+00', 'false', 'Today''s Special', NULL, NULL),
	('bcb6a598-c559-446d-8ce1-a162104e20b2', '7524750f-332c-4d0b-aa9d-956d950e2e1c', '010fafcf-6cb6-4363-89d9-95202d0e228d', 'Fruit Salad', NULL, 13.00, NULL, 'true', 'true', 15, '2026-03-31 07:35:29.573572+00', '2026-03-31 07:35:29.573572+00', 'false', 'Today''s Special', NULL, NULL),
	('bf1df052-89fe-4e7c-907b-97b3624f6e77', '7524750f-332c-4d0b-aa9d-956d950e2e1c', '0053177a-bc31-476d-b25d-72dcb56a227f', 'Iced Coffee', NULL, 23.00, 'https://upload.wikimedia.org/wikipedia/commons/a/ac/Affogato_al_Caffe.jpg', 'true', 'true', 15, '2026-03-31 07:35:29.573572+00', '2026-03-31 07:35:29.573572+00', 'false', 'Today''s Special', NULL, NULL),
	('bf63dab3-6b54-4c43-aec0-b3320a76f2cb', 'fe9adce2-5d31-4523-b788-0b624a9ce3a7', '48a4a418-813b-4f77-a064-e9d41dd25dbf', 'Tangdi Biryani', NULL, 750.00, NULL, 'false', 'true', 15, '2026-04-05 12:23:19.295562+00', '2026-04-05 12:23:19.295562+00', 'false', 'Today''s Special', NULL, NULL),
	('c05fc2f6-0568-4908-9cff-46bfd292bb84', 'fe9adce2-5d31-4523-b788-0b624a9ce3a7', '65db2bf6-1640-4daa-8d66-f7a2f53a11d8', 'Kadai Paneer', NULL, 160.00, 'https://upload.wikimedia.org/wikipedia/commons/7/7d/Kadai_Paneer-Delhi-12.jpg', 'true', 'true', 15, '2026-04-05 12:23:19.295562+00', '2026-04-05 12:23:19.295562+00', 'false', 'Today''s Special', NULL, NULL),
	('c1fa35a0-690b-4a37-8a3d-bca8e59c48dd', 'c1be311f-e30c-4e11-b173-e393f2155594', '756e529c-1f60-4fc9-ba25-858618c91279', 'Veg Manchurian', NULL, 160.00, NULL, 'true', 'true', 15, '2026-04-06 09:36:51.476443+00', '2026-04-06 09:36:51.476443+00', 'false', 'Today''s Special', NULL, NULL),
	('c2117417-0458-4196-b4e9-9da4556a8996', 'c1be311f-e30c-4e11-b173-e393f2155594', '756e529c-1f60-4fc9-ba25-858618c91279', 'Dragon Panner', NULL, 180.00, NULL, 'true', 'true', 15, '2026-04-06 09:36:51.476443+00', '2026-04-06 09:36:51.476443+00', 'false', 'Today''s Special', NULL, NULL),
	('c29615dd-1a16-4675-ae22-cf627ab1550a', 'c1be311f-e30c-4e11-b173-e393f2155594', '6354d744-d197-4480-8b65-7c721d504984', 'S/P Chicken', NULL, 220.00, NULL, 'false', 'true', 15, '2026-04-06 09:37:16.213419+00', '2026-04-06 09:37:16.213419+00', 'false', 'Today''s Special', NULL, NULL),
	('c3127719-0b19-4113-b24e-ae155ae7c78a', 'c1be311f-e30c-4e11-b173-e393f2155594', 'cd082ac8-713e-4c3f-8dc4-abd02cf025e9', 'Pudina Roti', NULL, 40.00, NULL, 'true', 'true', 15, '2026-04-06 09:37:16.213419+00', '2026-04-06 09:37:16.213419+00', 'false', 'Today''s Special', NULL, NULL),
	('c51c6266-e6ae-4029-9a23-70e623189164', 'c1be311f-e30c-4e11-b173-e393f2155594', '9f124c6a-8567-410e-a6ff-ff0072a34de1', 'Ginger Chicken', NULL, 240.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:27.618396+00', '2026-04-06 09:36:27.618396+00', 'false', 'Today''s Special', NULL, NULL),
	('c6cd78b3-26b0-4239-9b2a-5f16c28aaab4', 'c1be311f-e30c-4e11-b173-e393f2155594', '9f124c6a-8567-410e-a6ff-ff0072a34de1', 'Pepper Chicken', NULL, 220.00, 'https://upload.wikimedia.org/wikipedia/en/8/80/Pepper_Chicken_%28film_cover%29.jpg', 'false', 'true', 15, '2026-04-06 09:36:27.618396+00', '2026-04-06 09:36:27.618396+00', 'false', 'Today''s Special', NULL, NULL),
	('ca5c6c8e-7743-4c52-a638-f80b06b13d8b', 'c1be311f-e30c-4e11-b173-e393f2155594', '9f124c6a-8567-410e-a6ff-ff0072a34de1', 'Chicken Manchurian', NULL, 220.00, 'https://upload.wikimedia.org/wikipedia/commons/b/bb/Chicken_Manchurian_%28Hyderabad_Style%29_%2811960049916%29.jpg', 'false', 'true', 15, '2026-04-06 09:36:27.618396+00', '2026-04-06 09:36:27.618396+00', 'false', 'Today''s Special', NULL, NULL),
	('ccd7e83a-2e79-49a6-9658-b299daee1552', 'fe9adce2-5d31-4523-b788-0b624a9ce3a7', '65db2bf6-1640-4daa-8d66-f7a2f53a11d8', 'Kaju Butter Masala', NULL, 240.00, NULL, 'true', 'true', 15, '2026-04-05 12:23:19.295562+00', '2026-04-05 12:23:19.295562+00', 'false', 'Today''s Special', NULL, NULL),
	('cfbc4e8b-1eab-46f0-ad2f-2d2e6ecc3c84', 'c1be311f-e30c-4e11-b173-e393f2155594', '6dce255f-bddb-4d06-9209-2b3f059c9f2c', 'Maharaju Biryani', NULL, 250.00, NULL, 'false', 'true', 15, '2026-04-06 09:35:54.297735+00', '2026-04-06 09:35:54.297735+00', 'false', 'Today''s Special', NULL, NULL),
	('d058e92a-6570-4584-864a-fa8f918b5085', 'c1be311f-e30c-4e11-b173-e393f2155594', '6eaea60c-46a8-4a45-a921-d0ac542468f8', 'Mushroom Paneer Biryani', NULL, 220.00, NULL, 'true', 'true', 15, '2026-04-06 09:35:54.297735+00', '2026-04-06 09:35:54.297735+00', 'false', 'Today''s Special', NULL, NULL),
	('d05d38a2-20cd-4631-adbe-ad9ae2764ac8', 'c1be311f-e30c-4e11-b173-e393f2155594', '2d87933c-66ff-4337-9872-f415c05dda0b', 'Egg Basket', NULL, 150.00, NULL, 'false', 'true', 15, '2026-04-06 09:37:41.410452+00', '2026-04-06 09:37:41.410452+00', 'false', 'Today''s Special', NULL, NULL),
	('d1c7bcdb-6f54-443d-96d6-098ea9bea8db', 'c1be311f-e30c-4e11-b173-e393f2155594', '9f124c6a-8567-410e-a6ff-ff0072a34de1', 'Chicken Lollipop', NULL, 240.00, 'https://upload.wikimedia.org/wikipedia/commons/a/a0/Chicken_lollipop_in_Goa.jpg', 'false', 'true', 15, '2026-04-06 09:36:27.618396+00', '2026-04-06 09:36:27.618396+00', 'false', 'Today''s Special', NULL, NULL),
	('d1e2c54f-1fcd-43c4-b483-0334cb9c36e2', '7524750f-332c-4d0b-aa9d-956d950e2e1c', '010fafcf-6cb6-4363-89d9-95202d0e228d', 'Cocktails', NULL, 12.00, 'https://upload.wikimedia.org/wikipedia/commons/8/80/15-09-26-RalfR-WLC-0084.jpg', 'true', 'true', 15, '2026-03-31 07:35:29.573572+00', '2026-03-31 07:35:29.573572+00', 'false', 'Today''s Special', NULL, NULL),
	('d5429c31-b50c-4a31-b2ef-0a79c8122fc8', 'c1be311f-e30c-4e11-b173-e393f2155594', '6354d744-d197-4480-8b65-7c721d504984', 'Prawn Curry', NULL, 320.00, 'https://www.themealdb.com/images/media/meals/qqlwv91763501559.jpg', 'false', 'true', 15, '2026-04-06 09:37:16.213419+00', '2026-04-06 09:37:16.213419+00', 'false', 'Today''s Special', NULL, NULL),
	('d5cd29c1-04c4-4d4b-864f-831c584c2145', 'c1be311f-e30c-4e11-b173-e393f2155594', '6354d744-d197-4480-8b65-7c721d504984', 'Chicken Rayalaseema', NULL, 240.00, NULL, 'false', 'true', 15, '2026-04-06 09:37:16.213419+00', '2026-04-06 09:37:16.213419+00', 'false', 'Today''s Special', NULL, NULL),
	('d693aa49-014d-4060-9c0a-85fba4782bac', 'c1be311f-e30c-4e11-b173-e393f2155594', '852dc3f7-6559-4a1c-ae0b-bf4a496c1250', 'Gobi Fried Rice', NULL, 140.00, NULL, 'true', 'true', 15, '2026-04-06 09:37:41.410452+00', '2026-04-06 09:37:41.410452+00', 'false', 'Today''s Special', NULL, NULL),
	('d6b74068-9006-4b75-bf9c-a505bff2ce19', 'c1be311f-e30c-4e11-b173-e393f2155594', '756e529c-1f60-4fc9-ba25-858618c91279', 'Mushroom Manchurian', NULL, 180.00, NULL, 'true', 'true', 15, '2026-04-06 09:36:51.476443+00', '2026-04-06 09:36:51.476443+00', 'false', 'Today''s Special', NULL, NULL),
	('d944008d-64f0-4ac9-a5e4-5577307816e8', 'c1be311f-e30c-4e11-b173-e393f2155594', '9f124c6a-8567-410e-a6ff-ff0072a34de1', 'Lemon Chicken', NULL, 220.00, 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Lemonchicken.jpg', 'false', 'true', 15, '2026-04-06 09:36:27.618396+00', '2026-04-06 09:36:27.618396+00', 'false', 'Today''s Special', NULL, NULL),
	('d972062a-9248-40ab-942c-b3c31b585f73', 'c1be311f-e30c-4e11-b173-e393f2155594', '852dc3f7-6559-4a1c-ae0b-bf4a496c1250', 'Mushroom Fried Rice', NULL, 150.00, NULL, 'true', 'true', 15, '2026-04-06 09:37:41.410452+00', '2026-04-06 09:37:41.410452+00', 'false', 'Today''s Special', NULL, NULL),
	('d9f0af0c-92fa-49d2-9f09-0cef0442012e', 'c1be311f-e30c-4e11-b173-e393f2155594', '2d87933c-66ff-4337-9872-f415c05dda0b', 'Egg Manchurian', NULL, 150.00, NULL, 'false', 'true', 15, '2026-04-06 09:37:41.410452+00', '2026-04-06 09:37:41.410452+00', 'false', 'Today''s Special', NULL, NULL),
	('dc354790-5dea-4eed-b0c6-b090b907724d', 'c1be311f-e30c-4e11-b173-e393f2155594', '9f124c6a-8567-410e-a6ff-ff0072a34de1', 'Chicken 65', NULL, 220.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:27.618396+00', '2026-04-06 09:36:27.618396+00', 'false', 'Today''s Special', NULL, NULL),
	('dc51b7ec-ba19-43b0-bc6f-7763dbf5ce96', '7524750f-332c-4d0b-aa9d-956d950e2e1c', '1f5f3a7c-9988-47bc-ad37-ae613b52387c', 'panner tikka', NULL, 456.00, NULL, 'true', 'true', 15, '2026-03-30 20:44:50.927167+00', '2026-03-30 20:44:50.927167+00', 'true', 'Today''s Special', NULL, NULL),
	('de64b208-1965-4f25-920d-1aba6b074e7d', 'c1be311f-e30c-4e11-b173-e393f2155594', '9f124c6a-8567-410e-a6ff-ff0072a34de1', 'Chicken Drumstick', NULL, 240.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:27.618396+00', '2026-04-06 09:36:27.618396+00', 'false', 'Today''s Special', NULL, NULL),
	('e0797796-e9fb-4d9d-ba53-ab9f931ac426', 'c1be311f-e30c-4e11-b173-e393f2155594', '9f124c6a-8567-410e-a6ff-ff0072a34de1', 'Slice Chicken', NULL, 220.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:27.618396+00', '2026-04-06 09:36:27.618396+00', 'false', 'Today''s Special', NULL, NULL),
	('e1e84f25-55f4-4d71-91e6-cdcdc9726946', 'c1be311f-e30c-4e11-b173-e393f2155594', '9f124c6a-8567-410e-a6ff-ff0072a34de1', 'Garlic Chicken', NULL, 240.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:27.618396+00', '2026-04-06 09:36:27.618396+00', 'false', 'Today''s Special', NULL, NULL),
	('e29fa152-767b-4e8d-8977-cee02d36587f', 'c1be311f-e30c-4e11-b173-e393f2155594', '756e529c-1f60-4fc9-ba25-858618c91279', 'Pepper Paneer', NULL, 180.00, NULL, 'true', 'true', 15, '2026-04-06 09:36:51.476443+00', '2026-04-06 09:36:51.476443+00', 'false', 'Today''s Special', NULL, NULL),
	('e3095c99-3286-4da1-a9eb-fc7c9e13adea', 'fe9adce2-5d31-4523-b788-0b624a9ce3a7', '65db2bf6-1640-4daa-8d66-f7a2f53a11d8', 'Palak Paneer', NULL, 180.00, 'https://upload.wikimedia.org/wikipedia/commons/b/b7/Palakpaneer_Rayagada_Odisha_0009.jpg', 'true', 'true', 15, '2026-04-05 12:23:19.295562+00', '2026-04-05 12:23:19.295562+00', 'false', 'Today''s Special', NULL, NULL),
	('e4daee58-3f93-4c46-9e82-745652b1130f', 'c1be311f-e30c-4e11-b173-e393f2155594', '6eaea60c-46a8-4a45-a921-d0ac542468f8', 'Veg Biryani', NULL, 150.00, NULL, 'true', 'true', 15, '2026-04-06 09:35:54.297735+00', '2026-04-06 09:35:54.297735+00', 'false', 'Today''s Special', NULL, NULL),
	('e50cf343-efef-436b-a349-adb322d679a2', 'c1be311f-e30c-4e11-b173-e393f2155594', '6eaea60c-46a8-4a45-a921-d0ac542468f8', 'Mushroom Biryani', NULL, 180.00, NULL, 'true', 'true', 15, '2026-04-06 09:35:54.297735+00', '2026-04-06 09:35:54.297735+00', 'false', 'Today''s Special', NULL, NULL),
	('e59e77a4-dcec-484a-98d3-ce86fdffaac5', 'c1be311f-e30c-4e11-b173-e393f2155594', '9f124c6a-8567-410e-a6ff-ff0072a34de1', 'Natu kodi Fry', NULL, 340.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:27.618396+00', '2026-04-06 09:36:27.618396+00', 'false', 'Today''s Special', NULL, NULL),
	('e5d25e07-eeeb-4b80-9bd6-b819db4ca4fd', '7524750f-332c-4d0b-aa9d-956d950e2e1c', '1f5f3a7c-9988-47bc-ad37-ae613b52387c', 'Chicken Burgers', NULL, 24.00, NULL, 'false', 'true', 15, '2026-03-31 07:35:29.573572+00', '2026-03-31 07:35:29.573572+00', 'false', 'Today''s Special', NULL, NULL),
	('e749ba66-705a-4fc5-bd7f-1c9d055f0be0', 'c1be311f-e30c-4e11-b173-e393f2155594', '6354d744-d197-4480-8b65-7c721d504984', 'Andhra Chicken Curry', NULL, 220.00, NULL, 'false', 'true', 15, '2026-04-06 09:37:16.213419+00', '2026-04-06 09:37:16.213419+00', 'false', 'Today''s Special', NULL, NULL),
	('e8bd4df2-b16c-462b-8d64-9b9e49f6c38a', 'c1be311f-e30c-4e11-b173-e393f2155594', '852dc3f7-6559-4a1c-ae0b-bf4a496c1250', 'Chicken Fried Rice', NULL, 150.00, 'https://www.themealdb.com/images/media/meals/wuyd2h1765655837.jpg', 'false', 'true', 15, '2026-04-06 09:37:41.410452+00', '2026-04-06 09:37:41.410452+00', 'false', 'Today''s Special', NULL, NULL),
	('ea35ea8c-2d45-4682-9deb-5977731504f7', 'fe9adce2-5d31-4523-b788-0b624a9ce3a7', '65db2bf6-1640-4daa-8d66-f7a2f53a11d8', 'Kaju Curry', NULL, 240.00, NULL, 'true', 'true', 15, '2026-04-05 12:23:19.295562+00', '2026-04-05 12:23:19.295562+00', 'false', 'Today''s Special', NULL, NULL),
	('eb221eff-af23-4236-b7e8-f4f377ab4644', 'c1be311f-e30c-4e11-b173-e393f2155594', '6354d744-d197-4480-8b65-7c721d504984', 'Mughlai Chicken', NULL, 240.00, NULL, 'false', 'true', 15, '2026-04-06 09:37:16.213419+00', '2026-04-06 09:37:16.213419+00', 'false', 'Today''s Special', NULL, NULL),
	('eb41a8fc-b5d6-4ddd-96cd-b316d06d819f', 'c1be311f-e30c-4e11-b173-e393f2155594', '852dc3f7-6559-4a1c-ae0b-bf4a496c1250', 'Curd Rice', NULL, 80.00, NULL, 'true', 'true', 15, '2026-04-06 09:37:41.410452+00', '2026-04-06 09:37:41.410452+00', 'false', 'Today''s Special', NULL, NULL),
	('ec313fa9-0634-4624-8ac9-d1128d204765', 'fe9adce2-5d31-4523-b788-0b624a9ce3a7', '65db2bf6-1640-4daa-8d66-f7a2f53a11d8', 'Dal Thadka', NULL, 140.00, NULL, 'true', 'true', 15, '2026-04-05 12:23:19.295562+00', '2026-04-05 12:23:19.295562+00', 'false', 'Today''s Special', NULL, NULL),
	('ee146e3a-9655-4efc-9e77-4d6a44e9e4ea', 'fe9adce2-5d31-4523-b788-0b624a9ce3a7', '65db2bf6-1640-4daa-8d66-f7a2f53a11d8', 'Kaju Paneer', NULL, 220.00, NULL, 'true', 'true', 15, '2026-04-05 12:23:19.295562+00', '2026-04-05 12:23:19.295562+00', 'false', 'Today''s Special', NULL, NULL),
	('ee5ee808-614d-4bd8-9d92-7ff6bf31d27e', 'c1be311f-e30c-4e11-b173-e393f2155594', '852dc3f7-6559-4a1c-ae0b-bf4a496c1250', 'Egg Fried Rice', NULL, 100.00, NULL, 'false', 'true', 15, '2026-04-06 09:37:41.410452+00', '2026-04-06 09:37:41.410452+00', 'false', 'Today''s Special', NULL, NULL),
	('eeb0510a-5765-4992-a054-7e2f814f2a99', 'c1be311f-e30c-4e11-b173-e393f2155594', 'cd082ac8-713e-4c3f-8dc4-abd02cf025e9', 'Butter Roti', NULL, 25.00, NULL, 'true', 'true', 15, '2026-04-06 09:37:16.213419+00', '2026-04-06 09:37:16.213419+00', 'false', 'Today''s Special', NULL, NULL),
	('f0e841c0-2ecb-4644-a331-58b6797fb4b1', '7524750f-332c-4d0b-aa9d-956d950e2e1c', '1f5f3a7c-9988-47bc-ad37-ae613b52387c', 'Cheeseburger', NULL, 34.00, 'https://upload.wikimedia.org/wikipedia/commons/4/4d/Cheeseburger.jpg', 'false', 'true', 15, '2026-03-31 07:35:29.573572+00', '2026-03-31 07:35:29.573572+00', 'false', 'Today''s Special', NULL, NULL),
	('f1284962-2e58-4057-bad7-62382083c925', 'c1be311f-e30c-4e11-b173-e393f2155594', '6dce255f-bddb-4d06-9209-2b3f059c9f2c', 'Chicken Roast Biryani', NULL, 240.00, NULL, 'false', 'true', 15, '2026-04-06 09:35:54.297735+00', '2026-04-06 09:35:54.297735+00', 'false', 'Today''s Special', NULL, NULL),
	('f182b233-bc3f-46b2-a745-02fd2bd57bce', 'c1be311f-e30c-4e11-b173-e393f2155594', '6696188e-9503-46b8-9815-458a1c1acecd', 'Creamup Prawns', NULL, 360.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:51.476443+00', '2026-04-06 09:36:51.476443+00', 'false', 'Today''s Special', NULL, NULL),
	('f2220b38-7909-47b1-97be-de9aa15fc61a', 'c1be311f-e30c-4e11-b173-e393f2155594', '756e529c-1f60-4fc9-ba25-858618c91279', 'Veg 555', NULL, 180.00, NULL, 'true', 'true', 15, '2026-04-06 09:36:51.476443+00', '2026-04-06 09:36:51.476443+00', 'false', 'Today''s Special', NULL, NULL),
	('f5ed4f08-5d03-40b5-b8bc-5c5198351360', 'c1be311f-e30c-4e11-b173-e393f2155594', '6dce255f-bddb-4d06-9209-2b3f059c9f2c', 'Mutton Roast Biryani', NULL, 360.00, NULL, 'false', 'true', 15, '2026-04-06 09:35:54.297735+00', '2026-04-06 09:35:54.297735+00', 'false', 'Today''s Special', NULL, NULL),
	('f6025f1d-29ad-42ff-94b5-ef0b8726724b', 'c1be311f-e30c-4e11-b173-e393f2155594', '2d87933c-66ff-4337-9872-f415c05dda0b', 'Egg Pakoda', NULL, 150.00, NULL, 'false', 'true', 15, '2026-04-06 09:37:41.410452+00', '2026-04-06 09:37:41.410452+00', 'false', 'Today''s Special', NULL, NULL),
	('f7c55c15-dcce-4947-b3f4-019859bf41e8', 'c1be311f-e30c-4e11-b173-e393f2155594', '6dce255f-bddb-4d06-9209-2b3f059c9f2c', 'Chicken Dum Biryani', NULL, 180.00, NULL, 'false', 'true', 15, '2026-04-06 09:35:54.297735+00', '2026-04-06 09:35:54.297735+00', 'false', 'Today''s Special', NULL, NULL),
	('f9239fb6-fd3c-44cd-944f-4af32790670e', 'c1be311f-e30c-4e11-b173-e393f2155594', '9f124c6a-8567-410e-a6ff-ff0072a34de1', 'Chicken Pakoda', NULL, 200.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:27.618396+00', '2026-04-06 09:36:27.618396+00', 'false', 'Today''s Special', NULL, NULL),
	('f92492e0-6f10-429e-8b6f-bf0c09e2f778', 'c1be311f-e30c-4e11-b173-e393f2155594', '6354d744-d197-4480-8b65-7c721d504984', 'Mutton CurryRayalaseema', NULL, 340.00, NULL, 'false', 'true', 15, '2026-04-06 09:37:16.213419+00', '2026-04-06 09:37:16.213419+00', 'false', 'Today''s Special', NULL, NULL),
	('f9887d61-0d89-43d0-bec8-d0fe05df1769', 'fe9adce2-5d31-4523-b788-0b624a9ce3a7', '65db2bf6-1640-4daa-8d66-f7a2f53a11d8', 'Veg chatpata', NULL, 160.00, NULL, 'true', 'true', 15, '2026-04-05 12:23:19.295562+00', '2026-04-05 12:23:19.295562+00', 'false', 'Today''s Special', NULL, NULL),
	('fb3ac6b1-19aa-4cc5-8701-69b96d16108d', 'c1be311f-e30c-4e11-b173-e393f2155594', '9f124c6a-8567-410e-a6ff-ff0072a34de1', 'Chicken Basket', NULL, 240.00, NULL, 'false', 'true', 15, '2026-04-06 09:36:27.618396+00', '2026-04-06 09:36:27.618396+00', 'false', 'Today''s Special', NULL, NULL),
	('fb769d67-0e35-4c52-9264-bea5d43cf9ab', 'c1be311f-e30c-4e11-b173-e393f2155594', 'cd082ac8-713e-4c3f-8dc4-abd02cf025e9', 'Plain Kulcha', NULL, 40.00, NULL, 'true', 'true', 15, '2026-04-06 09:37:16.213419+00', '2026-04-06 09:37:16.213419+00', 'false', 'Today''s Special', NULL, NULL),
	('fba72214-56f7-4360-ac23-bb5cdb5e8f66', 'c1be311f-e30c-4e11-b173-e393f2155594', '716662e9-5258-48e0-ad88-36f7e04a0917', 'Tangdi Full', NULL, 280.00, NULL, 'false', 'true', 15, '2026-04-06 09:37:41.410452+00', '2026-04-06 09:37:41.410452+00', 'false', 'Today''s Special', NULL, NULL),
	('fe1e614a-6a85-40f4-8144-f92244723077', 'c1be311f-e30c-4e11-b173-e393f2155594', '6dce255f-bddb-4d06-9209-2b3f059c9f2c', 'Biryani Rice', NULL, 110.00, NULL, 'false', 'true', 15, '2026-04-06 09:35:54.297735+00', '2026-04-06 09:35:54.297735+00', 'false', 'Today''s Special', NULL, NULL),
	('fe623468-8e80-4508-842c-f37956bc1abf', 'c1be311f-e30c-4e11-b173-e393f2155594', '6354d744-d197-4480-8b65-7c721d504984', 'Methi Chicken', NULL, 220.00, NULL, 'false', 'true', 15, '2026-04-06 09:37:16.213419+00', '2026-04-06 09:37:16.213419+00', 'false', 'Today''s Special', NULL, NULL),
	('fe6cfd9d-8770-4568-8809-55c66445d699', '7524750f-332c-4d0b-aa9d-956d950e2e1c', '1f5f3a7c-9988-47bc-ad37-ae613b52387c', 'Hot Dog', NULL, 23.00, 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Hot_dog_with_mustard.png', 'false', 'true', 15, '2026-03-31 07:35:29.573572+00', '2026-03-31 07:35:29.573572+00', 'false', 'Today''s Special', NULL, NULL),
	('ff0dbd30-80c2-45ac-ad5d-5a798f0e86ff', 'fe9adce2-5d31-4523-b788-0b624a9ce3a7', '48a4a418-813b-4f77-a064-e9d41dd25dbf', 'Bucket Dum Biryani', '(Half Chicken Starter, Half Chicken Curry, Roti 3)', 750.00, NULL, 'false', 'true', 15, '2026-04-05 12:23:19.295562+00', '2026-04-05 12:23:19.295562+00', 'false', 'Today''s Special', NULL, NULL);

-- Dumping structure for table public.menu_variants
CREATE TABLE IF NOT EXISTS "menu_variants" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"menu_item_id" UUID NOT NULL,
	"name" TEXT NOT NULL,
	"price_adjustment" NUMERIC(10,2) NOT NULL DEFAULT 0,
	"is_default" BOOLEAN NOT NULL DEFAULT false,
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
	PRIMARY KEY ("id"),
	CONSTRAINT "menu_variants_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);

-- Dumping data for table public.menu_variants: -1 rows

-- Dumping structure for table public.notifications
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"user_id" UUID NOT NULL,
	"type" TEXT NOT NULL DEFAULT 'system',
	"title" TEXT NOT NULL,
	"message" TEXT NOT NULL,
	"read" BOOLEAN NOT NULL DEFAULT false,
	"action_url" TEXT NULL DEFAULT NULL,
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
	PRIMARY KEY ("id")
)
CREATE INDEX "idx_notifications_user_id" ON "" ("user_id");
CREATE INDEX "idx_notifications_read" ON "" ("user_id", "read");;

-- Dumping data for table public.notifications: -1 rows
INSERT INTO "notifications" ("id", "user_id", "type", "title", "message", "read", "action_url", "created_at") VALUES
	('1d718788-14e1-40a2-a4e7-69dbba8ee14c', '328e18d3-24c3-4716-89be-3fe5c94f40b1', 'subscription', 'Account Approved! 🎉', 'Your banaoo.io account has been approved. You can now choose a plan and start managing your restaurant.', 'false', '/select-plan', '2026-04-03 12:06:46.63732+00'),
	('2fe1d362-8898-4016-b1b4-44cf898e506e', 'd61c616e-ff7a-4679-9ac8-afff1950f75d', 'subscription', 'Account Approved! 🎉', 'Your banaoo.io account has been approved. You can now choose a plan and start managing your restaurant.', 'false', '/select-plan', '2026-03-29 14:51:23.079718+00'),
	('4ce01bae-ecb6-49e5-a079-0c62f49591c8', '0cae5721-724f-41a8-804c-bdb0601b54c6', 'subscription', 'Account Approved! 🎉', 'Your banaoo.io account has been approved. You can now choose a plan and start managing your restaurant.', 'false', '/select-plan', '2026-03-30 09:49:53.129734+00'),
	('4eabbd2c-8824-445d-b917-41c34d55f594', '8bd4ffde-fbfd-4ddd-9d0d-fdbd7dba419f', 'subscription', 'Account Approved! 🎉', 'Your banaoo.io account has been approved. You can now choose a plan and start managing your restaurant.', 'false', '/select-plan', '2026-04-01 17:40:25.571737+00'),
	('a0ba9849-f607-430a-a9fa-0142016dfac8', 'c019bea6-a9c7-4afe-9db6-5e6ae87f6e21', 'subscription', 'Account Approved! 🎉', 'Your banaoo.io account has been approved. You can now choose a plan and start managing your restaurant.', 'true', '/select-plan', '2026-03-29 14:51:15.398028+00'),
	('ad6fd8d7-a203-413e-94f5-81644472b7e4', 'f7878447-4ae2-46ee-bb63-a839d221b0b4', 'subscription', 'Account Approved! 🎉', 'Your banaoo.io account has been approved. You can now choose a plan and start managing your restaurant.', 'false', '/select-plan', '2026-03-29 12:16:30.654995+00'),
	('ca51d4bf-337f-4ad9-a420-1245b646d86d', 'd2df722f-bf2b-4d58-aeaa-91e6ad0f6948', 'subscription', 'Account Approved! 🎉', 'Your banaoo.io account has been approved. You can now choose a plan and start managing your restaurant.', 'false', '/select-plan', '2026-03-31 01:10:39.138182+00'),
	('cf3af89f-b685-48cb-a42b-0a45c1f00944', 'aa0249e8-381f-4133-8981-92f134063ede', 'subscription', 'Account Approved! 🎉', 'Your banaoo.io account has been approved. You can now choose a plan and start managing your restaurant.', 'false', '/select-plan', '2026-04-05 19:22:52.915335+00'),
	('f48c712c-779d-4654-bb7f-80a5923beac9', '2dbe5495-8e7a-438e-9e28-0c4fcc1e2652', 'subscription', 'Account Approved! 🎉', 'Your banaoo.io account has been approved. You can now choose a plan and start managing your restaurant.', 'false', '/select-plan', '2026-03-29 14:51:21.657003+00'),
	('ffa2174c-7cd7-4c56-acdf-3e32a31b42d5', '6d174952-8430-448d-99f1-765891a1ac38', 'subscription', 'Account Approved! 🎉', 'Your banaoo.io account has been approved. You can now choose a plan and start managing your restaurant.', 'false', '/select-plan', '2026-04-06 09:32:02.753843+00');

-- Dumping structure for table public.order_items
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
	PRIMARY KEY ("id"),
	CONSTRAINT "order_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
	CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);

-- Dumping data for table public.order_items: -1 rows
INSERT INTO "order_items" ("id", "order_id", "menu_item_id", "item_name", "quantity", "unit_price", "total_price", "notes", "created_at") VALUES
	('20e752d0-7b74-4ca5-ac3a-960c6f984f5d', 'b4c1a7ea-d639-41f9-9fd6-387ff1b2454c', 'dc51b7ec-ba19-43b0-bc6f-7763dbf5ce96', 'panner tikka', 3, 456, 1368, NULL, '2026-03-30 21:13:32.868974+00'),
	('3df07128-dc1b-42ec-b66e-9715ffe632a5', '40d9f865-4ef0-49d9-b4b5-360430b8b9ed', '830cba72-38e7-4a33-a2db-502fc4474db2', 'French Fries', 1, 15, 15, NULL, '2026-04-11 07:09:04.187115+00'),
	('4db32841-0037-42eb-9845-2360e8960b03', 'ccc3a1e9-f8d8-4bc7-b155-f0f8b290141b', '1a774ff9-2816-45e1-a249-6b10c4bbfc54', 'Cheese Sandwich', 1, 22, 22, NULL, '2026-04-11 07:14:56.070174+00'),
	('67500d01-3f1d-41aa-be8e-b17f95d63bcd', 'ccc3a1e9-f8d8-4bc7-b155-f0f8b290141b', 'bcb6a598-c559-446d-8ce1-a162104e20b2', 'Fruit Salad', 1, 13, 13, NULL, '2026-04-11 07:14:56.070174+00'),
	('6c4ed712-ce75-42e3-8e7b-3cf44c0ce5a6', '40d9f865-4ef0-49d9-b4b5-360430b8b9ed', 'd1e2c54f-1fcd-43c4-b483-0334cb9c36e2', 'Cocktails', 1, 12, 12, NULL, '2026-04-11 07:09:04.187115+00'),
	('91693f18-75ee-47f7-b88e-d3c70058fec7', '40d9f865-4ef0-49d9-b4b5-360430b8b9ed', 'e5d25e07-eeeb-4b80-9bd6-b819db4ca4fd', 'Chicken Burgers', 1, 24, 24, NULL, '2026-04-11 07:09:04.187115+00'),
	('92869169-84f3-4f15-aa9d-8910231708c3', '40d9f865-4ef0-49d9-b4b5-360430b8b9ed', 'f0e841c0-2ecb-4644-a331-58b6797fb4b1', 'Cheeseburger', 1, 34, 34, NULL, '2026-04-11 07:09:04.187115+00'),
	('97574466-0828-4076-895b-2fd8631c06ac', 'ccc3a1e9-f8d8-4bc7-b155-f0f8b290141b', 'f0e841c0-2ecb-4644-a331-58b6797fb4b1', 'Cheeseburger', 1, 34, 34, NULL, '2026-04-11 07:14:56.070174+00'),
	('989b2f75-4651-47d1-b275-40ce61086407', 'ccc3a1e9-f8d8-4bc7-b155-f0f8b290141b', 'd1e2c54f-1fcd-43c4-b483-0334cb9c36e2', 'Cocktails', 1, 12, 12, NULL, '2026-04-11 07:14:56.070174+00'),
	('aa393315-aa6a-4b13-b57c-98ee18411178', 'ccc3a1e9-f8d8-4bc7-b155-f0f8b290141b', 'e5d25e07-eeeb-4b80-9bd6-b819db4ca4fd', 'Chicken Burgers', 1, 24, 24, NULL, '2026-04-11 07:14:56.070174+00'),
	('c4ae29fc-dc97-4c34-a12e-8416287b9ae7', 'ccc3a1e9-f8d8-4bc7-b155-f0f8b290141b', '830cba72-38e7-4a33-a2db-502fc4474db2', 'French Fries', 1, 15, 15, NULL, '2026-04-11 07:14:56.070174+00'),
	('e39f5b4a-eff5-4a0e-8038-ebadfda0a172', '40d9f865-4ef0-49d9-b4b5-360430b8b9ed', '1a774ff9-2816-45e1-a249-6b10c4bbfc54', 'Cheese Sandwich', 1, 22, 22, NULL, '2026-04-11 07:09:04.187115+00'),
	('f05cc250-29e9-447f-aaf9-8f12886c5ed1', '4e7a7e7f-2942-4e9c-bc88-f7f3d40af177', 'dc51b7ec-ba19-43b0-bc6f-7763dbf5ce96', 'panner tikka', 1, 456, 456, NULL, '2026-03-30 21:11:53.105975+00');

-- Dumping structure for table public.orders
CREATE TABLE IF NOT EXISTS "orders" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"order_number" TEXT NOT NULL,
	"outlet_id" UUID NOT NULL,
	"status" TEXT NOT NULL DEFAULT 'pending',
	"order_type" TEXT NOT NULL DEFAULT 'dine_in',
	"table_number" TEXT NULL DEFAULT NULL,
	"subtotal" NUMERIC NOT NULL DEFAULT 0,
	"total" NUMERIC NOT NULL DEFAULT 0,
	"notes" TEXT NULL DEFAULT NULL,
	"created_by" UUID NULL DEFAULT NULL,
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
	"updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
	"source" TEXT NOT NULL DEFAULT 'pos',
	"external_order_id" TEXT NULL DEFAULT NULL,
	"platform_data" JSONB NULL DEFAULT '{}',
	"customer_name" TEXT NULL DEFAULT NULL,
	"customer_phone" TEXT NULL DEFAULT NULL,
	"delivery_address" TEXT NULL DEFAULT NULL,
	"delivery_status" TEXT NULL DEFAULT NULL,
	PRIMARY KEY ("id"),
	CONSTRAINT "orders_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
)
CREATE INDEX "idx_orders_source" ON "" ("source");
CREATE INDEX "idx_orders_external_order_id" ON "" ("external_order_id");;

-- Dumping data for table public.orders: -1 rows
INSERT INTO "orders" ("id", "order_number", "outlet_id", "status", "order_type", "table_number", "subtotal", "total", "notes", "created_by", "created_at", "updated_at", "source", "external_order_id", "platform_data", "customer_name", "customer_phone", "delivery_address", "delivery_status") VALUES
	('40d9f865-4ef0-49d9-b4b5-360430b8b9ed', '1775891344017', '7524750f-332c-4d0b-aa9d-956d950e2e1c', 'pending', 'dine_in', 'T1', 107, 107, NULL, '235a080f-85cf-4ed4-8685-1eaf546fed66', '2026-04-11 07:09:04.110859+00', '2026-04-11 07:09:04.110859+00', 'pos', NULL, '{}', NULL, NULL, NULL, NULL),
	('4e7a7e7f-2942-4e9c-bc88-f7f3d40af177', '1774905113085', '7524750f-332c-4d0b-aa9d-956d950e2e1c', 'pending', 'takeaway', NULL, 456, 456, NULL, '235a080f-85cf-4ed4-8685-1eaf546fed66', '2026-03-30 21:11:52.993965+00', '2026-03-30 21:11:52.993965+00', 'pos', NULL, '{}', NULL, NULL, NULL, NULL),
	('b4c1a7ea-d639-41f9-9fd6-387ff1b2454c', '1774905212897', '7524750f-332c-4d0b-aa9d-956d950e2e1c', 'pending', 'dine_in', 'T1', 1368, 1368, NULL, '235a080f-85cf-4ed4-8685-1eaf546fed66', '2026-03-30 21:13:32.756083+00', '2026-03-30 21:13:32.756083+00', 'pos', NULL, '{}', NULL, NULL, NULL, NULL),
	('ccc3a1e9-f8d8-4bc7-b155-f0f8b290141b', '1775891695908', '7524750f-332c-4d0b-aa9d-956d950e2e1c', 'pending', 'dine_in', 'T1', 120, 120, NULL, '235a080f-85cf-4ed4-8685-1eaf546fed66', '2026-04-11 07:14:55.999624+00', '2026-04-11 07:14:55.999624+00', 'pos', NULL, '{}', NULL, NULL, NULL, NULL);

-- Dumping structure for table public.outlets
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
	PRIMARY KEY ("id"),
	CONSTRAINT "outlets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);

-- Dumping data for table public.outlets: -1 rows
INSERT INTO "outlets" ("id", "owner_id", "name", "address", "phone", "opening_time", "closing_time", "is_active", "created_at", "updated_at", "latitude", "longitude") VALUES
	('15e7c6c6-4a13-4075-8529-b43166490d01', '0cae5721-724f-41a8-804c-bdb0601b54c6', 'ammas kitchen', 'Hyderabad', '+917799846684', NULL, NULL, 'true', '2026-03-30 17:59:18.08526+00', '2026-03-30 17:59:18.08526+00', NULL, NULL),
	('191ecbf4-9097-4c67-9d52-567c03f99d84', '235a080f-85cf-4ed4-8685-1eaf546fed66', 'Dotbotz', 'Hyderabad', '+917799846684', NULL, NULL, 'true', '2026-03-29 10:20:38.618879+00', '2026-03-29 10:20:38.618879+00', NULL, NULL),
	('448edbcd-5274-4b71-a847-4a91edfeaeb3', '235a080f-85cf-4ed4-8685-1eaf546fed66', 'Harshini', 'Hyderabad', '7799846684', NULL, NULL, 'true', '2026-04-11 06:53:58.761464+00', '2026-04-11 06:53:58.761464+00', NULL, NULL),
	('5a84b7dc-eca3-4a6c-954d-4f5cccbfb63e', '328e18d3-24c3-4716-89be-3fe5c94f40b1', 'Savera', 'Hyderabad', '8971690163', NULL, NULL, 'true', '2026-04-03 12:07:44.747945+00', '2026-04-03 12:07:44.747945+00', NULL, NULL),
	('7524750f-332c-4d0b-aa9d-956d950e2e1c', '235a080f-85cf-4ed4-8685-1eaf546fed66', 'main branch', 'tenali', '6301019935', NULL, NULL, 'true', '2026-03-30 20:39:35.294231+00', '2026-03-30 20:39:35.294231+00', NULL, NULL),
	('87380f31-a2ec-42c1-a06d-bbb9539cde06', '8bd4ffde-fbfd-4ddd-9d0d-fdbd7dba419f', '9 amma', NULL, '7093142725', NULL, NULL, 'true', '2026-04-01 17:42:51.109241+00', '2026-04-01 17:42:51.109241+00', NULL, NULL),
	('c1be311f-e30c-4e11-b173-e393f2155594', '6d174952-8430-448d-99f1-765891a1ac38', 'Sunrise Restaurant', 'Porumamilla', '9444439240', NULL, NULL, 'true', '2026-04-06 09:33:59.043668+00', '2026-04-06 09:33:59.043668+00', NULL, NULL),
	('d776e4e4-4e69-4d69-b796-9c8018fc898d', '235a080f-85cf-4ed4-8685-1eaf546fed66', 'Nakshatra', 'hyderabad', '6301019935', NULL, NULL, 'true', '2026-03-29 20:28:58.247073+00', '2026-03-29 20:28:58.247073+00', NULL, NULL),
	('e6870616-8514-44f4-8008-ff8141fbaf3d', '235a080f-85cf-4ed4-8685-1eaf546fed66', 'NasarOutlet', 'Hyderabad', '6301019935', NULL, NULL, 'true', '2026-04-11 20:22:19.118468+00', '2026-04-11 20:22:19.118468+00', NULL, NULL),
	('fe9adce2-5d31-4523-b788-0b624a9ce3a7', 'c019bea6-a9c7-4afe-9db6-5e6ae87f6e21', 'Sri Restaurant', 'Hyderabad', '7799846684', NULL, NULL, 'true', '2026-04-05 12:22:19.030809+00', '2026-04-05 12:22:19.030809+00', NULL, NULL);

-- Dumping structure for table public.platform_integrations
CREATE TABLE IF NOT EXISTS "platform_integrations" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"outlet_id" UUID NOT NULL,
	"platform" TEXT NOT NULL,
	"credentials" JSONB NULL DEFAULT '{}',
	"settings" JSONB NULL DEFAULT '{}',
	"is_active" BOOLEAN NOT NULL DEFAULT false,
	"status" TEXT NOT NULL DEFAULT 'disconnected',
	"last_synced_at" TIMESTAMPTZ NULL DEFAULT NULL,
	"webhook_url" TEXT NULL DEFAULT NULL,
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
	"updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
	PRIMARY KEY ("id"),
	UNIQUE ("outlet_id", "platform"),
	CONSTRAINT "platform_integrations_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
)
CREATE INDEX "idx_platform_integrations_outlet" ON "" ("outlet_id");;

-- Dumping data for table public.platform_integrations: -1 rows

-- Dumping structure for table public.platform_sync_logs
CREATE TABLE IF NOT EXISTS "platform_sync_logs" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"integration_id" UUID NOT NULL,
	"action" TEXT NOT NULL,
	"status" TEXT NOT NULL DEFAULT 'pending',
	"request_data" JSONB NULL DEFAULT NULL,
	"response_data" JSONB NULL DEFAULT NULL,
	"error_message" TEXT NULL DEFAULT NULL,
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
	PRIMARY KEY ("id"),
	CONSTRAINT "platform_sync_logs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "platform_integrations" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
)
CREATE INDEX "idx_platform_sync_logs_integration" ON "" ("integration_id");;

-- Dumping data for table public.platform_sync_logs: -1 rows

-- Dumping structure for table public.profiles
CREATE TABLE IF NOT EXISTS "profiles" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"user_id" UUID NOT NULL,
	"full_name" TEXT NOT NULL,
	"role" TEXT NOT NULL,
	"pin_code" TEXT NULL DEFAULT NULL,
	"phone" TEXT NULL DEFAULT NULL,
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
	"updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
	"business_type" TEXT NULL DEFAULT NULL,
	"onboarding_completed" BOOLEAN NOT NULL DEFAULT false,
	"ordering_slug" TEXT NULL DEFAULT NULL,
	"brand_name" TEXT NULL DEFAULT NULL,
	"logo_url" TEXT NULL DEFAULT NULL,
	"brand_color" TEXT NULL DEFAULT NULL,
	"app_theme" TEXT NOT NULL DEFAULT 'light',
	"account_status" TEXT NOT NULL DEFAULT 'pending',
	"is_admin" BOOLEAN NOT NULL DEFAULT false,
	PRIMARY KEY ("id"),
	UNIQUE ("ordering_slug"),
	UNIQUE ("user_id"),
	CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
CREATE INDEX "profiles_ordering_slug_idx" ON "profiles" ("ordering_slug");
CREATE INDEX "idx_profiles_account_status" ON "profiles" ("account_status");

-- Dumping data for table public.profiles: 16 rows
INSERT INTO "profiles" ("id", "user_id", "full_name", "role", "pin_code", "phone", "created_at", "updated_at", "business_type", "onboarding_completed", "ordering_slug", "brand_name", "logo_url", "brand_color", "app_theme", "account_status", "is_admin") VALUES
	('058dbc1c-50d3-464b-a5a0-e0f7df0cdd0b', '2dbe5495-8e7a-438e-9e28-0c4fcc1e2652', 'allprodx', 'owner', NULL, NULL, '2026-03-29 11:40:54.320647+00', '2026-03-29 11:40:54.320647+00', NULL, 'false', NULL, NULL, NULL, NULL, 'light', 'approved', 'false'),
	('0cb6e0c0-00f6-4008-adff-c04079f15cec', '4388bec4-2a8c-4a51-b189-6e8319ee0d37', 'nihal', 'owner', NULL, NULL, '2026-03-29 12:21:37.313237+00', '2026-03-29 12:21:37.313237+00', NULL, 'true', NULL, NULL, NULL, NULL, 'light', 'approved', 'false'),
	('18cf61da-53d6-4b85-aae5-897280a9decb', 'aa377d13-8cf6-41c0-a814-1c99397344b8', 'likith sai', 'owner', NULL, NULL, '2026-04-11 04:17:35.449192+00', '2026-04-11 04:17:35.449192+00', NULL, 'false', NULL, NULL, NULL, NULL, 'light', 'pending', 'false'),
	('3b894776-0d5c-4e98-bfa0-1699b69eaca2', '75e4f577-b26b-4b36-ba85-f69a0554d117', 'allprodx', 'owner', NULL, NULL, '2026-03-29 12:42:06.966138+00', '2026-03-29 12:42:06.966138+00', NULL, 'false', NULL, NULL, NULL, NULL, 'light', 'approved', 'false'),
	('40354fc1-9823-4f93-9b1d-dca095d42d01', 'c019bea6-a9c7-4afe-9db6-5e6ae87f6e21', 'sanjeev', 'owner', NULL, NULL, '2026-03-29 14:50:25.373746+00', '2026-03-29 14:50:25.373746+00', NULL, 'true', NULL, NULL, NULL, NULL, 'light', 'approved', 'false'),
	('412fc75f-883e-453b-9079-c085e8e05097', '235a080f-85cf-4ed4-8685-1eaf546fed66', 'krackbot studio', 'owner', NULL, NULL, '2026-03-29 10:18:42.817781+00', '2026-03-29 10:20:38.398931+00', 'restaurant', 'true', 'dotbotz-bjyd', 'Spice Restaurant', '/uploads/1774907690887-705565393.png', '#f97316', 'light', 'approved', 'true'),
	('566bf241-7093-4a4d-8b64-f452fa5cbeed', 'd61c616e-ff7a-4679-9ac8-afff1950f75d', 'XGoo Development', 'owner', NULL, NULL, '2026-03-29 11:23:39.513534+00', '2026-03-29 11:23:39.513534+00', NULL, 'false', NULL, NULL, NULL, NULL, 'light', 'approved', 'false'),
	('66772434-4a78-4d4b-94f4-d6371ddbddc0', '0cae5721-724f-41a8-804c-bdb0601b54c6', 'shiva', 'owner', NULL, '+917799846684', '2026-03-30 09:48:20.134321+00', '2026-03-30 09:48:20.134321+00', 'restaurant', 'true', 'ammas-kitchen-0jhv', 'ammas kitchen', NULL, NULL, 'light', 'approved', 'false'),
	('6cac4b83-4503-4e5d-90aa-7c7c8b0668d7', 'f7878447-4ae2-46ee-bb63-a839d221b0b4', 'Harshini Singari', 'owner', NULL, NULL, '2026-03-29 12:00:10.06854+00', '2026-03-29 12:00:10.06854+00', NULL, 'false', NULL, NULL, NULL, NULL, 'light', 'approved', 'false'),
	('78dc7581-ee8a-42fc-a692-49df4ad18bc6', '74952a80-6e9d-4989-b4c2-ea7aba1337f7', 'mallapuram navya', 'owner', NULL, NULL, '2026-03-30 20:18:42.266483+00', '2026-03-30 20:18:42.266483+00', NULL, 'false', NULL, NULL, NULL, NULL, 'light', 'pending', 'false'),
	('7f7a5bb1-c365-41c4-a886-068beb444e7b', '8bd4ffde-fbfd-4ddd-9d0d-fdbd7dba419f', 'Niharika ', 'owner', NULL, '7093142725', '2026-04-01 17:24:38.570871+00', '2026-04-01 17:24:38.570871+00', 'restaurant', 'true', '9-amma-3lr1', '9 amma', NULL, NULL, 'light', 'approved', 'false'),
	('8519d0b9-de44-49df-8db3-f33691f9f28d', 'eea45908-c633-4add-aca4-3d4bdb3bab22', 'krishnamurthy', 'owner', NULL, NULL, '2026-03-29 13:03:01.918018+00', '2026-03-29 13:03:01.918018+00', NULL, 'true', NULL, NULL, NULL, NULL, 'light', 'approved', 'false'),
	('97dbaed0-dff4-4294-8ae5-c12ed4e046d9', '328e18d3-24c3-4716-89be-3fe5c94f40b1', 'karthik burra', 'owner', NULL, '8971690163', '2026-04-03 12:05:56.496199+00', '2026-04-03 12:05:56.496199+00', 'bar', 'true', 'savera-ebgd', 'Savera', NULL, NULL, 'light', 'approved', 'false'),
	('9c5c10cf-ea80-4486-a7cc-86fb99ac467d', '6d174952-8430-448d-99f1-765891a1ac38', 'Ramana', 'owner', NULL, '9444439240', '2026-04-06 09:27:00.797902+00', '2026-04-06 09:27:00.797902+00', 'restaurant', 'true', 'sunrise-restaurant-koqc', 'Sunrise Restaurant', '/uploads/1775469004392-932172974.png', NULL, 'light', 'approved', 'false'),
	('a7203c34-f7b3-4984-8902-338676638ccd', 'd2df722f-bf2b-4d58-aeaa-91e6ad0f6948', 'Test mail', 'owner', NULL, NULL, '2026-03-31 00:59:03.691765+00', '2026-03-31 00:59:03.691765+00', NULL, 'false', NULL, NULL, NULL, NULL, 'light', 'approved', 'false'),
	('c91a6db8-6e2f-4c5a-977e-9f3b046562d7', 'bae4ef3a-ef25-4b62-a743-6122b8953c99', 'nandini', 'owner', NULL, NULL, '2026-03-30 20:17:13.877703+00', '2026-03-30 20:17:13.877703+00', NULL, 'false', NULL, NULL, NULL, NULL, 'light', 'pending', 'false'),
	('cc7ac0a9-c42e-4631-be69-36b6cf30eadd', 'aa0249e8-381f-4133-8981-92f134063ede', 'Navya', 'owner', NULL, '06301019935', '2026-04-05 19:20:37.802981+00', '2026-04-05 19:20:37.802981+00', NULL, 'false', NULL, NULL, NULL, NULL, 'light', 'approved', 'false'),
	('dadaf5ff-6e14-4c05-bd28-d41d65bd2b2f', '20327e5a-0473-4bdc-bfbc-e75ea050f147', 'nakshatra', 'owner', NULL, NULL, '2026-03-29 12:48:54.940747+00', '2026-03-29 12:48:54.940747+00', NULL, 'true', NULL, NULL, NULL, NULL, 'light', 'approved', 'false'),
	('f2cbf09f-6d13-41cd-8076-75f6f2ab19c2', '0edefb48-ec9f-456f-bcfb-64f3bea2b140', 'Test User', 'owner', NULL, NULL, '2026-03-29 20:13:04.0567+00', '2026-03-29 20:13:04.0567+00', NULL, 'false', NULL, NULL, NULL, NULL, 'light', 'approved', 'false');

-- Dumping structure for table public.restaurant_tables
CREATE TABLE IF NOT EXISTS "restaurant_tables" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"outlet_id" UUID NOT NULL,
	"table_number" TEXT NOT NULL,
	"shape" TEXT NOT NULL DEFAULT 'square',
	"seats" INTEGER NOT NULL DEFAULT 4,
	"x_position" NUMERIC NOT NULL DEFAULT 50,
	"y_position" NUMERIC NOT NULL DEFAULT 50,
	"width" NUMERIC NOT NULL DEFAULT 10,
	"height" NUMERIC NOT NULL DEFAULT 10,
	"rotation" INTEGER NOT NULL DEFAULT 0,
	"status" TEXT NOT NULL DEFAULT 'available',
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
	"updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
	"zone" TEXT NOT NULL DEFAULT 'indoor',
	"current_customer_name" TEXT NULL DEFAULT NULL,
	"reserved_time" TIMESTAMPTZ NULL DEFAULT NULL,
	"party_size" INTEGER NULL DEFAULT NULL,
	PRIMARY KEY ("id"),
	CONSTRAINT "restaurant_tables_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
)
CREATE INDEX "idx_restaurant_tables_outlet" ON "" ("outlet_id");;

-- Dumping data for table public.restaurant_tables: -1 rows
INSERT INTO "restaurant_tables" ("id", "outlet_id", "table_number", "shape", "seats", "x_position", "y_position", "width", "height", "rotation", "status", "created_at", "updated_at", "zone", "current_customer_name", "reserved_time", "party_size") VALUES
	('06840bd4-f03e-4290-bd15-a1db39acfe4f', 'd776e4e4-4e69-4d69-b796-9c8018fc898d', 'T1', 'square', 4, 20.34198113207547, 20.943396226415096, 12, 12, 0, 'available', '2026-03-29 21:26:04.16706+00', '2026-03-29 21:26:04.16706+00', 'Indoor', NULL, NULL, NULL),
	('318b8860-422f-4d35-8c18-91354c6f9aa5', 'fe9adce2-5d31-4523-b788-0b624a9ce3a7', 'T3', 'rectangle', 4, 44.76102941176471, 19.411764705882355, 12, 12, 0, 'available', '2026-04-05 12:22:34.824214+00', '2026-04-05 12:22:34.824214+00', 'Indoor', NULL, NULL, NULL),
	('790e4f42-0619-4e73-bd8e-6058dc6a6088', '7524750f-332c-4d0b-aa9d-956d950e2e1c', 'T1', 'rectangle', 4, 49.764150943396224, 51.886792452830186, 12, 12, 0, 'available', '2026-03-30 21:13:10.93004+00', '2026-03-30 21:13:10.93004+00', 'Indoor', NULL, NULL, NULL),
	('b4b33d37-dfc9-40f2-99f9-ee850585ea62', 'fe9adce2-5d31-4523-b788-0b624a9ce3a7', 'T2', 'round', 4, 27.113970588235293, 20, 12, 12, 0, 'available', '2026-04-05 12:22:33.524105+00', '2026-04-05 12:22:33.524105+00', 'Indoor', NULL, NULL, NULL),
	('facc84ba-baaf-4bb3-8ae7-7143c9e07d4f', 'fe9adce2-5d31-4523-b788-0b624a9ce3a7', 'T1', 'square', 4, 9.099264705882353, 20.294117647058822, 12, 12, 0, 'available', '2026-04-05 12:22:28.63226+00', '2026-04-05 12:22:28.63226+00', 'Indoor', NULL, NULL, NULL);

-- Dumping structure for table public.saved_menus
CREATE TABLE IF NOT EXISTS "saved_menus" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"user_id" UUID NOT NULL,
	"slug" TEXT NOT NULL,
	"restaurant_name" TEXT NOT NULL,
	"tagline" TEXT NULL DEFAULT NULL,
	"logo_url" TEXT NULL DEFAULT NULL,
	"currency" TEXT NULL DEFAULT '₹',
	"menu_data" JSONB NOT NULL,
	"is_published" BOOLEAN NULL DEFAULT true,
	"views_count" INTEGER NULL DEFAULT 0,
	"created_at" TIMESTAMPTZ NULL DEFAULT now(),
	"updated_at" TIMESTAMPTZ NULL DEFAULT now(),
	PRIMARY KEY ("id"),
	UNIQUE ("slug")
);

-- Dumping data for table public.saved_menus: -1 rows

-- Dumping structure for function public.seed_sample_data_for_user
DELIMITER //
CREATE FUNCTION "seed_sample_data_for_user"() RETURNS UNKNOWN AS $$ 
DECLARE
  new_outlet_id uuid;
  cat_starters_id uuid;
  cat_main_id uuid;
  cat_breads_id uuid;
  cat_beverages_id uuid;
  cat_desserts_id uuid;
BEGIN
  -- Only seed for owner role
  IF NEW.role != 'owner' THEN
    RETURN NEW;
  END IF;

  -- Create sample outlet
  INSERT INTO public.outlets (name, address, phone, owner_id)
  VALUES ('My Restaurant', '123 Main Street, City Center', '+91 98765 43210', NEW.user_id)
  RETURNING id INTO new_outlet_id;

  -- Create categories
  INSERT INTO public.menu_categories (name, outlet_id, sort_order) 
  VALUES ('Starters', new_outlet_id, 1) RETURNING id INTO cat_starters_id;

  INSERT INTO public.menu_categories (name, outlet_id, sort_order) 
  VALUES ('Main Course', new_outlet_id, 2) RETURNING id INTO cat_main_id;

  INSERT INTO public.menu_categories (name, outlet_id, sort_order) 
  VALUES ('Breads', new_outlet_id, 3) RETURNING id INTO cat_breads_id;

  INSERT INTO public.menu_categories (name, outlet_id, sort_order) 
  VALUES ('Beverages', new_outlet_id, 4) RETURNING id INTO cat_beverages_id;

  INSERT INTO public.menu_categories (name, outlet_id, sort_order) 
  VALUES ('Desserts', new_outlet_id, 5) RETURNING id INTO cat_desserts_id;

  -- Create sample menu items
  INSERT INTO public.menu_items 
  (name, description, base_price, is_veg, category_id, outlet_id, image_url) 
  VALUES
  ('Paneer Tikka', 'Marinated cottage cheese grilled to perfection with spices', 280, true, cat_starters_id, new_outlet_id, 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400'),
  ('Chicken 65', 'Crispy fried chicken with South Indian spices', 320, false, cat_starters_id, new_outlet_id, 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=400'),
  ('Veg Spring Rolls', 'Crispy rolls filled with mixed vegetables', 180, true, cat_starters_id, new_outlet_id, 'https://images.unsplash.com/photo-154850720082c3fb8d89eb5e62b9f65?w=400'),
  ('Dal Makhani', 'Creamy black lentils slow-cooked overnight', 240, true, cat_main_id, new_outlet_id, 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400'),
  ('Butter Chicken', 'Tender chicken in rich tomato-butter gravy', 340, false, cat_main_id, new_outlet_id, 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400'),
  ('Palak Paneer', 'Cottage cheese cubes in creamy spinach gravy', 260, true, cat_main_id, new_outlet_id, 'https://images.unsplash.com/photo-1618449840665-9ed506d73a34?w=400'),
  ('Butter Naan', 'Soft leavened bread brushed with butter', 45, true, cat_breads_id, new_outlet_id, 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=400'),
  ('Garlic Naan', 'Naan topped with fresh garlic and herbs', 55, true, cat_breads_id, new_outlet_id, 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=400'),
  ('Tandoori Roti', 'Whole wheat bread baked in tandoor', 30, true, cat_breads_id, new_outlet_id, 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400'),
  ('Mango Lassi', 'Sweet yogurt drink blended with mango', 90, true, cat_beverages_id, new_outlet_id, 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=400'),
  ('Masala Chai', 'Traditional spiced Indian tea', 40, true, cat_beverages_id, new_outlet_id, 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=400'),
  ('Fresh Lime Soda', 'Refreshing lime drink with soda', 60, true, cat_beverages_id, new_outlet_id, 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=400'),
  ('Gulab Jamun', 'Deep-fried milk dumplings in sugar syrup', 100, true, cat_desserts_id, new_outlet_id, 'https://images.unsplash.com/photo-1666190050245-e8c4b5b0e5b5?w=400'),
  ('Rasmalai', 'Soft cottage cheese patties in sweet milk', 120, true, cat_desserts_id, new_outlet_id, 'https://images.unsplash.com/photo-1601303516534-2e5c2e94eb8d?w=400');

  RETURN NEW;
END;
 $$//
DELIMITER ;

-- Dumping structure for table public.session
CREATE TABLE IF NOT EXISTS "session" (
	"sid" VARCHAR NOT NULL,
	"sess" JSON NOT NULL,
	"expire" TIMESTAMP NOT NULL,
	PRIMARY KEY ("sid")
)
CREATE INDEX "IX_session_expire" ON "" ("expire");;

-- Dumping data for table public.session: 59 rows
INSERT INTO "session" ("sid", "sess", "expire") VALUES
	('1sH6vaHFLb5IqvbjP34rbCFrzsyEuj6y', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T13:50:04.334Z","secure":true,"httpOnly":true,"path":"/","sameSite":"lax"}}', '2026-04-29 13:50:05'),
	('2frFrIXEd3I4rVaiienVQlHEkA22w95P', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T20:17:13.884Z","secure":true,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"bae4ef3a-ef25-4b62-a743-6122b8953c99"}}', '2026-04-29 20:17:24'),
	('3QGhyse74cVPDyAye1dKqEGsWW9GSpYi', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-05-11T04:17:35.473Z","secure":true,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"aa377d13-8cf6-41c0-a814-1c99397344b8"}}', '2026-05-14 12:03:00'),
	('7dU7KMTSVZwhlZpdw4t39ZxzEpuvjJt8', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T13:55:35.895Z","secure":true,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"20327e5a-0473-4bdc-bfbc-e75ea050f147"}}', '2026-04-29 13:55:36'),
	('9l-IDlgOZPTGMWNwutxGnZaoqRtFnzQB', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-05-11T06:52:54.399Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"235a080f-85cf-4ed4-8685-1eaf546fed66"}}', '2026-05-14 16:11:20'),
	('AG84cMrFnplNDlXK4GcTwc3mR49Nr8CY', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-05-08T12:58:33.641Z","secure":true,"httpOnly":true,"path":"/","sameSite":"lax"}}', '2026-05-08 12:58:34'),
	('ah0XGmldO3-UH1x0Wmj5O3VM2Ay17MUE', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T21:13:48.681Z","secure":true,"httpOnly":true,"path":"/","sameSite":"lax"}}', '2026-04-29 21:13:49'),
	('ajeZn6ewM1XgrfEWbzRaTrV5W6W5sb74', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-05-14T16:21:48.878Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"c019bea6-a9c7-4afe-9db6-5e6ae87f6e21"}}', '2026-05-14 16:22:05'),
	('aP9ArBbdzo-sm7GAZc6X0J-COx-RQLs5', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T13:32:02.074Z","secure":true,"httpOnly":true,"path":"/","sameSite":"none"},"passport":{"user":"235a080f-85cf-4ed4-8685-1eaf546fed66"}}', '2026-04-29 13:32:03'),
	('Bi02o-BkCggApfeh5A1Q4Q9kDjlmgjvm', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T13:51:16.311Z","secure":true,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"235a080f-85cf-4ed4-8685-1eaf546fed66"}}', '2026-04-29 13:51:17'),
	('bs2DFcFgVK2GqQNZVBDv1ShQ5QF9AM7t', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-28T11:29:08.568Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"235a080f-85cf-4ed4-8685-1eaf546fed66"}}', '2026-04-28 11:29:10'),
	('CPa7zP8qLxmWCflEIMdQ-oHP3wf4A-Jb', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-05-05T19:33:21.768Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"235a080f-85cf-4ed4-8685-1eaf546fed66"}}', '2026-05-15 06:56:43'),
	('Ds2fJJfGCN2XmUpeQdsNuF18_bGvuhDl', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T20:37:41.916Z","secure":true,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"235a080f-85cf-4ed4-8685-1eaf546fed66"}}', '2026-04-29 20:39:39'),
	('dxLFEp0F2CXHxwXSiptM3o0YvFZ3qsP7', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-28T12:00:09.746Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"f7878447-4ae2-46ee-bb63-a839d221b0b4"}}', '2026-04-28 14:55:48'),
	('D-xUaSBkV5bttZ48hwPKKo8TKzfaCttP', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-05-05T03:54:54.510Z","secure":true,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"328e18d3-24c3-4716-89be-3fe5c94f40b1"}}', '2026-05-09 12:04:26'),
	('e8_qQKjukGRjnlurQP-vrd02KMAC0r3q', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T13:33:51.970Z","secure":true,"httpOnly":true,"path":"/","sameSite":"none"},"passport":{"user":"20327e5a-0473-4bdc-bfbc-e75ea050f147"}}', '2026-04-29 13:33:52'),
	('emcCye0lLGvYvZDI3o55DiAPlZrWiivL', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-05-16T02:01:23.217Z","secure":true,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"235a080f-85cf-4ed4-8685-1eaf546fed66"}}', '2026-05-16 02:05:28'),
	('Eshw97ojHTEKibXSUiv6WPNKDjlS16OA', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-28T20:15:53.589Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"0edefb48-ec9f-456f-bcfb-64f3bea2b140"}}', '2026-04-28 20:16:35'),
	('f5sf9FJZxMTfUYomaUmaXzGf7ufPVsI4', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-28T12:49:21.027Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"2dbe5495-8e7a-438e-9e28-0c4fcc1e2652"}}', '2026-04-28 14:55:48'),
	('FDoOgHp_Th9kjUjvBJV8OoF6SpoSF7EO', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T13:50:31.289Z","secure":true,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"20327e5a-0473-4bdc-bfbc-e75ea050f147"}}', '2026-04-29 13:50:32'),
	('GbtIFJ0Rr1R4xRblpRUHkL5dUDXB6kkn', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T13:33:25.259Z","secure":true,"httpOnly":true,"path":"/","sameSite":"none"},"passport":{"user":"235a080f-85cf-4ed4-8685-1eaf546fed66"}}', '2026-04-29 13:33:26'),
	('gloGrYYWqR9xVwoACaLSUcbySRRN98q5', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T13:31:26.532Z","secure":true,"httpOnly":true,"path":"/","sameSite":"none"},"passport":{"user":"235a080f-85cf-4ed4-8685-1eaf546fed66"}}', '2026-04-29 13:31:27'),
	('IrjL9W1W6jiUBSLB5BNypJ_sk-ojO1pb', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-28T11:29:41.873Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"235a080f-85cf-4ed4-8685-1eaf546fed66"}}', '2026-04-28 11:29:43'),
	('IZYqw1jMMREyIdr2TjS7MgLq-hEk6o0x', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T13:50:58.803Z","secure":true,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"20327e5a-0473-4bdc-bfbc-e75ea050f147"}}', '2026-04-29 13:50:59'),
	('J-1BlRuXZZwugFVsSXrVD1ENKDeQuOwE', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-30T05:11:26.366Z","secure":true,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"235a080f-85cf-4ed4-8685-1eaf546fed66"}}', '2026-05-06 07:44:42'),
	('jeNBnhUnYwDj2PPDGDDG68bDDKgEKPKQ', '{"cookie":{"originalMaxAge":2591999999,"expires":"2026-04-28T10:23:12.691Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"235a080f-85cf-4ed4-8685-1eaf546fed66"}}', '2026-04-28 10:23:30'),
	('jPmIXvmnC9BWfFwxf6cSJk8m7CsS281K', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T13:34:25.616Z","secure":true,"httpOnly":true,"path":"/","sameSite":"none"},"passport":{"user":"20327e5a-0473-4bdc-bfbc-e75ea050f147"}}', '2026-04-29 13:34:26'),
	('K4ckgDBfBiiybCI_WdFNIv4S9_VIEHtF', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T09:49:33.582Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"235a080f-85cf-4ed4-8685-1eaf546fed66"}}', '2026-04-29 09:49:54'),
	('_kHtcWIU7Q_Ve5JjWiBC_qHbTg7KXqpc', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T13:35:52.538Z","secure":true,"httpOnly":true,"path":"/","sameSite":"none"},"passport":{"user":"20327e5a-0473-4bdc-bfbc-e75ea050f147"}}', '2026-04-29 13:35:53'),
	('l4p5tzbhrQ-U42bjT6r_7RgXW8EOgn-_', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T13:33:19.061Z","secure":true,"httpOnly":true,"path":"/","sameSite":"none"},"passport":{"user":"235a080f-85cf-4ed4-8685-1eaf546fed66"}}', '2026-04-29 13:33:20'),
	('_lD6Q-KcG7Be4FRAdLttkufCiR3S6yjB', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T14:08:58.830Z","secure":true,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"20327e5a-0473-4bdc-bfbc-e75ea050f147"}}', '2026-04-29 14:08:59'),
	('mJ9-IULdkowuEPt-uAxAWU6qWosuoDMA', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T20:18:55.817Z","secure":true,"httpOnly":true,"path":"/","sameSite":"lax"}}', '2026-04-29 21:17:37'),
	('MjBvAsU0msN3ELrsWRKnenF89KIPFh7i', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T13:33:15.476Z","secure":true,"httpOnly":true,"path":"/","sameSite":"none"},"passport":{"user":"235a080f-85cf-4ed4-8685-1eaf546fed66"}}', '2026-04-29 13:33:16'),
	('mR-hQLGFODD8IyITgpa-hQ4IxAMoZgcV', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T20:06:58.606Z","secure":true,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"235a080f-85cf-4ed4-8685-1eaf546fed66"}}', '2026-04-29 20:06:59'),
	('mrOhoPjcCeccDYzvuiSkhpb6NlMwOEqr', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-28T11:23:39.207Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"d61c616e-ff7a-4679-9ac8-afff1950f75d"}}', '2026-04-28 11:24:42'),
	('mW74_0VJ9v2uYQv1-H2TA-veketVGVkK', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T13:34:02.790Z","secure":true,"httpOnly":true,"path":"/","sameSite":"none"},"passport":{"user":"20327e5a-0473-4bdc-bfbc-e75ea050f147"}}', '2026-04-29 13:34:03'),
	('mxz7YBYSi6obHlPdDCKY9oSX-hnegTMU', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T13:51:11.702Z","secure":true,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"235a080f-85cf-4ed4-8685-1eaf546fed66"}}', '2026-04-29 13:51:12'),
	('OHxC_PDRUM7nBSGDe6BvKmXPMHTs_p2l', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T05:16:53.466Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"20327e5a-0473-4bdc-bfbc-e75ea050f147"}}', '2026-04-29 05:22:53'),
	('OLkuvqDdZO3Me_8lq5W9duN_OLvfEGcc', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-05-06T09:58:30.684Z","secure":true,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"c019bea6-a9c7-4afe-9db6-5e6ae87f6e21"}}', '2026-05-07 06:27:24'),
	('Pgo5-S3VPRjm_YoBIuMotl9G_OERvC3P', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T13:32:22.186Z","secure":true,"httpOnly":true,"path":"/","sameSite":"none"},"passport":{"user":"235a080f-85cf-4ed4-8685-1eaf546fed66"}}', '2026-04-29 13:32:23'),
	('Qs3hUAB8a4NQ1VB-P2-hdHZU5aOEC68h', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T20:06:40.823Z","secure":true,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"235a080f-85cf-4ed4-8685-1eaf546fed66"}}', '2026-04-29 20:06:41'),
	('qXm2qd1J6GfMD_Gq9OhpfKnPN_RSEWmh', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T13:33:04.187Z","secure":true,"httpOnly":true,"path":"/","sameSite":"none"},"passport":{"user":"235a080f-85cf-4ed4-8685-1eaf546fed66"}}', '2026-04-29 13:33:05'),
	('r8HUP5VR33PQSrHzDa9_7WnJCydvZY5T', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-05-06T09:55:39.431Z","secure":true,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"6d174952-8430-448d-99f1-765891a1ac38"}}', '2026-05-06 11:10:10'),
	('rc0faZDgGJ7VsMP0xgHx8LVQkU11DpV7', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T13:34:04.533Z","secure":true,"httpOnly":true,"path":"/","sameSite":"none"},"passport":{"user":"20327e5a-0473-4bdc-bfbc-e75ea050f147"}}', '2026-04-29 13:34:05'),
	('SCmDdybxkGrLortH_t6B0XdfHm82uCuc', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T13:33:30.433Z","secure":true,"httpOnly":true,"path":"/","sameSite":"none"},"passport":{"user":"235a080f-85cf-4ed4-8685-1eaf546fed66"}}', '2026-04-29 13:33:31'),
	('SOjXTekih2R3ZMFjNmfSbdoDT3HoMitF', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T19:09:37.954Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"235a080f-85cf-4ed4-8685-1eaf546fed66"}}', '2026-04-29 19:09:40'),
	('TDm0D1Wi8IR-B5RQYKa6LgfY_o32U-fZ', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-05-01T17:24:38.593Z","secure":true,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"8bd4ffde-fbfd-4ddd-9d0d-fdbd7dba419f"}}', '2026-05-01 17:43:10'),
	('TTL--NoswX0f6N0Ib7GWDyBPM0yEaPP9', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T13:31:28.242Z","secure":true,"httpOnly":true,"path":"/","sameSite":"none"},"passport":{"user":"235a080f-85cf-4ed4-8685-1eaf546fed66"}}', '2026-04-29 13:31:29'),
	('UQKQ1pYhmcMPtBX24nWL3PLO8UZ7OA2t', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T13:31:13.834Z","secure":true,"httpOnly":true,"path":"/","sameSite":"none"},"passport":{"user":"235a080f-85cf-4ed4-8685-1eaf546fed66"}}', '2026-04-29 13:31:14'),
	('UshCa3Gs365X6jUcqVZlk-ZRlTxUhDjP', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T05:10:25.230Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"}}', '2026-04-29 06:11:04'),
	('Vb6AHnxfvqTELRyLyu4bJ_ZMTj4y5G6u', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T13:55:31.505Z","secure":true,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"20327e5a-0473-4bdc-bfbc-e75ea050f147"}}', '2026-04-29 13:55:32'),
	('vqpSszsNyISgU8uwFMdRv3Ok9Nbt3W0r', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T06:12:21.705Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"20327e5a-0473-4bdc-bfbc-e75ea050f147"}}', '2026-04-29 06:20:22'),
	('wCiYMIyNO9EhTao0HKUU3lfxQtlZ4BTM', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-28T10:18:42.107Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"235a080f-85cf-4ed4-8685-1eaf546fed66"}}', '2026-04-28 10:20:39'),
	('wOPykBivt8fI56Nl1pPz8LzEGznMjzrB', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-05-05T19:20:38.414Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"aa0249e8-381f-4133-8981-92f134063ede"}}', '2026-05-05 19:23:05'),
	('xEtuIi_fqa9BRG-o_UKqXSs_48JWgUGn', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T13:31:29.378Z","secure":true,"httpOnly":true,"path":"/","sameSite":"none"},"passport":{"user":"235a080f-85cf-4ed4-8685-1eaf546fed66"}}', '2026-04-29 13:31:30'),
	('xv_ohUcon-tEZm6qoLGpBJ7tN6-doZNW', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T18:02:48.483Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"235a080f-85cf-4ed4-8685-1eaf546fed66"}}', '2026-04-29 18:03:30'),
	('y-qp2lDkKH2LpzpSFAFBkFLnaDB1Q_eM', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T13:52:54.870Z","secure":true,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"20327e5a-0473-4bdc-bfbc-e75ea050f147"}}', '2026-04-29 13:52:55'),
	('ZAe6Ir_bJRoeT8la33WyzbiXgsdOZxCk', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T13:32:18.693Z","secure":true,"httpOnly":true,"path":"/","sameSite":"none"},"passport":{"user":"235a080f-85cf-4ed4-8685-1eaf546fed66"}}', '2026-04-29 13:32:19'),
	('ZUYUzwsq1Q4XyDtnveEZZLwN8ZMUSK2l', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-04-29T22:00:40.025Z","secure":true,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"235a080f-85cf-4ed4-8685-1eaf546fed66"}}', '2026-05-11 06:58:29'),
	('ZVJbniUH_xdhGR_PgNcKRKOtT4eoxXMO', '{"cookie":{"originalMaxAge":2592000000,"expires":"2026-05-16T04:56:50.470Z","secure":true,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"74952a80-6e9d-4989-b4c2-ea7aba1337f7"}}', '2026-05-16 04:56:52');

-- Dumping structure for table public.staff_members
CREATE TABLE IF NOT EXISTS "staff_members" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"owner_id" UUID NOT NULL,
	"full_name" TEXT NOT NULL,
	"phone" TEXT NULL DEFAULT NULL,
	"email" TEXT NULL DEFAULT NULL,
	"role" TEXT NOT NULL DEFAULT 'staff',
	"pin_code" TEXT NULL DEFAULT NULL,
	"is_active" BOOLEAN NOT NULL DEFAULT true,
	"notes" TEXT NULL DEFAULT NULL,
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
	"updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
	"page_permissions" JSONB NULL DEFAULT '{}',
	"username" TEXT NULL DEFAULT NULL,
	"system_email" TEXT NULL DEFAULT NULL,
	PRIMARY KEY ("id"),
	UNIQUE ("username"),
	UNIQUE ("system_email"),
	CONSTRAINT "staff_members_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
)
CREATE INDEX "idx_staff_members_owner" ON "" ("owner_id");;

-- Dumping data for table public.staff_members: -1 rows
INSERT INTO "staff_members" ("id", "owner_id", "full_name", "phone", "email", "role", "pin_code", "is_active", "notes", "created_at", "updated_at", "page_permissions", "username", "system_email") VALUES
	('bb6935e8-7062-420b-8c05-93276f95d9b6', '235a080f-85cf-4ed4-8685-1eaf546fed66', 'navya', '6301019935', NULL, 'staff', '1234', 'true', NULL, '2026-03-30 21:09:31.332399+00', '2026-03-30 21:09:31.332399+00', '["orders", "menu"]', 'navya.lwzg', 'navya.lwzg@banaoo-staff.app'),
	('ec5ba31a-cc92-458c-af96-be52c2125753', '6d174952-8430-448d-99f1-765891a1ac38', 'Ramana', '9177209896', NULL, 'chef', '9177', 'true', 'Main Chef', '2026-04-06 11:09:07.647604+00', '2026-04-06 11:09:07.647604+00', '["orders", "kitchen", "menu"]', 'ramana.rv3h', 'ramana.rv3h@banaoo-staff.app');

-- Dumping structure for table public.staff_outlet_assignments
CREATE TABLE IF NOT EXISTS "staff_outlet_assignments" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"user_id" UUID NOT NULL,
	"outlet_id" UUID NOT NULL,
	"assigned_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
	PRIMARY KEY ("id"),
	UNIQUE ("user_id", "outlet_id"),
	CONSTRAINT "staff_outlet_assignments_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
	CONSTRAINT "staff_outlet_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);

-- Dumping data for table public.staff_outlet_assignments: -1 rows

-- Dumping structure for table public.staff_outlet_links
CREATE TABLE IF NOT EXISTS "staff_outlet_links" (
	"staff_member_id" UUID NOT NULL,
	"outlet_id" UUID NOT NULL,
	PRIMARY KEY ("staff_member_id", "outlet_id"),
	CONSTRAINT "staff_outlet_links_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
	CONSTRAINT "staff_outlet_links_staff_member_id_fkey" FOREIGN KEY ("staff_member_id") REFERENCES "staff_members" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
)
CREATE INDEX "idx_staff_outlet_links_outlet" ON "" ("outlet_id");;

-- Dumping data for table public.staff_outlet_links: -1 rows
INSERT INTO "staff_outlet_links" ("staff_member_id", "outlet_id") VALUES
	('bb6935e8-7062-420b-8c05-93276f95d9b6', '191ecbf4-9097-4c67-9d52-567c03f99d84'),
	('ec5ba31a-cc92-458c-af96-be52c2125753', 'c1be311f-e30c-4e11-b173-e393f2155594');

-- Dumping structure for table public.subscriptions
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"user_id" UUID NOT NULL,
	"plan_type" TEXT NOT NULL,
	"status" TEXT NOT NULL DEFAULT 'trialing',
	"trial_ends_at" TIMESTAMPTZ NULL DEFAULT NULL,
	"razorpay_customer_id" TEXT NULL DEFAULT NULL,
	"razorpay_subscription_id" TEXT NULL DEFAULT NULL,
	"razorpay_plan_id" TEXT NULL DEFAULT NULL,
	"current_period_start" TIMESTAMPTZ NULL DEFAULT NULL,
	"current_period_end" TIMESTAMPTZ NULL DEFAULT NULL,
	"cancelled_at" TIMESTAMPTZ NULL DEFAULT NULL,
	"created_at" TIMESTAMPTZ NULL DEFAULT now(),
	"updated_at" TIMESTAMPTZ NULL DEFAULT now(),
	"period_months" INTEGER NULL DEFAULT NULL,
	"expires_at" TIMESTAMPTZ NULL DEFAULT NULL,
	"razorpay_order_id" TEXT NULL DEFAULT NULL,
	"razorpay_payment_id" TEXT NULL DEFAULT NULL,
	PRIMARY KEY ("id"),
	UNIQUE ("razorpay_subscription_id"),
	UNIQUE ("razorpay_order_id")
)
CREATE INDEX "idx_subscriptions_user_id" ON "" ("user_id");
CREATE INDEX "idx_subscriptions_razorpay_subscription_id" ON "" ("razorpay_subscription_id");;

-- Dumping data for table public.subscriptions: -1 rows
INSERT INTO "subscriptions" ("id", "user_id", "plan_type", "status", "trial_ends_at", "razorpay_customer_id", "razorpay_subscription_id", "razorpay_plan_id", "current_period_start", "current_period_end", "cancelled_at", "created_at", "updated_at", "period_months", "expires_at", "razorpay_order_id", "razorpay_payment_id") VALUES
	('0c4c6313-73db-473d-8b5d-58bd42bad709', '235a080f-85cf-4ed4-8685-1eaf546fed66', 'starter', 'active', NULL, NULL, NULL, NULL, '2026-03-29 10:19:32.057+00', '2026-04-29 10:19:32.047+00', NULL, '2026-03-29 10:19:32.87925+00', '2026-03-29 10:19:32.87925+00', 1, '2026-04-29 10:19:32.047+00', 'order_SX0QGHKb8VTeSy', 'pay_SX0QaJZHKbzM0V'),
	('1dc9ff19-1852-44c1-8968-19db1b1fa555', '75e4f577-b26b-4b36-ba85-f69a0554d117', 'professional', 'active', NULL, NULL, NULL, NULL, '2026-03-29 12:47:11.652+00', '2026-04-29 12:47:11.652+00', NULL, '2026-03-29 12:47:11.948651+00', '2026-03-29 12:47:11.948651+00', 1, '2026-04-29 12:47:11.652+00', 'order_SX2wMo5RvpY2cH', 'pay_SX2wWisbXOTWnt'),
	('38def123-24ab-4034-8e5e-6131f065c6ec', 'f7878447-4ae2-46ee-bb63-a839d221b0b4', 'professional', 'active', NULL, NULL, NULL, NULL, '2026-03-29 12:00:54.132+00', '2026-04-29 12:00:54.132+00', NULL, '2026-03-29 12:00:54.688703+00', '2026-03-29 12:00:54.688703+00', 1, '2026-04-29 12:00:54.132+00', 'order_SX29Uo8RAZm3lY', 'pay_SX29frBbu0k91Y'),
	('4ad0d262-deba-4c77-af7b-827ec98d08e0', '20327e5a-0473-4bdc-bfbc-e75ea050f147', 'professional', 'active', NULL, NULL, NULL, NULL, '2026-03-30 04:45:22.878+00', '2027-03-30 04:45:22.878+00', NULL, '2026-03-30 04:45:22.741154+00', '2026-03-30 04:45:22.741154+00', 12, '2027-03-30 04:45:22.878+00', 'order_SXJG8JsRkFyjsA', 'pay_SXJGFdBtt2yvIP'),
	('603df64f-25a4-4d94-9f8b-19b1b5d82387', '4388bec4-2a8c-4a51-b189-6e8319ee0d37', 'professional', 'active', NULL, NULL, NULL, NULL, '2026-03-29 12:50:06.13+00', '2026-04-29 12:50:06.13+00', NULL, '2026-03-29 12:50:06.410206+00', '2026-03-29 12:50:06.410206+00', 1, '2026-04-29 12:50:06.13+00', 'order_SX2zLj0RF6NI3R', 'pay_SX2zYbJRed9TTW'),
	('61c3f1f0-26f2-4044-8f5d-cbad3fee6be0', 'd61c616e-ff7a-4679-9ac8-afff1950f75d', 'starter', 'active', NULL, NULL, NULL, NULL, '2026-03-29 11:24:41.05+00', '2026-04-29 11:24:41.05+00', NULL, '2026-03-29 11:24:41.58246+00', '2026-03-29 11:24:41.58246+00', 1, '2026-04-29 11:24:41.05+00', 'order_SX1X8bHJgQLTfn', 'pay_SX1XP7cMAelkZy'),
	('7ab9cb7c-27c0-4340-8017-5d98e8a110b3', '235a080f-85cf-4ed4-8685-1eaf546fed66', 'professional', 'active', NULL, NULL, NULL, NULL, '2026-03-30 20:49:35.724+00', '2026-04-30 20:49:35.724+00', NULL, '2026-03-30 20:49:35.725148+00', '2026-03-30 20:49:35.725148+00', 1, '2026-04-30 20:49:35.724+00', 'order_SXZggdrUkPWAYT', 'pay_SXZhGKzDtdNRVL'),
	('94cfc075-c1b0-4963-be0e-c1f18d860eb9', 'eea45908-c633-4add-aca4-3d4bdb3bab22', 'professional', 'active', NULL, NULL, NULL, NULL, '2026-03-29 13:05:21.375+00', '2026-04-29 13:05:21.375+00', NULL, '2026-03-29 13:05:21.612713+00', '2026-03-29 13:05:21.612713+00', 1, '2026-04-29 13:05:21.375+00', 'order_SX3E8TirZEO0ef', 'pay_SX3FkYJwqNw5Am'),
	('f0b4acd6-faf2-4081-9b4c-c721fb217454', '2dbe5495-8e7a-438e-9e28-0c4fcc1e2652', 'professional', 'active', NULL, NULL, NULL, NULL, '2026-03-29 11:41:51.761+00', '2026-06-29 11:41:51.761+00', NULL, '2026-03-29 11:41:52.30371+00', '2026-03-29 11:41:52.30371+00', 3, '2026-06-29 11:41:51.761+00', 'order_SX1pOkwbbAVt5K', 'pay_SX1pZ0SvBgglQf');

-- Dumping structure for table public.table_zones
CREATE TABLE IF NOT EXISTS "table_zones" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"outlet_id" UUID NOT NULL,
	"name" TEXT NOT NULL,
	"sort_order" INTEGER NOT NULL DEFAULT 0,
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
	PRIMARY KEY ("id"),
	CONSTRAINT "table_zones_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);

-- Dumping data for table public.table_zones: -1 rows

-- Dumping structure for function public.touch_staff_members
DELIMITER //
CREATE FUNCTION "touch_staff_members"() RETURNS UNKNOWN AS $$ 
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
 $$//
DELIMITER ;

-- Dumping structure for function public.update_updated_at_column
DELIMITER //
CREATE FUNCTION "update_updated_at_column"() RETURNS UNKNOWN AS $$ 
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
 $$//
DELIMITER ;

-- Dumping structure for table public.users
CREATE TABLE IF NOT EXISTS "users" (
	"id" UUID NOT NULL DEFAULT gen_random_uuid(),
	"email" TEXT NOT NULL,
	"password_hash" TEXT NULL DEFAULT NULL,
	"google_id" TEXT NULL DEFAULT NULL,
	"created_at" TIMESTAMPTZ NULL DEFAULT now(),
	"updated_at" TIMESTAMPTZ NULL DEFAULT now(),
	PRIMARY KEY ("id"),
	UNIQUE ("email"),
	UNIQUE ("google_id")
);

-- Dumping data for table public.users: 19 rows
INSERT INTO "users" ("id", "email", "password_hash", "google_id", "created_at", "updated_at") VALUES
	('0cae5721-724f-41a8-804c-bdb0601b54c6', 'shiva@gmail.com', '$2a$10$..rGUItAVoes75B0riGBw.PJDJwUFD5aMbTBxyLEUlPFVZHBBLIhS', NULL, '2026-03-30 09:48:20.100208+00', '2026-03-30 09:48:20.100208+00'),
	('0edefb48-ec9f-456f-bcfb-64f3bea2b140', 'test_user_jetski_123@example.com', '$2a$10$KIHeQSIjs8bBHbtCZe.b7O4F0qDTInzvYg8JsbhtSeIIPbjruIFY2', NULL, '2026-03-29 20:13:04.008627+00', '2026-03-29 20:13:04.008627+00'),
	('20327e5a-0473-4bdc-bfbc-e75ea050f147', 'nakshatra@gmail.com', '$2a$10$GdhGg4r6sfJSU0zg.IqQZegzFKsV.34LjmLgwZcU4sleNMGfA7dDe', NULL, '2026-03-29 12:48:54.910622+00', '2026-03-29 12:48:54.910622+00'),
	('235a080f-85cf-4ed4-8685-1eaf546fed66', 'krackbotstudio@gmail.com', '$2a$10$S4YHM6kuu2gOg.DTpKuJGOkM2nSehj1KUJ3GxfpTCOU2EU1./6vma', '116107068857590074950', '2026-03-29 10:18:42.76853+00', '2026-03-29 10:18:42.76853+00'),
	('2dbe5495-8e7a-438e-9e28-0c4fcc1e2652', 'allprodx.up@gmail.com', NULL, '106185344959110158703', '2026-03-29 11:40:54.291033+00', '2026-03-29 11:40:54.291033+00'),
	('328e18d3-24c3-4716-89be-3fe5c94f40b1', 'karthikburra2211@gmail.com', NULL, '105578382332145555870', '2026-04-03 12:05:56.494528+00', '2026-04-03 12:05:56.494528+00'),
	('4388bec4-2a8c-4a51-b189-6e8319ee0d37', '99sanjeevnihal99@gmail.com', '$2a$10$KMrJPtbcWLktQD86MDuGQufxnHNAITddto7uj1rYg.oOtLA.HmvT.', NULL, '2026-03-29 12:21:37.280357+00', '2026-03-29 12:21:37.280357+00'),
	('6d174952-8430-448d-99f1-765891a1ac38', 'sunrise94444@gmail.com', '$2a$10$9GeayRUTyx.9DRP0RyBQiOXn2Y0UYxcAlBHYRrGAuGo7J7v2yavte', NULL, '2026-04-06 09:27:00.792049+00', '2026-04-06 09:27:00.792049+00'),
	('74952a80-6e9d-4989-b4c2-ea7aba1337f7', 'mallapuramnavya@gmail.com', NULL, '112688086193918719268', '2026-03-30 20:18:42.264707+00', '2026-03-30 20:18:42.264707+00'),
	('75e4f577-b26b-4b36-ba85-f69a0554d117', 'sanjeevnihal@live.com', '$2a$10$c9ILfCNne6/2R9Cor9MdpeAFquajmZ5j.CS4vjeAEIQixJVdnni.u', NULL, '2026-03-29 12:42:06.935308+00', '2026-03-29 12:42:06.935308+00'),
	('8bd4ffde-fbfd-4ddd-9d0d-fdbd7dba419f', 'niharikachinnu08@gmail.com', '$2a$10$vk5Gf9/z4WeK1pNgS94M8ukiPztsX6rf2g6fteG.6w8Z0BItRFmqy', NULL, '2026-04-01 17:24:38.563497+00', '2026-04-01 17:24:38.563497+00'),
	('aa0249e8-381f-4133-8981-92f134063ede', 'mallapuramnavya04@gmail.com', '$2a$10$DwLtKeuWK5XGaiwOT1sXcezwpON7KQgY2f2jI2E/pICXL7Kc.FFRS', NULL, '2026-04-05 19:20:37.774115+00', '2026-04-05 19:20:37.774115+00'),
	('aa377d13-8cf6-41c0-a814-1c99397344b8', 'singarilikithsai2006@gmail.com', NULL, '104416145912143387316', '2026-04-11 04:17:35.444576+00', '2026-04-11 04:17:35.444576+00'),
	('bae4ef3a-ef25-4b62-a743-6122b8953c99', 'nandini@gmail.com', '$2a$10$CTAdZWGe91CQI26PcNbV5uFcss8ea23pO7mS4EyZkELys0wml5G9m', NULL, '2026-03-30 20:17:13.874889+00', '2026-03-30 20:17:13.874889+00'),
	('c019bea6-a9c7-4afe-9db6-5e6ae87f6e21', 'sanjeevnihal.s@gmail.com', '$2a$10$UESpTiKKXOzdHjNEUzEgZOmIBSxlEgq6KSesAw6qMToLHKcEHanya', '111804082124986496991', '2026-03-29 14:50:25.330515+00', '2026-03-29 14:50:25.330515+00'),
	('d2df722f-bf2b-4d58-aeaa-91e6ad0f6948', 'test@mail.com', '$2a$10$/rxkyemS.TPrCKlxteQwdOZEF36Z3OAae/VzPku55F/nm8disAY7C', NULL, '2026-03-31 00:59:03.678553+00', '2026-03-31 00:59:03.678553+00'),
	('d61c616e-ff7a-4679-9ac8-afff1950f75d', 'xgoo.dev@gmail.com', NULL, '108873751654506624040', '2026-03-29 11:23:39.482209+00', '2026-03-29 11:23:39.482209+00'),
	('eea45908-c633-4add-aca4-3d4bdb3bab22', 'krishnamurthysingari@gmail.com', '$2a$10$3ZDNY0CrMPSw/n14QGBUn.X1MdZw6svofgdeSzsk82S/hwRzHCeQa', NULL, '2026-03-29 13:03:01.887198+00', '2026-03-29 13:03:01.887198+00'),
	('f7878447-4ae2-46ee-bb63-a839d221b0b4', 'harshinisingari@gmail.com', NULL, '114006983440394230553', '2026-03-29 12:00:10.036421+00', '2026-03-29 12:00:10.036421+00');

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
