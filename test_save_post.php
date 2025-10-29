<?php
header('Content-Type: application/json');

require 'config/database.php';

// Test database connection
$conn = getDatabaseConnection();

// Test data
$content = 'Test post';
$type = 'text';
$audience = 'students';
$images = ['data:image/jpeg;base64,/9j/4AAQSkZJRg==']; // Small test image

$imagesJson = json_encode($images);

$stmt = $conn->prepare("INSERT INTO admin_posts (content, type, audience, course, layout, images, author, timestamp) VALUES (?, ?, ?, ?, ?, ?, 'Administrator', NOW())");
$stmt->bind_param("ssssss", $content, $type, $audience, $null = null, $layout = 'image-left', $imagesJson);

if ($stmt->execute()) {
    echo json_encode([
        'success' => true,
        'message' => 'Test post saved successfully',
        'id' => $conn->insert_id
    ]);
} else {
    echo json_encode([
        'success' => false,
        'error' => $conn->error,
        'stmt_error' => $stmt->error
    ]);
}

$stmt->close();
$conn->close();
?>

