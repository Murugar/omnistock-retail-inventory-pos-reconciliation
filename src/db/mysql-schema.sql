-- =====================================================================
-- OmniStock Enterprise Retail Inventory & POS Reconciliation Schema
-- Engine: MySQL 8.0+ (InnoDB)
-- Charset: utf8mb4 / Collation: utf8mb4_unicode_ci
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `omnistock_inventory` 
DEFAULT CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `omnistock_inventory`;

-- ---------------------------------------------------------------------
-- 1. USERS, ROLES & ACCESS CONTROL
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `roles` (
    `id` VARCHAR(36) PRIMARY KEY,
    `role_code` VARCHAR(50) NOT NULL UNIQUE,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(255),
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `users` (
    `id` VARCHAR(36) PRIMARY KEY,
    `email` VARCHAR(150) NOT NULL UNIQUE,
    `full_name` VARCHAR(150) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role_code` VARCHAR(50) NOT NULL,
    `store_location_id` VARCHAR(36) NULL,
    `is_active` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `last_login_at` TIMESTAMP NULL,
    FOREIGN KEY (`role_code`) REFERENCES `roles`(`role_code`) ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2. STORES & WAREHOUSE LOCATIONS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `store_locations` (
    `id` VARCHAR(36) PRIMARY KEY,
    `location_code` VARCHAR(30) NOT NULL UNIQUE,
    `name` VARCHAR(120) NOT NULL,
    `type` ENUM('central_warehouse', 'retail_flagship', 'mall_boutique', 'fulfillment_hub') NOT NULL,
    `address` VARCHAR(255) NOT NULL,
    `city` VARCHAR(80) NOT NULL,
    `manager_name` VARCHAR(100),
    `phone` VARCHAR(30),
    `is_active` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3. PRODUCT CATALOG, CATEGORIES & SKU VARIANTS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `product_categories` (
    `id` VARCHAR(36) PRIMARY KEY,
    `code` VARCHAR(30) NOT NULL UNIQUE,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `products` (
    `id` VARCHAR(36) PRIMARY KEY,
    `sku_base` VARCHAR(50) NOT NULL UNIQUE,
    `name` VARCHAR(200) NOT NULL,
    `brand` VARCHAR(100) NOT NULL,
    `category_id` VARCHAR(36) NOT NULL,
    `description` TEXT,
    `image_url` VARCHAR(500),
    `status` ENUM('active', 'discontinued', 'draft') DEFAULT 'active',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`category_id`) REFERENCES `product_categories`(`id`) ON DELETE RESTRICT,
    INDEX `idx_products_brand` (`brand`),
    INDEX `idx_products_category` (`category_id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `product_variants` (
    `id` VARCHAR(36) PRIMARY KEY,
    `product_id` VARCHAR(36) NOT NULL,
    `sku` VARCHAR(60) NOT NULL UNIQUE,
    `barcode` VARCHAR(50) NOT NULL UNIQUE,
    `variant_name` VARCHAR(120) NOT NULL,
    `attributes_json` JSON NOT NULL, -- e.g. {"size": "M", "color": "Olive Green"}
    `unit_cost` DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
    `unit_price` DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
    `supplier` VARCHAR(150) NOT NULL,
    `supplier_code` VARCHAR(60),
    `lead_time_days` INT DEFAULT 7,
    `weight_grams` INT NULL,
    `status` ENUM('active', 'discontinued', 'draft') DEFAULT 'active',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE,
    INDEX `idx_variants_sku` (`sku`),
    INDEX `idx_variants_barcode` (`barcode`)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4. INVENTORY BALANCES (PER LOCATION)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `inventory_balances` (
    `id` VARCHAR(36) PRIMARY KEY,
    `sku_id` VARCHAR(36) NOT NULL,
    `location_id` VARCHAR(36) NOT NULL,
    `quantity_on_hand` INT NOT NULL DEFAULT 0,
    `quantity_allocated` INT NOT NULL DEFAULT 0,
    `quantity_available` INT GENERATED ALWAYS AS (`quantity_on_hand` - `quantity_allocated`) STORED,
    `min_reorder_point` INT NOT NULL DEFAULT 10,
    `max_capacity` INT NOT NULL DEFAULT 200,
    `last_counted_at` TIMESTAMP NULL,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_sku_location` (`sku_id`, `location_id`),
    FOREIGN KEY (`sku_id`) REFERENCES `product_variants`(`id`) ON DELETE RESTRICT,
    FOREIGN KEY (`location_id`) REFERENCES `store_locations`(`id`) ON DELETE RESTRICT,
    INDEX `idx_inventory_onhand` (`quantity_on_hand`),
    INDEX `idx_inventory_reorder` (`quantity_on_hand`, `min_reorder_point`)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5. INVENTORY TRANSACTION LEDGER (IMMUTABLE LOG)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `inventory_transactions` (
    `id` VARCHAR(36) PRIMARY KEY,
    `sku_id` VARCHAR(36) NOT NULL,
    `location_id` VARCHAR(36) NOT NULL,
    `transaction_type` ENUM(
        'receipt', 
        'pos_sale', 
        'customer_return', 
        'transfer_out', 
        'transfer_in', 
        'adjustment_shrinkage', 
        'adjustment_surplus', 
        'damage_write_off'
    ) NOT NULL,
    `quantity_delta` INT NOT NULL,
    `balance_before` INT NOT NULL,
    `balance_after` INT NOT NULL,
    `unit_cost` DECIMAL(12, 4) NOT NULL,
    `total_valuation_delta` DECIMAL(14, 4) NOT NULL,
    `reference_type` ENUM('PO', 'POS_RECEIPT', 'RETURN_AUTH', 'TRANSFER_ORDER', 'RECON_SESSION', 'MANUAL_AUDIT') NOT NULL,
    `reference_id` VARCHAR(100) NOT NULL,
    `performed_by_user_id` VARCHAR(36) NOT NULL,
    `notes` TEXT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`sku_id`) REFERENCES `product_variants`(`id`) ON DELETE RESTRICT,
    FOREIGN KEY (`location_id`) REFERENCES `store_locations`(`id`) ON DELETE RESTRICT,
    INDEX `idx_trans_sku` (`sku_id`),
    INDEX `idx_trans_type` (`transaction_type`),
    INDEX `idx_trans_created` (`created_at`),
    INDEX `idx_trans_ref` (`reference_type`, `reference_id`)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 6. POS INTEGRATIONS & SALES IMPORT
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pos_integrations` (
    `id` VARCHAR(36) PRIMARY KEY,
    `provider` ENUM('square', 'shopify', 'lightspeed', 'clover', 'toast') NOT NULL,
    `location_id` VARCHAR(36) NOT NULL,
    `api_key_masked` VARCHAR(50) NOT NULL,
    `webhook_endpoint` VARCHAR(255) NOT NULL,
    `status` ENUM('active', 'syncing', 'error', 'paused') DEFAULT 'active',
    `last_sync_at` TIMESTAMP NULL,
    `total_synced_sales` INT DEFAULT 0,
    `total_sales_volume` DECIMAL(14, 2) DEFAULT 0.00,
    FOREIGN KEY (`location_id`) REFERENCES `store_locations`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `pos_sales` (
    `id` VARCHAR(36) PRIMARY KEY,
    `pos_provider` VARCHAR(50) NOT NULL,
    `external_order_id` VARCHAR(100) NOT NULL,
    `location_id` VARCHAR(36) NOT NULL,
    `terminal_id` VARCHAR(50) NOT NULL,
    `cashier_name` VARCHAR(100),
    `subtotal` DECIMAL(12, 2) NOT NULL,
    `tax` DECIMAL(12, 2) NOT NULL,
    `total` DECIMAL(12, 2) NOT NULL,
    `payment_method` VARCHAR(50) NOT NULL,
    `inventory_status` ENUM('synced', 'pending_reconciliation', 'discrepancy_alert') DEFAULT 'synced',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_pos_order` (`pos_provider`, `external_order_id`),
    FOREIGN KEY (`location_id`) REFERENCES `store_locations`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `pos_sale_items` (
    `id` VARCHAR(36) PRIMARY KEY,
    `pos_sale_id` VARCHAR(36) NOT NULL,
    `sku` VARCHAR(60) NOT NULL,
    `quantity` INT NOT NULL,
    `unit_price` DECIMAL(12, 2) NOT NULL,
    `tax_amount` DECIMAL(12, 2) NOT NULL,
    FOREIGN KEY (`pos_sale_id`) REFERENCES `pos_sales`(`id`) ON DELETE CASCADE,
    INDEX `idx_sale_sku` (`sku`)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 7. PHYSICAL COUNT & RECONCILIATION ENGINE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `reconciliation_sessions` (
    `id` VARCHAR(36) PRIMARY KEY,
    `session_code` VARCHAR(50) NOT NULL UNIQUE,
    `location_id` VARCHAR(36) NOT NULL,
    `category_filter` VARCHAR(100) NULL,
    `status` ENUM('in_progress', 'pending_manager_approval', 'approved_posted', 'cancelled') DEFAULT 'in_progress',
    `started_by` VARCHAR(100) NOT NULL,
    `finalized_by` VARCHAR(100) NULL,
    `total_expected_units` INT DEFAULT 0,
    `total_counted_units` INT DEFAULT 0,
    `net_variance_units` INT DEFAULT 0,
    `net_variance_cost` DECIMAL(14, 4) DEFAULT 0.0000,
    `variance_rate_percent` DECIMAL(6, 2) DEFAULT 0.00,
    `manager_notes` TEXT NULL,
    `started_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `finalized_at` TIMESTAMP NULL,
    FOREIGN KEY (`location_id`) REFERENCES `store_locations`(`id`) ON DELETE RESTRICT,
    INDEX `idx_recon_status` (`status`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `reconciliation_items` (
    `id` VARCHAR(36) PRIMARY KEY,
    `session_id` VARCHAR(36) NOT NULL,
    `sku_id` VARCHAR(36) NOT NULL,
    `expected_on_hand` INT NOT NULL,
    `physical_count` INT NULL,
    `variance_units` INT GENERATED ALWAYS AS (COALESCE(`physical_count`, `expected_on_hand`) - `expected_on_hand`) VIRTUAL,
    `unit_cost` DECIMAL(12, 4) NOT NULL,
    `variance_cost` DECIMAL(14, 4) GENERATED ALWAYS AS (`variance_units` * `unit_cost`) VIRTUAL,
    `severity` ENUM('match', 'minor', 'critical_shrinkage', 'critical_surplus') DEFAULT 'match',
    `reason_code` ENUM(
        'theft_shoplifting', 
        'damaged_spoilage', 
        'pos_misscan', 
        'vendor_shortage', 
        'unrecorded_return', 
        'clerical_count_error', 
        'unresolved'
    ) DEFAULT 'unresolved',
    `counter_notes` VARCHAR(255) NULL,
    `is_reviewed` BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (`session_id`) REFERENCES `reconciliation_sessions`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`sku_id`) REFERENCES `product_variants`(`id`) ON DELETE RESTRICT,
    UNIQUE KEY `uk_session_sku` (`session_id`, `sku_id`)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 8. AUDIT TRAILS & ACTIVITY LOG
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_trail_entries` (
    `id` VARCHAR(36) PRIMARY KEY,
    `user_id` VARCHAR(36) NOT NULL,
    `user_name` VARCHAR(150) NOT NULL,
    `user_role` VARCHAR(50) NOT NULL,
    `action` VARCHAR(100) NOT NULL,
    `entity_type` VARCHAR(50) NOT NULL,
    `entity_id` VARCHAR(60) NOT NULL,
    `details` TEXT NOT NULL,
    `ip_address` VARCHAR(45) NOT NULL,
    `previous_state_json` JSON NULL,
    `new_state_json` JSON NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_audit_entity` (`entity_type`, `entity_id`),
    INDEX `idx_audit_user` (`user_id`),
    INDEX `idx_audit_time` (`created_at`)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 9. REPORTING VIEWS
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW `v_inventory_valuation` AS
SELECT 
    l.id AS location_id,
    l.name AS location_name,
    c.name AS category_name,
    COUNT(DISTINCT v.id) AS total_skus,
    SUM(ib.quantity_on_hand) AS total_units_on_hand,
    SUM(ib.quantity_on_hand * v.unit_cost) AS total_asset_valuation_cost,
    SUM(ib.quantity_on_hand * v.unit_price) AS total_retail_valuation
FROM inventory_balances ib
JOIN product_variants v ON ib.sku_id = v.id
JOIN products p ON v.product_id = p.id
JOIN product_categories c ON p.category_id = c.id
JOIN store_locations l ON ib.location_id = l.id
GROUP BY l.id, l.name, c.name;

CREATE OR REPLACE VIEW `v_reconciliation_exceptions` AS
SELECT 
    rs.session_code,
    rs.location_id,
    l.name AS location_name,
    v.sku,
    v.barcode,
    p.name AS product_name,
    v.variant_name,
    ri.expected_on_hand,
    ri.physical_count,
    ri.variance_units,
    ri.variance_cost,
    ri.severity,
    ri.reason_code
FROM reconciliation_items ri
JOIN reconciliation_sessions rs ON ri.session_id = rs.id
JOIN product_variants v ON ri.sku_id = v.id
JOIN products p ON v.product_id = p.id
JOIN store_locations l ON rs.location_id = l.id
WHERE ri.variance_units != 0;

-- ---------------------------------------------------------------------
-- 10. STORED PROCEDURE: EXECUTE RECONCILIATION ADJUSTMENT
-- ---------------------------------------------------------------------
DELIMITER $$
CREATE PROCEDURE `sp_finalize_reconciliation`(
    IN in_session_id VARCHAR(36),
    IN in_manager_id VARCHAR(36),
    IN in_manager_notes TEXT
)
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE var_sku_id VARCHAR(36);
    DECLARE var_loc_id VARCHAR(36);
    DECLARE var_expected INT;
    DECLARE var_physical INT;
    DECLARE var_unit_cost DECIMAL(12,4);
    DECLARE var_delta INT;
    
    DECLARE cur_items CURSOR FOR 
        SELECT ri.sku_id, rs.location_id, ri.expected_on_hand, ri.physical_count, ri.unit_cost
        FROM reconciliation_items ri
        JOIN reconciliation_sessions rs ON ri.session_id = rs.id
        WHERE ri.session_id = in_session_id AND ri.physical_count IS NOT NULL AND (ri.physical_count - ri.expected_on_hand) != 0;

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    START TRANSACTION;

    OPEN cur_items;
    read_loop: LOOP
        FETCH cur_items INTO var_sku_id, var_loc_id, var_expected, var_physical, var_unit_cost;
        IF done THEN
            LEAVE read_loop;
        END IF;

        SET var_delta = var_physical - var_expected;

        -- 1. Insert immutable adjustment transaction
        INSERT INTO inventory_transactions (
            id, sku_id, location_id, transaction_type, quantity_delta,
            balance_before, balance_after, unit_cost, total_valuation_delta,
            reference_type, reference_id, performed_by_user_id, notes, created_at
        ) VALUES (
            UUID(), var_sku_id, var_loc_id,
            IF(var_delta < 0, 'adjustment_shrinkage', 'adjustment_surplus'),
            var_delta, var_expected, var_physical, var_unit_cost,
            var_delta * var_unit_cost,
            'RECON_SESSION', in_session_id, in_manager_id, in_manager_notes, NOW()
        );

        -- 2. Update live inventory balances table
        UPDATE inventory_balances
        SET quantity_on_hand = var_physical,
            last_counted_at = NOW()
        WHERE sku_id = var_sku_id AND location_id = var_loc_id;

    END LOOP;
    CLOSE cur_items;

    -- 3. Close the reconciliation session
    UPDATE reconciliation_sessions
    SET status = 'approved_posted',
        finalized_by = in_manager_id,
        finalized_at = NOW(),
        manager_notes = in_manager_notes
    WHERE id = in_session_id;

    COMMIT;
END$$
DELIMITER ;
