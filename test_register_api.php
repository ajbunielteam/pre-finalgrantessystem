<!DOCTYPE html>
<html>
<head>
    <title>Test Register API</title>
    <style>
        body { font-family: Arial; padding: 20px; }
        .success { color: green; padding: 10px; background: #d4edda; margin: 10px 0; }
        .error { color: red; padding: 10px; background: #f8d7da; margin: 10px 0; }
        pre { background: #f4f4f4; padding: 10px; overflow: auto; }
    </style>
</head>
<body>
    <h2>Test Registration API</h2>
    
    <form id="testForm">
        <p>First Name: <input type="text" name="firstName" value="Test" required></p>
        <p>Last Name: <input type="text" name="lastName" value="Student" required></p>
        <p>Student ID: <input type="text" name="studentId" value="TEST001" required></p>
        <p>Email: <input type="email" name="email" value="test@test.com" required></p>
        <p>Award Number: <input type="text" name="awardNumber" value="AW001" required></p>
        <p>Password: <input type="password" name="password" value="123456" required></p>
        <p>Department: <input type="text" name="department" value="Department of Computer Studies" required></p>
        <p>Course: <input type="text" name="course" value="BSIT" required></p>
        <p>Year: <input type="text" name="year" value="1st" required></p>
        <p>Place: <input type="text" name="place" value="Test City" required></p>
        <button type="submit">Test Registration</button>
    </form>
    
    <div id="result"></div>

    <script>
        document.getElementById('testForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = {};
            formData.forEach((value, key) => data[key] = value);
            
            document.getElementById('result').innerHTML = '<p>Testing...</p>';
            
            try {
                const response = await fetch('api/register.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    document.getElementById('result').innerHTML = 
                        '<div class="success">✓ Registration successful! Student ID: ' + result.id + '</div>';
                } else {
                    document.getElementById('result').innerHTML = 
                        '<div class="error">✗ Error: ' + result.message + '</div>';
                }
                
                document.getElementById('result').innerHTML += '<pre>' + JSON.stringify(result, null, 2) + '</pre>';
            } catch (error) {
                document.getElementById('result').innerHTML = 
                    '<div class="error">✗ Network Error: ' + error.message + '</div>';
            }
        });
    </script>
</body>
</html>
