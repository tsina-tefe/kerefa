-- QEREFA showcase data.
-- A mid-range traditional restaurant in Bole, Addis Ababa.
-- Food menu is Breakfast, Lunch, and Combo from qerefa-menu.json.
-- Drink categories (coffee, juice, tej & beer) stay as showcase extras.
-- Re-running this script replaces only rows it owns (MH- codes).
-- Staff password for every new login below is: password
-- Existing admin login is unchanged (username admin / password password).
--
-- Bills follow the app: dine-in adds 10% service, then 15% VAT on food + service.
-- Takeaway and delivery have no service charge. VAT is still 15%.
-- Run this file in Workbench after: php artisan migrate --seed
-- In Workbench, this script selects kerefa_v1. Do not run it on another schema.
-- Keep the connection on utf8mb4 so Amharic names store correctly.

SET NAMES utf8mb4;
USE `kerefa_v1`;

START TRANSACTION;

SET @branch = (SELECT id FROM branches WHERE code = 'MAIN' LIMIT 1);
SET @pwd = '$2y$12$fDcXVxqez1dK1reu57pbXuyEIRSuYJbVjPmwDCBEYNamy5Yu6aZsy';

-- ---------------------------------------------------------------------------
-- Remove a previous showcase load
-- ---------------------------------------------------------------------------

DELETE ti FROM ticket_items ti
    JOIN kitchen_bar_tickets t ON t.id = ti.ticket_id
    JOIN orders o ON o.id = t.order_id
WHERE o.order_number LIKE 'MH-%';

DELETE t FROM kitchen_bar_tickets t
    JOIN orders o ON o.id = t.order_id
WHERE o.order_number LIKE 'MH-%';

DELETE p FROM payments p
    JOIN orders o ON o.id = p.order_id
WHERE o.order_number LIKE 'MH-%';

DELETE m FROM order_item_modifiers m
    JOIN order_items i ON i.id = m.order_item_id
    JOIN orders o ON o.id = i.order_id
WHERE o.order_number LIKE 'MH-%';

DELETE h FROM order_status_history h
    JOIN orders o ON o.id = h.order_id
WHERE o.order_number LIKE 'MH-%';

DELETE i FROM order_items i
    JOIN orders o ON o.id = i.order_id
WHERE o.order_number LIKE 'MH-%';

DELETE FROM orders WHERE order_number LIKE 'MH-%';

DELETE FROM menu_item_modifiers
WHERE menu_item_id IN (SELECT id FROM (SELECT id FROM menu_items WHERE code LIKE 'MH-%') x);

DELETE FROM menu_items WHERE code LIKE 'MH-%';
DELETE FROM menu_categories WHERE branch_id = @branch AND slug LIKE 'mh-%';

UPDATE orders o
    JOIN restaurant_tables t ON t.id = o.restaurant_table_id
SET o.restaurant_table_id = NULL
WHERE t.branch_id = @branch
  AND t.table_number IN ('H1','H2','H3','H4','H5','H6','H7','H8','H9','H10','G1','G2','G3','G4','G5','G6','K1','K2');

DELETE FROM restaurant_tables
WHERE branch_id = @branch
  AND table_number IN ('H1','H2','H3','H4','H5','H6','H7','H8','H9','H10','G1','G2','G3','G4','G5','G6','K1','K2');

DELETE FROM dining_areas
WHERE branch_id = @branch AND name IN ('Main Hall', 'Garden', 'Private Rooms');

DELETE FROM order_stations WHERE branch_id = @branch AND code LIKE 'MH-%';

DELETE poi FROM purchase_order_items poi
    JOIN purchase_orders po ON po.id = poi.purchase_order_id
WHERE po.po_number LIKE 'MH-PO-%';

DELETE FROM purchase_orders WHERE po_number LIKE 'MH-PO-%';

DELETE st FROM stock_transactions st
    JOIN inventory_items i ON i.id = st.inventory_item_id
WHERE i.code LIKE 'MH-%';

DELETE s FROM inventory_stocks s
    JOIN inventory_items i ON i.id = s.inventory_item_id
WHERE i.code LIKE 'MH-%';

DELETE FROM inventory_items WHERE code LIKE 'MH-%';
DELETE FROM inventory_categories WHERE code LIKE 'MH-%';
DELETE FROM suppliers WHERE tax_number LIKE 'MH-TIN-%';

DELETE r FROM model_has_roles r
    JOIN users u ON u.id = r.model_id
WHERE r.model_type = 'App\\Models\\User'
  AND u.username IN ('kidist','hana','dawit','meron','yonas','sara','abel','frehiwot');

DELETE a FROM user_branch_access a
    JOIN users u ON u.id = a.user_id
WHERE u.username IN ('kidist','hana','dawit','meron','yonas','sara','abel','frehiwot');

DELETE FROM users
WHERE username IN ('kidist','hana','dawit','meron','yonas','sara','abel','frehiwot');

-- ---------------------------------------------------------------------------
-- The restaurant
-- ---------------------------------------------------------------------------

UPDATE branches
SET name = 'Mesob House',
    address = 'Bole Medhanealem, behind Edna Mall, Addis Ababa',
    phone = '+251116612040',
    email = 'reservations@mesobhouse.et',
    currency = 'ETB',
    is_main = 1,
    is_active = 1
WHERE id = @branch;

UPDATE users
SET name = 'Selam Tesfaye',
    phone = '+251911202418'
WHERE username = 'admin';

INSERT INTO departments (branch_id, code, name, type, is_active, created_at, updated_at)
SELECT @branch, 'FOH', 'Front of House', 'service', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE branch_id = @branch AND code = 'FOH');

INSERT INTO departments (branch_id, code, name, type, is_active, created_at, updated_at)
SELECT @branch, 'STR', 'Store', 'store', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE branch_id = @branch AND code = 'STR');

SET @kit = (SELECT id FROM departments WHERE branch_id = @branch AND code = 'KIT');
SET @bar_dept = (SELECT id FROM departments WHERE branch_id = @branch AND code = 'BAR');
SET @foh = (SELECT id FROM departments WHERE branch_id = @branch AND code = 'FOH');
SET @store = (SELECT id FROM departments WHERE branch_id = @branch AND code = 'STR');

INSERT INTO order_stations
    (branch_id, name, code, station_type, printer_model, printer_connection, printer_ip, printer_port, paper_width_mm, auto_print, print_copies, is_active, notes, created_at, updated_at)
VALUES
    (@branch, 'Hot Kitchen', 'MH-HOT', 'kitchen', 'IRP 200D', 'thermal_80mm', '192.168.10.21', 9100, 80, 1, 1, 1, 'Wot, tibs, kitfo, and injera pass.', NOW(), NOW());
SET @st_hot = LAST_INSERT_ID();

INSERT INTO order_stations
    (branch_id, name, code, station_type, printer_model, printer_connection, printer_ip, printer_port, paper_width_mm, auto_print, print_copies, is_active, notes, created_at, updated_at)
VALUES
    (@branch, 'Bar', 'MH-BAR', 'bar', 'IRP 200D', 'thermal_80mm', '192.168.10.22', 9100, 80, 1, 1, 1, 'Coffee, tej, beer, and soft drinks.', NOW(), NOW());
SET @st_bar = LAST_INSERT_ID();

-- ---------------------------------------------------------------------------
-- Floor
-- ---------------------------------------------------------------------------

INSERT INTO dining_areas (branch_id, name, description, sort_order, is_active, created_at, updated_at) VALUES
    (@branch, 'Main Hall', 'Ground floor dining room, lunch and dinner', 1, 1, NOW(), NOW());
SET @area_hall = LAST_INSERT_ID();

INSERT INTO dining_areas (branch_id, name, description, sort_order, is_active, created_at, updated_at) VALUES
    (@branch, 'Garden', 'Open-air tables under the meskel shade', 2, 1, NOW(), NOW());
SET @area_garden = LAST_INSERT_ID();

INSERT INTO dining_areas (branch_id, name, description, sort_order, is_active, created_at, updated_at) VALUES
    (@branch, 'Private Rooms', 'Kibeb rooms for families and small celebrations', 3, 1, NOW(), NOW());
