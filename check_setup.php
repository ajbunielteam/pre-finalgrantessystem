<?php
// Quick setup check script
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h1>GranTES Setup Check</h1>";

// Check database connection
echo "<h2>1. Database Connection</h2>";
try {
    require_once 'config/database.php';
    $conn = getDatabaseConnection();
    echo "✅ Database connected successfully<br>";
    
    // Check if shares column exists
    echo "<h2>2. Database Schema Check</h2>";
    $result = $conn->query("DESCRIBE admin_posts");
    $columns = [];
    while ($row = $result->fetch_assoc()) {
        $columns[] = $row['Field'];
    }
    
    if (in_array('shares', $columns)) {
        echo "✅ 'shares' column exists<br>";
    } else {
        echo "❌ 'shares' column NOT found. Run the SQL migration!<br>";
    }
    
    if (in_array('comments_count', $columns)) {
        echo "✅ 'comments_count' column exists<br>";
    } else {
        echo "⚠️ 'comments_count' column not found (optional)<br>";
    }
    
    // Check posts
    echo "<h2>3. Posts in Database</h2>";
    $result = $conn->query("SELECT COUNT(*) as count FROM admin_posts");
    $count = $result->fetch_assoc()['count'];
    echo "Total posts in database: " . $count . "<br>";
    
    if ($count > 0) {
        echo "✅ Posts found<br>";
        // Show sample post
        $result = $conn->query("SELECT id, content, likes, shares, comments FROM admin_posts ORDER BY id DESC LIMIT 1");
        $post = $result->fetch_assoc();
        echo "<h3>Sample Post:</h3>";
        echo "ID: " . $post['id'] . "<br>";
        echo "Content: " . substr($post['content'], 0, 50) . "...<br>";
        echo "Likes: " . ($post['likes'] ?? 0) . "<br>";
        echo "Shares: " . ($post['shares'] ?? 0) . "<br>";
        
        $comments = json_decode($post['comments'], true);
        if (is_array($comments)) {
            echo "Comments: " . count($comments) . "<br>";
        } else {
            echo "Comments: 0<br>";
        }
    } else {
        echo "⚠️ No posts found. Create a post as admin first!<br>";
    }
    
    $conn->close();
    
} catch (Exception $e) {
    echo "❌ Database error: " . $e->getMessage() . "<br>";
}

// Check API files
echo "<h2>4. API Files Check</h2>";
$apiFiles = [
    'api/update_post_engagement.php',
    'api/get_posts.php',
    'config/database.php'
];

foreach ($apiFiles as $file) {
    if (file_exists($file)) {
        echo "✅ $file exists<br>";
    } else {
        echo "❌ $file NOT FOUND<br>";
    }
}

echo "<h2>5. SQL to Run (if needed)</h2>";
echo "<pre>";
echo "ALTER TABLE admin_posts ADD COLUMN shares INT DEFAULT 0 AFTER likes;\n";
echo "ALTER TABLE admin_posts ADD COLUMN comments_count INT DEFAULT 0 AFTER comments;\n";
echo "</pre>";
echo '<button onclick="location.reload()">Refresh</button>';

?>

