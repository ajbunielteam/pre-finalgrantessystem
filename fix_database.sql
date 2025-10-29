-- RUN THIS IN phpMyAdmin: http://localhost/phpmyadmin
-- 1. Click on the SQL tab
-- 2. Copy and paste all of this
-- 3. Click "Go"

USE grantes_db;

-- Add shares column
ALTER TABLE admin_posts ADD COLUMN shares INT DEFAULT 0;

-- Add comments_count column
ALTER TABLE admin_posts ADD COLUMN comments_count INT DEFAULT 0;

-- Verify columns exist
DESCRIBE admin_posts;