SET @area_private = LAST_INSERT_ID();

INSERT INTO restaurant_tables (branch_id, dining_area_id, table_number, capacity, status, is_active, created_at, updated_at) VALUES
    (@branch, @area_hall, 'H1', 4, 'available', 1, NOW(), NOW()),
    (@branch, @area_hall, 'H2', 4, 'available', 1, NOW(), NOW()),
    (@branch, @area_hall, 'H3', 2, 'available', 1, NOW(), NOW()),
    (@branch, @area_hall, 'H4', 4, 'available', 1, NOW(), NOW()),
    (@branch, @area_hall, 'H5', 6, 'available', 1, NOW(), NOW()),
    (@branch, @area_hall, 'H6', 6, 'available', 1, NOW(), NOW()),
    (@branch, @area_hall, 'H7', 4, 'available', 1, NOW(), NOW()),
    (@branch, @area_hall, 'H8', 4, 'available', 1, NOW(), NOW()),
    (@branch, @area_hall, 'H9', 2, 'available', 1, NOW(), NOW()),
    (@branch, @area_hall, 'H10', 8, 'maintenance', 1, NOW(), NOW()),
    (@branch, @area_garden, 'G1', 4, 'reserved', 1, NOW(), NOW()),
    (@branch, @area_garden, 'G2', 4, 'available', 1, NOW(), NOW()),
    (@branch, @area_garden, 'G3', 6, 'available', 1, NOW(), NOW()),
    (@branch, @area_garden, 'G4', 4, 'available', 1, NOW(), NOW()),
    (@branch, @area_garden, 'G5', 4, 'available', 1, NOW(), NOW()),
    (@branch, @area_garden, 'G6', 8, 'available', 1, NOW(), NOW()),
    (@branch, @area_private, 'K1', 8, 'available', 1, NOW(), NOW()),
    (@branch, @area_private, 'K2', 10, 'available', 1, NOW(), NOW());

-- ---------------------------------------------------------------------------
-- Staff. Password for each account is: password
-- ---------------------------------------------------------------------------

INSERT INTO users (name, username, email, phone, email_verified_at, password, branch_id, department_id, is_active, created_at, updated_at) VALUES
    ('Kidist Haile', 'kidist', 'kidist.haile@mesobhouse.et', '+251911220014', NOW(), @pwd, @branch, @foh, 1, NOW(), NOW());
SET @kidist = LAST_INSERT_ID();
INSERT INTO users (name, username, email, phone, email_verified_at, password, branch_id, department_id, is_active, created_at, updated_at) VALUES
    ('Hana Bekele', 'hana', 'hana.bekele@mesobhouse.et', '+251911334410', NOW(), @pwd, @branch, @foh, 1, NOW(), NOW());
SET @hana = LAST_INSERT_ID();
INSERT INTO users (name, username, email, phone, email_verified_at, password, branch_id, department_id, is_active, created_at, updated_at) VALUES
    ('Dawit Alemu', 'dawit', 'dawit.alemu@mesobhouse.et', '+251922118760', NOW(), @pwd, @branch, @foh, 1, NOW(), NOW());
SET @dawit = LAST_INSERT_ID();
INSERT INTO users (name, username, email, phone, email_verified_at, password, branch_id, department_id, is_active, created_at, updated_at) VALUES
    ('Meron Tadesse', 'meron', 'meron.tadesse@mesobhouse.et', '+251913556021', NOW(), @pwd, @branch, @foh, 1, NOW(), NOW());
SET @meron = LAST_INSERT_ID();
INSERT INTO users (name, username, email, phone, email_verified_at, password, branch_id, department_id, is_active, created_at, updated_at) VALUES
    ('Yonas Gebre', 'yonas', 'yonas.gebre@mesobhouse.et', '+251911678334', NOW(), @pwd, @branch, @kit, 1, NOW(), NOW());
SET @yonas = LAST_INSERT_ID();
INSERT INTO users (name, username, email, phone, email_verified_at, password, branch_id, department_id, is_active, created_at, updated_at) VALUES
    ('Sara Mohammed', 'sara', 'sara.mohammed@mesobhouse.et', '+251944210118', NOW(), @pwd, @branch, @bar_dept, 1, NOW(), NOW());
SET @sara = LAST_INSERT_ID();
INSERT INTO users (name, username, email, phone, email_verified_at, password, branch_id, department_id, is_active, created_at, updated_at) VALUES
    ('Abel Worku', 'abel', 'abel.worku@mesobhouse.et', '+251911902255', NOW(), @pwd, @branch, @store, 1, NOW(), NOW());
SET @abel = LAST_INSERT_ID();
INSERT INTO users (name, username, email, phone, email_verified_at, password, branch_id, department_id, is_active, created_at, updated_at) VALUES
    ('Frehiwot Assefa', 'frehiwot', 'frehiwot.assefa@mesobhouse.et', '+251922441908', NOW(), @pwd, @branch, @store, 1, NOW(), NOW());
SET @frehiwot = LAST_INSERT_ID();

INSERT INTO model_has_roles (role_id, model_type, model_id)
SELECT r.id, 'App\\Models\\User', u.model_id
FROM (
    SELECT 'branch-manager' AS role_name, @kidist AS model_id
    UNION ALL SELECT 'cashier', @hana
    UNION ALL SELECT 'waiter', @dawit
    UNION ALL SELECT 'waiter', @meron
    UNION ALL SELECT 'kitchen-staff', @yonas
    UNION ALL SELECT 'bar-staff', @sara
    UNION ALL SELECT 'storekeeper', @abel
    UNION ALL SELECT 'procurement-officer', @frehiwot
) u
JOIN roles r ON r.name = u.role_name AND r.guard_name = 'web';

INSERT INTO user_branch_access (user_id, branch_id) VALUES
    (@kidist, @branch), (@hana, @branch), (@dawit, @branch), (@meron, @branch),
    (@yonas, @branch), (@sara, @branch), (@abel, @branch), (@frehiwot, @branch);

-- ---------------------------------------------------------------------------
-- Menu. Food prices come from the Qerefa menu. Names show English (Amharic).
-- ---------------------------------------------------------------------------

INSERT INTO menu_categories (branch_id, order_station_id, name, slug, sort_order, is_active, created_at, updated_at) VALUES
    (@branch, @st_hot, 'Breakfast (ቁርስ)', 'mh-breakfast', 1, 1, NOW(), NOW()),
    (@branch, @st_hot, 'Lunch (ምሳ)', 'mh-lunch', 2, 1, NOW(), NOW()),
    (@branch, @st_hot, 'Combo (ኮምቦ)', 'mh-combo', 3, 1, NOW(), NOW()),
    (@branch, @st_bar, 'Coffee & Tea', 'mh-coffee', 4, 1, NOW(), NOW()),
    (@branch, @st_bar, 'Juice & Soft Drinks', 'mh-cold', 5, 1, NOW(), NOW()),
    (@branch, @st_bar, 'Tej & Beer', 'mh-tej', 6, 1, NOW(), NOW());

INSERT INTO menu_items
    (branch_id, category_id, order_station_id, code, name, description, price, cost_price, preparation_department, is_available, is_favorite, is_active, recipe_enabled, created_at, updated_at)
