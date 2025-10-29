<?php
// Fix the images column to support larger images
require_once 'config/database.php';

try {
    $conn = getDatabaseConnection();
    
    // Check current column type
    $result = $conn->query("SHOW COLUMNS FROM admin_posts LIKE 'images'");
    $column = $result->fetch_assoc();
    
    echo "<h2>Current images column type: " . $column['Type'] . "</h2>";
    
    // Modify the column to MEDIUMTEXT
    $sql = "ALTER TABLE admin_posts MODIFY COLUMN images MEDIUMTEXT";
    
    if ($conn->query($sql)) {
        echo "<h2 style='color: green;'>✅ Successfully changed images column to MEDIUMTEXT!</h2>";
        
        // Check new column type
        $result = $conn->query("SHOW COLUMNS FROM admin_posts LIKE 'images'");
        $column = $result->fetch_assoc();
        echo "<h2>New images column type: " . $column['Type'] . "</h2>";
    } else {
        echo "<h2 style='color: red;'>❌ Error: " . $conn->error . "</h2>";
    }
    
    $conn->close();
} catch (Exception $e) {
    echo "<h2 style='color: red;'>❌ Error: " . $e->getMessage() . "</h2>";
}
?>

