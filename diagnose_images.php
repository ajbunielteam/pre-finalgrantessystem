<?php
header('Content-Type: text/html; charset=utf-8');
require_once 'config/database.php';

$conn = getDatabaseConnection();

echo "<h1>Image Storage Diagnosis</h1>";

// Check column type
echo "<h2>1. Checking column type...</h2>";
$result = $conn->query("SHOW COLUMNS FROM admin_posts WHERE Field = 'images'");
$column = $result->fetch_assoc();
echo "<p><strong>Column Type:</strong> " . $column['Type'] . "</p>";

if ($column['Type'] === 'text' || $column['Type'] === 'tinytext') {
    echo "<p style='color: red;'><strong>⚠️ WARNING: Column is TEXT (65KB limit). This will truncate images!</strong></p>";
    echo "<p>Run: <code>ALTER TABLE admin_posts MODIFY COLUMN images MEDIUMTEXT;</code> in phpMyAdmin</p>";
}

// Check posts with images
echo "<h2>2. Checking posts with images...</h2>";
$result = $conn->query("SELECT id, content, images, LENGTH(images) as img_length FROM admin_posts WHERE images IS NOT NULL AND images != '' AND images != 'null' AND images != '[]' ORDER BY timestamp DESC LIMIT 5");

$posts = [];
while ($row = $result->fetch_assoc()) {
    $posts[] = $row;
}

if (count($posts) === 0) {
    echo "<p>No posts with images found.</p>";
} else {
    echo "<p>Found " . count($posts) . " posts with images:</p>";
    
    foreach ($posts as $post) {
        echo "<div style='border: 1px solid #ccc; padding: 10px; margin: 10px 0;'>";
        echo "<h3>Post ID: {$post['id']}</h3>";
        echo "<p><strong>Content:</strong> " . htmlspecialchars(substr($post['content'], 0, 50)) . "...</p>";
        echo "<p><strong>Image data length:</strong> " . $post['img_length'] . " bytes</p>";
        
        // Try to decode the JSON
        $decoded = json_decode($post['images'], true);
        if (json_last_error() === JSON_ERROR_NONE) {
            echo "<p style='color: green;'>✅ JSON is valid</p>";
            if (is_array($decoded)) {
                echo "<p>Decoded as array with " . count($decoded) . " items</p>";
                
                foreach ($decoded as $idx => $img) {
                    if (is_string($img)) {
                        $imgType = substr($img, 0, 30);
                        echo "<p>Image $idx: Starts with: <code>" . htmlspecialchars($imgType) . "...</code></p>";
                    } else {
                        echo "<p>Image $idx: " . gettype($img) . "</p>";
                    }
                }
            } else {
                echo "<p>Decoded as: " . gettype($decoded) . "</p>";
            }
        } else {
            echo "<p style='color: red;'>❌ JSON decode error: " . json_last_error_msg() . "</p>";
            echo "<p>First 200 chars: <code>" . htmlspecialchars(substr($post['images'], 0, 200)) . "</code></p>";
        }
        
        echo "</div>";
    }
}

// Show first 200 chars of raw database value
if (count($posts) > 0) {
    echo "<h2>3. Raw database value (first 500 chars):</h2>";
    echo "<pre style='background: #f5f5f5; padding: 10px; overflow: auto; max-height: 300px;'>";
    echo htmlspecialchars(substr($posts[0]['images'], 0, 500));
    echo "</pre>";
}

$conn->close();
?>

<hr>
<h2>Quick Fixes:</h2>
<ul>
    <li><a href="fix_images_column.php">Fix Column Type (Run this first!)</a></li>
    <li><a href="index.html">Go back to the app</a></li>
</ul>