SELECT @branch, c.id, c.order_station_id, v.code, v.name, v.description, v.price, v.cost_price, v.dept, v.available, v.favorite, 1, 0, NOW(), NOW()
FROM (
    SELECT 'mh-breakfast' AS slug, 'MH-CHECH-SP' AS code, 'Chechebesa Special (ጨጨብሳ ስፔሻል)' AS name, NULL AS description, 400.00 AS price, 140.00 AS cost_price, 'kitchen' AS dept, 1 AS available, 1 AS favorite
    UNION ALL SELECT 'mh-breakfast', 'MH-CHECH-F', 'Chechebesa Fasting (ጨጨብሳ የፆም)', NULL, 350.00, 120.00, 'kitchen', 1, 0
    UNION ALL SELECT 'mh-breakfast', 'MH-FIRFIR-F', 'Firfir Fasting (ፍርፍር የፆም)', NULL, 360.00, 125.00, 'kitchen', 1, 0
    UNION ALL SELECT 'mh-breakfast', 'MH-FIRFIR-M', 'Firfir with Meat (ፍርፍር በስጋ)', NULL, 450.00, 160.00, 'kitchen', 1, 0
    UNION ALL SELECT 'mh-breakfast', 'MH-EGG-T', 'Egg with Tomato (እንቁላል በቲማቲም)', NULL, 380.00, 130.00, 'kitchen', 1, 0
    UNION ALL SELECT 'mh-breakfast', 'MH-EGG-M', 'Egg with Meat (እንቁላል በስጋ)', NULL, 460.00, 165.00, 'kitchen', 1, 0
    UNION ALL SELECT 'mh-breakfast', 'MH-DIRK-M', 'Dirkosh Firfir (ድርቆሽ ፍርፍር)', NULL, 460.00, 165.00, 'kitchen', 1, 0
    UNION ALL SELECT 'mh-breakfast', 'MH-DIRK-F', 'Dirkosh Firfir Fasting (ድርቆሽ ፍርፍር የፆም)', NULL, 360.00, 125.00, 'kitchen', 1, 0
    UNION ALL SELECT 'mh-breakfast', 'MH-DULET', 'Dulet (ዱለት)', NULL, 450.00, 180.00, 'kitchen', 1, 0
    UNION ALL SELECT 'mh-breakfast', 'MH-KINCHE-F', 'Kinche Fasting (ቂንጬ የፆም)', NULL, 350.00, 90.00, 'kitchen', 1, 0
    UNION ALL SELECT 'mh-breakfast', 'MH-KINCHE-B', 'Kinche with Clarified Butter (ቂንጬ በቂቤ)', NULL, 460.00, 140.00, 'kitchen', 1, 0
    UNION ALL SELECT 'mh-breakfast', 'MH-BULA', 'Bula (ቡላ)', NULL, 450.00, 150.00, 'kitchen', 1, 0
    UNION ALL SELECT 'mh-breakfast', 'MH-BULA-KF', 'Bula with Kitfo (ቡላ በክትፎ)', NULL, 720.00, 320.00, 'kitchen', 1, 0
    UNION ALL SELECT 'mh-breakfast', 'MH-BREAD-FF', 'Bread Firfir (ዳቦ ፍርፍር)', NULL, 250.00, 70.00, 'kitchen', 1, 0
    UNION ALL SELECT 'mh-breakfast', 'MH-PASTA-M', 'Pasta with Meat (ፓስታ በስጋ)', NULL, 550.00, 200.00, 'kitchen', 1, 0
    UNION ALL SELECT 'mh-breakfast', 'MH-FUL-N', 'Ful Normal (ፉል ኖርማል)', NULL, 350.00, 90.00, 'kitchen', 1, 0
    UNION ALL SELECT 'mh-breakfast', 'MH-FUL-SP', 'Ful Special (ፉል ስፔሻል)', NULL, 400.00, 110.00, 'kitchen', 1, 0
    UNION ALL SELECT 'mh-breakfast', 'MH-MEAT-FF', 'Meat Firfir (ስጋ ፍርፍር)', NULL, 650.00, 260.00, 'kitchen', 1, 0
    UNION ALL SELECT 'mh-breakfast', 'MH-TIBS-FF', 'Tibs Firfir (ጥብስ ፍርፍር)', NULL, 650.00, 260.00, 'kitchen', 1, 0
    UNION ALL SELECT 'mh-breakfast', 'MH-QUANTA-FF', 'Quanta Firfir (ቋንጣ ፍርፍር)', NULL, 650.00, 260.00, 'kitchen', 1, 0
    UNION ALL SELECT 'mh-breakfast', 'MH-QUANTA-DK', 'Quanta Dirkosh (ቋንጣ ድርቆሽ)', NULL, 650.00, 260.00, 'kitchen', 1, 0
    UNION ALL SELECT 'mh-lunch', 'MH-SHIRO', 'Shiro (ሽሮ)', NULL, 395.00, 80.00, 'kitchen', 1, 0
    UNION ALL SELECT 'mh-lunch', 'MH-SHIRO-KB', 'Shiro with Clarified Butter (ሽሮ በቂቤ)', NULL, 445.00, 95.00, 'kitchen', 1, 0
    UNION ALL SELECT 'mh-lunch', 'MH-SHIRO-BZ', 'Shiro Bozena (ሽሮ ቦዘና)', NULL, 495.00, 160.00, 'kitchen', 1, 0
    UNION ALL SELECT 'mh-lunch', 'MH-BEYA', 'Beyayenetu (በየአይነቱ)', NULL, 545.00, 170.00, 'kitchen', 1, 1
    UNION ALL SELECT 'mh-lunch', 'MH-PASTA-T', 'Pasta with Tomato Sauce (ፓስታ በስጎ)', NULL, 385.00, 90.00, 'kitchen', 1, 0
    UNION ALL SELECT 'mh-lunch', 'MH-SIGA-W', 'Meat Stew (ስጋ ወጥ)', NULL, 715.00, 280.00, 'kitchen', 1, 0
    UNION ALL SELECT 'mh-lunch', 'MH-MENCHET', 'Menchet Stew (ምንቸት ወጥ ቀይ እና አልጫ)', NULL, 680.00, 260.00, 'kitchen', 1, 0
    UNION ALL SELECT 'mh-lunch', 'MH-KEKEL', 'Kekel (ቅቅል)', NULL, 775.00, 310.00, 'kitchen', 1, 0
    UNION ALL SELECT 'mh-lunch', 'MH-DORO', 'Doro Stew (ዶሮ ወጥ)', NULL, 820.00, 340.00, 'kitchen', 1, 1
    UNION ALL SELECT 'mh-lunch', 'MH-KITFO', 'Kitfo (ክትፎ)', NULL, 930.00, 420.00, 'kitchen', 1, 1
    UNION ALL SELECT 'mh-lunch', 'MH-TIBS', 'Tibs (ጥብስ)', NULL, 680.00, 280.00, 'kitchen', 1, 0
    UNION ALL SELECT 'mh-lunch', 'MH-CHIKINA', 'Chikina Tibs (ጭቅና ጥብስ)', NULL, 790.00, 320.00, 'kitchen', 1, 0
    UNION ALL SELECT 'mh-lunch', 'MH-DINICH-M', 'Dinich with Meat (ድንች በስጋ)', NULL, 595.00, 200.00, 'kitchen', 1, 0
    UNION ALL SELECT 'mh-lunch', 'MH-MISIR-M', 'Misir Stew (ምስር በስጋ)', NULL, 595.00, 180.00, 'kitchen', 1, 0
    UNION ALL SELECT 'mh-lunch', 'MH-QEREFA', 'Qerefa (ቀረፋ)', NULL, 1200.00, 450.00, 'kitchen', 1, 0
    UNION ALL SELECT 'mh-lunch', 'MH-QEREFA-SP', 'Qerefa Special (ቀረፋ ስፔሻል)', NULL, 1500.00, 580.00, 'kitchen', 1, 1
    UNION ALL SELECT 'mh-combo', 'MH-SHIRO-TB', 'Shiro with Tibs (ሽሮ - በጥብስ)', NULL, 825.00, 300.00, 'kitchen', 1, 1
    UNION ALL SELECT 'mh-combo', 'MH-DINICH-TB', 'Dinich with Meat and Tibs (ድንች በስጋ - በጥብስ)', NULL, 895.00, 330.00, 'kitchen', 1, 0
    UNION ALL SELECT 'mh-combo', 'MH-MISIR-DN', 'Misir with Dinich with Meat (ምስር - ድንች በስጋ)', NULL, 760.00, 260.00, 'kitchen', 1, 0
    UNION ALL SELECT 'mh-combo', 'MH-FAST-HH', 'Fasting Half-Half (የፆም ሃፍ-ሃፍ)', NULL, 480.00, 140.00, 'kitchen', 1, 0
    UNION ALL SELECT 'mh-coffee', 'MH-BUNA', 'Buna (ቡና)', 'Fresh roasted coffee, served with popcorn.', 60.00, 12.00, 'bar', 1, 1
    UNION ALL SELECT 'mh-coffee', 'MH-MAC', 'Macchiato (ማኪያቶ)', 'Bole-style macchiato.', 80.00, 18.00, 'bar', 1, 1
    UNION ALL SELECT 'mh-coffee', 'MH-TEA', 'Shai (ሻይ)', 'Black tea with ginger or cinnamon.', 40.00, 8.00, 'bar', 1, 0
    UNION ALL SELECT 'mh-cold', 'MH-SPRIS', 'Spris (ስፕሪስ)', 'Layered avocado, mango, and papaya juice.', 120.00, 35.00, 'bar', 1, 0
    UNION ALL SELECT 'mh-cold', 'MH-AVOCADO', 'Avocado Juice (አቮካዶ ጁስ)', 'Blended avocado with a little sugar.', 150.00, 45.00, 'bar', 1, 0
    UNION ALL SELECT 'mh-cold', 'MH-AMBO', 'Ambo (አምቦ)', 'Sparkling mineral water.', 70.00, 28.00, 'bar', 1, 0
    UNION ALL SELECT 'mh-cold', 'MH-COKE', 'Coca-Cola (ኮካ ኮላ)', 'Chilled bottle.', 60.00, 25.00, 'bar', 1, 0
    UNION ALL SELECT 'mh-cold', 'MH-WATER', 'Water (ውሃ)', 'Still water, 500 ml.', 40.00, 12.00, 'bar', 1, 0
    UNION ALL SELECT 'mh-tej', 'MH-GEORGE', 'St. George Beer (ቅዱስ ጊዮርጊስ)', 'Draft bottle, cold.', 90.00, 42.00, 'bar', 1, 0
    UNION ALL SELECT 'mh-tej', 'MH-HABESHA', 'Habesha Cold Gold (ሀበሻ)', 'Local lager.', 100.00, 48.00, 'bar', 1, 0
    UNION ALL SELECT 'mh-tej', 'MH-TEJ', 'Tej, glass (ጠጅ)', 'Honey wine by the glass.', 180.00, 55.00, 'bar', 1, 1
    UNION ALL SELECT 'mh-tej', 'MH-TEJBERELE', 'Tej, berele (ጠጅ በበርሌ)', 'Honey wine in a berele flask.', 350.00, 110.00, 'bar', 1, 0
) v
JOIN menu_categories c ON c.branch_id = @branch AND c.slug = v.slug;

