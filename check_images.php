<?php
header('Content-Type: text/html; charset=utf-8');
require_once 'config/database.php';

$conn = getDatabaseConnection();

echo "<h1>Image Check</h1>";

// Check column type
$result = $conn->query("SHOW COLUMNS FROM admin_posts WHERE Field = 'images'");
$row = $result->fetch_assoc();
echo "<h2>1. Column Type</h2>";
echo "<p>Current type: " . $row['Type'] . "</p>";

if (strpos($row['Type'], 'TEXT') !== false && strpos($row['Type'], 'MEDIUMTEXT') === false) {
    echo "<p style='color:red;font-weight:bold;'>❌ PROBLEM FOUND! Column is TEXT (65KB limit). You need to change it to MEDIUMTEXT.</p>";
    echo "<p style='color:blue;'>👉 Run this SQL in phpMyAdmin:</p>";
    echo "<pre style='background:#f5f5f5;padding:10px;'>ALTER TABLE admin_posts MODIFY COLUMN images MEDIUMTEXT;</pre>";
} else {
    echo "<p style='color:green;font-weight:bold;'>✅ Column is MEDIUMTEXT - good!</p>";
}

// Check posts with images
echo "<h2>2. Posts with Images</h2>";
$result = $conn->query("SELECT id, content, LENGTH(images) as img_len FROM admin_posts WHERE images IS NOT NULL AND images != '' ORDER BY id DESC LIMIT 10");

if ($result->num_rows > 0) {
    echo "<table border='1' cellpadding='10' style='border-collapse:collapse;width:100%;'>";
    echo "<tr><th>ID</th><th>Content</th><th>Image Length</th><th>Status</th></tr>";
    while ($row = $result->fetch_assoc()) {
        $status = ($row['img_len'] == 65535) ? "❌ TRUNCATED" : "✅ OK";
        $color = ($row['img_len'] == 65535) ? "red" : "green";
        echo "<tr>";
        echo "<td>" . $row['id'] . "</td>";
        echo "<td>" . substr($row['content'], 0, 50) . "...</td>";
        echo "<td>" . number_format($row['img_len']) . " bytes</td>";
        echo "<td style='color:$color;font-weight:bold;'>$status</td>";
        echo "</tr>";
    }
    echo "</table>";
} else {
    echo "<p>No posts with images found.</p>";
}

// If truncated posts exist, offer to delete them
$result = $conn->query("SELECT COUNT(*) as count FROM admin_posts WHERE LENGTH(images) = 65535");
$count = $result->fetch_assoc()['count'];

if ($count > 0) {
    echo "<h2 style='color:red;'>3. Delete Truncated Posts</h2>";
    echo "<p>Found $count posts with truncated images.</p>";
    echo "<p>These posts are broken. You should delete them and create new ones.</p>";
    echo "<p style='color:blue;'>👉 Run this SQL to delete them:</p>";
    echo "<pre style='background:#f5f5f5;padding:10px;'>DELETE FROM admin_posts WHERE LENGTH(images) = 65535;</pre>";
}

$conn->close();
?>
