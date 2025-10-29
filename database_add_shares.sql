-- Add shares column to admin_posts table if it doesn't exist
-- Run this in phpMyAdmin (http://localhost/phpmyadmin)

USE grantes_db;

-- Check if shares column exists, if not add it
ALTER TABLE admin_posts 
ADD COLUMN IF NOT EXISTS shares INT DEFAULT 0 AFTER likes;

-- Also ensure comments_count is available
ALTER TABLE admin_posts 
ADD COLUMN IF NOT EXISTS comments_count INT DEFAULT 0 AFTER comments;