INSERT INTO menu_item_modifiers (menu_item_id, name, additional_price, is_active, created_at, updated_at)
SELECT id, 'Extra egg', 60, 1, NOW(), NOW() FROM menu_items WHERE code = 'MH-DORO';
INSERT INTO menu_item_modifiers (menu_item_id, name, additional_price, is_active, created_at, updated_at)
SELECT id, 'Leb leb (warmed)', 0, 1, NOW(), NOW() FROM menu_items WHERE code = 'MH-KITFO';
INSERT INTO menu_item_modifiers (menu_item_id, name, additional_price, is_active, created_at, updated_at)
SELECT id, 'Extra mitmita', 0, 1, NOW(), NOW() FROM menu_items WHERE code = 'MH-KITFO';
INSERT INTO menu_item_modifiers (menu_item_id, name, additional_price, is_active, created_at, updated_at)
SELECT id, 'Extra awaze', 30, 1, NOW(), NOW() FROM menu_items WHERE code = 'MH-CHIKINA';
INSERT INTO menu_item_modifiers (menu_item_id, name, additional_price, is_active, created_at, updated_at)
SELECT id, 'Less spicy', 0, 1, NOW(), NOW() FROM menu_items WHERE code = 'MH-CHIKINA';
INSERT INTO menu_item_modifiers (menu_item_id, name, additional_price, is_active, created_at, updated_at)
SELECT id, 'Extra awaze', 30, 1, NOW(), NOW() FROM menu_items WHERE code = 'MH-TIBS';

-- ---------------------------------------------------------------------------
-- Orders across the last 7 days, plus tables that are open right now.
-- Totals are calculated after the lines, using the same VAT rules as the app.
-- ---------------------------------------------------------------------------

INSERT INTO orders
    (branch_id, order_number, order_type, restaurant_table_id, customer_name, customer_phone, delivery_address, waiter_id, cashier_id, status, payment_status, notes, subtotal, discount_amount, tax_amount, service_charge_amount, total_amount, amount_paid, cancelled_by, cancellation_reason, created_at, updated_at)
SELECT
    @branch,
    v.order_number,
    v.order_type,
    t.id,
    v.customer_name,
    v.customer_phone,
    v.delivery_address,
    IF(v.waiter = 'dawit', @dawit, @meron),
    IF(v.payment_status = 'paid', @hana, NULL),
    v.status,
    v.payment_status,
    v.notes,
    0, 0, 0, 0, 0, 0,
    IF(v.status = 'cancelled', @kidist, NULL),
    v.cancellation_reason,
    v.created_at,
    v.created_at
