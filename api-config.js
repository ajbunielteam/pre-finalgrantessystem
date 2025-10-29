// API Configuration
const API_BASE_URL = 'http://localhost/grantes/api';

// Helper function for API calls
async function apiCall(endpoint, method = 'GET', data = null) {
    const options = {
        method: method,
        headers: {}
    };
    
    // Only add Content-Type header for POST/PUT requests with data
    if ((method === 'POST' || method === 'PUT') && data) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(data);
    } else if (data) {
        // For other methods, include data in query string for GET requests
        if (method === 'GET') {
            // Append as query params instead
            const params = new URLSearchParams();
            Object.keys(data).forEach(key => {
                params.append(key, data[key]);
            });
            endpoint += (endpoint.includes('?') ? '&' : '?') + params.toString();
        }
    }
    
    try {
        console.log(`Making API call to: ${API_BASE_URL}/${endpoint}`, data);
        const response = await fetch(`${API_BASE_URL}/${endpoint}`, options);
        console.log(`Response status: ${response.status} ${response.statusText}`);
        
        // Check if response is ok and has content
        if (!response.ok) {
            const text = await response.text();
            console.error('API Response Error:', response.status, text);
            return { success: false, message: 'API error: ' + response.status };
        }
        
        const text = await response.text();
        console.log('Raw response text:', text);
        if (!text.trim()) {
            console.error('Empty response from API');
            return { success: false, message: 'Empty response' };
        }
        
        const result = JSON.parse(text);
        console.log('API Response parsed:', result);
        return result;
    } catch (error) {
        console.error('API Error:', error);
        return { success: false, message: 'Network error: ' + error.message };
    }
}

// Get all students from database
async function getStudentsFromDatabase() {
    try {
        const response = await apiCall('get_students.php');
        console.log('📡 get_students.php response:', response);
        
        if (response && response.success && Array.isArray(response.students)) {
            return response.students;
        } else {
            console.warn('⚠️ Invalid response format:', response);
            return [];
        }
    } catch (error) {
        console.error('❌ Error fetching students:', error);
        return [];
    }
}

// ============================================
// POST MANAGEMENT FUNCTIONS
// ============================================

async function savePost(postData) {
    const response = await apiCall('save_post.php', 'POST', postData);
    return response;
}

async function getPosts(audience = '') {
    let endpoint = 'get_posts.php';
    if (audience) {
        endpoint += `?audience=${audience}`;
    }
    const response = await apiCall(endpoint);
    if (response.success) {
        return response.posts;
    }
    return [];
}

async function deletePost(postId) {
    const response = await apiCall('delete_post.php', 'POST', { postId: postId });
    if (response.success) {
        return response;
    } else {
        console.error('Failed to delete post:', response.message);
        return null;
    }
}

async function updatePostEngagement(postId, action, comment = null) {
    const data = { postId: postId, action: action };
    if (comment) {
        data.comment = comment;
    }
    const response = await apiCall('update_post_engagement.php', 'POST', data);
    return response;
}

// ============================================
// MESSAGE MANAGEMENT FUNCTIONS
// ============================================

async function saveMessage(messageData) {
    const response = await apiCall('save_message.php', 'POST', messageData);
    if (response.success) {
        return response;
    } else {
        console.error('Failed to save message:', response.message);
        return null;
    }
}

async function getMessages(userId, userType, receiverId = null, receiverType = null) {
    let endpoint = `get_messages.php?userId=${userId}&userType=${userType}`;
    if (receiverId && receiverType) {
        endpoint += `&receiverId=${receiverId}&receiverType=${receiverType}`;
    }
    
    try {
        const response = await apiCall(endpoint);
        if (response && response.success) {
            return response.messages || [];
        }
        return [];
    } catch (error) {
        console.error('Error in getMessages:', error);
        return [];
    }
}

// ============================================
// OTHER FUNCTIONS
// ============================================

async function searchStudents(searchQuery) {
    const response = await apiCall(`search_students.php?query=${encodeURIComponent(searchQuery)}`);
    if (response.success) {
        return response.students;
    }
    return [];
}

async function updateStudent(studentData) {
    const response = await apiCall('update_student.php', 'POST', studentData);
    return response;
}

async function updateStudentPassword(studentId, newPassword) {
    return await apiCall('update_student_password.php', 'POST', {
        studentId: studentId,
        password: newPassword
    });
}

async function updateAdminPassword(adminId, oldPassword, newPassword) {
    return await apiCall('update_admin_password.php', 'POST', {
        adminId: adminId,
        oldPassword: oldPassword,
        newPassword: newPassword
    });
}

async function uploadPhoto(file) {
    const formData = new FormData();
    formData.append('photo', file);
    
    try {
        const response = await fetch(`${API_BASE_URL}/upload_photo.php`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            return result;
        } else {
            showToast(result.message || 'Failed to upload photo', 'error');
            return null;
        }
    } catch (error) {
        console.error('Upload error:', error);
        showToast('Network error during upload', 'error');
        return null;
    }
}