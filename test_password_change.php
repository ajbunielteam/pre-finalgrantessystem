<?php
// Test script for password change
$url = 'http://localhost/grantes/api/update_student_password.php';
$data = json_encode([
    'newPassword' => 'testpass123',
    'email' => 'chris@grantes.com'
]);

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "HTTP Code: " . $httpCode . "\n";
echo "Response: " . $response . "\n";
echo "\nDecoded Response: \n";
print_r(json_decode($response, true));
?>