FROM (
    SELECT 'MH-T01' AS order_number, 'dine_in' AS order_type, 'H2' AS table_no, 'Ato Getachew Mengistu' AS customer_name, '+251911445520' AS customer_phone, NULL AS delivery_address, 'dawit' AS waiter, 'completed' AS status, 'paid' AS payment_status, 'Birthday lunch for four.' AS notes, NULL AS cancellation_reason, TIMESTAMP(CURDATE(), '12:18:00') AS created_at
    UNION ALL SELECT 'MH-T02', 'dine_in', 'H6', 'W/ro Almaz Bekele', '+251911882014', NULL, 'meron', 'completed', 'paid', NULL, NULL, TIMESTAMP(CURDATE(), '12:42:00')
    UNION ALL SELECT 'MH-T03', 'takeaway', NULL, 'Solomon Tadesse', '+251922118034', NULL, 'dawit', 'completed', 'paid', 'Packed with extra injera on the side.', NULL, TIMESTAMP(CURDATE(), '13:08:00')
    UNION ALL SELECT 'MH-T04', 'dine_in', 'H1', 'Helen Girma', '+251913220845', NULL, 'meron', 'completed', 'paid', NULL, NULL, TIMESTAMP(CURDATE(), '13:22:00')
    UNION ALL SELECT 'MH-T05', 'dine_in', 'G2', 'Biniam Assefa', '+251911670332', NULL, 'dawit', 'completed', 'paid', NULL, NULL, TIMESTAMP(CURDATE(), '13:47:00')
    UNION ALL SELECT 'MH-T06', 'dine_in', 'H5', 'Mekdes Hailu', '+251944118903', NULL, 'meron', 'completed', 'paid', NULL, NULL, TIMESTAMP(CURDATE(), '14:12:00')
    UNION ALL SELECT 'MH-T07', 'delivery', NULL, 'Yared Kebede', '+251913667201', 'Sarbet, near Agona, Addis Ababa', 'dawit', 'completed', 'paid', 'Call when the driver reaches the gate.', NULL, TIMESTAMP(CURDATE(), '14:36:00')
    UNION ALL SELECT 'MH-T08', 'dine_in', 'G4', 'Feven Alemu', '+251911334908', NULL, 'meron', 'completed', 'paid', 'Fasting table. No butter.', NULL, TIMESTAMP(CURDATE(), '15:02:00')
    UNION ALL SELECT 'MH-Y01', 'dine_in', 'H1', 'Ato Mulugeta Worku', '+251911556710', NULL, 'dawit', 'completed', 'paid', 'Sunday family table.', NULL, TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '18:40:00')
    UNION ALL SELECT 'MH-Y02', 'dine_in', 'G5', 'W/ro Tigist Haile', '+251922334118', NULL, 'meron', 'completed', 'paid', NULL, NULL, TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '19:25:00')
    UNION ALL SELECT 'MH-Y03', 'takeaway', NULL, 'Kazanchis office order', '+251911000441', NULL, 'dawit', 'completed', 'paid', 'Office platter, packed in foil.', NULL, TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '20:10:00')
    UNION ALL SELECT 'MH-Y04', 'dine_in', 'K2', 'Ato Nahom Desta', '+251913441220', NULL, 'meron', 'completed', 'paid', 'Private room.', NULL, TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '21:05:00')
    UNION ALL SELECT 'MH-S01', 'dine_in', 'H3', 'W/ro Bethlehem Tesfaye', '+251911772640', NULL, 'dawit', 'completed', 'paid', NULL, NULL, TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 2 DAY), '13:10:00')
    UNION ALL SELECT 'MH-S02', 'dine_in', 'G6', 'Ato Samuel Bekele', '+251922908114', NULL, 'meron', 'completed', 'paid', 'Saturday dinner, eight guests.', NULL, TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 2 DAY), '19:50:00')
    UNION ALL SELECT 'MH-S03', 'delivery', NULL, 'Rahel Girma', '+251913220019', 'CMC Michael, Addis Ababa', 'dawit', 'completed', 'paid', NULL, NULL, TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 2 DAY), '20:40:00')
    UNION ALL SELECT 'MH-F01', 'dine_in', 'H7', 'W/ro Aster Demisse', '+251911640228', NULL, 'meron', 'completed', 'paid', 'Friday fasting lunch.', NULL, TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 3 DAY), '12:55:00')
    UNION ALL SELECT 'MH-F02', 'dine_in', 'K1', 'Ato Yosef Mekonnen', '+251944552019', NULL, 'dawit', 'completed', 'paid', NULL, NULL, TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 3 DAY), '20:15:00')
    UNION ALL SELECT 'MH-H01', 'dine_in', 'H2', 'Marta Alemu', '+251911228764', NULL, 'meron', 'completed', 'paid', NULL, NULL, TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 4 DAY), '13:30:00')
    UNION ALL SELECT 'MH-H02', 'dine_in', 'G3', 'Ato Daniel Teshome', '+251922671045', NULL, 'dawit', 'completed', 'paid', NULL, NULL, TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 4 DAY), '19:10:00')
    UNION ALL SELECT 'MH-W01', 'dine_in', 'H8', 'W/ro Lidya Hailu', '+251913880214', NULL, 'meron', 'completed', 'paid', 'Wednesday fasting.', NULL, TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 5 DAY), '12:50:00')
    UNION ALL SELECT 'MH-W02', 'takeaway', NULL, 'Robel Assefa', '+251911903366', NULL, 'dawit', 'completed', 'paid', NULL, NULL, TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 5 DAY), '18:40:00')
    UNION ALL SELECT 'MH-U01', 'dine_in', 'H4', 'Hanna Worku', '+251944210667', NULL, 'meron', 'completed', 'paid', NULL, NULL, TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 6 DAY), '13:15:00')
    UNION ALL SELECT 'MH-U02', 'dine_in', 'G1', 'Ato Ephrem Bekele', '+251911447812', NULL, 'dawit', 'completed', 'paid', NULL, NULL, TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 6 DAY), '19:45:00')
    UNION ALL SELECT 'MH-O01', 'dine_in', 'H4', 'Ato Bereket Tadesse', '+251911556093', NULL, 'meron', 'in_preparation', 'unpaid', 'Medium spice on the tibs.', NULL, DATE_SUB(NOW(), INTERVAL 20 MINUTE)
    UNION ALL SELECT 'MH-O02', 'dine_in', 'G3', 'W/ro Selamawit Girma', '+251922114870', NULL, 'dawit', 'in_preparation', 'unpaid', 'Guest is waiting on the doro stew.', NULL, DATE_SUB(NOW(), INTERVAL 35 MINUTE)
    UNION ALL SELECT 'MH-O03', 'dine_in', 'K1', 'Ato Henok Abebe', '+251913772451', NULL, 'meron', 'in_preparation', 'unpaid', 'One kitfo raw, one leb leb.', NULL, DATE_SUB(NOW(), INTERVAL 12 MINUTE)
    UNION ALL SELECT 'MH-O04', 'takeaway', NULL, 'Mimi, walk-in', '+251911200348', NULL, 'dawit', 'in_preparation', 'unpaid', 'Pack the pasta separately from the drink.', NULL, DATE_SUB(NOW(), INTERVAL 8 MINUTE)
    UNION ALL SELECT 'MH-X01', 'dine_in', 'H9', 'Ato Tesfaye Negash', '+251911330214', NULL, 'dawit', 'cancelled', 'unpaid', NULL, 'Guest left before the order was fired.', TIMESTAMP(CURDATE(), '13:55:00')
) v
LEFT JOIN restaurant_tables t ON t.branch_id = @branch AND t.table_number = v.table_no;

INSERT INTO order_items
    (order_id, menu_item_id, name, quantity, unit_price, subtotal, special_instructions, status, preparation_department, order_station_id, created_at, updated_at)
SELECT o.id, m.id, m.name, v.qty, m.price, ROUND(m.price * v.qty, 2), v.note,
    IF(o.status = 'cancelled', 'cancelled', 'sent'),
    m.preparation_department, m.order_station_id, o.created_at, o.created_at
