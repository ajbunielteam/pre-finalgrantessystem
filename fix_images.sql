-- Fix images column to support large base64 images
-- Run this in phpMyAdmin

USE grantes_db;

-- Change images column from TEXT to MEDIUMTEXT (supports up to 16MB)
ALTER TABLE admin_posts MODIFY COLUMN images MEDIUMTEXT;

-- Check the result
DESCRIBE admin_posts;

