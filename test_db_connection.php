<?php
require_once 'config/database.php';

echo "<h2>Testing Database Connection</h2>";

// Test connection
$conn = getDatabaseConnection();
echo "<p style='color: green;'>✓ Database connected successfully!</p>";

// Check if students table exists
$result = $conn->query("SHOW TABLES LIKE 'students'");
if ($result->num_rows > 0) {
    echo "<p style='color: green;'>✓ Students table exists</p>";
    
    // Show table structure
    echo "<h3>Students Table Structure:</h3>";
    $result = $conn->query("DESCRIBE students");
    echo "<table border='1' cellpadding='5'>";
    echo "<tr><th>Field</th><th>Type</th><th>Null</th><th>Key</th><th>Default</th></tr>";
    while ($row = $result->fetch_assoc()) {
        echo "<tr>";
        echo "<td>" . $row['Field'] . "</td>";
        echo "<td>" . $row['Type'] . "</td>";
        echo "<td>" . $row['Null'] . "</td>";
        echo "<td>" . $row['Key'] . "</td>";
        echo "<td>" . ($row['Default'] ?? 'NULL') . "</td>";
        echo "</tr>";
    }
    echo "</table>";
    
    // Count students
    $result = $conn->query("SELECT COUNT(*) as count FROM students");
    $count = $result->fetch_assoc()['count'];
    echo "<h3>Total Students in Database: $count</h3>";
    
} else {
    echo "<p style='color: red;'>✗ Students table does NOT exist!</p>";
    echo "<p>You need to create the students table first.</p>";
}

$conn->close();
?>