FROM (
    SELECT 'MH-T01' AS ord, 'MH-DORO' AS item, 2 AS qty, 'Half spicy' AS note
    UNION ALL SELECT 'MH-T01', 'MH-BEYA', 1, NULL
    UNION ALL SELECT 'MH-T01', 'MH-TEJ', 3, NULL
    UNION ALL SELECT 'MH-T01', 'MH-MAC', 2, NULL
    UNION ALL SELECT 'MH-T02', 'MH-KITFO', 1, 'Leb leb, not raw'
    UNION ALL SELECT 'MH-T02', 'MH-TIBS', 1, NULL
    UNION ALL SELECT 'MH-T02', 'MH-GEORGE', 2, NULL
    UNION ALL SELECT 'MH-T03', 'MH-BEYA', 2, NULL
    UNION ALL SELECT 'MH-T03', 'MH-SHIRO', 1, NULL
    UNION ALL SELECT 'MH-T03', 'MH-WATER', 2, NULL
    UNION ALL SELECT 'MH-T04', 'MH-SHIRO-TB', 2, NULL
    UNION ALL SELECT 'MH-T04', 'MH-TIBS', 1, NULL
    UNION ALL SELECT 'MH-T04', 'MH-SPRIS', 3, NULL
    UNION ALL SELECT 'MH-T04', 'MH-HABESHA', 2, NULL
    UNION ALL SELECT 'MH-T05', 'MH-CHIKINA', 1, NULL
    UNION ALL SELECT 'MH-T05', 'MH-SHIRO-BZ', 1, NULL
    UNION ALL SELECT 'MH-T05', 'MH-AVOCADO', 2, NULL
    UNION ALL SELECT 'MH-T06', 'MH-CHIKINA', 1, 'Extra awaze'
    UNION ALL SELECT 'MH-T06', 'MH-TIBS-FF', 1, NULL
    UNION ALL SELECT 'MH-T06', 'MH-COKE', 2, NULL
    UNION ALL SELECT 'MH-T06', 'MH-TEA', 2, NULL
    UNION ALL SELECT 'MH-T07', 'MH-DORO', 1, NULL
    UNION ALL SELECT 'MH-T07', 'MH-KITFO', 1, 'Raw, mitmita on the side'
    UNION ALL SELECT 'MH-T07', 'MH-TEJBERELE', 1, NULL
    UNION ALL SELECT 'MH-T07', 'MH-QEREFA', 1, NULL
    UNION ALL SELECT 'MH-T08', 'MH-FAST-HH', 2, 'No butter'
    UNION ALL SELECT 'MH-T08', 'MH-SHIRO', 1, NULL
    UNION ALL SELECT 'MH-T08', 'MH-PASTA-T', 1, NULL
    UNION ALL SELECT 'MH-T08', 'MH-WATER', 2, NULL
    UNION ALL SELECT 'MH-Y01', 'MH-DORO', 3, NULL
    UNION ALL SELECT 'MH-Y01', 'MH-KITFO', 2, NULL
    UNION ALL SELECT 'MH-Y01', 'MH-BEYA', 2, NULL
    UNION ALL SELECT 'MH-Y01', 'MH-TEJBERELE', 2, NULL
    UNION ALL SELECT 'MH-Y01', 'MH-GEORGE', 4, NULL
    UNION ALL SELECT 'MH-Y02', 'MH-CHIKINA', 2, NULL
    UNION ALL SELECT 'MH-Y02', 'MH-DULET', 1, NULL
    UNION ALL SELECT 'MH-Y02', 'MH-FIRFIR-M', 1, NULL
    UNION ALL SELECT 'MH-Y02', 'MH-AVOCADO', 3, NULL
    UNION ALL SELECT 'MH-Y02', 'MH-MAC', 3, NULL
    UNION ALL SELECT 'MH-Y03', 'MH-DORO', 4, NULL
    UNION ALL SELECT 'MH-Y03', 'MH-TIBS', 2, NULL
    UNION ALL SELECT 'MH-Y03', 'MH-SHIRO', 4, NULL
    UNION ALL SELECT 'MH-Y03', 'MH-QEREFA-SP', 1, NULL
    UNION ALL SELECT 'MH-Y04', 'MH-SHIRO-TB', 2, NULL
    UNION ALL SELECT 'MH-Y04', 'MH-BEYA', 2, NULL
    UNION ALL SELECT 'MH-Y04', 'MH-TEJ', 4, NULL
    UNION ALL SELECT 'MH-S01', 'MH-DORO', 2, NULL
    UNION ALL SELECT 'MH-S01', 'MH-KITFO', 2, NULL
    UNION ALL SELECT 'MH-S01', 'MH-BEYA', 1, NULL
    UNION ALL SELECT 'MH-S01', 'MH-TEJ', 4, NULL
    UNION ALL SELECT 'MH-S02', 'MH-CHIKINA', 2, NULL
    UNION ALL SELECT 'MH-S02', 'MH-KITFO', 1, NULL
    UNION ALL SELECT 'MH-S02', 'MH-DORO', 1, NULL
    UNION ALL SELECT 'MH-S02', 'MH-HABESHA', 4, NULL
    UNION ALL SELECT 'MH-S02', 'MH-SPRIS', 2, NULL
    UNION ALL SELECT 'MH-S03', 'MH-DINICH-TB', 2, NULL
    UNION ALL SELECT 'MH-S03', 'MH-SHIRO-TB', 2, NULL
    UNION ALL SELECT 'MH-S03', 'MH-DORO', 2, NULL
    UNION ALL SELECT 'MH-F01', 'MH-BEYA', 3, NULL
    UNION ALL SELECT 'MH-F01', 'MH-SHIRO', 2, NULL
    UNION ALL SELECT 'MH-F01', 'MH-FAST-HH', 2, NULL
    UNION ALL SELECT 'MH-F01', 'MH-WATER', 4, NULL
    UNION ALL SELECT 'MH-F01', 'MH-BUNA', 3, NULL
    UNION ALL SELECT 'MH-F02', 'MH-KITFO', 2, NULL
    UNION ALL SELECT 'MH-F02', 'MH-TIBS', 2, NULL
    UNION ALL SELECT 'MH-F02', 'MH-TEJBERELE', 2, NULL
    UNION ALL SELECT 'MH-H01', 'MH-DORO', 1, NULL
    UNION ALL SELECT 'MH-H01', 'MH-TIBS-FF', 2, NULL
    UNION ALL SELECT 'MH-H01', 'MH-MAC', 2, NULL
    UNION ALL SELECT 'MH-H01', 'MH-AMBO', 2, NULL
    UNION ALL SELECT 'MH-H02', 'MH-CHIKINA', 1, NULL
    UNION ALL SELECT 'MH-H02', 'MH-SHIRO-TB', 2, NULL
    UNION ALL SELECT 'MH-H02', 'MH-GEORGE', 3, NULL
    UNION ALL SELECT 'MH-W01', 'MH-FAST-HH', 2, NULL
    UNION ALL SELECT 'MH-W01', 'MH-SHIRO', 2, NULL
    UNION ALL SELECT 'MH-W01', 'MH-PASTA-T', 1, NULL
    UNION ALL SELECT 'MH-W01', 'MH-TEA', 3, NULL
    UNION ALL SELECT 'MH-W02', 'MH-KITFO', 1, NULL
    UNION ALL SELECT 'MH-W02', 'MH-DULET', 1, NULL
    UNION ALL SELECT 'MH-W02', 'MH-BREAD-FF', 1, NULL
    UNION ALL SELECT 'MH-U01', 'MH-SHIRO-BZ', 2, NULL
    UNION ALL SELECT 'MH-U01', 'MH-DORO', 1, NULL
    UNION ALL SELECT 'MH-U01', 'MH-SPRIS', 2, NULL
    UNION ALL SELECT 'MH-U01', 'MH-WATER', 2, NULL
    UNION ALL SELECT 'MH-U02', 'MH-CHIKINA', 1, NULL
    UNION ALL SELECT 'MH-U02', 'MH-SIGA-W', 1, NULL
    UNION ALL SELECT 'MH-U02', 'MH-TEJ', 3, NULL
    UNION ALL SELECT 'MH-U02', 'MH-BUNA', 2, NULL
    UNION ALL SELECT 'MH-O01', 'MH-CHIKINA', 1, 'Medium spicy'
    UNION ALL SELECT 'MH-O01', 'MH-TEJ', 2, NULL
    UNION ALL SELECT 'MH-O01', 'MH-MAC', 1, NULL
    UNION ALL SELECT 'MH-O02', 'MH-DORO', 1, NULL
    UNION ALL SELECT 'MH-O02', 'MH-QEREFA', 1, NULL
    UNION ALL SELECT 'MH-O02', 'MH-BEYA', 1, NULL
    UNION ALL SELECT 'MH-O03', 'MH-KITFO', 2, 'One raw, one leb leb'
    UNION ALL SELECT 'MH-O03', 'MH-TEJBERELE', 1, NULL
    UNION ALL SELECT 'MH-O04', 'MH-PASTA-M', 1, NULL
    UNION ALL SELECT 'MH-O04', 'MH-COKE', 1, NULL
    UNION ALL SELECT 'MH-X01', 'MH-BEYA', 1, NULL
    UNION ALL SELECT 'MH-X01', 'MH-BUNA', 2, NULL
) v
JOIN orders o ON o.order_number = v.ord
JOIN menu_items m ON m.code = v.item;

UPDATE orders o
JOIN (
    SELECT order_id, ROUND(SUM(CASE WHEN status = 'voided' THEN 0 ELSE subtotal END), 2) AS subtotal
    FROM order_items
    GROUP BY order_id
) x ON x.order_id = o.id
SET
    o.subtotal = x.subtotal,
    o.service_charge_amount = IF(o.order_type = 'dine_in', ROUND(x.subtotal * 0.10, 2), 0),
    o.tax_amount = ROUND((x.subtotal + IF(o.order_type = 'dine_in', ROUND(x.subtotal * 0.10, 2), 0)) * 0.15, 2),
    o.total_amount = ROUND(
        x.subtotal
        + IF(o.order_type = 'dine_in', ROUND(x.subtotal * 0.10, 2), 0)
        + ROUND((x.subtotal + IF(o.order_type = 'dine_in', ROUND(x.subtotal * 0.10, 2), 0)) * 0.15, 2)
    , 2)
WHERE o.order_number LIKE 'MH-%';

UPDATE orders
SET amount_paid = IF(payment_status = 'paid', total_amount, 0)
WHERE order_number LIKE 'MH-%';

