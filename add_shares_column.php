<?php
// Quick script to add missing columns
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h1>Adding Missing Database Columns</h1>";

try {
    require_once 'config/database.php';
    $conn = getDatabaseConnection();
    
    echo "<h2>Step 1: Checking current columns...</h2>";
    $result = $conn->query("DESCRIBE admin_posts");
    $columns = [];
    while ($row = $result->fetch_assoc()) {
        $columns[] = $row['Field'];
        echo "- " . $row['Field'] . " (" . $row['Type'] . ")<br>";
    }
    
    echo "<h2>Step 2: Adding missing columns...</h2>";
    
    if (!in_array('shares', $columns)) {
        $conn->query("ALTER TABLE admin_posts ADD COLUMN shares INT DEFAULT 0 AFTER likes");
        echo "✅ Added 'shares' column<br>";
    } else {
        echo "⚠️ 'shares' column already exists<br>";
    }
    
    if (!in_array('comments_count', $columns)) {
        $conn->query("ALTER TABLE admin_posts ADD COLUMN comments_count INT DEFAULT 0 AFTER comments");
        echo "✅ Added 'comments_count' column<br>";
    } else {
        echo "⚠️ 'comments_count' column already exists<br>";
    }
    
    echo "<h2>Step 3: Verifying changes...</h2>";
    $result = $conn->query("DESCRIBE admin_posts");
    $newColumns = [];
    while ($row = $result->fetch_assoc()) {
        $newColumns[] = $row['Field'];
        echo "- " . $row['Field'] . " (" . $row['Type'] . ")<br>";
    }
    
    if (in_array('shares', $newColumns) && in_array('comments_count', $newColumns)) {
        echo "<br><h2 style='color: green;'>✅ SUCCESS! All columns are now present.</h2>";
        echo "<p>You can now refresh your page and try liking/commenting again!</p>";
    } else {
        echo "<br><h2 style='color: red;'>❌ Something went wrong. Please run this SQL manually in phpMyAdmin:</h2>";
        echo "<pre>ALTER TABLE admin_posts ADD COLUMN shares INT DEFAULT 0 AFTER likes;\n";
        echo "ALTER TABLE admin_posts ADD COLUMN comments_count INT DEFAULT 0 AFTER comments;</pre>";
    }
    
    $conn->close();
    
} catch (Exception $e) {
    echo "<h2 style='color: red;'>❌ ERROR:</h2>";
    echo "<p>" . $e->getMessage() . "</p>";
    echo "<p>Please run this SQL manually in phpMyAdmin:</p>";
    echo "<pre>ALTER TABLE admin_posts ADD COLUMN shares INT DEFAULT 0 AFTER likes;\n";
    echo "ALTER TABLE admin_posts ADD COLUMN comments_count INT DEFAULT 0 AFTER comments;</pre>";
}
?>

