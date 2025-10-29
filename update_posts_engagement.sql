-- Update admin_posts table to add engagement columns
-- This script ensures the table has likes, comments, shares columns

USE grantes_db;

-- Add likes column if it doesn't exist
ALTER TABLE admin_posts 
ADD COLUMN IF NOT EXISTS likes INT DEFAULT 0;

-- Add shares column if it doesn't exist
ALTER TABLE admin_posts 
ADD COLUMN IF NOT EXISTS shares INT DEFAULT 0;

-- Add comments column if it doesn't exist (stores JSON array of comments)
ALTER TABLE admin_posts 
ADD COLUMN IF NOT EXISTS comments TEXT DEFAULT '[]';

-- Update existing posts to have default engagement values
UPDATE admin_posts 
SET likes = COALESCE(likes, 0),
    shares = COALESCE(shares, 0),
    comments = COALESCE(NULLIF(comments, ''), '[]')
WHERE likes IS NULL OR shares IS NULL OR comments IS NULL OR comments = '';

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_admin_posts_likes ON admin_posts(likes);
CREATE INDEX IF NOT EXISTS idx_admin_posts_shares ON admin_posts(shares);