INSERT INTO payments (order_id, branch_id, method, amount, reference, received_by, paid_at, created_at, updated_at)
SELECT
    o.id,
    o.branch_id,
    ELT(MOD(o.id, 4) + 1, 'cash', 'telebirr', 'cbe_birr', 'card'),
    o.total_amount,
    CONCAT(ELT(MOD(o.id, 4) + 1, 'CASH', 'TB', 'CBE', 'CARD'), '-', o.order_number),
    @hana,
    o.created_at,
    o.created_at,
    o.created_at
FROM orders o
WHERE o.order_number LIKE 'MH-%' AND o.payment_status = 'paid';

INSERT INTO order_status_history (order_id, status_from, status_to, changed_by, comments, created_at)
SELECT id, NULL, 'in_preparation', waiter_id, 'Sent to the kitchen and bar.', created_at
FROM orders WHERE order_number LIKE 'MH-%';

INSERT INTO order_status_history (order_id, status_from, status_to, changed_by, comments, created_at)
SELECT id, 'in_preparation', 'completed', cashier_id, 'Bill settled.', created_at
FROM orders WHERE order_number LIKE 'MH-%' AND status = 'completed';

INSERT INTO order_status_history (order_id, status_from, status_to, changed_by, comments, created_at)
SELECT id, 'in_preparation', 'cancelled', cancelled_by, cancellation_reason, created_at
FROM orders WHERE order_number LIKE 'MH-%' AND status = 'cancelled';

INSERT INTO kitchen_bar_tickets
    (branch_id, order_id, order_station_id, ticket_number, department, status, sent_at, started_at, created_at, updated_at)
SELECT @branch, o.id, @st_hot, CONCAT('K-', o.order_number), 'kitchen', 'queued', o.created_at,
    IF(o.order_number = 'MH-O02', DATE_ADD(o.created_at, INTERVAL 4 MINUTE), NULL),
    o.created_at, o.created_at
FROM orders o
WHERE o.order_number IN ('MH-O01', 'MH-O02', 'MH-O03', 'MH-O04')
  AND EXISTS (
      SELECT 1 FROM order_items i
      WHERE i.order_id = o.id AND i.preparation_department = 'kitchen'
  );

INSERT INTO kitchen_bar_tickets
    (branch_id, order_id, order_station_id, ticket_number, department, status, sent_at, created_at, updated_at)
SELECT @branch, o.id, @st_bar, CONCAT('B-', o.order_number), 'bar', 'queued', o.created_at, o.created_at, o.created_at
FROM orders o
WHERE o.order_number IN ('MH-O01', 'MH-O02', 'MH-O03', 'MH-O04')
  AND EXISTS (
      SELECT 1 FROM order_items i
      WHERE i.order_id = o.id AND i.preparation_department = 'bar'
  );

INSERT INTO ticket_items (ticket_id, order_item_id, quantity, special_instructions, status, created_at, updated_at)
SELECT t.id, i.id, i.quantity, i.special_instructions, 'queued', t.created_at, t.created_at
FROM kitchen_bar_tickets t
JOIN orders o ON o.id = t.order_id
JOIN order_items i ON i.order_id = o.id AND i.preparation_department = t.department
WHERE o.order_number LIKE 'MH-O%';

UPDATE restaurant_tables
SET status = 'occupied'
WHERE branch_id = @branch AND table_number IN ('H4', 'G3', 'K1');

-- ---------------------------------------------------------------------------
-- Store, suppliers, and purchase orders
-- ---------------------------------------------------------------------------

INSERT INTO inventory_categories (name, code, description, created_at, updated_at) VALUES
    ('Grains', 'MH-GRAIN', 'Teff and flour for injera', NOW(), NOW()),
    ('Spices', 'MH-SPICE', 'Berbere, mitmita, and kibbeh', NOW(), NOW()),
    ('Meat & poultry', 'MH-MEAT', 'Beef, chicken, and fish', NOW(), NOW()),
    ('Produce', 'MH-PRODUCE', 'Onions, greens, and fasting vegetables', NOW(), NOW()),
    ('Dairy & eggs', 'MH-DAIRY', 'Ayib, butter, and eggs', NOW(), NOW()),
    ('Beverages', 'MH-BEV', 'Coffee, beer, water, and tej inputs', NOW(), NOW());

INSERT INTO inventory_items (branch_id, category_id, code, name, unit, unit_cost, is_active, created_at, updated_at)
SELECT @branch, c.id, v.code, v.name, v.unit, v.unit_cost, 1, NOW(), NOW()
FROM (
    SELECT 'MH-GRAIN' AS cat, 'MH-TEFF' AS code, 'Red teff flour' AS name, 'kg' AS unit, 180.00 AS unit_cost
    UNION ALL SELECT 'MH-GRAIN', 'MH-TEFFW', 'White teff flour', 'kg', 160.00
    UNION ALL SELECT 'MH-SPICE', 'MH-BERBERE', 'Berbere', 'kg', 450.00
    UNION ALL SELECT 'MH-SPICE', 'MH-MITMITA', 'Mitmita', 'kg', 520.00
    UNION ALL SELECT 'MH-SPICE', 'MH-KIBBEH', 'Niter kibbeh', 'kg', 900.00
    UNION ALL SELECT 'MH-SPICE', 'MH-SHIROPOW', 'Shiro powder', 'kg', 220.00
    UNION ALL SELECT 'MH-MEAT', 'MH-BEEF', 'Beef, topside', 'kg', 780.00
    UNION ALL SELECT 'MH-MEAT', 'MH-CHICKEN', 'Chicken, whole', 'pcs', 420.00
    UNION ALL SELECT 'MH-MEAT', 'MH-FISHKG', 'Nile perch', 'kg', 550.00
    UNION ALL SELECT 'MH-PRODUCE', 'MH-ONION', 'Red onion', 'kg', 45.00
    UNION ALL SELECT 'MH-PRODUCE', 'MH-TOMATO', 'Tomato', 'kg', 40.00
    UNION ALL SELECT 'MH-PRODUCE', 'MH-GOMENKG', 'Gomen, bunch', 'kg', 35.00
    UNION ALL SELECT 'MH-PRODUCE', 'MH-LENTIL', 'Misir, red lentil', 'kg', 140.00
    UNION ALL SELECT 'MH-DAIRY', 'MH-AYIBKG', 'Ayib', 'kg', 280.00
    UNION ALL SELECT 'MH-DAIRY', 'MH-EGGS', 'Eggs', 'tray', 220.00
    UNION ALL SELECT 'MH-BEV', 'MH-COFFEE', 'Yirgacheffe coffee', 'kg', 650.00
    UNION ALL SELECT 'MH-BEV', 'MH-HONEY', 'White honey, for tej', 'kg', 480.00
    UNION ALL SELECT 'MH-BEV', 'MH-BEER', 'St. George, crate', 'crate', 1800.00
    UNION ALL SELECT 'MH-BEV', 'MH-AMBOC', 'Ambo, crate', 'crate', 900.00
) v
JOIN inventory_categories c ON c.code = v.cat;

INSERT INTO inventory_stocks (branch_id, inventory_item_id, current_stock, min_stock_level, created_at, updated_at)
SELECT @branch, i.id, v.on_hand, v.minimum, NOW(), NOW()
FROM (
    SELECT 'MH-TEFF' AS code, 86.0000 AS on_hand, 25.0000 AS minimum
    UNION ALL SELECT 'MH-TEFFW', 40, 15
    UNION ALL SELECT 'MH-BERBERE', 12.5, 4
    UNION ALL SELECT 'MH-MITMITA', 3.2, 1.5
    UNION ALL SELECT 'MH-KIBBEH', 8, 3
    UNION ALL SELECT 'MH-SHIROPOW', 18, 6
    UNION ALL SELECT 'MH-BEEF', 22, 10
    UNION ALL SELECT 'MH-CHICKEN', 16, 8
    UNION ALL SELECT 'MH-FISHKG', 9, 4
    UNION ALL SELECT 'MH-ONION', 12, 25
    UNION ALL SELECT 'MH-TOMATO', 6, 15
    UNION ALL SELECT 'MH-GOMENKG', 3, 8
    UNION ALL SELECT 'MH-LENTIL', 28, 10
    UNION ALL SELECT 'MH-AYIBKG', 6, 3
    UNION ALL SELECT 'MH-EGGS', 11, 4
    UNION ALL SELECT 'MH-COFFEE', 2.5, 6
    UNION ALL SELECT 'MH-HONEY', 7, 3
    UNION ALL SELECT 'MH-BEER', 14, 6
    UNION ALL SELECT 'MH-AMBOC', 9, 4
) v
JOIN inventory_items i ON i.code = v.code;

INSERT INTO stock_transactions
    (branch_id, inventory_item_id, type, quantity, balance_after, unit_cost, total_cost, user_id, notes, created_at, updated_at)
SELECT @branch, i.id, v.type, v.qty, v.balance_after, i.unit_cost, ROUND(v.qty * i.unit_cost, 2), @abel, v.notes, v.at, v.at
FROM (
    SELECT 'MH-TEFF' AS code, 'in' AS type, 100.0000 AS qty, 100.0000 AS balance_after, 'Merkato delivery, red teff.' AS notes, DATE_SUB(NOW(), INTERVAL 2 DAY) AS at
    UNION ALL SELECT 'MH-TEFF', 'out', 14, 86, 'Issued to the injera kitchen.', DATE_SUB(NOW(), INTERVAL 6 HOUR)
    UNION ALL SELECT 'MH-ONION', 'in', 40, 40, 'Shola market purchase.', DATE_SUB(NOW(), INTERVAL 3 DAY)
    UNION ALL SELECT 'MH-ONION', 'out', 22, 18, 'Issued to the hot kitchen.', DATE_SUB(NOW(), INTERVAL 1 DAY)
    UNION ALL SELECT 'MH-ONION', 'wastage', 6, 12, 'Soft onions discarded this morning.', DATE_SUB(NOW(), INTERVAL 5 HOUR)
    UNION ALL SELECT 'MH-BERBERE', 'in', 12.5, 12.5, 'House berbere from Merkato Spice House.', DATE_SUB(NOW(), INTERVAL 4 DAY)
    UNION ALL SELECT 'MH-BEEF', 'in', 30, 30, 'Morning delivery from Kera.', DATE_SUB(NOW(), INTERVAL 8 HOUR)
    UNION ALL SELECT 'MH-BEEF', 'out', 8, 22, 'Kitfo and tibs prep.', DATE_SUB(NOW(), INTERVAL 3 HOUR)
    UNION ALL SELECT 'MH-COFFEE', 'in', 5, 5, 'Yirgacheffe beans.', DATE_SUB(NOW(), INTERVAL 5 DAY)
    UNION ALL SELECT 'MH-COFFEE', 'out', 2.5, 2.5, 'Bar roast for the week.', DATE_SUB(NOW(), INTERVAL 1 DAY)
) v
JOIN inventory_items i ON i.code = v.code;

INSERT INTO suppliers (name, contact_person, phone, email, address, tax_number, is_active, created_at, updated_at) VALUES
    ('Merkato Spice House', 'Ato Kebede Tessema', '+251911445090', 'kebede@merkatospice.et', 'Merkato, Addis Ababa', 'MH-TIN-001', 1, NOW(), NOW()),
    ('Kera Meat Supply', 'W/ro Meseret Abebe', '+251922330187', 'meseret@kerameat.et', 'Kera, Addis Ababa', 'MH-TIN-002', 1, NOW(), NOW()),
    ('Shola Fresh Produce', 'Ato Tariku Hailu', '+251913220764', 'tariku@sholafresh.et', 'Shola Market, Addis Ababa', 'MH-TIN-003', 1, NOW(), NOW()),
    ('Bole Beverage Trade', 'Sara Getachew', '+251911670441', 'orders@bolebev.et', 'Kazanchis, Addis Ababa', 'MH-TIN-004', 1, NOW(), NOW());

SET @sup_spice = (SELECT id FROM suppliers WHERE tax_number = 'MH-TIN-001');
SET @sup_meat = (SELECT id FROM suppliers WHERE tax_number = 'MH-TIN-002');
SET @sup_produce = (SELECT id FROM suppliers WHERE tax_number = 'MH-TIN-003');
SET @sup_bev = (SELECT id FROM suppliers WHERE tax_number = 'MH-TIN-004');

INSERT INTO purchase_orders (branch_id, supplier_id, po_number, status, total_amount, created_by, notes, created_at, updated_at) VALUES
    (@branch, @sup_spice, 'MH-PO-1048', 'received', 0, @frehiwot, 'Weekly berbere, mitmita, and kibbeh.', DATE_SUB(NOW(), INTERVAL 4 DAY), DATE_SUB(NOW(), INTERVAL 4 DAY));
SET @po_spice = LAST_INSERT_ID();
INSERT INTO purchase_orders (branch_id, supplier_id, po_number, status, total_amount, created_by, notes, created_at, updated_at) VALUES
    (@branch, @sup_produce, 'MH-PO-1052', 'pending', 0, @frehiwot, 'Onions, tomato, and gomen are below the minimum.', DATE_SUB(NOW(), INTERVAL 3 HOUR), DATE_SUB(NOW(), INTERVAL 3 HOUR));
SET @po_produce = LAST_INSERT_ID();
INSERT INTO purchase_orders (branch_id, supplier_id, po_number, status, total_amount, created_by, notes, created_at, updated_at) VALUES
    (@branch, @sup_meat, 'MH-PO-1055', 'pending', 0, @frehiwot, 'Saturday cover. Confirm the beef cut before noon.', DATE_SUB(NOW(), INTERVAL 1 HOUR), DATE_SUB(NOW(), INTERVAL 1 HOUR));
SET @po_meat = LAST_INSERT_ID();
INSERT INTO purchase_orders (branch_id, supplier_id, po_number, status, total_amount, created_by, notes, created_at, updated_at) VALUES
    (@branch, @sup_bev, 'MH-PO-1044', 'received', 0, @frehiwot, 'Beer and Ambo for the weekend.', DATE_SUB(NOW(), INTERVAL 6 DAY), DATE_SUB(NOW(), INTERVAL 6 DAY));
SET @po_bev = LAST_INSERT_ID();

INSERT INTO purchase_order_items
    (purchase_order_id, inventory_item_id, name, quantity_ordered, quantity_received, unit, unit_cost, subtotal, created_at, updated_at)
SELECT v.po_id, i.id, i.name, v.qty, v.received, i.unit, i.unit_cost, ROUND(v.qty * i.unit_cost, 2), NOW(), NOW()
FROM (
    SELECT @po_spice AS po_id, 'MH-BERBERE' AS code, 10.0000 AS qty, 10.0000 AS received
    UNION ALL SELECT @po_spice, 'MH-MITMITA', 3, 3
    UNION ALL SELECT @po_spice, 'MH-KIBBEH', 8, 8
    UNION ALL SELECT @po_produce, 'MH-ONION', 50, 0
    UNION ALL SELECT @po_produce, 'MH-TOMATO', 30, 0
    UNION ALL SELECT @po_produce, 'MH-GOMENKG', 20, 0
    UNION ALL SELECT @po_meat, 'MH-BEEF', 40, 0
    UNION ALL SELECT @po_meat, 'MH-CHICKEN', 24, 0
    UNION ALL SELECT @po_bev, 'MH-BEER', 12, 12
    UNION ALL SELECT @po_bev, 'MH-AMBOC', 8, 8
) v
JOIN inventory_items i ON i.code = v.code;

UPDATE purchase_orders po
JOIN (
    SELECT purchase_order_id, ROUND(SUM(subtotal), 2) AS total_amount
    FROM purchase_order_items
    GROUP BY purchase_order_id
) x ON x.purchase_order_id = po.id
SET po.total_amount = x.total_amount
WHERE po.po_number LIKE 'MH-PO-%';

COMMIT;

SELECT 'QEREFA showcase is loaded.' AS message;
SELECT order_number, status, payment_status, order_type, subtotal, service_charge_amount, tax_amount, total_amount
FROM orders
WHERE order_number LIKE 'MH-%'
ORDER BY created_at;
