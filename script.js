// Global Variables
let currentUser = null;
let students = [];
let applications = [];
let notifications = [];
let currentApplicationId = null;
let adminPosts = [];

// Chat Variables
let chatMessages = [];
let chatIsOpen = false;
let chatIsMinimized = false;
let unreadMessageCount = 0;

// Persist chat to localStorage so admin messages appear for students later
function loadPersistedChatMessages() {
    try {
        const stored = localStorage.getItem('chatMessages');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                chatMessages = parsed;
            }
        }
    } catch (e) {
        // ignore parse errors
    }
}

function persistChatMessages() {
    try {
        localStorage.setItem('chatMessages', JSON.stringify(chatMessages));
    } catch (e) {
        // ignore storage errors
    }
}

// Profile Chat Variables
let profileChatMessages = [];
let profileChatIsExpanded = false;
let profileChatPendingFile = null;

let adminActiveChatStudentId = null;



// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Load data from localStorage first, fallback to empty arrays
    const savedStudents = localStorage.getItem('students');
    const savedApplications = localStorage.getItem('applications');
    
    if (savedStudents) {
        students = JSON.parse(savedStudents);
        console.log('Loaded students from localStorage:', students);
    } else {
        students = []; // Start with empty array - no sample data
        localStorage.setItem('students', JSON.stringify(students));
        console.log('Initialized with empty students array');
    }
    
    if (savedApplications) {
        applications = JSON.parse(savedApplications);
        // Cleanup: remove legacy sample applications (with firstName/lastName fields)
        try {
            const cleanedApplications = applications.filter(app => app && (
                (typeof app.studentId !== 'undefined' && (app.documentType || app.documentFiles))
            ));
            if (cleanedApplications.length !== applications.length) {
                applications = cleanedApplications;
                localStorage.setItem('applications', JSON.stringify(applications));
            }
        } catch (e) {
            // ignore cleanup errors
        }
    } else {
        applications = []; // Start with empty array
        localStorage.setItem('applications', JSON.stringify(applications));
    }
    
    loadPersistedChatMessages();
    
    // Check if user is already logged in
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        if (document && document.body) {
            document.body.classList.add('logged-in');
            if (currentUser.role === 'admin') {
                document.body.classList.add('admin-logged-in');
            } else {
                document.body.classList.remove('admin-logged-in');
            }
        }
        showDashboard();
    } else {
        showHome();
    }
    
    // Generate sample notifications
    generateSampleNotifications();
}

// Navigation Functions
function showHome() {
    hideAllSections();
    document.getElementById('home').classList.add('active');
    updateNavigation();
    // Render home feed posts targeted for Home Page audience
    if (typeof loadHomeFeed === 'function') {
        loadHomeFeed();
    }
}

function showLogin() {
    hideAllSections();
    document.getElementById('login').classList.add('active');
    updateNavigation();
}

function showRegister() {
    hideAllSections();
    document.getElementById('register').classList.add('active');
    updateNavigation();
}

function showDashboard() {
    hideAllSections();
    if (currentUser && currentUser.role === 'admin') {
        document.getElementById('admin-dashboard').classList.add('active');
        loadAdminDashboard();
    } else {
        document.getElementById('student-homepage').classList.add('active');
        loadStudentHomepage();
    }
    updateNavigation();
}

function hideAllSections() {
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => section.classList.remove('active'));
}

function updateNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.style.display = 'block';
    });
    
    if (currentUser) {
        if (document && document.body) {
            document.body.classList.add('logged-in');
            if (currentUser.role === 'admin') {
                document.body.classList.add('admin-logged-in');
            } else {
                document.body.classList.remove('admin-logged-in');
            }
        }
        const homeLink = document.querySelector('.nav-link[onclick="showHome()"]');
        const loginLink = document.querySelector('.nav-link[onclick="showLogin()"]');
        const registerLink = document.querySelector('.nav-link[onclick="showRegister()"]');
        if (homeLink) homeLink.style.display = 'none';
        if (loginLink) loginLink.style.display = 'none';
        if (registerLink) registerLink.style.display = 'none';
    } else {
        if (document && document.body) {
            document.body.classList.remove('logged-in');
            document.body.classList.remove('admin-logged-in');
        }
        const homeLink = document.querySelector('.nav-link[onclick="showHome()"]');
        const loginLink = document.querySelector('.nav-link[onclick="showLogin()"]');
        const registerLink = document.querySelector('.nav-link[onclick="showRegister()"]');
        if (homeLink) homeLink.style.display = 'block';
        if (loginLink) loginLink.style.display = 'block';
        if (registerLink) registerLink.style.display = 'block';
    }
}

// Authentication Functions
async function handleRegister(event) {
    event.preventDefault();
    
    const formData = {
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        studentId: document.getElementById('studentId').value,
        email: document.getElementById('registerEmail').value,
        password: document.getElementById('registerPassword').value,
        confirmPassword: document.getElementById('confirmPassword').value,
        department: document.getElementById('department').value,
        course: document.getElementById('course').value,
        year: document.getElementById('year').value
    };
    
    // Validation
    if (formData.password !== formData.confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    // API call to register student
    const response = await apiCall('register.php', 'POST', {
        firstName: formData.firstName,
        lastName: formData.lastName,
        studentId: formData.studentId,
        email: formData.email,
        password: formData.password,
        department: formData.department,
        course: formData.course,
        year: formData.year
    });
    
    if (response.success) {
        showToast('Registration successful! Please login.', 'success');
        showLogin();
    } else {
        showToast(response.message || 'Registration failed', 'error');
    }
}

// Home Feed: Render admin posts where audience === 'home' in Facebook-like cards
async function loadHomeFeed() {
    const feedEl = document.getElementById('homeFeed');
    if (!feedEl) return;
    
    try {
        // Get posts from database
        const posts = await getPosts('home');
        
        // Filter posts for homepage (audience === 'home' or all students)
        const homePosts = posts.filter(p => {
            if (!p) return false;
            const audRaw = (p.audience == null ? '' : p.audience).toString().toLowerCase();
            // Include posts with audience 'home', 'students' (visible to all), or empty
            return audRaw === 'home' || audRaw === 'students' || audRaw === '';
        }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        const postsToRender = homePosts.slice(0, 6);
        
        if (postsToRender.length === 0) {
            feedEl.innerHTML = `
                <div class="welcome-message">
                    <h3>No public posts yet</h3>
                    <p>Announcements for the Home Page will appear here.</p>
                </div>
            `;
            return;
        }
        feedEl.innerHTML = postsToRender.map(post => {
            const aud = ((post && post.audience) ? post.audience.toString().toLowerCase() : '');
            const badgeText = aud === 'students' ? 'GranTES Students' : 'Home Page';
            const ts = post && post.created_at ? post.created_at : (post.timestamp || new Date().toISOString());
            const author = (post && post.author) ? post.author : 'Administrator';
            const content = (post && post.content) ? post.content : '';
            const hasMulti = Array.isArray(post.images) && post.images.length > 1;
            const hasSingle = Array.isArray(post.images) && post.images.length === 1;
            const isTextOnly = !hasMulti && !hasSingle;
            
            if (isTextOnly) {
                return `
        <div class="post-card product-style text-only">
            <div class="post-content">
                <div class="post-hero-text">${content}</div>
            </div>
        </div>`;
            }
            const imageFirst = (post.layout || 'image-left') === 'image-left';
            const mediaHtml = (Array.isArray(post.images) && post.images.length > 1)
                ? renderCarousel(post.images)
                : (Array.isArray(post.images) && post.images.length === 1 ? `<div class="post-image"><img src="${post.images[0]}" alt="post image"></div>` : '');
            const detailsHtml = `<div class=\"post-details\">\n                        <div class=\"post-text\">${content}</div>\n                        ${post.type === 'media' ? '<div class=\"post-media\"><i class=\"fas fa-image\"></i> Media attached</div>' : ''}\n                        ${post.type === 'live' ? '<div class=\"post-live\"><i class=\"fas fa-video\"></i> Live video</div>' : ''}\n                        ${post.type === 'feeling' ? '<div class=\"post-feeling\"><i class=\"fas fa-smile\"></i> Feeling/Activity</div>' : ''}\n                    </div>`;
            return `
        <div class=\"post-card product-style\">\n            <div class=\"post-content\">\n                <div class=\"post-body ${imageFirst ? 'image-left' : 'image-right'}\">\n                    ${imageFirst ? `${mediaHtml}${detailsHtml}` : `${detailsHtml}${mediaHtml}`}
                </div>
            </div>
        </div>`;
        }).join('');
    } catch (error) {
        console.error('Error loading home feed:', error);
        feedEl.innerHTML = `
            <div class="welcome-message">
                <h3>Error loading posts</h3>
                <p>Please refresh the page.</p>
            </div>
        `;
    }
}

// Ensure Home feed renders on initial page load
document.addEventListener('DOMContentLoaded', function() {
    try { loadHomeFeed(); } catch (_) { /* ignore */ }
});

async function homeLikePost(postId) {
    try {
        const response = await apiCall('update_post_engagement.php', 'POST', {
            postId: postId,
            action: 'like'
        });
        
        if (response.success) {
    loadHomeFeed();
            showToast('Post liked!', 'success');
        } else {
            showToast('Failed to like post', 'error');
        }
    } catch (error) {
        console.error('Error toggling like:', error);
        showToast('Failed to like post', 'error');
    }
}

function homeCommentPost(postId) {
    const comment = prompt('Add a comment:');
    if (!comment || !comment.trim()) return;
    
    // For home page, just show a message
    showToast('Please log in to comment', 'info');
}

async function homeSharePost(postId) {
    try {
        // Update shares count in database
        const response = await apiCall('update_post_engagement.php', 'POST', {
            postId: postId,
            action: 'share'
        });
        
        // Copy link to clipboard
        const shareUrl = `${window.location.origin}${window.location.pathname}?post=${postId}`;
        try {
            await navigator.clipboard.writeText(shareUrl);
            showToast('Post link copied to clipboard!', 'success');
        } catch (clipboardError) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = shareUrl;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showToast('Post link copied to clipboard!', 'success');
        }
        
        // Refresh feed
        loadHomeFeed();
    } catch (error) {
        console.error('Error sharing post:', error);
        showToast('Failed to share post', 'error');
    }
}

async function handleLogin(event) {
    event.preventDefault();
    
    const role = document.getElementById('loginRole').value;
    const emailRaw = document.getElementById('loginEmail').value;
    const passwordRaw = document.getElementById('loginPassword').value;
    const email = (emailRaw || '').trim().toLowerCase();
    const password = (passwordRaw || '').trim();
    const awardNumberRaw = document.getElementById('loginAwardNumber').value || '';
    const identifier = awardNumberRaw.trim().toLowerCase() || email;
    
    console.log('Login attempt:', { role, email, password, identifier });
    
    // API call to login
    const response = await apiCall('login.php', 'POST', {
        role: role,
        email: email,
        password: password,
        identifier: identifier
    });
    
    if (response.success) {
        currentUser = response.user;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        if (document && document.body) {
            document.body.classList.add('logged-in');
            if (currentUser.role === 'admin') {
                document.body.classList.add('admin-logged-in');
            } else {
                document.body.classList.remove('admin-logged-in');
            }
        }

        updateNavigation();
        showToast('Login successful!', 'success');
        showDashboard();
    } else {
        showToast(response.message || 'Login failed', 'error');
    }
}

// Safe localStorage setter - prevents quota errors from breaking flows
function safeSetItem(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (e) {
        return false;
    }
}

// Guarantee stored student has a unique numeric id; persists back to localStorage if missing
function ensureStudentHasId(student) {
    if (student && typeof student.id === 'number' && student.id > 0) return student;
    const stored = JSON.parse(localStorage.getItem('students') || '[]');
    const matchIdx = stored.findIndex(s => (
        (s.awardNumber && student.awardNumber && String(s.awardNumber).trim().toLowerCase() === String(student.awardNumber).trim().toLowerCase()) ||
        (s.email && student.email && String(s.email).trim().toLowerCase() === String(student.email).trim().toLowerCase()) ||
        (s.studentId && student.studentId && String(s.studentId).trim().toLowerCase() === String(student.studentId).trim().toLowerCase())
    ));
    const nextId = stored.reduce((m, s) => {
        const idNum = typeof s.id === 'number' ? s.id : 0;
        return idNum > m ? idNum : m;
    }, 0) + 1;
    if (matchIdx !== -1) {
        if (!stored[matchIdx].id) stored[matchIdx].id = nextId;
        localStorage.setItem('students', JSON.stringify(stored));
        student.id = stored[matchIdx].id;
    } else if (!student.id) {
        student.id = nextId;
    }
    return student;
}

function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    showToast('Logged out successfully', 'success');
    if (document && document.body) {
        document.body.classList.remove('logged-in');
        document.body.classList.remove('admin-logged-in');
    }
    showHome();
}

// Student Homepage Functions
function loadStudentHomepage() {
    const student = currentUser.studentData;
    
    // Update header - handle both camelCase and snake_case formats
    const firstName = student.firstName || student.first_name || '';
    const lastName = student.lastName || student.last_name || '';
    const fullName = firstName + ' ' + lastName;
    
    document.getElementById('studentName').textContent = fullName.trim() || 'Student';
    
    // Update notification count
    const studentNotifications = notifications.filter(n => n.studentId === student.id);
    document.getElementById('studentNotificationCount').textContent = studentNotifications.length;
    
    // Update message count (guard if element not present in sidebar)
    const studentMessages = JSON.parse(localStorage.getItem('studentMessages') || '[]');
    const unreadMessages = studentMessages.filter(m => m.studentId === student.id && m.sender === 'admin' && !m.read);
    const msgCountElHeader = document.getElementById('studentMessageCount');
    if (msgCountElHeader) { msgCountElHeader.textContent = unreadMessages.length; }
    
    // Load profile information
    loadStudentProfile();
    
    // Load announcements
    loadStudentAnnouncements();
    
    // Load messages
    loadStudentMessages();
    // Make counters open Messages tab
    const msgCountEl = document.getElementById('studentMessageCount');
    if (msgCountEl) { msgCountEl.style.cursor = 'pointer'; msgCountEl.onclick = () => openStudentMessages(); }
    const notifCountEl = document.getElementById('studentNotificationCount');
    if (notifCountEl) { notifCountEl.style.cursor = 'pointer'; notifCountEl.onclick = () => openStudentMessages(); }
    
    // Initialize chat
    initializeChat();
}


function loadStudentProfile() {
    const student = currentUser.studentData;
    
    const sideName = document.getElementById('profileName');
    const studentFirstName = student.firstName || student.first_name || '';
    const studentLastName = student.lastName || student.last_name || '';
    const studentIdValue = student.studentId || student.student_id || '';
    if (sideName) sideName.textContent = `${studentFirstName} ${studentLastName}`;
    const sideId = document.getElementById('profileStudentId');
    if (sideId) sideId.textContent = studentIdValue;
    const sideEmail = document.getElementById('profileEmail');
    if (sideEmail) sideEmail.textContent = student.email;
    const sideCourse = document.getElementById('profileCourse');
    if (sideCourse) sideCourse.textContent = student.course;
    const sideYear = document.getElementById('profileYear');
    if (sideYear) sideYear.textContent = student.year;
    const sideAward = document.getElementById('profileAwardNumber');
    if (sideAward) sideAward.textContent = student.awardNumber || 'Not assigned';
    const statusEl = document.getElementById('profileStatus');
    if (statusEl) {
        const flags = [];
        if (student.isIndigenous) flags.push('INDIGENOUS PEOPLE');
        if (student.isPwd) flags.push("PWD's");
        statusEl.textContent = flags.length ? flags.join(', ') : '—';
    }
    const indigenousEl = document.getElementById('profileIndigenous');
    const pwdEl = document.getElementById('profilePwd');
    if (indigenousEl) indigenousEl.textContent = student.isIndigenous ? 'Yes' : 'No';
    if (pwdEl) pwdEl.textContent = student.isPwd ? 'Yes' : 'No';

    // Also populate main profile panel fields if present
    const nameMain = document.getElementById('profileNameMain');
    if (nameMain) nameMain.textContent = `${studentFirstName} ${studentLastName}`;
    const idMain = document.getElementById('profileStudentIdMain');
    if (idMain) idMain.textContent = studentIdValue;
    const emailMain = document.getElementById('profileEmailMain');
    if (emailMain) emailMain.textContent = student.email;
    const courseMain = document.getElementById('profileCourseMain');
    if (courseMain) courseMain.textContent = student.course;
    const deptMain = document.getElementById('profileDepartmentMain');
    if (deptMain) deptMain.textContent = student.department || '';
    const placeMain = document.getElementById('profilePlaceMain');
    if (placeMain) placeMain.textContent = student.place || '';
    const yearMain = document.getElementById('profileYearMain');
    if (yearMain) yearMain.textContent = student.year;
    const awardMain = document.getElementById('profileAwardNumberMain');
    if (awardMain) awardMain.textContent = student.awardNumber || 'Not assigned';
    const statusMain = document.getElementById('profileStatusMain');
    if (statusMain) {
        const flagsMain = [];
        if (student.isIndigenous) flagsMain.push('INDIGENOUS PEOPLE');
        if (student.isPwd) flagsMain.push("PWD's");
        statusMain.textContent = flagsMain.length ? flagsMain.join(', ') : '—';
    }
    const indigenousMain = document.getElementById('profileIndigenousMain');
    if (indigenousMain) indigenousMain.textContent = student.isIndigenous ? 'Yes' : 'No';
    const pwdMain = document.getElementById('profilePwdMain');
    if (pwdMain) pwdMain.textContent = student.isPwd ? 'Yes' : 'No';
}

// Load posts for student homepage feed
async function loadStudentHomepagePosts() {
    const container = document.getElementById('studentPostsFeed');
    if (!container) return;
    
    try {
        // Load posts from database with 'students' audience
        const posts = await getPosts('students');
        
        if (!posts || posts.length === 0) {
            container.innerHTML = `
                <div class="welcome-message">
                    <h3>Welcome to the Student Portal</h3>
                    <p>Stay updated with announcements and communicate with the administration team.</p>
                    <p style="margin-top: 1rem; color: #64748b;">No announcements yet.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = posts.map(post => {
            let imagesHtml = '';
            
            if (post.images) {
                let imageArray = [];
                
                if (Array.isArray(post.images)) {
                    imageArray = post.images;
                } else if (typeof post.images === 'string') {
                    try {
                        const parsed = JSON.parse(post.images);
                        imageArray = Array.isArray(parsed) ? parsed : [parsed];
                    } catch (e) {
                        imageArray = [post.images];
                    }
                } else if (post.images) {
                    imageArray = [post.images];
                }
                
                imageArray = imageArray.map(img => {
                    if (typeof img === 'string' && img.trim().startsWith('[') && img.trim().endsWith(']')) {
                        try {
                            const parsed = JSON.parse(img);
                            if (Array.isArray(parsed)) {
                                return parsed[0];
                            }
                            return parsed;
                        } catch (e) {
                            return img;
                        }
                    }
                    return img;
                });
                
                imageArray = imageArray.filter(img => {
                    return img && typeof img === 'string' && img.trim() !== '' && img.length > 10;
                });
                
                // Check if this is a live post with video
                const isLiveVideo = post.type === 'live' && imageArray.length > 0;
                
                if (isLiveVideo) {
                    const firstItem = imageArray[0];
                    const isVideo = typeof firstItem === 'string' && (
                        firstItem.startsWith('data:video/') || 
                        firstItem.includes('video/webm') ||
                        firstItem.includes('video/mp4')
                    );
                    
                    if (isVideo) {
                        imagesHtml = `
                            <div class="post-video-container">
                                <video controls class="post-video" style="width: 100%; max-width: 100%; border-radius: 8px; margin-top: 10px; background: #000;">
                                    <source src="${firstItem}" type="video/webm">
                                    <source src="${firstItem}" type="video/mp4">
                                    Your browser does not support the video tag.
                                </video>
                                <div class="post-live-indicator">
                                    <span class="live-dot-small"></span>
                                    <span>Live Recording</span>
                                </div>
                            </div>
                        `;
                    } else {
                        imagesHtml = `<div class="post-image-container"><img src="${firstItem}" alt="Post image" class="post-image" style="max-width: 100%; border-radius: 8px; margin-top: 10px; display: block;"></div>`;
                    }
                } else if (imageArray.length === 1) {
                    const item = imageArray[0];
                    const isVideo = typeof item === 'string' && (
                        item.startsWith('data:video/') || 
                        item.includes('video/webm') ||
                        item.includes('video/mp4')
                    );
                    
                    if (isVideo) {
                        imagesHtml = `
                            <div class="post-video-container">
                                <video controls class="post-video" style="width: 100%; max-width: 100%; border-radius: 8px; margin-top: 10px; background: #000;">
                                    <source src="${item}" type="video/webm">
                                    <source src="${item}" type="video/mp4">
                                    Your browser does not support the video tag.
                                </video>
                            </div>
                        `;
                    } else {
                        imagesHtml = `<div class="post-image-container"><img src="${item}" alt="Post image" class="post-image" style="max-width: 100%; border-radius: 8px; margin-top: 10px; display: block;"></div>`;
                    }
                } else if (imageArray.length > 1) {
                    imagesHtml = renderCarousel(imageArray);
                }
            }
            
            return `
                <div class="post-item" data-post-id="${post.id}">
                    <div class="post-header">
                        <div class="post-author">
                            <div class="post-avatar"><i class="fas fa-user-shield"></i></div>
                            <div class="post-author-info">
                                <span class="post-author-name">Administrator</span>
                                <span class="post-time">${formatDate(post.created_at)}</span>
                            </div>
                        </div>
                    </div>
                    <div class="post-content">
                        <p>${post.content || ''}</p>
                        ${imagesHtml}
                    </div>
                    <div class="post-engagement">
                        <div class="post-reactions">
                            <span class="reactions-count"><span class="count-num">${post.likes || 0}</span> <span class="count-label">likes</span></span>
                            <span class="comments-count"><span class="count-num">${post.comments_count || 0}</span> <span class="count-label">comments</span></span>
                        </div>
                        <div class="post-actions">
                            <button class="action-btn like-btn" onclick="studentToggleLike(${post.id})">
                                <i class="fas fa-thumbs-up"></i>
                                <span>Like</span>
                            </button>
                            <button class="action-btn comment-btn" onclick="studentToggleComments(${post.id})">
                                <i class="fas fa-comment"></i>
                                <span>Comment</span>
                            </button>
                        </div>
                        <div id="student-comments-${post.id}" class="comments-section" style="display: none;">
                            <div id="student-comments-list-${post.id}" data-loaded="false"></div>
                            <div class="comment-input-container">
                                <input type="text" placeholder="Write a comment..." id="studentCommentInput-${post.id}" class="comment-input" onkeypress="if(event.key==='Enter') studentCommentPost(${post.id})">
                                <button onclick="studentCommentPost(${post.id})" class="comment-submit-btn">
                                    <i class="fas fa-paper-plane"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading student homepage posts:', error);
        container.innerHTML = `
            <div class="welcome-message">
                <h3>Welcome to the Student Portal</h3>
                <p>Error loading posts. Please try refreshing the page.</p>
            </div>
        `;
    }
}

// Load posts for public home page
async function loadHomeFeed() {
    const container = document.getElementById('homeFeed');
    if (!container) return;
    
    try {
        // Load posts from database with 'home' audience
        const posts = await getPosts('home');
        
        if (!posts || posts.length === 0) {
            container.innerHTML = `
                <div class="welcome-message">
                    <p>No announcements yet. Check back soon for updates!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = posts.map(post => {
            let imagesHtml = '';
            
            if (post.images) {
                let imageArray = [];
                
                if (Array.isArray(post.images)) {
                    imageArray = post.images;
                } else if (typeof post.images === 'string') {
                    try {
                        const parsed = JSON.parse(post.images);
                        imageArray = Array.isArray(parsed) ? parsed : [parsed];
                    } catch (e) {
                        imageArray = [post.images];
                    }
                } else if (post.images) {
                    imageArray = [post.images];
                }
                
                imageArray = imageArray.map(img => {
                    if (typeof img === 'string' && img.trim().startsWith('[') && img.trim().endsWith(']')) {
                        try {
                            const parsed = JSON.parse(img);
                            if (Array.isArray(parsed)) {
                                return parsed[0];
                            }
                            return parsed;
                        } catch (e) {
                            return img;
                        }
                    }
                    return img;
                });
                
                imageArray = imageArray.filter(img => {
                    return img && typeof img === 'string' && img.trim() !== '' && img.length > 10;
                });
                
                // Check if this is a live post with video
                const isLiveVideo = post.type === 'live' && imageArray.length > 0;
                
                if (isLiveVideo) {
                    const firstItem = imageArray[0];
                    const isVideo = typeof firstItem === 'string' && (
                        firstItem.startsWith('data:video/') || 
                        firstItem.includes('video/webm') ||
                        firstItem.includes('video/mp4')
                    );
                    
                    if (isVideo) {
                        imagesHtml = `
                            <div class="post-video-container">
                                <video controls class="post-video" style="width: 100%; max-width: 100%; border-radius: 8px; margin-top: 10px; background: #000;">
                                    <source src="${firstItem}" type="video/webm">
                                    <source src="${firstItem}" type="video/mp4">
                                    Your browser does not support the video tag.
                                </video>
                                <div class="post-live-indicator">
                                    <span class="live-dot-small"></span>
                                    <span>Live Recording</span>
                                </div>
                            </div>
                        `;
                    } else {
                        imagesHtml = `<div class="post-image-container"><img src="${firstItem}" alt="Post image" class="post-image" style="max-width: 100%; border-radius: 8px; margin-top: 10px; display: block;"></div>`;
                    }
                } else if (imageArray.length === 1) {
                    const item = imageArray[0];
                    const isVideo = typeof item === 'string' && (
                        item.startsWith('data:video/') || 
                        item.includes('video/webm') ||
                        item.includes('video/mp4')
                    );
                    
                    if (isVideo) {
                        imagesHtml = `
                            <div class="post-video-container">
                                <video controls class="post-video" style="width: 100%; max-width: 100%; border-radius: 8px; margin-top: 10px; background: #000;">
                                    <source src="${item}" type="video/webm">
                                    <source src="${item}" type="video/mp4">
                                    Your browser does not support the video tag.
                                </video>
                            </div>
                        `;
                    } else {
                        imagesHtml = `<div class="post-image-container"><img src="${item}" alt="Post image" class="post-image" style="max-width: 100%; border-radius: 8px; margin-top: 10px; display: block;"></div>`;
                    }
                } else if (imageArray.length > 1) {
                    imagesHtml = renderCarousel(imageArray);
                }
            }
            
            return `
                <div class="post-item" data-post-id="${post.id}">
                    <div class="post-header">
                        <div class="post-author">
                            <div class="post-avatar"><i class="fas fa-user-shield"></i></div>
                            <div class="post-author-info">
                                <span class="post-author-name">Administrator</span>
                                <span class="post-time">${formatDate(post.created_at)}</span>
                            </div>
                        </div>
                    </div>
                    <div class="post-content">
                        <p>${post.content || ''}</p>
                        ${imagesHtml}
                    </div>
                    <div class="post-engagement">
                        <div class="post-reactions">
                            <span class="reactions-count"><span class="count-num">${post.likes || 0}</span> <span class="count-label">likes</span></span>
                            <span class="comments-count"><span class="count-num">${post.comments_count || 0}</span> <span class="count-label">comments</span></span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading home feed:', error);
        container.innerHTML = `
            <div class="welcome-message">
                <p>Error loading posts. Please try refreshing the page.</p>
            </div>
        `;
    }
}

async function loadStudentHomepage() {
    // Load posts for student homepage
    await loadStudentHomepagePosts();
    // Load notifications
    if (typeof loadStudentNotifications === 'function') {
        loadStudentNotifications();
    }
}

async function loadStudentAnnouncements() {
    const container = document.getElementById('studentAnnouncementsFeed');
    if (!container) return;
    
    try {
        // Load posts from database with 'students' audience
        const posts = await getPosts('students');
        
        if (!posts || posts.length === 0) {
        container.innerHTML = `
            <div class="no-posts">
                <i class="fas fa-newspaper"></i>
                <h4>No announcements yet</h4>
                <p>The administration hasn't posted any announcements yet.</p>
            </div>
        `;
        return;
    }

        container.innerHTML = posts.map(post => {
            let imagesHtml = '';
            
            if (post.images) {
                let imageArray = [];
                
                if (Array.isArray(post.images)) {
                    imageArray = post.images;
                } else if (typeof post.images === 'string') {
                    try {
                        const parsed = JSON.parse(post.images);
                        imageArray = Array.isArray(parsed) ? parsed : [parsed];
                    } catch (e) {
                        imageArray = [post.images];
                    }
                } else if (post.images) {
                    imageArray = [post.images];
                }
                
                imageArray = imageArray.map(img => {
                    if (typeof img === 'string' && img.trim().startsWith('[') && img.trim().endsWith(']')) {
                        try {
                            const parsed = JSON.parse(img);
                            if (Array.isArray(parsed)) {
                                return parsed[0];
                            }
                            return parsed;
                        } catch (e) {
                            return img;
                        }
                    }
                    return img;
                });
                
                imageArray = imageArray.filter(img => {
                    return img && typeof img === 'string' && img.trim() !== '' && img.length > 10;
                });
                
                // Check if this is a live post with video
                const isLiveVideo = post.type === 'live' && imageArray.length > 0;
                
                if (isLiveVideo) {
                    const firstItem = imageArray[0];
                    const isVideo = typeof firstItem === 'string' && (
                        firstItem.startsWith('data:video/') || 
                        firstItem.includes('video/webm') ||
                        firstItem.includes('video/mp4')
                    );
                    
                    if (isVideo) {
                        imagesHtml = `
                            <div class="post-video-container">
                                <video controls class="post-video" style="width: 100%; max-width: 100%; border-radius: 8px; margin-top: 10px; background: #000;">
                                    <source src="${firstItem}" type="video/webm">
                                    <source src="${firstItem}" type="video/mp4">
                                    Your browser does not support the video tag.
                                </video>
                                <div class="post-live-indicator">
                                    <span class="live-dot-small"></span>
                                    <span>Live Recording</span>
                                </div>
                            </div>
                        `;
                    } else {
                        imagesHtml = `<div class="post-image-container"><img src="${firstItem}" alt="Post image" class="post-image" style="max-width: 100%; border-radius: 8px; margin-top: 10px; display: block;"></div>`;
                    }
                } else if (imageArray.length === 1) {
                    const item = imageArray[0];
                    const isVideo = typeof item === 'string' && (
                        item.startsWith('data:video/') || 
                        item.includes('video/webm') ||
                        item.includes('video/mp4')
                    );
                    
                    if (isVideo) {
                        imagesHtml = `
                            <div class="post-video-container">
                                <video controls class="post-video" style="width: 100%; max-width: 100%; border-radius: 8px; margin-top: 10px; background: #000;">
                                    <source src="${item}" type="video/webm">
                                    <source src="${item}" type="video/mp4">
                                    Your browser does not support the video tag.
                                </video>
                            </div>
                        `;
                    } else {
                        imagesHtml = `<div class="post-image-container"><img src="${item}" alt="Post image" class="post-image" style="max-width: 100%; border-radius: 8px; margin-top: 10px; display: block;"></div>`;
                    }
                } else if (imageArray.length > 1) {
                    imagesHtml = renderCarousel(imageArray);
                }
            }
        
        return `
            <div class="post-card">
                <div class="post-header">
                    <div class="post-author-avatar">
                        <i class="fas fa-user-shield"></i>
                    </div>
                    <div class="post-author-info">
                            <h4>Administrator</h4>
                            <p>${formatDate(post.created_at)}</p>
                    </div>
                </div>
                <div class="post-content">
                        ${imagesHtml}
                        <div class="post-text">${post.content || ''}</div>
                </div>
                <div class="post-actions">
                        <button class="post-action-btn" onclick="studentToggleLike(${post.id})">
                        <i class="fas fa-heart"></i>
                            <span>${post.likes || 0}</span>
                    </button>
                        <button class="post-action-btn" onclick="studentToggleComments(${post.id})">
                        <i class="fas fa-comment"></i>
                            <span>${post.comments_count || 0}</span>
                    </button>
                </div>
                    <div class="comments-section" id="student-comments-${post.id}" style="display: none;">
                        <div id="student-comments-list-${post.id}" data-loaded="false"></div>
                    <div class="comment-form">
                            <input type="text" class="comment-input" placeholder="Write a comment..." id="studentCommentInput-${post.id}" onkeypress="if(event.key==='Enter') studentCommentPost(${post.id})">
                            <button class="comment-btn" onclick="studentCommentPost(${post.id})">Comment</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
        
        // Load comments for each post when they're opened
        
    } catch (error) {
        console.error('Error loading student announcements:', error);
        container.innerHTML = `
            <div class="no-posts">
                <i class="fas fa-exclamation-triangle"></i>
                <h4>Error loading announcements</h4>
                <p>Please try refreshing the page.</p>
            </div>
        `;
    }
}

async function loadStudentMessages() {
    const container = document.getElementById('studentChatMessages');
    if (!container) return;
    
    try {
        // Get student ID and normalize it
        const studentId = currentUser?.studentData?.id || currentUser?.studentData?.student_id;
        const normalizedStudentId = typeof studentId === 'number' 
            ? studentId 
            : parseInt(studentId) || studentId;
        
        if (!normalizedStudentId) {
            container.innerHTML = `
                <div class="no-messages">
                    <i class="fas fa-comments"></i>
                    <h4>Error</h4>
                    <p>Student ID not found.</p>
                </div>
            `;
            return;
        }
        
        // Load messages from database
        const messages = await getMessages(
            normalizedStudentId, 
            'student', 
            1, // Admin ID
            'admin'
        );
        if (messages.length === 0) {
            container.innerHTML = `
                <div class="no-messages">
                    <i class="fas fa-comments"></i>
                    <h4>No messages yet</h4>
                    <p>Start a conversation with the administration team.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = messages.map(message => {
            const isStudent = message.senderType === 'student';
            const time = new Date(message.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            return `
                <div class="message-item ${isStudent ? 'sent' : 'received'}">
                    <div class="message-avatar">${isStudent ? 'S' : 'A'}</div>
                    <div class="message-bubble">
                        <div class="message-text">${message.content}</div>
                        <div class="message-time">${time}</div>
                    </div>
                </div>
            `;
        }).join('');
        
        container.scrollTop = container.scrollHeight;
    } catch (error) {
        console.error('Error loading messages:', error);
        container.innerHTML = `
            <div class="no-messages">
                <i class="fas fa-comments"></i>
                <h4>Error loading messages</h4>
                <p>Please try again later.</p>
            </div>
        `;
    }
}


function loadStudentNotifications() {
    const container = document.getElementById('notificationsContainer');
    const studentNotifications = notifications.filter(n => n.studentId === currentUser.studentData.id);
    
    if (studentNotifications.length === 0) {
        container.innerHTML = '<p class="no-notifications">No notifications yet.</p>';
        return;
    }
    
    container.innerHTML = studentNotifications.map(notification => `
        <div class="notification-item ${notification.read ? '' : 'unread'}">
            <h4>${notification.title}</h4>
            <p>${notification.message}</p>
            <div class="timestamp">${formatDate(notification.date)}</div>
        </div>
    `).join('');
}

function submitApplication(event) {
    event.preventDefault();
    
    const idPicture = document.getElementById('idPictureUpload').files[0];
    const idNumber = document.getElementById('idNumber').value.trim();
    const cor = document.getElementById('corUpload').files[0];
    const notes = document.getElementById('applicationNotes').value;
    
    // Require at least one file
    if (!idPicture && !cor) {
        showToast('Please upload at least one document (ID Picture or COR)', 'error');
        return;
    }

    // Build a single application bundling provided documents
    const attachedDocuments = [];
    let combinedTypeLabels = [];
    let representativeFileName = 'Multiple files';

    if (idPicture) {
        combinedTypeLabels.push('ID Picture');
        attachedDocuments.push({ type: 'ID Picture', fileName: idPicture.name, fileDataUrl: null });
        representativeFileName = idPicture.name;
    }
    if (cor) {
        combinedTypeLabels.push('COR');
        attachedDocuments.push({ type: 'COR', fileName: cor.name, fileDataUrl: null });
        representativeFileName = idPicture ? 'Multiple files' : cor.name;
    }
    if (idNumber) {
        combinedTypeLabels.push('ID Number');
    }

    const newApplication = {
        id: applications.length + 1,
        studentId: currentUser.studentData.id,
        documentType: combinedTypeLabels.join(' + '),
        fileName: representativeFileName,
        notes: notes,
        status: 'submitted',
        submittedDate: new Date().toISOString().split('T')[0],
        reviewedDate: null,
        reviewerNotes: null,
        fileDataUrl: null,
        documentFiles: attachedDocuments
    };
    applications.push(newApplication);

    // Store data URLs for preview and save student's ID picture if provided
    const processFileToDataUrl = (file, indexInDocs) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            if (newApplication.documentFiles && newApplication.documentFiles[indexInDocs]) {
                newApplication.documentFiles[indexInDocs].fileDataUrl = e.target.result;
            }
            if (indexInDocs !== null && newApplication.documentFiles[indexInDocs].type === 'ID Picture') {
                const studentIndex = students.findIndex(s => s.id === currentUser.studentData.id);
                students[studentIndex].idPictureDataUrl = e.target.result;
            }
        };
        reader.readAsDataURL(file);
    };

    // Read files
    if (idPicture) processFileToDataUrl(idPicture, 0);
    if (cor) processFileToDataUrl(cor, idPicture ? 1 : 0);
    
    // Update student status - application submitted
    const studentIndex = students.findIndex(s => s.id === currentUser.studentData.id);
    // Application status is now managed through the new process, not via pending/approved/rejected
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    // Add notification
    addNotification(currentUser.studentData.id, 'Application Submitted', 
        'Your documents have been submitted and are under review.');
    
    showToast('Application submitted successfully!', 'success');
    
    // Reset form
    document.getElementById('applicationNotes').value = '';
    const idPictureInput = document.getElementById('idPictureUpload');
    const idCardInput = document.getElementById('idNumber');
    const corInput = document.getElementById('corUpload');
    if (idPictureInput) idPictureInput.value = '';
    if (idCardInput) idCardInput.value = '';
    if (corInput) corInput.value = '';
    
    // Reload dashboard
    loadStudentDashboard();
}

// (Removed legacy showStudentTab for #student-dashboard to avoid conflicts)

// Admin Dashboard Functions
async function loadAdminDashboard() {
    console.log('🏠 loadAdminDashboard called');
    
    // Show admin homepage by default
    const adminHomepage = document.getElementById('admin-homepage');
    const tabContent = document.querySelector('.tab-content');
    
    if (adminHomepage) {
    adminHomepage.style.display = 'block';
    }
    if (tabContent) {
    tabContent.style.display = 'none';
    }
    
    // Wait a bit to ensure DOM is ready
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Load students from database and update stats FIRST
    console.log('📊 Updating admin stats...');
    await updateAdminStats();
    
    // Load admin posts
    if (typeof loadAdminPosts === 'function') {
    loadAdminPosts();
    }
    
    // Load applications
    if (typeof loadApplications === 'function') {
    loadApplications();
    }
    
    // Load students
    if (typeof loadStudents === 'function') {
    loadStudents();
    }
    
    // Initialize chat
    if (typeof initializeChat === 'function') {
    initializeChat();
    }
    
    // Also update stats again after a short delay to ensure everything is loaded
    setTimeout(async () => {
        console.log('🔄 Refreshing stats after delay...');
        await updateAdminStats();
    }, 500);
}

// Update admin dashboard statistics from database
async function updateAdminStats() {
    console.log('🔄 updateAdminStats called');
    
    try {
        // Get students from database
        console.log('📡 Fetching students from database...');
        const studentsFromDB = await getStudentsFromDatabase();
        console.log('✅ Students fetched:', studentsFromDB ? studentsFromDB.length : 0, 'students');
        
        // Find the stat elements
        const totalStudentsEl = document.getElementById('totalStudents');
        const totalIndigenousEl = document.getElementById('totalIndigenous');
        const totalPwdEl = document.getElementById('totalPwd');
        const totalArchivedEl = document.getElementById('totalArchived');
        
        console.log('🔍 Element check:', {
            totalStudents: !!totalStudentsEl,
            totalIndigenous: !!totalIndigenousEl,
            totalPwd: !!totalPwdEl,
            totalArchived: !!totalArchivedEl
        });
        
        if (!totalStudentsEl || !totalIndigenousEl || !totalPwdEl || !totalArchivedEl) {
            console.error('❌ Stat elements not found!');
            return;
        }
        
        if (!studentsFromDB || studentsFromDB.length === 0) {
            // Set all stats to 0 if no students
            console.log('📊 No students found, setting all stats to 0');
            totalStudentsEl.textContent = '0';
            totalIndigenousEl.textContent = '0';
            totalPwdEl.textContent = '0';
            totalArchivedEl.textContent = '0';
            return;
        }
        
        // Calculate statistics
        const totalStudents = studentsFromDB.length;
        
        // Check for indigenous students - handle multiple possible field names and values
        const indigenousStudents = studentsFromDB.filter(s => {
            const isIndigenous = s.isIndigenous === true || 
                               s.isIndigenous === 1 || 
                               s.isIndigenous === '1' ||
                               s.is_indigenous === 1 || 
                               s.is_indigenous === true ||
                               s.is_indigenous === '1';
            return isIndigenous;
        }).length;
        
        // Check for PWD students
        const pwdStudents = studentsFromDB.filter(s => {
            const isPwd = s.isPwd === true || 
                         s.isPwd === 1 || 
                         s.isPwd === '1' ||
                         s.is_pwd === 1 || 
                         s.is_pwd === true ||
                         s.is_pwd === '1';
            return isPwd;
        }).length;
        
        // Check for archived students
        const archivedStudents = studentsFromDB.filter(s => {
            const status = s.status || s.student_status || 'active';
            return status.toLowerCase() === 'archived';
        }).length;
        
        // Update the display
        totalStudentsEl.textContent = totalStudents;
        totalIndigenousEl.textContent = indigenousStudents;
        totalPwdEl.textContent = pwdStudents;
        totalArchivedEl.textContent = archivedStudents;
        
        console.log('✅ Admin stats updated:', {
            totalStudents,
            indigenousStudents,
            pwdStudents,
            archivedStudents
        });
        
    } catch (error) {
        console.error('❌ Error updating admin stats:', error);
        console.error('Error details:', error.stack);
        
        // Set to 0 on error and show error message
        const elements = ['totalStudents', 'totalIndigenous', 'totalPwd', 'totalArchived'];
        elements.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = '0';
                el.style.color = '#ef4444'; // Red color to indicate error
            }
        });
        
        // Try to show error toast if available
        if (typeof showToast === 'function') {
            showToast('Failed to load statistics. Please refresh the page.', 'error');
        }
    }
}

function loadApplications() {
    const container = document.getElementById('applicationsContainer');
    const filteredApplications = filterApplicationsByStatus().filter(app => app && app.documentType);
    
    if (filteredApplications.length === 0) {
        container.innerHTML = '<p class="no-data">No applications found.</p>';
        return;
    }
    
    container.innerHTML = filteredApplications.map(app => {
        const student = students.find(s => s.id === app.studentId) || { firstName: '', lastName: '', studentId: '' };
        return `
            <div class="application-item">
                <div class="application-header">
                    <h4>${student.firstName} ${student.lastName}</h4>
                    <span class="status-badge status-${app.status}">${app.status}</span>
                </div>
                <div class="application-info">
                    <div class="info-item">
                        <span class="info-label">Student ID</span>
                        <span class="info-value">${student.studentId}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Document Type</span>
                        <span class="info-value">${app.documentType}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Submitted Date</span>
                        <span class="info-value">${formatDate(app.submittedDate)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Status</span>
                        <span class="info-value">${app.status}</span>
                    </div>
                </div>
                <div class="application-actions">
                    <button class="btn btn-secondary" onclick="viewApplicationDetails(${app.id})">View Details</button>
                </div>
            </div>
        `;
    }).join('');
}

function loadStudents() {
    const container = document.getElementById('studentsContainer');
    const filteredStudents = filterStudentsByStatus();
    
    if (filteredStudents.length === 0) {
        container.innerHTML = '<p class="no-data">No students found.</p>';
        return;
    }
    
    container.innerHTML = filteredStudents.map((student, index) => {
        return `
            <div class="student-item">
                <div class="student-header">
                    <h4><span class="student-index">${index + 1}</span>${student.firstName} ${student.lastName}</h4>
                </div>
                <div class="student-info">
                    <div class="info-item">
                        <span class="info-label">Student ID</span>
                        <span class="info-value">${student.studentId || 'N/A'}</span>
                    </div>
                </div>
                <div class="student-actions">
                    <button class="btn btn-secondary" onclick="openStudentProfileModal(${student.id || student.student_id})">View Profile</button>
                    <button class="btn btn-secondary" onclick="editStudent(${student.id})">Edit</button>
                    <button class="btn btn-secondary" onclick="archiveStudent(${student.id})">Archive</button>
                    <button class="btn btn-danger" onclick="deleteStudent(${student.id})">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

// Admin Tab Functions
function showAdminTab(tabName) {
    // Update bottom navigation tab buttons
    document.querySelectorAll('.nav-tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Hide admin homepage and show tab content
    const adminHomepage = document.getElementById('admin-homepage');
    const tabContent = document.querySelector('.tab-content');
    
    if (tabName === 'homepage') {
        adminHomepage.style.display = 'block';
        tabContent.style.display = 'none';
    } else {
        adminHomepage.style.display = 'none';
        tabContent.style.display = 'block';
        
        // Update tab panels
        document.querySelectorAll('#admin-dashboard .tab-panel').forEach(panel => panel.classList.remove('active'));
        document.getElementById(`${tabName}-tab`).classList.add('active');
    }
    
    // Load tab-specific content
    if (tabName === 'reports') {
        loadReports();
    }
}

// Quick action: show only the Students list and hide the tab bar
function openManageStudents() {
    showAdminTab('students');
    const navTabs = document.querySelector('.admin-nav-tabs');
    if (navTabs) {
        navTabs.style.display = 'none';
    }
}

// Show Profile panel when clicking the sidebar profile card header
function showStudentProfile() {
    const homepageContent = document.getElementById('student-homepage-content');
    const tabContent = document.querySelector('#student-homepage .tab-content');
    const navTabs = document.querySelector('#student-homepage .admin-nav-tabs');

    if (homepageContent && tabContent && navTabs) {
        homepageContent.style.display = 'none';
        tabContent.style.display = 'block';
        // Hide tabs when viewing profile via sidebar
        navTabs.style.display = 'none';

        // Hide all panels and show profile panel
        document.querySelectorAll('#student-homepage .tab-panel').forEach(panel => panel.classList.remove('active'));
        const profilePanel = document.getElementById('profile-tab');
        if (profilePanel) profilePanel.classList.add('active');

        // Do not alter tab button active state (tabs remain Announcements/Messages)
        document.querySelectorAll('#student-homepage .nav-tab-btn').forEach(btn => btn.classList.remove('active'));
    }

    // Ensure profile data is populated
    loadStudentProfile();
}

// Open Messages from sidebar Notifications or counters
function openStudentMessages() {
    const homepageContent = document.getElementById('student-homepage-content');
    const tabContent = document.querySelector('#student-homepage .tab-content');
    const navTabs = document.querySelector('#student-homepage .admin-nav-tabs');

    if (homepageContent && tabContent && navTabs) {
        homepageContent.style.display = 'none';
        tabContent.style.display = 'block';
        navTabs.style.display = 'flex';

        // Switch to messages panel and highlight Messages tab button
        document.querySelectorAll('#student-homepage .tab-panel').forEach(panel => panel.classList.remove('active'));
        const msgPanel = document.getElementById('messages-tab');
        if (msgPanel) msgPanel.classList.add('active');
        document.querySelectorAll('#student-homepage .nav-tab-btn').forEach(btn => btn.classList.remove('active'));
        const msgBtn = document.querySelector(`#student-homepage .nav-tab-btn[onclick*="'messages'"]`);
        if (msgBtn) msgBtn.classList.add('active');

        // Ensure messages render
        setTimeout(loadStudentMessages, 0);
    }
}

function loadReports() {
    // Simple chart implementation (in a real app, you'd use a charting library)
    const applicationChart = document.getElementById('applicationChart');
    const trendChart = document.getElementById('trendChart');
    const departmentChart = document.getElementById('departmentChart');
    const departmentSummary = document.getElementById('departmentSummary');
    const placeChart = document.getElementById('placeChart');
    const placeSummary = document.getElementById('placeSummary');
    
    if (applicationChart && trendChart) {
        drawSimpleChart(applicationChart, {
            active: students.filter(s => (s.status || 'active') === 'active').length,
            archived: students.filter(s => s.status === 'archived').length
        });
        
        drawSimpleChart(trendChart, {
            jan: 5,
            feb: 8,
            mar: 12,
            apr: 15
        });
    }

    // Department analysis
    if (departmentChart && departmentSummary) {
        const storedStudents = JSON.parse(localStorage.getItem('students') || '[]');
        const deptCounts = storedStudents.reduce((acc, s) => {
            const dept = (s && s.department) ? s.department : 'Unspecified';
            acc[dept] = (acc[dept] || 0) + 1;
            return acc;
        }, {});
        if (Object.keys(deptCounts).length === 0) {
            departmentSummary.innerHTML = '<p class="no-data">No department data available.</p>';
        } else {
            // Render chart
            drawSimpleChart(departmentChart, deptCounts);
            // Render summary list
            const total = Object.values(deptCounts).reduce((a, b) => a + b, 0);
            const sorted = Object.entries(deptCounts).sort((a, b) => b[1] - a[1]);
            departmentSummary.innerHTML = `
                <ul class="dept-summary-list">
                    ${sorted.map(([name, count], idx) => {
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                        const color = `hsl(${(idx * 53) % 360}, 70%, 55%)`;
                        const abbr = abbreviateDepartment(name);
                        return `<li title="${name}">
                            <span class="dept-color-dot" style="background:${color}"></span>
                            <span class="dept-name">${abbr}</span>
                            <span class="dept-count">${count} (${pct}%)</span>
                        </li>`;
                    }).join('')}
                </ul>
            `;
        }
    }
}

    // Place (From) analysis (counts and percentage summary)
    const placeChart = document.getElementById('placeChart');
    const placeSummary = document.getElementById('placeSummary');
    if (placeChart && placeSummary) {
        const storedStudents = JSON.parse(localStorage.getItem('students') || '[]');
        const placeCounts = storedStudents.reduce((acc, s) => {
            const place = (s && s.place && s.place.trim()) ? s.place.trim() : 'Unspecified';
            acc[place] = (acc[place] || 0) + 1;
            return acc;
        }, {});
        if (Object.keys(placeCounts).length === 0) {
            placeSummary.innerHTML = '<p class="no-data">No origin data available.</p>';
            const ctx = placeChart.getContext('2d');
            ctx.clearRect(0, 0, placeChart.width, placeChart.height);
        } else {
            drawSimpleChart(placeChart, placeCounts);
            const total = Object.values(placeCounts).reduce((a, b) => a + b, 0);
            const sorted = Object.entries(placeCounts).sort((a, b) => b[1] - a[1]).slice(0, 12);
            placeSummary.innerHTML = `
                <ul class="dept-summary-list">
                    ${sorted.map(([name, count], idx) => {
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                        const color = `hsl(${(idx * 53) % 360}, 70%, 55%)`;
                        return `<li title="${name}">
                            <span class="dept-color-dot" style="background:${color}"></span>
                            <span class="dept-name">${name}</span>
                            <span class="dept-count">${count} (${pct}%)</span>
                        </li>`;
                    }).join('')}
                </ul>
            `;
        }
    }

function drawSimpleChart(canvas, data, opts) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    const maxValue = Math.max(...Object.values(data));
    const labels = Object.keys(data);
    const values = Object.values(data);
    const count = labels.length;
    const padding = 10;
    const barWidth = Math.max(20, Math.floor(width / count) - padding);
    const labelColor = '#374151';
    const hideLabels = !!(opts && opts.hideLabels);
    const labelFormatter = (opts && typeof opts.labelFormatter === 'function') ? opts.labelFormatter : (t) => t;
    
    labels.forEach((key, index) => {
        const value = values[index];
        const bottomSpace = hideLabels ? 8 : 18;
        const barHeight = maxValue > 0 ? (value / maxValue) * (height - (32 + bottomSpace)) : 0;
        const x = index * (barWidth + padding) + 5;
        const y = height - barHeight - (16 + bottomSpace);

        // Bar color with spaced hues for readability
        ctx.fillStyle = `hsl(${(index * 53) % 360}, 70%, 55%)`;
        ctx.fillRect(x, y, barWidth, barHeight);

        // Value label above bar
        ctx.fillStyle = labelColor;
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(String(value), x + barWidth/2, y - 6);

        // Optional label under bar
        if (!hideLabels) {
            const text = labelFormatter(key);
            ctx.save();
            ctx.fillStyle = labelColor;
            ctx.translate(x + barWidth/2, height - 6);
            ctx.rotate(0);
            ctx.fillText(text, 0, 0);
            ctx.restore();
        }
    });
}

function abbreviateDepartment(name) {
    if (!name) return '';
    const mapping = {
        'Department of Computer Studies': 'DCS',
        'Department of Business and Management': 'DBM',
        'Department of Industrial Technology': 'DIT',
        'Department of General Teacher Training': 'DGTT',
        'College of Criminal Justice Education': 'CCJE',
        'Unspecified': 'Unspecified'
    };
    if (mapping[name]) return mapping[name];
    // Generic fallback: collapse common prefixes and shorten words
    return name
        .replace(/^Department of\s+/i, '')
        .replace(/and/gi, '&')
        .replace(/Education/gi, 'Edu')
        .replace(/Management/gi, 'Mgmt')
        .replace(/Technology/gi, 'Tech')
        .replace(/General/gi, 'Gen')
        .trim();
}

// Application Management Functions
function reviewApplication(applicationId) {
    const application = applications.find(a => a.id === applicationId);
    const student = students.find(s => s.id === application.studentId);
    
    currentApplicationId = applicationId;
    
    document.getElementById('applicationDetails').innerHTML = `
        <div class="application-details">
            <h4>Application Details</h4>
            <div class="detail-row">
                <strong>Student:</strong> ${student.firstName} ${student.lastName} (${student.studentId})
            </div>
            <div class="detail-row">
                <strong>Document Type:</strong> ${application.documentType}
            </div>
            <div class="detail-row">
                <strong>File:</strong> ${application.fileName}
            </div>
            <div class="detail-row">
                <strong>Notes:</strong> ${application.notes || 'No additional notes'}
            </div>
            <div class="detail-row">
                <strong>Submitted:</strong> ${formatDate(application.submittedDate)}
            </div>
            <div class="detail-row attachments">
                <strong>Attachments:</strong>
                <div class="attachments-grid">
                    ${(application.documentFiles && application.documentFiles.length > 0) ? application.documentFiles.map(doc => `
                        <div class="attachment-card">
                            <div class="attachment-title">${doc.type}</div>
                            ${doc.fileDataUrl ? (
                                (doc.fileName || '').toLowerCase().endsWith('.pdf')
                                    ? `<iframe src="${doc.fileDataUrl}" class="attachment-preview"></iframe>`
                                    : `<img src="${doc.fileDataUrl}" alt="${doc.fileName || 'file'}" class="attachment-preview">`
                            ) : `<div class=\"attachment-fallback\">${doc.fileName || 'No preview available'}</div>`}
                            ${doc.fileName ? `<div class="attachment-filename">${doc.fileName}</div>` : ''}
                        </div>
                    `).join('') : `
                        <div class="attachment-card">
                            <div class="attachment-fallback">No attachments</div>
                        </div>
                    `}
                </div>
            </div>
        </div>
    `;
    
    // reviewModal removed - using viewApplicationDetails instead
    viewApplicationDetails(application.id);
}

// updateApplicationStatus function removed - approval/rejection process has been replaced

function viewApplicationDetails(applicationId) {
    const application = applications.find(a => a.id === applicationId);
    const student = students.find(s => s.id === application.studentId);
    
    alert(`Application Details:\n\nStudent: ${student.firstName} ${student.lastName}\nDocument: ${application.documentType}\nStatus: ${application.status}\nSubmitted: ${formatDate(application.submittedDate)}\nReviewed: ${application.reviewedDate ? formatDate(application.reviewedDate) : 'Not reviewed'}\nNotes: ${application.notes || 'None'}`);
}

async function openStudentProfileModal(studentId) {
    // Be robust: try to locate the student from the in-memory list first,
    // then fall back to the database with multiple id field variants.
    let student = Array.isArray(students) ? students.find(s => s && (s.id === studentId || s.id == studentId)) : null;
    if (!student) {
        try {
            const fromDb = await getStudentsFromDatabase();
            if (Array.isArray(fromDb) && fromDb.length) {
                student = fromDb.find(s => (
                    s && (
                        s.id === studentId || s.id == studentId ||
                        s.student_id == studentId || s.studentId == studentId ||
                        String(s.awardNumber || s.award_number || '') === String(studentId)
                    )
                ));
            }
        } catch (e) {
            console.error('Failed loading students from DB for profile modal:', e);
        }
    }
    if (!student) {
        showToast('Student record not found.', 'error');
        return;
    }
    const modal = document.getElementById('studentProfileModal');
    if (!modal) return;

    const firstName = student.firstName || student.first_name || '';
    const lastName = student.lastName || student.last_name || '';
    document.getElementById('adminStudentName').textContent = `${firstName} ${lastName}`.trim();
    document.getElementById('adminStudentEmail').textContent = student.email || '';
    // Keep the header meta showing the correct Student ID (not award number)
    document.getElementById('adminStudentId').textContent = student.studentId || '';
    const adminDeptEl = document.getElementById('adminStudentDepartment');
    if (adminDeptEl) { adminDeptEl.textContent = student.department || ''; }
    const adminPlaceEl = document.getElementById('adminStudentPlace');
    if (adminPlaceEl) { adminPlaceEl.textContent = student.place || ''; }
    document.getElementById('adminStudentCourse').textContent = student.course || '';
    document.getElementById('adminStudentYear').textContent = student.year || student.yearLevel || student.year_level || '';
    const adminStudentIdValueEl = document.getElementById('adminStudentIdValue');
    if (adminStudentIdValueEl) { adminStudentIdValueEl.textContent = student.studentId; }
    const adminStudentAwardNumberEl = document.getElementById('adminStudentAwardNumber');
    if (adminStudentAwardNumberEl) { adminStudentAwardNumberEl.textContent = student.awardNumber || 'N/A'; }
    document.getElementById('adminStudentStatus').textContent = student.status || 'active';
    // Application status removed from admin view
    const registeredValue = student.registered || student.registrationDate || student.registeredDate || student.created_at || null;
    document.getElementById('adminStudentRegistered').textContent = registeredValue ? formatDate(registeredValue) : 'N/A';

    const img = document.getElementById('adminStudentPhoto');
    if (img) {
        const picture = student.idPictureDataUrl || student.id_picture || student.photo || '';
        if (picture) {
            img.src = picture;
            img.alt = 'Student ID Picture';
        } else {
            img.src = '';
            img.alt = 'No ID Picture available';
        }
    }

    // Show flags in admin view if needed
    const indigenousBadge = document.getElementById('adminStudentIndigenous');
    const pwdBadge = document.getElementById('adminStudentPwd');
    if (indigenousBadge) indigenousBadge.textContent = student.isIndigenous ? 'Yes' : 'No';
    if (pwdBadge) pwdBadge.textContent = student.isPwd ? 'Yes' : 'No';

    // Load admin-student chat thread for this student
    // Ensure we use the correct ID - prefer the database ID, fallback to studentId
    adminActiveChatStudentId = student.id || student.student_id || studentId;
    renderAdminStudentChat();

    modal.style.display = 'block';
}

function closeStudentProfileModal() {
    const modal = document.getElementById('studentProfileModal');
    if (modal) modal.style.display = 'none';
}

async function renderAdminStudentChat() {
    const container = document.getElementById('adminStudentChatMessages');
    if (!container) return;
    container.innerHTML = '';
    
    if (!adminActiveChatStudentId) {
        container.innerHTML = `
            <div class="chat-welcome">
                <div class="welcome-message">
                    <i class="fas fa-comments"></i>
                    <h5>Start chatting</h5>
                    <p>Your messages will appear here.</p>
                </div>
            </div>
        `;
        return;
    }
    
    try {
        // Normalize the student ID to ensure proper matching
        const normalizedStudentId = typeof adminActiveChatStudentId === 'number' 
            ? adminActiveChatStudentId 
            : parseInt(adminActiveChatStudentId) || adminActiveChatStudentId;
        
        // Load messages from database in BOTH directions:
        // 1. Messages where admin sent to student (admin is sender)
        // 2. Messages where student sent to admin (student is sender)
        const [messagesFromAdmin, messagesFromStudent] = await Promise.all([
            getMessages(1, 'admin', normalizedStudentId, 'student'),
            getMessages(normalizedStudentId, 'student', 1, 'admin')
        ]);
        
        console.log('📨 Messages from admin to student:', messagesFromAdmin);
        console.log('📨 Messages from student to admin:', messagesFromStudent);
        
        // Merge both message arrays and remove duplicates
        const allMessages = [];
        const messageMap = new Map();
        
        // Add messages from admin to student
        if (Array.isArray(messagesFromAdmin)) {
            messagesFromAdmin.forEach(msg => {
                const key = `${msg.createdAt || msg.timestamp || ''}_${msg.content || msg.text || ''}_admin`;
                if (!messageMap.has(key)) {
                    messageMap.set(key, true);
                    allMessages.push(msg);
                }
            });
        }
        
        // Add messages from student to admin
        if (Array.isArray(messagesFromStudent)) {
            messagesFromStudent.forEach(msg => {
                const key = `${msg.createdAt || msg.timestamp || ''}_${msg.content || msg.text || ''}_student`;
                if (!messageMap.has(key)) {
                    messageMap.set(key, true);
                    allMessages.push(msg);
                }
            });
        }
        
        // Sort messages by timestamp
        allMessages.sort((a, b) => {
            const timeA = new Date(a.createdAt || a.timestamp || 0);
            const timeB = new Date(b.createdAt || b.timestamp || 0);
            return timeA - timeB;
        });
        
        console.log('📨 All merged messages (sorted):', allMessages);
        
        if (allMessages.length === 0) {
            container.innerHTML = `
                <div class="chat-welcome">
                    <div class="welcome-message">
                        <i class="fas fa-comments"></i>
                        <h5>Start chatting</h5>
                        <p>Your messages will appear here.</p>
                    </div>
                </div>
            `;
            return;
        }
        
        allMessages.forEach(message => {
            const messageDiv = document.createElement('div');
            const isAdmin = message.senderType === 'admin';
            messageDiv.className = `profile-message ${isAdmin ? 'sent' : 'received'}`;
            const time = new Date(message.createdAt || message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            messageDiv.innerHTML = `
                <div class="profile-message-avatar">${isAdmin ? 'A' : 'S'}</div>
                <div class="profile-message-content">
                    <div>${message.content || message.text || ''}</div>
                    <div class="profile-message-time">${time}</div>
                </div>
            `;
            container.appendChild(messageDiv);
        });
        
        container.scrollTop = container.scrollHeight;
    } catch (error) {
        console.error('Error loading admin chat:', error);
        container.innerHTML = `
            <div class="chat-welcome">
                <div class="welcome-message">
                    <i class="fas fa-comments"></i>
                    <h5>Error loading messages</h5>
                    <p>Please refresh the page.</p>
                </div>
            </div>
        `;
    }
}

function addMessageToAdminChat(container, message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `profile-message ${message.sender === 'admin' ? 'sent' : 'received'}`;
    const time = new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    messageDiv.innerHTML = `
        <div class="profile-message-avatar">${message.sender === 'admin' ? 'A' : 'S'}</div>
        <div class="profile-message-content">
            <div>${message.text || ''}</div>
            <div class="profile-message-time">${time}</div>
        </div>
    `;
    container.appendChild(messageDiv);
    // Ensure persistence when rendering (in case messages were programmatically added)
    persistChatMessages();
}

async function adminSendChatMessage() {
    const input = document.getElementById('adminStudentChatInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text || !adminActiveChatStudentId) return;
    
    try {
        // Normalize the student ID - ensure we're using the correct ID format
        const normalizedStudentId = typeof adminActiveChatStudentId === 'number' 
            ? adminActiveChatStudentId 
            : parseInt(adminActiveChatStudentId) || adminActiveChatStudentId;
        
        // Save message to database
        await saveMessage({
            senderId: 1, // Admin ID
            receiverId: normalizedStudentId,
            senderType: 'admin',
            receiverType: 'student',
            content: text,
            attachment: null,
            attachmentName: null
        });
        
        // Add notification for student
        addNotification(normalizedStudentId, 'New Message from Admin', text);
        
        // Reload chat to show the new message
        await renderAdminStudentChat();
        input.value = '';
        
        // Update student's profile chat if they're viewing it - compare with normalized IDs
        if (currentUser && currentUser.role === 'student') {
            const studentId = currentUser.studentData?.id || currentUser.studentData?.student_id;
            const normalizedCurrentStudentId = typeof studentId === 'number' 
                ? studentId 
                : parseInt(studentId) || studentId;
            
            if (normalizedCurrentStudentId == normalizedStudentId) {
                await loadProfileChatMessages();
            }
        }
    } catch (error) {
        console.error('Error sending message:', error);
        showToast('Failed to send message', 'error');
    }
}

function adminHandleChatKeyPress(event) {
    if (event.key === 'Enter') {
        adminSendChatMessage();
    }
}
// Student Management Functions
function sendMessageToStudent(studentId) {
    const message = prompt('Enter your message:');
    if (message) {
        const student = students.find(s => s.id === studentId);
        addNotification(studentId, 'Message from Admin', message);
        showToast('Message sent successfully!', 'success');
    }
}

function archiveStudent(studentId) {
    if (confirm('Are you sure you want to archive this student?')) {
        const studentIndex = students.findIndex(s => s.id === studentId);
        students[studentIndex].status = 'archived';
        loadStudents();
        loadAdminDashboard();
        showToast('Student archived successfully!', 'success');
    }
}

function activateStudent(studentId) {
    const studentIndex = students.findIndex(s => s.id === studentId);
    students[studentIndex].status = 'active';
    loadStudents();
    loadAdminDashboard();
    showToast('Student activated successfully!', 'success');
}

function deleteStudent(studentId) {
    if (!confirm('Are you sure you want to permanently delete this student?')) return;
    // Reload latest
    const stored = JSON.parse(localStorage.getItem('students') || '[]');
    const newList = stored.filter(s => s.id !== studentId);
    localStorage.setItem('students', JSON.stringify(newList));
    students = newList;
    // Remove related chat messages
    try {
        loadPersistedChatMessages();
        const filteredMsgs = chatMessages.filter(m => m.studentId !== studentId);
        chatMessages = filteredMsgs;
        persistChatMessages();
    } catch (_) { /* ignore */ }
    loadStudents();
    loadAdminDashboard();
    showToast('Student deleted successfully!', 'success');
}

// Filter Functions
function filterApplications() {
    loadApplications();
}

function filterApplicationsByStatus() {
    const statusFilter = document.getElementById('statusFilter').value;
    const searchTerm = document.getElementById('searchStudents').value.toLowerCase();
    
    let filtered = applications;
    
    if (statusFilter) {
        filtered = filtered.filter(app => app.status === statusFilter);
    }
    
    if (searchTerm) {
        filtered = filtered.filter(app => {
            const student = students.find(s => s.id === app.studentId);
            return student.firstName.toLowerCase().includes(searchTerm) || 
                   student.lastName.toLowerCase().includes(searchTerm) ||
                   student.studentId.toLowerCase().includes(searchTerm);
        });
    }
    
    return filtered;
}

function searchApplications() {
    loadApplications();
}

function filterStudents() {
    loadStudents();
}

function filterStudentsByStatus() {
    const statusFilter = document.getElementById('studentStatusFilter').value;
    const searchTerm = (document.getElementById('searchStudentRecords').value || '').trim().toLowerCase();
    
    // Load students from localStorage as single source of truth
    const storedStudents = JSON.parse(localStorage.getItem('students') || '[]');
    students = storedStudents;
    
    let filtered = students;
    
    if (statusFilter) {
        filtered = filtered.filter(student => (student.status || 'active') === statusFilter);
    }
    
    if (searchTerm) {
        filtered = filtered.filter(student => 
            (student.firstName || '').toLowerCase().includes(searchTerm) ||
            (student.lastName || '').toLowerCase().includes(searchTerm) ||
            (student.studentId || '').toLowerCase().includes(searchTerm) ||
            (student.email || '').toLowerCase().includes(searchTerm) ||
            (student.awardNumber || '').toLowerCase().includes(searchTerm) ||
            (student.course || '').toLowerCase().includes(searchTerm) ||
            (student.year || '').toLowerCase().includes(searchTerm)
        );
    }
    
    return filtered;
}

function searchStudents() {
    loadStudents();
}

// Settings Functions
// Removed updateSettings() function - Subsidy Types and System Message sections removed

async function generateReport() {
    try {
        console.log('📄 Generating Excel report...');
        
        // Check if XLSX library is loaded
        if (typeof XLSX === 'undefined') {
            showToast('Excel library not loaded. Please refresh the page.', 'error');
            return;
        }
        
        // Fetch students from database
        const studentsArr = await getStudentsFromDatabase();
        
        if (!studentsArr || studentsArr.length === 0) {
            showToast('No student data available to generate report.', 'warning');
            return;
        }
        
        // Calculate statistics
        const totalStudents = studentsArr.length;
        const indigenousStudents = studentsArr.filter(s => 
            s.isIndigenous === true || s.isIndigenous === 1 || s.is_indigenous === 1 || s.is_indigenous === true
        ).length;
        const pwdStudents = studentsArr.filter(s => 
            s.isPwd === true || s.isPwd === 1 || s.is_pwd === 1 || s.is_pwd === true
        ).length;
        const archivedStudents = studentsArr.filter(s => {
            const status = s.status || s.student_status || 'active';
            return status.toLowerCase() === 'archived';
        }).length;
        
        // Department breakdown
        const deptCounts = studentsArr.reduce((acc, s) => {
            const d = (s && s.department && s.department.trim()) ? s.department.trim() : 'Unspecified';
            acc[d] = (acc[d] || 0) + 1;
            return acc;
        }, {});
        
        // Place/Origin breakdown - normalize city names to group same cities
        const normalizeCityName = (place) => {
            if (!place || !place.trim()) return 'Unspecified';
            
            let normalized = place.trim();
            normalized = normalized.toLowerCase();
            normalized = normalized.replace(/\s+(city|town|municipality|municipal|province|prov)$/i, '');
            const parts = normalized.split(',');
            if (parts.length > 1) {
                normalized = parts[0].trim();
            }
            return normalized.split(' ').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
        };
        
        const getDisplayName = (place, normalized) => {
            if (!place || !place.trim()) return 'Unspecified';
            const parts = place.trim().split(',');
            return parts[0].trim() || normalized || 'Unspecified';
        };
        
        const placeGroups = {};
        studentsArr.forEach(s => {
            const originalPlace = (s && s.place && s.place.trim()) ? s.place.trim() : '';
            const normalized = normalizeCityName(originalPlace);
            const displayName = getDisplayName(originalPlace, normalized);
            
            if (!placeGroups[normalized]) {
                placeGroups[normalized] = {
                    count: 0,
                    displayName: displayName
                };
            }
            placeGroups[normalized].count++;
        });
        
        const placeCounts = {};
        Object.keys(placeGroups).forEach(normalized => {
            const group = placeGroups[normalized];
            placeCounts[group.displayName] = group.count;
        });
        
        // Course breakdown
        const courseCounts = studentsArr.reduce((acc, s) => {
            const c = (s && s.course && s.course.trim()) ? s.course.trim() : 'Unspecified';
            acc[c] = (acc[c] || 0) + 1;
            return acc;
        }, {});
        
        // Year level breakdown
        const yearCounts = studentsArr.reduce((acc, s) => {
            const y = (s && s.year && s.year.trim()) || (s && s.yearLevel && s.yearLevel.trim()) ? 
                      (s.year || s.yearLevel).trim() : 'Unspecified';
            acc[y] = (acc[y] || 0) + 1;
            return acc;
        }, {});
        
        const reportDate = new Date().toLocaleString();
        const reportDateShort = new Date().toISOString().split('T')[0];
        
        // Create workbook
        const wb = XLSX.utils.book_new();
        
        // Sheet 1: Summary Statistics
        const summaryData = [
            ['GRANTES SMART SUBSIDY MANAGEMENT SYSTEM'],
            ['STUDENT ANALYTICS REPORT'],
            ['Generated: ' + reportDate],
            [''], // Empty row
            ['SUMMARY STATISTICS'],
            ['', ''],
            ['Total Students', totalStudents],
            ['Indigenous People', indigenousStudents],
            ["PWD's", pwdStudents],
            ['Archived Students', archivedStudents],
            ['Active Students', totalStudents - archivedStudents]
        ];
        const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
        ws1['!cols'] = [{ wch: 25 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, ws1, 'Summary');
        
        // Sheet 2: Department Breakdown
        const deptData = [
            ['DEPARTMENT BREAKDOWN'],
            ['', ''],
            ['Department', 'Count', 'Percentage']
        ];
        Object.entries(deptCounts)
            .sort((a, b) => b[1] - a[1])
            .forEach(([dept, count]) => {
                const pct = ((count / totalStudents) * 100).toFixed(1);
                deptData.push([dept, count, pct + '%']);
            });
        const ws2 = XLSX.utils.aoa_to_sheet(deptData);
        ws2['!cols'] = [{ wch: 40 }, { wch: 10 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, ws2, 'Departments');
        
        // Sheet 3: Origin/Place Breakdown
        const placeData = [
            ['ORIGIN/PLACE BREAKDOWN'],
            ['', ''],
            ['Place/Origin', 'Count', 'Percentage']
        ];
        Object.entries(placeCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 50) // Top 50
            .forEach(([place, count]) => {
                const pct = ((count / totalStudents) * 100).toFixed(1);
                placeData.push([place || 'Unspecified', count, pct + '%']);
            });
        const ws3 = XLSX.utils.aoa_to_sheet(placeData);
        ws3['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, ws3, 'Origins');
        
        // Sheet 4: Course Breakdown
        const courseData = [
            ['COURSE BREAKDOWN'],
            ['', ''],
            ['Course', 'Count', 'Percentage']
        ];
        Object.entries(courseCounts)
            .sort((a, b) => b[1] - a[1])
            .forEach(([course, count]) => {
                const pct = ((count / totalStudents) * 100).toFixed(1);
                courseData.push([course || 'Unspecified', count, pct + '%']);
            });
        const ws4 = XLSX.utils.aoa_to_sheet(courseData);
        ws4['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, ws4, 'Courses');
        
        // Sheet 5: Year Level Breakdown
        const yearData = [
            ['YEAR LEVEL BREAKDOWN'],
            ['', ''],
            ['Year Level', 'Count', 'Percentage']
        ];
        Object.entries(yearCounts)
            .sort((a, b) => {
                const order = {'1st': 1, '2nd': 2, '3rd': 3, '4th': 4};
                return (order[a[0]] || 99) - (order[b[0]] || 99);
            })
            .forEach(([year, count]) => {
                const pct = ((count / totalStudents) * 100).toFixed(1);
                yearData.push([year + ' Year', count, pct + '%']);
            });
        const ws5 = XLSX.utils.aoa_to_sheet(yearData);
        ws5['!cols'] = [{ wch: 15 }, { wch: 10 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, ws5, 'Year Levels');
        
        // Sheet 6: Student List (Main Data Sheet)
        const studentData = [
            ['STUDENT LIST'],
            ['', ''],
            ['#', 'First Name', 'Last Name', 'Student ID', 'Email', 'Department', 'Course', 'Year Level', 'Place/Origin', 'Indigenous', "PWD's", 'Status', 'Award Number']
        ];
        studentsArr.forEach((s, idx) => {
            studentData.push([
                idx + 1,
                s.firstName || '',
                s.lastName || '',
                s.studentId || 'N/A',
                s.email || 'N/A',
                s.department || 'N/A',
                s.course || 'N/A',
                s.year || s.yearLevel || 'N/A',
                s.place || s.from || s.origin || 'N/A',
                (s.isIndigenous || s.is_indigenous) ? 'Yes' : 'No',
                (s.isPwd || s.is_pwd) ? 'Yes' : 'No',
                s.status || s.student_status || 'active',
                s.awardNumber || s.award_number || 'N/A'
            ]);
        });
        const ws6 = XLSX.utils.aoa_to_sheet(studentData);
        // Set column widths
        ws6['!cols'] = [
            { wch: 5 },   // #
            { wch: 15 },  // First Name
            { wch: 15 },  // Last Name
            { wch: 12 },  // Student ID
            { wch: 25 },  // Email
            { wch: 35 },  // Department
            { wch: 15 },  // Course
            { wch: 12 },  // Year Level
            { wch: 20 },  // Place/Origin
            { wch: 12 },  // Indigenous
            { wch: 10 },  // PWD's
            { wch: 12 },  // Status
            { wch: 15 }   // Award Number
        ];
        // Freeze header row
        ws6['!freeze'] = { x: 0, y: 2 };
        XLSX.utils.book_append_sheet(wb, ws6, 'Student List');
        
        // Generate Excel file and download
        const fileName = `grantes_report_${reportDateShort}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        showToast('Excel report generated and downloaded successfully!', 'success');
        console.log('✅ Excel report generated successfully:', fileName);
        
    } catch (error) {
        console.error('❌ Error generating Excel report:', error);
        showToast('Failed to generate Excel report: ' + error.message, 'error');
    }
}

// Notification Functions
function addNotification(studentId, title, message) {
    const notification = {
        id: notifications.length + 1,
        studentId: studentId,
        title: title,
        message: message,
        date: new Date().toISOString(),
        read: false
    };
    
    notifications.push(notification);
}

function generateSampleNotifications() {
    // Generate some sample notifications
    if (notifications.length === 0) {
        addNotification(1, 'Welcome!', 'Welcome to GranTES Smart Subsidy Management System');
        addNotification(2, 'Application Received', 'Your application has been received and is under review');
    }
}

// Utility Functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('notificationToast');
    const toastMessage = document.getElementById('toastMessage');
    
    toastMessage.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');
    
        setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function closeModal() {
    document.getElementById('reviewModal').style.display = 'none';
    currentApplicationId = null;
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('reviewModal');
    if (event.target === modal) {
        closeModal();
    }
}

// Export data functions (for demo purposes)
function exportStudents() {
    const dataStr = JSON.stringify(students, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'students.json';
    link.click();
}

function exportApplications() {
    const dataStr = JSON.stringify(applications, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'applications.json';
    link.click();
}

// Chat Functions
function toggleChat() {
    const chatBox = document.getElementById('chatBox');
    const chatToggle = document.getElementById('chatToggle');
    
    if (chatIsOpen) {
        closeChat();
    } else {
        openChat();
    }
}

function openChat() {
    const chatBox = document.getElementById('chatBox');
    chatBox.classList.add('show');
    chatIsOpen = true;
    chatIsMinimized = false;
    
    // Clear unread count
    unreadMessageCount = 0;
    updateChatBadge();
    
    // Load chat messages
    loadChatMessages();
    
    // Focus on input
    setTimeout(() => {
        document.getElementById('chatInput').focus();
    }, 300);
}

function closeChat() {
    const chatBox = document.getElementById('chatBox');
    chatBox.classList.remove('show');
    chatIsOpen = false;
    chatIsMinimized = false;
}

function toggleChatMinimize() {
    const chatBox = document.getElementById('chatBox');
    chatIsMinimized = !chatIsMinimized;
    
    if (chatIsMinimized) {
        chatBox.classList.add('minimized');
    } else {
        chatBox.classList.remove('minimized');
    }
}

function loadChatMessages() {
    const container = document.getElementById('chatMessages');
    
    // Clear welcome message if there are chat messages
    if (chatMessages.length > 0) {
        container.innerHTML = '';
        
        chatMessages.forEach(message => {
            addMessageToChat(message);
        });
    }
    
    scrollChatToBottom();
}

function addMessageToChat(message) {
    const container = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.sender === 'user' ? 'sent' : 'received'}`;
    
    const time = new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    messageDiv.innerHTML = `
        <div class="message-avatar">
            ${message.sender === 'user' ? 
                (currentUser && currentUser.role === 'student' ? 'S' : 'A') : 
                (message.sender === 'admin' ? 'A' : 'S')
            }
        </div>
        <div class="message-content">
            <div>${message.text}</div>
            <div class="message-time">${time}</div>
        </div>
    `;
    
    container.appendChild(messageDiv);
    scrollChatToBottom();
}

function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Add user message
    const userMessage = {
        id: Date.now(),
        text: message,
        sender: 'user',
        timestamp: new Date().toISOString(),
        userId: currentUser ? currentUser.id : 'anonymous'
    };
    
    chatMessages.push(userMessage);
    addMessageToChat(userMessage);
    
    // Clear input
    input.value = '';
}

    

function handleChatKeyPress(event) {
    if (event.key === 'Enter') {
        sendChatMessage();
    }
}

function showTypingIndicator() {
    const container = document.getElementById('chatMessages');
    const typingDiv = document.createElement('div');
    typingDiv.id = 'typingIndicator';
    typingDiv.className = 'typing-indicator show';
    typingDiv.innerHTML = `
        <div class="message received">
            <div class="message-avatar">A</div>
            <div class="message-content">
                <div>Admin is typing<span class="typing-dots">.</span><span class="typing-dots">.</span><span class="typing-dots">.</span></div>
            </div>
        </div>
    `;
    
    container.appendChild(typingDiv);
    scrollChatToBottom();
}

function hideTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

function scrollChatToBottom() {
    const container = document.getElementById('chatMessages');
    container.scrollTop = container.scrollHeight;
}

function updateChatBadge() {
    const badge = document.getElementById('chatBadge');
    if (unreadMessageCount > 0) {
        badge.textContent = unreadMessageCount;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

function sendMessageToStudent(studentId) {
    adminActiveChatStudentId = studentId;
    openStudentProfileModal(studentId);
}

// Initialize chat when user logs in
function initializeChat() {
    if (currentUser) {
        // Show chat toggle for logged in users
        const chatToggle = document.getElementById('chatToggle');
        if (chatToggle) {
            chatToggle.style.display = 'flex';
        }
        
        // Set appropriate chat header based on user role
        const chatUserName = document.getElementById('chatUserName');
        if (chatUserName) {
            if (currentUser.role === 'admin') {
                chatUserName.textContent = 'Student Support';
            } else {
                chatUserName.textContent = 'Admin Support';
            }
        }
        
        // Initialize profile chat
        initializeProfileChat();
    } else {
        const chatToggle = document.getElementById('chatToggle');
        if (chatToggle) {
            chatToggle.style.display = 'none';
        }
    }
}

// Profile Chat Functions
function initializeProfileChat() {
    // Load any existing profile chat messages
    loadProfileChatMessages();
    const fileInput = document.getElementById('profileChatFile');
    if (fileInput) {
        fileInput.addEventListener('change', handleProfileChatFileSelected);
    }
}

function toggleProfileChat() {
    const chatContainer = document.querySelector('.profile-chat-container');
    profileChatIsExpanded = !profileChatIsExpanded;
    
    if (profileChatIsExpanded) {
        chatContainer.style.position = 'fixed';
        chatContainer.style.top = '50%';
        chatContainer.style.left = '50%';
        chatContainer.style.transform = 'translate(-50%, -50%)';
        chatContainer.style.width = '500px';
        chatContainer.style.height = '600px';
        chatContainer.style.zIndex = '2000';
        chatContainer.style.boxShadow = '0 20px 40px rgba(0,0,0,0.3)';
        
        // Update button icon
        const button = chatContainer.querySelector('.profile-chat-header button i');
        button.className = 'fas fa-compress-arrows-alt';
    } else {
        chatContainer.style.position = '';
        chatContainer.style.top = '';
        chatContainer.style.left = '';
        chatContainer.style.transform = '';
        chatContainer.style.width = '';
        chatContainer.style.height = '400px';
        chatContainer.style.zIndex = '';
        chatContainer.style.boxShadow = '';
        
        // Update button icon
        const button = chatContainer.querySelector('.profile-chat-header button i');
        button.className = 'fas fa-expand-arrows-alt';
    }
}

async function loadProfileChatMessages() {
    const container = document.getElementById('profileChatMessages');
    if (!container) return;
    
    if (!currentUser || currentUser.role !== 'student') {
        container.innerHTML = `
            <div class="chat-welcome">
                <div class="welcome-message">
                    <i class="fas fa-comments"></i>
                    <h5>Not available</h5>
                    <p>Student chat is only available for students.</p>
                </div>
            </div>
        `;
        return;
    }
    
    try {
        // Get student ID - handle both camelCase and snake_case
        const studentId = currentUser.studentData?.id || currentUser.studentData?.student_id;
        const normalizedStudentId = typeof studentId === 'number' 
            ? studentId 
            : parseInt(studentId) || studentId;
        
        if (!normalizedStudentId) {
            container.innerHTML = `
                <div class="chat-welcome">
                    <div class="welcome-message">
                        <i class="fas fa-comments"></i>
                        <h5>Error</h5>
                        <p>Student ID not found.</p>
                    </div>
                </div>
            `;
            return;
        }
        
        // Load messages from database in BOTH directions:
        // 1. Messages where student sent to admin (student is sender)
        // 2. Messages where admin sent to student (admin is sender)
        const [messagesFromStudent, messagesFromAdmin] = await Promise.all([
            getMessages(normalizedStudentId, 'student', 1, 'admin'),
            getMessages(1, 'admin', normalizedStudentId, 'student')
        ]);
        
        console.log('📨 Student side - Messages from student:', messagesFromStudent);
        console.log('📨 Student side - Messages from admin:', messagesFromAdmin);
        
        // Also load from localStorage as fallback and merge
    loadPersistedChatMessages();
        const localMessages = chatMessages.filter(m => {
            const msgStudentId = m.studentId || m.receiverId;
            const normalizedMsgStudentId = typeof msgStudentId === 'number' 
                ? msgStudentId 
                : parseInt(msgStudentId) || msgStudentId;
            return normalizedMsgStudentId == normalizedStudentId;
        });
        
        // Merge database messages from both directions with local messages, avoiding duplicates
        const allMessages = [];
        const messageMap = new Map();
        
        // Add messages from student to admin
        if (Array.isArray(messagesFromStudent)) {
            messagesFromStudent.forEach(msg => {
                const key = `${msg.createdAt || msg.timestamp || ''}_${msg.content || msg.text || ''}_student`;
                if (!messageMap.has(key)) {
                    messageMap.set(key, true);
                    allMessages.push(msg);
                }
            });
        }
        
        // Add messages from admin to student
        if (Array.isArray(messagesFromAdmin)) {
            messagesFromAdmin.forEach(msg => {
                const key = `${msg.createdAt || msg.timestamp || ''}_${msg.content || msg.text || ''}_admin`;
                if (!messageMap.has(key)) {
                    messageMap.set(key, true);
                    allMessages.push(msg);
                }
            });
        }
        // Merge with local messages (for offline/sync purposes)
        localMessages.forEach(localMsg => {
            // Only add if not already in database messages (by timestamp or content)
            const allDbMessages = [...(messagesFromStudent || []), ...(messagesFromAdmin || [])];
            const exists = allDbMessages.some(dbMsg => 
                (dbMsg.content === localMsg.text || dbMsg.text === localMsg.text) && 
                Math.abs(new Date(dbMsg.createdAt || dbMsg.timestamp).getTime() - new Date(localMsg.timestamp).getTime()) < 10000
            );
            if (!exists && localMsg.sender === 'user') {
                // Only add unsent local messages
                const key = `${localMsg.timestamp}_${localMsg.text || ''}_student`;
                if (!messageMap.has(key)) {
                    messageMap.set(key, true);
                    allMessages.push({
                        content: localMsg.text,
                        createdAt: localMsg.timestamp,
                        senderType: 'student',
                        senderId: normalizedStudentId
                    });
                }
            }
        });
        
        // Sort by timestamp
        allMessages.sort((a, b) => {
            const timeA = new Date(a.createdAt || a.timestamp);
            const timeB = new Date(b.createdAt || b.timestamp);
            return timeA - timeB;
        });
        
        // Render messages
        container.innerHTML = '';
        
        if (allMessages.length === 0) {
        container.innerHTML = `
            <div class="chat-welcome">
                <div class="welcome-message">
                    <i class="fas fa-comments"></i>
                    <h5>Start chatting with Admin</h5>
                    <p>This is a direct message between you and admin.</p>
                </div>
            </div>
        `;
        } else {
            allMessages.forEach(message => {
                const messageDiv = document.createElement('div');
                const isStudent = (message.senderType || message.sender) === 'student' || message.sender === 'user';
                messageDiv.className = `profile-message ${isStudent ? 'sent' : 'received'}`;
                const time = new Date(message.createdAt || message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                const content = message.content || message.text || '';
                messageDiv.innerHTML = `
                    <div class="profile-message-avatar">${isStudent ? 'S' : 'A'}</div>
                    <div class="profile-message-content">
                        <div>${content}</div>
                        <div class="profile-message-time">${time}</div>
                    </div>
                `;
                container.appendChild(messageDiv);
            });
    }
    
    scrollProfileChatToBottom();
    } catch (error) {
        console.error('Error loading profile chat messages:', error);
        container.innerHTML = `
            <div class="chat-welcome">
                <div class="welcome-message">
                    <i class="fas fa-comments"></i>
                    <h5>Error loading messages</h5>
                    <p>Please refresh the page.</p>
                </div>
            </div>
        `;
    }
}

function addMessageToProfileChat(message) {
    const container = document.getElementById('profileChatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `profile-message ${message.sender === 'user' ? 'sent' : 'received'}`;
    
    const time = new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    let contentHtml = '';
    if (message.type === 'file' && message.fileName) {
        const isImage = message.fileType && message.fileType.startsWith('image/');
        if (isImage && message.previewUrl) {
            contentHtml = `<div class="profile-attachment"><img src="${message.previewUrl}" alt="${message.fileName}"></div>`;
        } else {
            contentHtml = `<div class="profile-attachment"><div class="filename">${message.fileName}</div></div>`;
        }
    }
    const textHtml = message.text ? `<div>${message.text}</div>` : '';

    messageDiv.innerHTML = `
        <div class="profile-message-avatar">
            ${message.sender === 'user' ? 
                (currentUser && currentUser.role === 'student' ? 'S' : 'A') : 
                (message.sender === 'admin' ? 'A' : 'S')
            }
        </div>
        <div class="profile-message-content">
            ${contentHtml}
            ${textHtml}
            <div class="profile-message-time">${time}</div>
        </div>
    `;
    
    container.appendChild(messageDiv);
    scrollProfileChatToBottom();
    persistChatMessages();
}

async function sendProfileChatMessage() {
    const input = document.getElementById('profileChatInput');
    const message = input.value.trim();
    
    if (!message && !profileChatPendingFile) return;
    
    if (!currentUser || currentUser.role !== 'student') {
        showToast('Only students can send messages', 'error');
        return;
    }
    
    try {
        // Get student ID and normalize it
        const studentId = currentUser.studentData?.id || currentUser.studentData?.student_id;
        const normalizedStudentId = typeof studentId === 'number' 
            ? studentId 
            : parseInt(studentId) || studentId;
        
        if (!normalizedStudentId) {
            showToast('Student ID not found', 'error');
            return;
        }
        
        // Save message to database
        if (message) {
            await saveMessage({
                senderId: normalizedStudentId,
                receiverId: 1, // Admin ID
                senderType: 'student',
                receiverType: 'admin',
                content: message,
                attachment: null,
                attachmentName: null
            });
            
            // Also add to local storage for immediate display
    const baseMessage = {
        id: Date.now(),
        sender: 'user',
        timestamp: new Date().toISOString(),
                userId: normalizedStudentId,
                studentId: normalizedStudentId,
                text: message
    };
            chatMessages.push(baseMessage);
            persistChatMessages();
        }

        // Handle file attachment if present
    if (profileChatPendingFile) {
        const file = profileChatPendingFile;
            // For now, files are stored locally - you can extend this to save to database
        const isImage = file.type && file.type.startsWith('image/');
        const messageWithFile = {
                id: Date.now(),
                sender: 'user',
                timestamp: new Date().toISOString(),
                userId: normalizedStudentId,
                studentId: normalizedStudentId,
            type: 'file',
            text: message || '',
            fileName: file.name,
            fileType: file.type,
            previewUrl: isImage ? URL.createObjectURL(file) : null
        };
        chatMessages.push(messageWithFile);
            persistChatMessages();
        profileChatPendingFile = null;
        const fileInput = document.getElementById('profileChatFile');
        if (fileInput) fileInput.value = '';
        }
        
        // Reload chat to show the new message
        await loadProfileChatMessages();
    
    // Clear input
    input.value = '';
    } catch (error) {
        console.error('Error sending profile chat message:', error);
        showToast('Failed to send message', 'error');
    }
}


function handleProfileChatKeyPress(event) {
    if (event.key === 'Enter') {
        sendProfileChatMessage();
    }
}

function triggerProfileChatFile() {
    const input = document.getElementById('profileChatFile');
    if (input) input.click();
}

function handleProfileChatFileSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    profileChatPendingFile = file;
    // Optionally, we could show a small chip indicating a file is attached
}

function showProfileTypingIndicator() {
    const container = document.getElementById('profileChatMessages');
    const typingDiv = document.createElement('div');
    typingDiv.id = 'profileTypingIndicator';
    typingDiv.className = 'profile-typing-indicator';
    typingDiv.innerHTML = `
        <div class="profile-message-avatar">A</div>
        <div class="profile-message-content">
            <div>Admin is typing<span class="profile-typing-dots">.</span><span class="profile-typing-dots">.</span><span class="profile-typing-dots">.</span></div>
        </div>
    `;
    
    container.appendChild(typingDiv);
    scrollProfileChatToBottom();
}

function hideProfileTypingIndicator() {
    const typingIndicator = document.getElementById('profileTypingIndicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

function scrollProfileChatToBottom() {
    const container = document.getElementById('profileChatMessages');
    container.scrollTop = container.scrollHeight;
}


// Admin Posting Functions
async function createPost(type) {
    console.log('🔵 createPost called with type:', type);
    
    const postInput = document.getElementById('postInput');
    let content = (postInput && postInput.value ? postInput.value.trim() : '').toString();
    const audienceSelect = document.getElementById('postAudience');
    const courseSelect = document.getElementById('postCourse');
    const audience = audienceSelect ? audienceSelect.value : 'students';
    const course = courseSelect ? courseSelect.value : '';
    const imageDataUrl = window.__pendingPostImageDataUrl || null;
    const imageList = Array.isArray(window.__pendingPostImages) ? window.__pendingPostImages : (imageDataUrl ? [imageDataUrl] : []);
    const layoutSelect = document.getElementById('postLayout');
    const layout = layoutSelect ? layoutSelect.value : 'image-left';
    
    if (window.__postingInProgress) {
        console.log('⚠️ Post already in progress, skipping...');
        return; // prevent double submissions
    }
    window.__postingInProgress = true;
    const finish = () => { window.__postingInProgress = false; };
    
    // Require either text or at least one image (except special 'feeling' and 'live' types)
    if (!content && imageList.length === 0 && type !== 'feeling' && type !== 'live') {
        showToast('Please enter text or add at least one image', 'error');
        finish();
        return;
    }
    
    // Special handling for 'live' video posts
    if (type === 'live') {
        // Prompt for live video URL or just post announcement
        if (!content) {
            content = '🔴 Starting live video session...';
        }
        // You can extend this to request camera access
        // navigator.mediaDevices.getUserMedia({ video: true })
    }
    
    // Special handling for 'feeling' posts
    if (type === 'feeling') {
        console.log('😊 Processing feeling post...');
        // Allow posting feelings/activities without content requirement
        if (!content) {
            content = '😊 Sharing my feeling/activity';
            console.log('📝 Set default content for feeling post');
        }
        console.log('📄 Content for feeling post:', content);
    }
    
    // Prepare post data for database
    const postData = {
        content: content || '',
        type: type,
        audience: audience,
        course: audience === 'specific' ? course : null,
        layout: layout,
        images: imageList.length > 0 ? imageList : null
    };
    

    try {
        console.log('Post data being sent:', postData);
        console.log('Images in postData:', postData.images);
        
        // Save to database using API
        const response = await savePost(postData);
        
        console.log('API Response:', response);
        console.log('Response debug:', response?.debug);
        
        if (!response || !response.success) {
            showToast('Failed to save post to database', 'error');
            finish();
            return;
        }
        
        // Reset inputs
        if (postInput) postInput.value = '';
        if (audienceSelect) audienceSelect.value = 'students';
        if (courseSelect) courseSelect.style.display = 'none';
        const layoutSelectReset = document.getElementById('postLayout');
        if (layoutSelectReset) layoutSelectReset.value = 'image-left';
        clearPostImage();
        
        // Refresh feeds
        await loadAdminPosts();
        // If on Home, refresh Home feed too
        if (document.getElementById('home') && document.getElementById('home').classList.contains('active')) {
            if (typeof loadHomeFeed === 'function') loadHomeFeed();
        }
        showToast('Post created successfully!', 'success');
        console.log('✅ Post created and page refreshed');
    } catch (error) {
        console.error('❌ Error saving post:', error);
        console.error('Error details:', error.message, error.stack);
        showToast('Failed to save post: ' + error.message, 'error');
    } finally {
        finish();
    }
}

// Ensure Publish button uses unified createPost logic
function publishPost() {
    // Check if there's a pending live post
    if (window.__pendingLivePost) {
        window.__pendingLivePost = false;
        createPost('live');
    } else {
    createPost('text');
    }
}

// Post image helpers
function triggerPostImageUpload() {
    const input = document.getElementById('postImageInput');
    if (input) input.click();
}

// Simple carousel renderer and controller
function renderCarousel(images) {
    const id = `carousel-${Date.now()}-${Math.floor(Math.random()*1000)}`;
    const slides = images.map((src, idx) => `<div class=\"carousel-slide ${idx===0?'active':''}\"><img src=\"${src}\" alt=\"image ${idx+1}\"></div>`).join('');
    return `
    <div class=\"carousel\" id=\"${id}\" data-index=\"0\">\n        <button class=\"carousel-arrow left\" onclick=\"carouselPrev('${id}')\" aria-label=\"Previous\">&#10094;</button>\n        <div class=\"carousel-track\">${slides}</div>\n        <button class=\"carousel-arrow right\" onclick=\"carouselNext('${id}')\" aria-label=\"Next\">&#10095;</button>\n    </div>`;
}

function carouselNext(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const slides = el.querySelectorAll('.carousel-slide');
    if (slides.length === 0) return;
    let index = parseInt(el.getAttribute('data-index') || '0', 10);
    slides[index].classList.remove('active');
    index = (index + 1) % slides.length;
    slides[index].classList.add('active');
    el.setAttribute('data-index', String(index));
}

function carouselPrev(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const slides = el.querySelectorAll('.carousel-slide');
    if (slides.length === 0) return;
    let index = parseInt(el.getAttribute('data-index') || '0', 10);
    slides[index].classList.remove('active');
    index = (index - 1 + slides.length) % slides.length;
    slides[index].classList.add('active');
    el.setAttribute('data-index', String(index));
}

function handlePostImagesSelected(event) {
    const files = (event.target.files && Array.from(event.target.files)) || [];
    if (files.length === 0) return;
    const imageFiles = files.filter(f => f.type && f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
        showToast('Please select image files', 'error');
        return;
    }
    const readers = [];
    window.__pendingPostImages = [];
    imageFiles.forEach((file, idx) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            window.__pendingPostImages.push(e.target.result);
            if (idx === 0) {
                window.__pendingPostImageDataUrl = e.target.result;
                const prev = document.getElementById('postImagePreview');
                const img = document.getElementById('postImagePreviewImg');
                const count = document.getElementById('postImageCount');
                if (prev && img) {
                    img.src = e.target.result;
                    prev.style.display = 'flex';
                }
                if (count) {
                    count.textContent = `+${Math.max(0, imageFiles.length - 1)}`;
                    count.style.display = imageFiles.length > 1 ? 'inline-flex' : 'none';
                }
            } else {
                const count = document.getElementById('postImageCount');
                if (count) {
                    count.textContent = `+${Math.max(0, window.__pendingPostImages.length - 1)}`;
                    count.style.display = window.__pendingPostImages.length > 1 ? 'inline-flex' : 'none';
                }
            }
        };
        reader.readAsDataURL(file);
        readers.push(reader);
    });
}

function clearPostImage() {
    window.__pendingPostImageDataUrl = null;
    window.__pendingPostImages = [];
    const input = document.getElementById('postImageInput');
    if (input) input.value = '';
    const prev = document.getElementById('postImagePreview');
    const img = document.getElementById('postImagePreviewImg');
    const count = document.getElementById('postImageCount');
    if (prev && img) {
        img.src = '';
        prev.style.display = 'none';
    }
    if (count) { count.style.display = 'none'; }
}

async function publishPost() {
    const postInput = document.getElementById('postInput');
    const content = postInput.value.trim();
    const audience = document.getElementById('postAudience').value;
    const course = document.getElementById('postCourse').value;
    const layout = document.getElementById('postLayout').value;
    
    if (!content) {
        showToast('Please enter a message before posting', 'error');
        return;
    }
    
    // Check if there's an image preview
    const imagePreview = document.getElementById('postImagePreview');
    let images = null;
    
    if (imagePreview && imagePreview.style.display !== 'none') {
        const imgSrc = document.getElementById('postImagePreviewImg')?.src;
        if (imgSrc) {
            images = [imgSrc];
        }
    }
    
    const postData = {
        content: content,
        type: 'text',
        audience: audience,
        course: course || null,
        layout: layout,
        images: images
    };
    
    // Save to database
    const response = await savePost(postData);
    
    if (response) {
        // Clear input and preview
        postInput.value = '';
        clearPostImage();
        
        // Refresh posts feed
        await loadAdminPosts();
        // Also refresh home feed if posts are for home audience
        if (postData.audience === 'home') {
            try {
                await loadHomeFeed();
            } catch (e) {
                // Ignore if not on home page
            }
        }
        // Also refresh student feeds if posts are for students audience
        if (postData.audience === 'students') {
            try {
                await loadStudentHomepagePosts();
                await loadStudentAnnouncements();
            } catch (e) {
                // Ignore if not on student page
            }
        }
    }
}

async function toggleLike(postId) {
    try {
        const response = await apiCall('update_post_engagement.php', 'POST', {
            postId: postId,
            action: 'like'
        });
        
        if (response.success) {
            await loadAdminPosts();
            showToast('Post liked!', 'success');
        } else {
            showToast('Failed to like post', 'error');
        }
    } catch (error) {
        console.error('Error toggling like:', error);
        showToast('Failed to like post', 'error');
    }
}

async function commentPost(postId) {
    const input = document.getElementById(`commentInput-${postId}`);
    if (!input) return;
    
    const comment = input.value.trim();
    if (!comment) return;
    
    console.log('Attempting to comment on post:', postId, 'Comment:', comment);
    
    try {
        const response = await apiCall('update_post_engagement.php', 'POST', {
            postId: postId,
            action: 'comment',
            comment: comment,
            author: 'Administrator'
        });
        
        console.log('Comment API Response:', response);
        
        if (response && response.success) {
            input.value = '';
            // Reset loaded flag so comments reload
            const commentsListDiv = document.getElementById(`admin-comments-list-${postId}`);
            if (commentsListDiv) {
                commentsListDiv.dataset.loaded = 'false';
            }
            await loadAdminPosts();
            // Reload comments to show the new one
            await loadAdminComments(postId);
            if (commentsListDiv) {
                commentsListDiv.dataset.loaded = 'true';
            }
            showToast('Comment added!', 'success');
        } else {
            const errorMsg = response ? response.message : 'Unknown error';
            console.error('Comment failed:', errorMsg);
            showToast(`Failed to add comment: ${errorMsg}`, 'error');
        }
    } catch (error) {
        console.error('Error adding comment:', error);
        showToast('Failed to add comment: ' + error.message, 'error');
    }
}

async function sharePost(postId) {
    try {
        // Update shares count in database
        const response = await apiCall('update_post_engagement.php', 'POST', {
            postId: postId,
            action: 'share'
        });
        
        // Copy link to clipboard
        const shareUrl = `${window.location.origin}${window.location.pathname}?post=${postId}`;
        try {
            await navigator.clipboard.writeText(shareUrl);
            showToast('Post link copied to clipboard!', 'success');
        } catch (clipboardError) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = shareUrl;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showToast('Post link copied to clipboard!', 'success');
        }
        
        // Refresh to update shares count
        await loadAdminPosts();
    } catch (error) {
        console.error('Error sharing post:', error);
        showToast('Failed to share post', 'error');
    }
}

async function adminDeletePost(postId) {
    if (!confirm('Delete this post permanently?')) return;
    
    try {
        const response = await apiCall('delete_post.php', 'POST', {
            postId: postId
        });
        
        if (response && response.success) {
        await loadAdminPosts();
        try { loadHomeFeed(); } catch (_) { /* ignore */ }
            showToast('Post deleted successfully!', 'success');
        } else {
            const errorMsg = response ? response.message : 'Unknown error';
            showToast(`Failed to delete: ${errorMsg}`, 'error');
        }
    } catch (error) {
        console.error('Error deleting post:', error);
        showToast('Failed to delete post', 'error');
    }
}

// Helper function to display comments
function displayCommentsHTML(postId, comments) {
    if (!comments || comments.length === 0) {
        return '<p style="text-align: center; color: #9ca3af; font-style: italic; padding: 15px;">No comments yet</p>';
    }
    
    // Sort comments by timestamp (newest first, or if no timestamp, by order)
    const sortedComments = [...comments].sort((a, b) => {
        const timeA = a.timestamp || a.created_at || '';
        const timeB = b.timestamp || b.created_at || '';
        return timeB.localeCompare(timeA); // Newest first
    });
    
    return sortedComments.map(comment => {
        const commentText = comment.content || comment.text || '';
        const commentAuthor = comment.author || 'User';
        const commentTime = comment.timestamp || comment.created_at || '';
        const authorInitial = commentAuthor.charAt(0).toUpperCase();
        
        // Escape HTML to prevent XSS
        const escapeHtml = (text) => {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };
        
        return `
        <div class="comment-item" style="display: flex; gap: 12px; padding: 12px; border-bottom: 1px solid #eee; align-items: flex-start;">
            <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">
                    ${escapeHtml(authorInitial)}
            </div>
            <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 600; margin-bottom: 4px; color: #374151;">
                        ${escapeHtml(commentAuthor)}
                </div>
                    <div style="color: #4b5563; margin-bottom: 4px; word-wrap: break-word; white-space: pre-wrap;">
                        ${escapeHtml(commentText)}
                </div>
                <div style="font-size: 12px; color: #9ca3af;">
                        ${commentTime ? formatDate(commentTime) : 'Recently'}
                </div>
            </div>
        </div>
        `;
    }).join('');
}

// Load and display comments for admin
async function loadAdminComments(postId) {
    const commentsListDiv = document.getElementById(`admin-comments-list-${postId}`);
    if (!commentsListDiv) return;
    
    try {
        const posts = await getPosts(); // Get all posts (no audience filter for admin)
        const post = posts.find(p => p.id === postId);
        
        if (post && post.comments && Array.isArray(post.comments) && post.comments.length > 0) {
                commentsListDiv.innerHTML = displayCommentsHTML(postId, post.comments);
        } else {
            commentsListDiv.innerHTML = '<p style="text-align: center; color: #9ca3af; font-style: italic; padding: 15px;">No comments yet</p>';
        }
    } catch (error) {
        console.error('Error loading admin comments:', error);
        commentsListDiv.innerHTML = '<p style="text-align: center; color: #9ca3af; font-style: italic; padding: 15px;">Error loading comments</p>';
    }
}

// Load and display comments for students
async function loadStudentComments(postId) {
    const commentsListDiv = document.getElementById(`student-comments-list-${postId}`);
    if (!commentsListDiv) return;
    
    try {
        // Try to get comments from the post data first
        const posts = await getPosts('students');
        const post = posts.find(p => p.id == postId);
        
        if (post && post.comments && Array.isArray(post.comments) && post.comments.length > 0) {
                commentsListDiv.innerHTML = displayCommentsHTML(postId, post.comments);
            } else {
                commentsListDiv.innerHTML = '<p style="text-align: center; color: #9ca3af; font-style: italic; padding: 15px;">No comments yet</p>';
        }
    } catch (error) {
        console.error('Error loading student comments:', error);
        commentsListDiv.innerHTML = '<p style="text-align: center; color: #9ca3af; font-style: italic; padding: 15px;">Error loading comments</p>';
    }
}

function toggleAdminComments(postId) {
    const commentsDiv = document.getElementById(`admin-comments-${postId}`);
    const commentsListDiv = document.getElementById(`admin-comments-list-${postId}`);
    
    if (!commentsDiv) return;
    
    if (commentsDiv.style.display === 'none' || commentsDiv.style.display === '') {
        commentsDiv.style.display = 'block';
        
        // Load comments from database if not already loaded
        if (commentsListDiv && commentsListDiv.dataset.loaded !== 'true') {
            loadAdminComments(postId).then(() => {
                if (commentsListDiv) {
                    commentsListDiv.dataset.loaded = 'true';
                }
            });
        }
    } else {
        commentsDiv.style.display = 'none';
    }
}

// Handle post input keypress
function handlePostKeyPress(event) {
    if (event.key === 'Enter') {
        createPost('text');
    }
}

// Load admin posts from database
async function loadAdminPosts() {
    const container = document.getElementById('postsFeed');
    if (!container) {
        console.log('postsFeed container not found');
        return;
    }
    
    try {
        // Get posts from database
        console.log('Loading admin posts...');
        const posts = await getPosts();
        console.log('Posts loaded:', posts);
        
        if (!posts || posts.length === 0) {
            container.innerHTML = `
                <div class="welcome-message">
                    <h3>No posts yet</h3>
                    <p>Start by creating your first announcement!</p>
                </div>
            `;
            return;
        }
        
        // Render posts
        container.innerHTML = posts.map(post => {
            let imagesHtml = '';
            
            console.log('Post images:', post.images);
            
            if (post.images) {
                console.log('Post has images field:', post.images);
                console.log('Type of post.images:', typeof post.images);
                console.log('Is array?:', Array.isArray(post.images));
                
                // Handle both array and object formats
                let imageArray = [];
                
                if (Array.isArray(post.images)) {
                    imageArray = post.images;
                    console.log('Images is already an array');
                } else if (typeof post.images === 'string') {
                    console.log('Images is a string, attempting to parse');
                    try {
                        const parsed = JSON.parse(post.images);
                        imageArray = Array.isArray(parsed) ? parsed : [parsed];
                        console.log('Successfully parsed JSON');
                    } catch (e) {
                        console.log('JSON parse failed, treating as single image');
                        imageArray = [post.images];
                    }
                } else if (post.images) {
                    imageArray = [post.images];
                }
                
                // Handle double-encoded JSON (string that contains JSON array)
                imageArray = imageArray.map(img => {
                    // Check if img is a string that looks like JSON
                    if (typeof img === 'string' && img.trim().startsWith('[') && img.trim().endsWith(']')) {
                        try {
                            const parsed = JSON.parse(img);
                            // If parsing gives us an array, return the first element
                            if (Array.isArray(parsed)) {
                                return parsed[0];
                            }
                            return parsed;
                        } catch (e) {
                            return img;
                        }
                    }
                    return img;
                });
                
                // Filter out any null/undefined/empty values
                imageArray = imageArray.filter(img => {
                    const isValid = img && typeof img === 'string' && img.trim() !== '' && img.length > 10;
                    console.log('Image valid?', isValid, img ? img.substring(0, 50) : 'N/A');
                    return isValid;
                });
                
                console.log('Final images array:', imageArray);
                console.log('Number of images after filter:', imageArray.length);
                
                // Check if this is a live post with video
                const isLiveVideo = post.type === 'live' && imageArray.length > 0;
                
                if (isLiveVideo) {
                    // Check if the first item is a video (data:video/) or detect video format
                    const firstItem = imageArray[0];
                    const isVideo = typeof firstItem === 'string' && (
                        firstItem.startsWith('data:video/') || 
                        firstItem.includes('video/webm') ||
                        firstItem.includes('video/mp4')
                    );
                    
                    if (isVideo) {
                        console.log('Rendering live video');
                        imagesHtml = `
                            <div class="post-video-container">
                                <video controls class="post-video" style="width: 100%; max-width: 100%; border-radius: 8px; margin-top: 10px; background: #000;">
                                    <source src="${firstItem}" type="video/webm">
                                    <source src="${firstItem}" type="video/mp4">
                                    Your browser does not support the video tag.
                                </video>
                                <div class="post-live-indicator">
                                    <span class="live-dot-small"></span>
                                    <span>Live Recording</span>
                                </div>
                            </div>
                        `;
                    } else {
                        // Fallback to image if not detected as video
                        imagesHtml = `<div class="post-image-container"><img src="${firstItem}" alt="Post image" class="post-image" style="max-width: 100%; border-radius: 8px; margin-top: 10px; display: block;"></div>`;
                    }
                } else if (imageArray.length === 1) {
                    // Check if single item is a video
                    const item = imageArray[0];
                    const isVideo = typeof item === 'string' && (
                        item.startsWith('data:video/') || 
                        item.includes('video/webm') ||
                        item.includes('video/mp4')
                    );
                    
                    if (isVideo) {
                        console.log('Rendering single video');
                        imagesHtml = `
                            <div class="post-video-container">
                                <video controls class="post-video" style="width: 100%; max-width: 100%; border-radius: 8px; margin-top: 10px; background: #000;">
                                    <source src="${item}" type="video/webm">
                                    <source src="${item}" type="video/mp4">
                                    Your browser does not support the video tag.
                                </video>
                            </div>
                        `;
                    } else {
                    console.log('Rendering single image');
                        imagesHtml = `<div class="post-image-container"><img src="${item}" alt="Post image" class="post-image" style="max-width: 100%; border-radius: 8px; margin-top: 10px; display: block;"></div>`;
                    }
                } else if (imageArray.length > 1) {
                    console.log('Rendering carousel with', imageArray.length, 'images');
                    imagesHtml = renderCarousel(imageArray);
                } else {
                    console.log('No valid images to render');
                }
            } else {
                console.log('Post has no images field');
            }
            
            return `
                <div class="post-item" data-post-id="${post.id}">
                    <div class="post-header">
                        <div class="post-author">
                            <div class="post-avatar"><i class="fas fa-user-shield"></i></div>
                            <div class="post-author-info">
                                <span class="post-author-name">Administrator</span>
                                <span class="post-time">${formatDate(post.created_at)}</span>
                            </div>
                        </div>
                        <div class="post-menu">
                            <button class="post-menu-btn" onclick="openPostMenu(${post.id})" title="More options">
                                <i class="fas fa-ellipsis-h"></i>
                            </button>
                        </div>
                    </div>
                    <div class="post-content">
                        <p>${post.content || ''}</p>
                        ${imagesHtml}
                    </div>
                    <div class="post-engagement">
                        <div class="post-reactions">
                            <span class="reactions-count"><span class="count-num">${post.likes || 0}</span> <span class="count-label">likes</span></span>
                            <span class="comments-count"><span class="count-num">${post.comments_count || 0}</span> <span class="count-label">comments</span></span>
                        </div>
                        <div class="post-actions">
                            <button class="action-btn like-btn" onclick="toggleLike(${post.id})">
                                <i class="fas fa-thumbs-up"></i>
                                <span>Like</span>
                            </button>
                            <button class="action-btn comment-btn" onclick="toggleAdminComments(${post.id})">
                                <i class="fas fa-comment"></i>
                                <span>Comment</span>
                            </button>
                        </div>
                        <div id="admin-comments-${post.id}" class="comments-section" style="display: none;">
                            <div id="admin-comments-list-${post.id}" data-loaded="false"></div>
                            <div class="comment-input-container">
                                <input type="text" placeholder="Write a comment..." id="commentInput-${post.id}" class="comment-input" onkeypress="if(event.key==='Enter') commentPost(${post.id})">
                                <button onclick="commentPost(${post.id})" class="comment-submit-btn">
                                    <i class="fas fa-paper-plane"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading admin posts:', error);
        container.innerHTML = `
            <div class="welcome-message">
                <h3>Error loading posts</h3>
                <p>Please try refreshing the page.</p>
            </div>
        `;
    }
}

function openPostMenu(postId) {
    // Simple implementation - show delete option
    if (confirm('Delete this post?')) {
        adminDeletePost(postId);
    }
}

// Student Tab Navigation
function showStudentTab(tabName) {
    // Hide homepage content and show tab content
    const homepageContent = document.getElementById('student-homepage-content');
    const tabContent = document.querySelector('#student-homepage .tab-content');
    const navTabs = document.querySelector('#student-homepage .admin-nav-tabs');
    
    if (tabName === 'homepage') {
        homepageContent.style.display = 'block';
        tabContent.style.display = 'none';
        navTabs.style.display = 'none';
        // Load posts for student homepage
        loadStudentHomepagePosts();
        return;
    }
    
    // Show tab content
    homepageContent.style.display = 'none';
    tabContent.style.display = 'block';
    navTabs.style.display = 'flex';
    
    // Hide all tab panels
    document.querySelectorAll('#student-homepage .tab-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    
    // Remove active class from all tab buttons
    document.querySelectorAll('#student-homepage .nav-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab panel
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // Add active class to clicked tab button (only if called from a click)
    if (typeof event !== 'undefined' && event && event.target) {
        event.target.classList.add('active');
    } else {
        // If called programmatically, set active on the correct nav button
        const btn = document.querySelector(`#student-homepage .nav-tab-btn[onclick*="'${tabName}'"]`);
        if (btn) btn.classList.add('active');
    }
    
    // Load specific content based on tab
    switch(tabName) {
        case 'announcements':
            loadStudentAnnouncements();
            break;
        case 'messages':
            // Defer to ensure panel is visible before rendering
            setTimeout(loadStudentMessages, 0);
            break;
        case 'profile':
            loadStudentProfile();
            break;
    }
}

// Student Messaging Functions
async function sendMessage() {
    const input = document.getElementById('chatMessageInput');
    const text = input.value.trim();
    
    if (!text) return;

    try {
        const messageData = {
            senderId: currentUser.studentData.id,
            receiverId: 1, // Admin ID
            senderType: 'student',
            receiverType: 'admin',
            content: text,
            attachment: null,
            attachmentName: null
        };
        
        // Save to database
        const response = await saveMessage(messageData);
        
        if (response && response.success) {
            input.value = '';
            await loadStudentMessages();
        }
    } catch (error) {
        console.error('Error sending message:', error);
        showToast('Failed to send message', 'error');
    }
}

// simulateAdminResponse removed in favor of shared chatMessages

function handleChatKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

function triggerFileUpload() {
    document.getElementById('chatFileInput').click();
}

// Student Announcement Functions
async function studentToggleLike(postId) {
    try {
        console.log('Attempting to like post:', postId);
        const response = await apiCall('update_post_engagement.php', 'POST', {
            postId: postId,
            action: 'like'
        });
        
        console.log('API Response:', response);
        
        if (response && response.success) {
            await loadStudentAnnouncements();
            // Also reload student homepage posts if on homepage
            try {
                await loadStudentHomepagePosts();
            } catch (e) {
                // Ignore if not on homepage
            }
            showToast('Post liked!', 'success');
        } else {
            const errorMsg = response ? response.message : 'Unknown error';
            console.error('Like failed:', errorMsg);
            showToast(`Failed to like: ${errorMsg}`, 'error');
        }
    } catch (error) {
        console.error('Error toggling like:', error);
        showToast('Failed to like post: ' + error.message, 'error');
    }
}

function studentToggleComments(postId) {
    const commentsSection = document.getElementById(`student-comments-${postId}`);
    const commentsListDiv = document.getElementById(`student-comments-list-${postId}`);
    
    if (!commentsSection) return;
    
    if (commentsSection.style.display === 'none' || commentsSection.style.display === '') {
        commentsSection.style.display = 'block';
        
        // Load comments from database if not already loaded
        if (commentsListDiv && commentsListDiv.dataset.loaded !== 'true') {
            loadStudentComments(postId).then(() => {
                if (commentsListDiv) {
                    commentsListDiv.dataset.loaded = 'true';
                }
            });
        }
    } else {
        commentsSection.style.display = 'none';
    }
}

async function loadStudentComments(postId) {
    const commentsListDiv = document.getElementById(`student-comments-list-${postId}`);
    if (!commentsListDiv) return;
    
    try {
        // Try to get comments from the post data first
        const posts = await getPosts('students');
        const post = posts.find(p => p.id == postId);
        
        if (post && post.comments && Array.isArray(post.comments)) {
            const comments = post.comments;
            if (comments.length === 0) {
                commentsListDiv.innerHTML = '<p style="text-align: center; color: #9ca3af; font-style: italic; padding: 15px;">No comments yet</p>';
            } else {
                commentsListDiv.innerHTML = comments.map(comment => `
                    <div class="comment-item" style="display: flex; gap: 12px; padding: 12px; border-bottom: 1px solid #eee; align-items: flex-start;">
                        <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">
                            ${comment.author ? comment.author.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 600; margin-bottom: 4px; color: #374151;">
                                ${comment.author || 'User'}
                            </div>
                            <div style="color: #4b5563; margin-bottom: 4px; word-wrap: break-word;">
                                ${comment.content || comment.text || ''}
                            </div>
                            <div style="font-size: 12px; color: #9ca3af;">
                                ${formatDate(comment.created_at || comment.timestamp)}
                            </div>
                        </div>
                    </div>
                `).join('');
            }
            return;
        }
        
        // Fallback: try API endpoint
        const response = await apiCall(`get_post_comments.php?postId=${postId}`);
        if (response && response.success && response.comments) {
            const comments = response.comments;
            if (comments.length === 0) {
                commentsListDiv.innerHTML = '<p style="text-align: center; color: #9ca3af; font-style: italic; padding: 15px;">No comments yet</p>';
            } else {
                commentsListDiv.innerHTML = comments.map(comment => `
                    <div class="comment-item" style="display: flex; gap: 12px; padding: 12px; border-bottom: 1px solid #eee; align-items: flex-start;">
                        <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">
                            ${comment.author ? comment.author.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 600; margin-bottom: 4px; color: #374151;">
                                ${comment.author || 'User'}
                            </div>
                            <div style="color: #4b5563; margin-bottom: 4px; word-wrap: break-word;">
                                ${comment.content || comment.text || ''}
                            </div>
                            <div style="font-size: 12px; color: #9ca3af;">
                                ${formatDate(comment.created_at || comment.timestamp)}
                            </div>
                        </div>
                    </div>
                `).join('');
            }
        } else {
            commentsListDiv.innerHTML = '<p style="text-align: center; color: #9ca3af; font-style: italic; padding: 15px;">No comments yet</p>';
        }
    } catch (error) {
        console.error('Error loading comments:', error);
        commentsListDiv.innerHTML = '<p style="text-align: center; color: #9ca3af; font-style: italic; padding: 15px;">No comments yet</p>';
    }
}

async function studentCommentPost(postId) {
    const input = document.getElementById(`studentCommentInput-${postId}`);
    if (!input) return;
    
    const comment = input.value.trim();
    if (!comment) return;
    
    console.log('Attempting to comment on post:', postId, 'Comment:', comment);
    
    try {
        const authorName = currentUser && currentUser.studentData 
            ? `${currentUser.studentData.firstName} ${currentUser.studentData.lastName}` 
            : 'Student';
            
        const response = await apiCall('update_post_engagement.php', 'POST', {
            postId: postId,
            action: 'comment',
            comment: comment,
            author: authorName
        });
        
        console.log('Comment API Response:', response);
        
        if (response && response.success) {
            input.value = '';
            // Reset loaded flag so comments reload
            const commentsListDiv = document.getElementById(`student-comments-list-${postId}`);
            if (commentsListDiv) {
                commentsListDiv.dataset.loaded = 'false';
            }
            // Reload posts and comments
            await loadStudentAnnouncements();
            await loadStudentComments(postId);
            // Also reload student homepage posts if on homepage  
            try {
                await loadStudentHomepagePosts();
            } catch (e) {
                // Ignore if not on homepage
            }
            if (commentsListDiv) {
                commentsListDiv.dataset.loaded = 'true';
            }
            showToast('Comment added!', 'success');
        } else {
            const errorMsg = response ? response.message : 'Unknown error';
            console.error('Comment failed:', errorMsg);
            showToast(`Failed to add comment: ${errorMsg}`, 'error');
        }
    } catch (error) {
        console.error('Error adding comment:', error);
        showToast('Failed to add comment: ' + error.message, 'error');
    }
}

async function studentSharePost(postId) {
    try {
        // Update shares count in database
        const response = await apiCall('update_post_engagement.php', 'POST', {
            postId: postId,
            action: 'share'
        });
        
        // Copy link to clipboard
        const shareUrl = `${window.location.origin}${window.location.pathname}?post=${postId}`;
        try {
            await navigator.clipboard.writeText(shareUrl);
            showToast('Post link copied to clipboard!', 'success');
        } catch (clipboardError) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = shareUrl;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showToast('Post link copied to clipboard!', 'success');
        }
        
        // Refresh to update shares count
        await loadStudentAnnouncements();
    } catch (error) {
        console.error('Error sharing post:', error);
        showToast('Failed to share post', 'error');
    }
}

// Legacy functions for backward compatibility
function togglePostLike(postId) {
    studentToggleLike(postId);
}

function toggleComments(postId) {
    studentToggleComments(postId);
}

function addComment(postId) {
    studentCommentPost(postId);
}

function renderComments(comments) {
    if (comments.length === 0) {
        return '<p style="text-align: center; color: #9ca3af; font-style: italic;">No comments yet</p>';
    }

    return comments.map(comment => `
        <div class="comment-item">
            <div class="comment-avatar">${comment.author.charAt(0).toUpperCase()}</div>
            <div class="comment-content">
                <div class="comment-author">${comment.author}</div>
                <div class="comment-text">${comment.text}</div>
                <div class="comment-time">${formatDate(comment.timestamp)}</div>
            </div>
        </div>
    `).join('');
}

// Student Registration Modal Functions
function openStudentRegistrationModal() {
    document.getElementById('studentRegistrationModal').style.display = 'block';
    // Clear form
    document.getElementById('studentRegistrationForm').reset();
}

function closeStudentRegistrationModal() {
    document.getElementById('studentRegistrationModal').style.display = 'none';
}

async function handleStudentRegistration(event) {
    console.log('🔥🔥🔥 handleStudentRegistration called from script.js! 🔥🔥🔥');
    if (event && event.preventDefault) {
        event.preventDefault();
    }
    
    console.log('Getting form values...');
    const firstName = (document.getElementById('adminFirstName').value || '').trim();
    const lastName = (document.getElementById('adminLastName').value || '').trim();
    const studentId = (document.getElementById('adminStudentIdInput').value || '').trim();
    const email = (document.getElementById('adminEmail').value || '').trim();
    const awardNumber = (document.getElementById('adminAwardNumber').value || '').trim();
    const password = document.getElementById('adminPassword').value;
    const confirmPassword = document.getElementById('adminConfirmPassword').value;
    const course = (document.getElementById('adminCourse').value || '').trim();
    const place = (document.getElementById('adminPlace') && document.getElementById('adminPlace').value || '').trim();
    const department = (document.getElementById('adminDepartment') && document.getElementById('adminDepartment').value || '').trim();
    const year = (document.getElementById('adminYear').value || '').trim();
    const photoFile = document.getElementById('adminPhoto') ? document.getElementById('adminPhoto').files[0] : null;
    const isIndigenous = document.getElementById('adminIsIndigenous') ? document.getElementById('adminIsIndigenous').checked : false;
    const isPwd = document.getElementById('adminIsPwd') ? document.getElementById('adminIsPwd').checked : false;
    
    console.log('Form values:', { firstName, lastName, studentId, email, awardNumber, department, place, course, year });
    
    // Basic required validation
    if (!firstName || !lastName || !studentId || !email || !awardNumber || !department || !place || !course || !year) {
        console.log('❌ Validation failed: Missing required fields');
        showToast('Please complete all required fields', 'error');
        return;
    }
    // Validate passwords match
    if (password !== confirmPassword) {
        console.log('❌ Validation failed: Passwords do not match');
        showToast('Passwords do not match!', 'error');
        return;
    }
    
    console.log('✅ Validation passed, proceeding with registration...');
    
    // Load latest students data from localStorage
    const savedStudents = localStorage.getItem('students');
    if (savedStudents) {
        students = JSON.parse(savedStudents);
    }

    // Uniqueness validation (field-specific, ignore empty existing fields)
    const norm = (v) => (v || '').trim().toLowerCase();
    const existsStudentId = students.some(s => (s.studentId && norm(s.studentId) === norm(studentId)));
    const existsEmail = students.some(s => (s.email && norm(s.email) === norm(email)));
    const existsAward = students.some(s => (s.awardNumber && norm(s.awardNumber) === norm(awardNumber)));
    if (existsStudentId || existsEmail || existsAward) {
        let msg = 'Duplicate found:';
        const parts = [];
        if (existsStudentId) parts.push('Student ID');
        if (existsEmail) parts.push('Email');
        if (existsAward) parts.push('Award Number');
        showToast(`${msg} ${parts.join(', ')} already exists`, 'error');
        return;
    }
    
    // Helper to finalize save after optional image processing
    const finalizeSave = async (idPictureDataUrl) => {
        try {
            console.log('Starting registration with data:', {
                firstName, lastName, studentId, email, password, 
                department, course, year, awardNumber, place
            });
            
            // Call the API to save to database
            const response = await apiCall('register.php', 'POST', {
                firstName: firstName,
                lastName: lastName,
                studentId: studentId,
                email: email,
                password: password,
                department: department,
                course: course,
                year: year,
                awardNumber: awardNumber,
                place: place,
                isIndigenous: isIndigenous,
                isPwd: isPwd
            });
            
            console.log('API Response:', response);
            
            if (!response || !response.success) {
                console.error('Registration failed:', response);
                showToast(response.message || 'Failed to register student in database', 'error');
                return;
            }
            
            // Also save to localStorage for backward compatibility
            const newStudent = {
                id: response.id || (students.length > 0 ? Math.max(...students.map(s => s.id)) + 1 : 1),
                firstName: firstName,
                lastName: lastName,
                studentId: studentId,
                email: email,
                awardNumber: awardNumber,
                password: password,
                department: department,
                place: place,
                course: course,
                year: year,
                status: 'active',
                applicationStatus: 'none',
                registered: new Date().toISOString(),
                role: 'student',
                idPictureDataUrl: idPictureDataUrl || null,
                isIndigenous: isIndigenous,
                isPwd: isPwd
            };
            
            students.push(newStudent);
            localStorage.setItem('students', JSON.stringify(students));
            
            closeStudentRegistrationModal();
            showToast('Student registered successfully!', 'success');
            // Refresh admin stats
            await updateAdminStats();
            // Reload students list
            await loadStudents();
        } catch (error) {
            console.error('Error registering student:', error);
            showToast('Failed to register student: ' + error.message, 'error');
        }
    };
    
    if (photoFile) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            await finalizeSave(e.target.result);
        };
        reader.readAsDataURL(photoFile);
    } else {
        finalizeSave(null).catch(error => {
            console.error('Error in finalizeSave:', error);
            showToast('Failed to register student', 'error');
        });
    }
}
// Bulk Registration Modal Functions
function openBulkRegistrationModal() {
    document.getElementById('bulkRegistrationModal').style.display = 'block';
    // Reset to step 1
    document.getElementById('bulkStep1').classList.add('active');
    document.getElementById('bulkStep2').classList.remove('active');
    document.getElementById('fileInfo').style.display = 'none';
    document.getElementById('processFileBtn').disabled = true;
}

function closeBulkRegistrationModal() {
    document.getElementById('bulkRegistrationModal').style.display = 'none';
}

// Admin Tab Navigation
function showAdminTab(tabName) {
    // Scope to admin dashboard only
    const adminSection = document.getElementById('admin-dashboard');
    const homepageContent = document.getElementById('admin-homepage');
    const tabContent = adminSection ? adminSection.querySelector('.tab-content') : null;
    const navTabs = adminSection ? adminSection.querySelector('.admin-nav-tabs') : null;
    
    if (!adminSection || !homepageContent || !tabContent || !navTabs) {
        return;
    }
    
    if (tabName === 'homepage') {
        homepageContent.style.display = 'block';
        tabContent.style.display = 'none';
        navTabs.style.display = 'none';
        // Refresh stats when returning to homepage
        updateAdminStats();
        return;
    }
    
    // Show tab content within admin section
    homepageContent.style.display = 'none';
    tabContent.style.display = 'block';
    navTabs.style.display = 'flex';
    
    // Hide all admin tab panels and deactivate tab buttons
    adminSection.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    adminSection.querySelectorAll('.nav-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Activate selected tab panel
    const targetPanel = document.getElementById(`${tabName}-tab`);
    if (targetPanel) {
        targetPanel.classList.add('active');
    }
    
    // Mark clicked button active if this came from a click
    if (typeof event !== 'undefined' && event && event.target) {
        event.target.classList.add('active');
    }
    
    // Load content
    switch(tabName) {
        case 'applications':
            loadApplications();
            break;
        case 'students':
            loadStudents();
            break;
        case 'reports':
            loadReports();
            break;
        case 'settings':
            loadSettings();
            break;
    }
}

// Load Applications Tab
function loadApplications() {
    const container = document.getElementById('applicationsContainer');
    if (!container) return; // Fix: Container doesn't exist, exit early
    
    if (applications.length === 0) {
        container.innerHTML = '<p class="no-data">No applications found.</p>';
        return;
    }
    
    const applicationsHTML = applications.map(app => `
        <div class="application-item">
            <div class="application-header">
                <h4>${app.firstName} ${app.lastName}</h4>
                <span class="status-badge status-${app.status}">${app.status.toUpperCase()}</span>
            </div>
            <div class="application-info">
                <div class="info-item">
                    <span class="info-label">Student ID:</span>
                    <span class="info-value">${app.studentId}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Email:</span>
                    <span class="info-value">${app.email}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Course:</span>
                    <span class="info-value">${app.course}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Year:</span>
                    <span class="info-value">${app.year}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Applied:</span>
                    <span class="info-value">${formatDate(app.appliedDate)}</span>
                </div>
            </div>
            <div class="application-actions">
                <button class="btn btn-secondary" onclick="viewApplicationDetails(${app.id})">View Details</button>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = applicationsHTML;
}

// Load Students Tab
async function loadStudents() {
    const container = document.getElementById('studentsContainer');
    if (!container) {
        console.log('studentsContainer not found!');
        return;
    }
    
    try {
        // Load students from database
        const students = await getStudentsFromDatabase();
        if (!students || students.length === 0) {
            container.innerHTML = '<p class="no-data">No students found.</p>';
            await updateAdminStats(); // Refresh stats from database
            return;
        }
        
        // Filter by status
        const statusFilter = document.getElementById('studentStatusFilter').value;
        const searchTerm = (document.getElementById('searchStudentRecords').value || '').trim().toLowerCase();
        
        let filteredStudents = students;
        if (statusFilter) {
            filteredStudents = filteredStudents.filter(s => (s.status || 'active') === statusFilter);
        }
        if (searchTerm) {
            filteredStudents = filteredStudents.filter(s => 
                (s.firstName || '').toLowerCase().includes(searchTerm) ||
                (s.lastName || '').toLowerCase().includes(searchTerm) ||
                (s.studentId || '').toLowerCase().includes(searchTerm) ||
                (s.email || '').toLowerCase().includes(searchTerm) ||
                (s.awardNumber || '').toLowerCase().includes(searchTerm)
            );
        }

        if (filteredStudents.length === 0) {
            container.innerHTML = '<p class="no-data">No students found.</p>';
            return;
        }
        
        container.innerHTML = filteredStudents.map((student, index) => {
            const safeStatus = (student.status || 'active').toLowerCase();
            const isArchived = safeStatus === 'archived';
            return `
                <div class="student-item">
                    <div class="student-header">
                        <h4><span class="student-index">${index + 1}</span>${student.firstName || ''} ${student.lastName || ''}</h4>
                    </div>
                    <div class="student-info">
                        <div class="info-item">
                            <span class="info-label">Student ID</span>
                            <span class="info-value">${student.studentId || 'N/A'}</span>
                        </div>
                        ${isArchived ? '<div class="info-item"><span class="info-label">Status</span><span class="info-value" style="color: #f59e0b;">Archived</span></div>' : ''}
                    </div>
                    <div class="student-actions">
                        <button class="btn btn-secondary" onclick="openStudentProfileModal(${student.id || student.student_id})">View Profile</button>
                        <button class="btn btn-secondary" onclick="editStudent(${student.id})">Edit</button>
                        ${isArchived 
                            ? `<button class="btn btn-success" onclick="restoreStudent(${student.id})">Restore</button>`
                            : `<button class="btn btn-secondary" onclick="archiveStudent(${student.id})">Archive</button>`
                        }
                        <button class="btn btn-danger" onclick="deleteStudent(${student.id})">Delete</button>
                    </div>
                </div>
            `;
        }).join('');

        await updateAdminStats(); // Refresh stats from database
    } catch (error) {
        console.error('Error loading students:', error);
        container.innerHTML = '<p class="no-data">Error loading students.</p>';
    }
}

// Load Reports Tab
async function loadReports() {
    console.log('📊 Loading reports...');
    
    const departmentChart = document.getElementById('departmentChart');
    const departmentSummary = document.getElementById('departmentSummary');
    const placeChart = document.getElementById('placeChart');
    const placeSummary = document.getElementById('placeSummary');

    try {
        // Fetch students from database (includes both active and archived)
        const studentsArr = await getStudentsFromDatabase();
        console.log('✅ Students loaded for reports:', studentsArr.length);

        if (!studentsArr || studentsArr.length === 0) {
            // Show no data message for both charts
            if (departmentSummary) {
                departmentSummary.innerHTML = '<p class="no-data">No students data available.</p>';
            }
            if (placeSummary) {
                placeSummary.innerHTML = '<p class="no-data">No students data available.</p>';
            }
            if (departmentChart) {
                const ctx = departmentChart.getContext('2d');
                ctx.clearRect(0, 0, departmentChart.width, departmentChart.height);
            }
            if (placeChart) {
                const ctx = placeChart.getContext('2d');
                ctx.clearRect(0, 0, placeChart.width, placeChart.height);
            }
            return;
        }

        // Calculate status breakdowns
        const activeStudents = studentsArr.filter(s => {
            const status = (s.status || s.student_status || 'active').toLowerCase();
            return status === 'active';
        });
        const archivedStudents = studentsArr.filter(s => {
            const status = (s.status || s.student_status || 'active').toLowerCase();
            return status === 'archived';
        });

        console.log(`📊 Report statistics: ${studentsArr.length} total (${activeStudents.length} active, ${archivedStudents.length} archived)`);

        // Department analysis (includes all students - active and archived)
    if (departmentChart && departmentSummary) {
        const deptCounts = studentsArr.reduce((acc, s) => {
                const d = (s && s.department && s.department.trim()) ? s.department.trim() : 'Unspecified';
            acc[d] = (acc[d] || 0) + 1;
            return acc;
        }, {});
            
            // Department breakdown by status
            const deptActiveCounts = activeStudents.reduce((acc, s) => {
                const d = (s && s.department && s.department.trim()) ? s.department.trim() : 'Unspecified';
                acc[d] = (acc[d] || 0) + 1;
                return acc;
            }, {});
            
            const deptArchivedCounts = archivedStudents.reduce((acc, s) => {
                const d = (s && s.department && s.department.trim()) ? s.department.trim() : 'Unspecified';
                acc[d] = (acc[d] || 0) + 1;
                return acc;
            }, {});
            
        if (Object.keys(deptCounts).length === 0) {
            departmentSummary.innerHTML = '<p class="no-data">No department data available.</p>';
            const ctx = departmentChart.getContext('2d');
            ctx.clearRect(0, 0, departmentChart.width, departmentChart.height);
        } else {
            drawSimpleChart(departmentChart, deptCounts, { hideLabels: false, labelFormatter: abbreviateDepartment });
            const total = Object.values(deptCounts).reduce((a, b) => a + b, 0);
            const sorted = Object.entries(deptCounts).sort((a, b) => b[1] - a[1]);
            departmentSummary.innerHTML = `
                    <div style="margin-bottom: 10px; padding: 8px; background: #f3f4f6; border-radius: 6px; font-size: 0.85em;">
                        <strong>Total: ${total}</strong> (${activeStudents.length} Active, ${archivedStudents.length} Archived)
                    </div>
                <ul class="dept-summary-list">
                    ${sorted.map(([name, count], idx) => {
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                            const activeCount = deptActiveCounts[name] || 0;
                            const archivedCount = deptArchivedCounts[name] || 0;
                        const color = `hsl(${(idx * 53) % 360}, 70%, 55%)`;
                        const abbr = abbreviateDepartment(name);
                            return `<li title="${name} - Active: ${activeCount}, Archived: ${archivedCount}">
                            <span class="dept-color-dot" style="background:${color}"></span>
                            <span class="dept-name">${abbr}</span>
                            <span class="dept-count">${count} (${pct}%)</span>
                                ${archivedCount > 0 ? `<span style="font-size: 0.8em; color: #f59e0b; margin-left: 8px;">[${archivedCount} archived]</span>` : ''}
                        </li>`;
                    }).join('')}
                </ul>
            `;
        }
    }

        // From (place) analysis (includes all students - active and archived)
        // Group by city name - normalize city names for better grouping
    if (placeChart && placeSummary) {
            // Helper function to normalize city names
            const normalizeCityName = (place) => {
                if (!place || !place.trim()) return 'Unspecified';
                
                let normalized = place.trim();
                
                // Convert to lowercase for comparison
                normalized = normalized.toLowerCase();
                
                // Remove common suffixes that might cause duplication
                normalized = normalized.replace(/\s+(city|town|municipality|municipal|province|prov)$/i, '');
                
                // Extract just the city name if it contains comma (e.g., "City, Province" -> "City")
                const parts = normalized.split(',');
                if (parts.length > 1) {
                    normalized = parts[0].trim();
                }
                
                // Capitalize first letter of each word for display
                return normalized.split(' ').map(word => 
                    word.charAt(0).toUpperCase() + word.slice(1)
                ).join(' ');
            };
            
            // Helper function to get display name (use original, or normalized if original is empty)
            const getDisplayName = (place, normalized) => {
                if (!place || !place.trim()) return 'Unspecified';
                // Return the first part before comma, or full name if no comma
                const parts = place.trim().split(',');
                return parts[0].trim() || normalized || 'Unspecified';
            };
            
            // First pass: normalize all places and group them
            const placeGroups = {};
            studentsArr.forEach(s => {
                const originalPlace = (s && s.place && s.place.trim()) ? s.place.trim() : '';
                const normalized = normalizeCityName(originalPlace);
                const displayName = getDisplayName(originalPlace, normalized);
                
                if (!placeGroups[normalized]) {
                    placeGroups[normalized] = {
                        count: 0,
                        displayName: displayName,
                        originalPlaces: new Set()
                    };
                }
                placeGroups[normalized].count++;
                if (originalPlace) {
                    placeGroups[normalized].originalPlaces.add(originalPlace);
                }
            });
            
            // Convert to counts object with display names
            const placeCounts = {};
            Object.keys(placeGroups).forEach(normalized => {
                const group = placeGroups[normalized];
                placeCounts[group.displayName] = group.count;
            });
            
            // Place breakdown by status (using same normalization)
            const placeActiveGroups = {};
            activeStudents.forEach(s => {
                const originalPlace = (s && s.place && s.place.trim()) ? s.place.trim() : '';
                const normalized = normalizeCityName(originalPlace);
                const displayName = getDisplayName(originalPlace, normalized);
                
                if (!placeActiveGroups[normalized]) {
                    placeActiveGroups[normalized] = {
                        count: 0,
                        displayName: displayName
                    };
                }
                placeActiveGroups[normalized].count++;
            });
            
            const placeActiveCounts = {};
            Object.keys(placeActiveGroups).forEach(normalized => {
                const group = placeActiveGroups[normalized];
                placeActiveCounts[group.displayName] = group.count;
            });
            
            const placeArchivedGroups = {};
            archivedStudents.forEach(s => {
                const originalPlace = (s && s.place && s.place.trim()) ? s.place.trim() : '';
                const normalized = normalizeCityName(originalPlace);
                const displayName = getDisplayName(originalPlace, normalized);
                
                if (!placeArchivedGroups[normalized]) {
                    placeArchivedGroups[normalized] = {
                        count: 0,
                        displayName: displayName
                    };
                }
                placeArchivedGroups[normalized].count++;
            });
            
            const placeArchivedCounts = {};
            Object.keys(placeArchivedGroups).forEach(normalized => {
                const group = placeArchivedGroups[normalized];
                placeArchivedCounts[group.displayName] = group.count;
            });
            
        if (Object.keys(placeCounts).length === 0) {
            placeSummary.innerHTML = '<p class="no-data">No origin data available.</p>';
            const ctx = placeChart.getContext('2d');
            ctx.clearRect(0, 0, placeChart.width, placeChart.height);
        } else {
            // Hide labels under bars; values only on top
            drawSimpleChart(placeChart, placeCounts, { hideLabels: true });
            const total = Object.values(placeCounts).reduce((a, b) => a + b, 0);
            const sorted = Object.entries(placeCounts).sort((a, b) => b[1] - a[1]).slice(0, 12);
            placeSummary.innerHTML = `
                    <div style="margin-bottom: 10px; padding: 8px; background: #f3f4f6; border-radius: 6px; font-size: 0.85em;">
                        <strong>Total: ${total}</strong> (${activeStudents.length} Active, ${archivedStudents.length} Archived)
                    </div>
                <ul class="dept-summary-list">
                    ${sorted.map(([name, count], idx) => {
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                            const activeCount = placeActiveCounts[name] || 0;
                            const archivedCount = placeArchivedCounts[name] || 0;
                        const color = `hsl(${(idx * 53) % 360}, 70%, 55%)`;
                            return `<li title="${name} - Active: ${activeCount}, Archived: ${archivedCount}">
                            <span class="dept-color-dot" style="background:${color}"></span>
                            <span class="dept-name">${(name || 'Unspecified').toLowerCase()}</span>
                            <span class="dept-count">${count} (${pct}%)</span>
                                ${archivedCount > 0 ? `<span style="font-size: 0.8em; color: #f59e0b; margin-left: 8px;">[${archivedCount} archived]</span>` : ''}
                        </li>`;
                    }).join('')}
                </ul>
            `;
            }
        }
        
        console.log('✅ Reports loaded successfully');
    } catch (error) {
        console.error('❌ Error loading reports:', error);
        if (departmentSummary) {
            departmentSummary.innerHTML = '<p class="no-data">Error loading department data.</p>';
        }
        if (placeSummary) {
            placeSummary.innerHTML = '<p class="no-data">Error loading origin data.</p>';
        }
        if (typeof showToast === 'function') {
            showToast('Failed to load reports. Please try again.', 'error');
        }
    }
}

// Load Settings Tab
function loadSettings() {
    // This would load system settings
    showToast('Settings loaded successfully!', 'success');
}

// Student Management Functions
function viewStudentProfile(studentId) {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    
    // Populate modal with student data
    document.getElementById('adminStudentName').textContent = `${student.firstName} ${student.lastName}`;
    document.getElementById('adminStudentEmail').textContent = student.email;
    document.getElementById('adminStudentId').textContent = student.studentId;
    document.getElementById('adminStudentCourse').textContent = student.course;
    document.getElementById('adminStudentYear').textContent = student.year;
    document.getElementById('adminStudentStatus').textContent = student.status;
    document.getElementById('adminStudentAppStatus').textContent = student.applicationStatus || 'N/A';
    document.getElementById('adminStudentRegistered').textContent = formatDate(student.registered);
    
    // Set student ID picture if available
    const img = document.getElementById('adminStudentPhoto');
    if (img) {
        if (student.idPictureDataUrl) {
            img.src = student.idPictureDataUrl;
            img.alt = 'Student ID Picture';
        } else {
            img.src = '';
            img.alt = 'No ID Picture available';
        }
    }
    
    // Show modal
    document.getElementById('studentProfileModal').style.display = 'block';
}

function closeStudentProfileModal() {
    document.getElementById('studentProfileModal').style.display = 'none';
}

async function editStudent(studentId) {
    try {
        console.log('📝 Loading student data for editing:', studentId);
        
        // Fetch student data from database
        const students = await getStudentsFromDatabase();
        const student = students.find(s => s.id === studentId || s.id == studentId);
        
    if (!student) {
        showToast('Student not found', 'error');
        return;
    }
    
        console.log('✅ Student found:', student);
        
        // Populate the edit form with student data
        document.getElementById('editStudentId').value = student.id;
        document.getElementById('editFirstName').value = student.firstName || student.first_name || '';
        document.getElementById('editLastName').value = student.lastName || student.last_name || '';
        document.getElementById('editEmail').value = student.email || '';
        document.getElementById('editCourse').value = student.course || '';
        document.getElementById('editYear').value = student.year || student.yearLevel || student.year_level || '';
        document.getElementById('editDepartment').value = student.department || '';
        document.getElementById('editPlace').value = student.place || student.from || student.origin || '';
        document.getElementById('editIsIndigenous').checked = student.isIndigenous === true || student.isIndigenous === 1 || student.is_indigenous === 1 || student.is_indigenous === true;
        document.getElementById('editIsPwd').checked = student.isPwd === true || student.isPwd === 1 || student.is_pwd === 1 || student.is_pwd === true;
        
        // Show the modal
        document.getElementById('editStudentModal').style.display = 'block';
        
    } catch (error) {
        console.error('❌ Error loading student for editing:', error);
        showToast('Failed to load student data: ' + error.message, 'error');
    }
}

function closeEditStudentModal() {
    document.getElementById('editStudentModal').style.display = 'none';
    // Reset form
    document.getElementById('editStudentForm').reset();
}

async function handleEditStudent(event) {
    event.preventDefault();
    
    try {
        const studentId = document.getElementById('editStudentId').value;
        const firstName = document.getElementById('editFirstName').value.trim();
        const lastName = document.getElementById('editLastName').value.trim();
        const email = document.getElementById('editEmail').value.trim();
        const course = document.getElementById('editCourse').value.trim();
        const year = document.getElementById('editYear').value;
        const department = document.getElementById('editDepartment').value;
        const place = document.getElementById('editPlace').value.trim();
        const isIndigenous = document.getElementById('editIsIndigenous').checked ? 1 : 0;
        const isPwd = document.getElementById('editIsPwd').checked ? 1 : 0;
        
        // Validation
        if (!firstName || !lastName || !email || !course || !year || !department || !place) {
            showToast('Please fill in all required fields', 'error');
            return;
        }
        
        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showToast('Please enter a valid email address', 'error');
            return;
        }
        
        console.log('📤 Updating student:', {
            id: studentId,
            firstName,
            lastName,
            email,
            course,
            year,
            department,
            place,
            isIndigenous,
            isPwd
        });
        
        // Update student in database
        const response = await updateStudent({
            id: parseInt(studentId),
            firstName: firstName,
            lastName: lastName,
            email: email,
            course: course,
            year: year,
            department: department,
            place: place,
            isIndigenous: isIndigenous,
            isPwd: isPwd
        });
        
        if (response && response.success) {
            showToast('Student updated successfully!', 'success');
            closeEditStudentModal();
            await loadStudents(); // Refresh student list
            await updateAdminStats(); // Refresh admin stats
        } else {
            showToast(response?.message || 'Failed to update student', 'error');
        }
    } catch (error) {
        console.error('❌ Error updating student:', error);
        showToast('Failed to update student: ' + error.message, 'error');
    }
}

async function archiveStudent(studentId) {
    if (!confirm('Are you sure you want to archive this student?')) {
        return;
    }
    
    try {
        console.log('📦 Archiving student:', studentId);
        
        // Call archive API
        const response = await apiCall('archive_student.php', 'POST', {
            id: studentId,
            status: 'archived'
        });
        
        if (response && response.success) {
            showToast('Student archived successfully!', 'success');
            await loadStudents(); // Refresh student list
            await updateAdminStats(); // Refresh admin stats
            
            // Check if reports tab is active and refresh it
            const reportsTab = document.getElementById('reports-tab');
            if (reportsTab && reportsTab.classList.contains('active')) {
                console.log('📊 Refreshing reports after archiving...');
                await loadReports();
            }
        } else {
            showToast(response?.message || 'Failed to archive student', 'error');
        }
    } catch (error) {
        console.error('❌ Error archiving student:', error);
        showToast('Failed to archive student: ' + error.message, 'error');
    }
}

async function restoreStudent(studentId) {
    if (!confirm('Are you sure you want to restore this student?')) {
        return;
    }
    
    try {
        console.log('📦 Restoring student:', studentId);
        
        // Call archive API with 'active' status
        const response = await apiCall('archive_student.php', 'POST', {
            id: studentId,
            status: 'active'
        });
        
        if (response && response.success) {
            showToast('Student restored successfully!', 'success');
            await loadStudents(); // Refresh student list
            await updateAdminStats(); // Refresh admin stats
            
            // Check if reports tab is active and refresh it
            const reportsTab = document.getElementById('reports-tab');
            if (reportsTab && reportsTab.classList.contains('active')) {
                console.log('📊 Refreshing reports after restoring...');
                await loadReports();
            }
        } else {
            showToast(response?.message || 'Failed to restore student', 'error');
        }
    } catch (error) {
        console.error('❌ Error restoring student:', error);
        showToast('Failed to restore student: ' + error.message, 'error');
    }
}

// Application Management Functions
function reviewApplication(applicationId) {
    const application = applications.find(app => app.id === applicationId);
    if (!application) return;
    
    currentApplicationId = applicationId;
    
    // Populate modal with application details
    const detailsContainer = document.getElementById('applicationDetails');
    detailsContainer.innerHTML = `
        <div class="application-details">
            <h4>Application Details</h4>
            <div class="detail-row">
                <strong>Name:</strong>
                <span>${application.firstName} ${application.lastName}</span>
            </div>
            <div class="detail-row">
                <strong>Student ID:</strong>
                <span>${application.studentId}</span>
            </div>
            <div class="detail-row">
                <strong>Email:</strong>
                <span>${application.email}</span>
            </div>
            <div class="detail-row">
                <strong>Course:</strong>
                <span>${application.course}</span>
            </div>
            <div class="detail-row">
                <strong>Year Level:</strong>
                <span>${application.year}</span>
            </div>
            <div class="detail-row">
                <strong>Applied Date:</strong>
                <span>${formatDate(application.appliedDate)}</span>
            </div>
            <div class="detail-row">
                <strong>Status:</strong>
                <span class="status-badge status-${application.status}">${application.status.toUpperCase()}</span>
            </div>
        </div>
    `;
    
    // Show modal
    // reviewModal removed - using viewApplicationDetails instead
    viewApplicationDetails(application.id);
}

// updateApplicationStatus function removed - approval/rejection process has been replaced

// Filter and Search Functions
function filterApplications() {
    loadApplications();
}

function searchApplications() {
    loadApplications();
}

function filterStudents() {
    loadStudents();
}

function searchStudents() {
    loadStudents();
}

// Admin Password Change Function
async function changeAdminPassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;
    
    // Validation
    if (!currentPassword || !newPassword || !confirmNewPassword) {
        showToast('Please fill in all password fields', 'error');
        return;
    }
    
    if (newPassword !== confirmNewPassword) {
        showToast('New passwords do not match', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        showToast('New password must be at least 6 characters long', 'error');
        return;
    }
    
    try {
        // Get admin email from current session
        const adminData = JSON.parse(localStorage.getItem('adminCredentials') || '{"email": "admin@grantes.com"}');
        
        console.log('Attempting to change admin password...');
        
        // Call API to update password in database
        const response = await apiCall('update_admin_password.php', 'POST', {
            email: adminData.email,
            currentPassword: currentPassword,
            newPassword: newPassword
        });
        
        console.log('Password change response:', response);
        
        if (response && response.success) {
            // Update localStorage
            adminData.password = newPassword;
            localStorage.setItem('adminCredentials', JSON.stringify(adminData));
            
            // Clear form
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmNewPassword').value = '';
            
            showToast('Password changed successfully!', 'success');
        } else {
            showToast(response?.message || 'Failed to change password', 'error');
        }
    } catch (error) {
        console.error('Error changing password:', error);
        showToast('Failed to change password: ' + error.message, 'error');
    }
}

// Student Password Change Functions
let selectedStudentForPasswordChange = null;

async function searchStudentsForPasswordChange() {
    const searchTerm = document.getElementById('studentSearch').value.trim();
    const resultsContainer = document.getElementById('studentSearchResults');
    
    if (searchTerm.length < 2) {
        resultsContainer.style.display = 'none';
        return;
    }
    
    try {
        console.log('🔍 Searching students for password change:', searchTerm);
        
        // Search students from database
        const response = await apiCall(`search_students.php?query=${encodeURIComponent(searchTerm)}`, 'GET');
        
        if (response && response.success && response.students) {
            const matchingStudents = response.students.slice(0, 10); // Limit to 10 results
    
    if (matchingStudents.length === 0) {
        resultsContainer.innerHTML = '<div class="student-search-item"><p>No students found</p></div>';
    } else {
        resultsContainer.innerHTML = matchingStudents.map(student => `
            <div class="student-search-item" onclick="selectStudentForPasswordChange(${student.id})">
                        <h5>${student.firstName || student.first_name || ''} ${student.lastName || student.last_name || ''}</h5>
                        <p>ID: ${student.studentId || student.student_id || 'N/A'} | Award: ${student.awardNumber || student.award_number || 'N/A'} | Email: ${student.email || 'N/A'}</p>
            </div>
        `).join('');
            }
        } else {
            resultsContainer.innerHTML = '<div class="student-search-item"><p>No students found</p></div>';
    }
    
    resultsContainer.classList.add('show');
    resultsContainer.style.display = 'block';
    } catch (error) {
        console.error('❌ Error searching students:', error);
        resultsContainer.innerHTML = '<div class="student-search-item"><p>Error searching students</p></div>';
        resultsContainer.style.display = 'block';
    }
}

async function selectStudentForPasswordChange(studentId) {
    try {
        console.log('📝 Selecting student for password change:', studentId);
        
        // Fetch student from database
        const students = await getStudentsFromDatabase();
        const student = students.find(s => s.id === studentId || s.id == studentId);
    
    if (!student) {
        showToast('Student not found', 'error');
        return;
    }
        
        console.log('✅ Student found:', student);
    
    selectedStudentForPasswordChange = student;
    
    // Hide search results
    document.getElementById('studentSearchResults').style.display = 'none';
    
    // Show selected student info
    document.getElementById('selectedStudentInfo').innerHTML = `
            <h5>${student.firstName || student.first_name || ''} ${student.lastName || student.last_name || ''}</h5>
        <p><strong>Student ID:</strong> ${student.studentId || student.student_id || 'N/A'}</p>
        <p><strong>Award Number:</strong> ${student.awardNumber || student.award_number || 'N/A'}</p>
        <p><strong>Email:</strong> ${student.email || 'N/A'}</p>
        <p><strong>Department:</strong> ${student.department || 'N/A'}</p>
    `;
    
    // Show password form
    document.getElementById('studentPasswordForm').style.display = 'block';
    
    // Clear search input
    document.getElementById('studentSearch').value = '';
    } catch (error) {
        console.error('❌ Error loading student:', error);
        showToast('Failed to load student data: ' + error.message, 'error');
    }
}

async function changeStudentPassword() {
    if (!selectedStudentForPasswordChange) {
        showToast('Please select a student first', 'error');
        return;
    }
    
    const newPassword = document.getElementById('newStudentPassword').value;
    const confirmPassword = document.getElementById('confirmStudentPassword').value;
    
    // Validation
    if (!newPassword || !confirmPassword) {
        showToast('Please fill in both password fields', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        showToast('Password must be at least 6 characters long', 'error');
        return;
    }
    
    try {
        // Call API to update password in database - use email or studentId
        const requestData = {
            newPassword: newPassword
        };
        
        // Log the full student object for debugging
        console.log('🔍 Selected student object:', selectedStudentForPasswordChange);
        
        // Add identifier (prefer email, then studentId, then id)
        // Handle both camelCase and snake_case field names
        const email = selectedStudentForPasswordChange.email;
        const studentId = selectedStudentForPasswordChange.studentId || selectedStudentForPasswordChange.student_id;
        const id = selectedStudentForPasswordChange.id;
        
        console.log('🔍 Extracted identifiers:', { email, studentId, id });
        
        if (email) {
            requestData.email = email;
            console.log('✅ Using email identifier:', email);
        } else if (studentId) {
            requestData.student_id = studentId;
            console.log('✅ Using student_id identifier:', studentId);
        } else if (id) {
            requestData.studentId = id;
            console.log('✅ Using id identifier:', id);
        }
        
        console.log('📝 Calling password change API with data:', requestData);
        const response = await apiCall('update_student_password.php', 'POST', requestData);
        console.log('📥 API Response received:', response);
        
        if (response && response.success) {
            console.log('✅ Password change successful');
            
            // Get student name before clearing
            const studentName = selectedStudentForPasswordChange?.firstName || selectedStudentForPasswordChange?.first_name || 'Student';
            const studentLastName = selectedStudentForPasswordChange?.lastName || selectedStudentForPasswordChange?.last_name || '';
            
            // Clear form
            clearStudentPasswordForm();
            
            showToast(`Password changed successfully for ${studentName} ${studentLastName}`, 'success');
        } else {
            console.error('❌ Password change failed. Response:', response);
            showToast(response?.message || 'Failed to change password', 'error');
        }
    } catch (error) {
        console.error('Error changing student password:', error);
        showToast('Failed to change password: ' + error.message, 'error');
    }
}

function clearStudentPasswordForm() {
    selectedStudentForPasswordChange = null;
    document.getElementById('studentSearch').value = '';
    document.getElementById('studentSearchResults').style.display = 'none';
    document.getElementById('selectedStudentInfo').innerHTML = '';
    document.getElementById('studentPasswordForm').style.display = 'none';
    document.getElementById('newStudentPassword').value = '';
    document.getElementById('confirmStudentPassword').value = '';
}

// Student Change Own Password Functions
// Student password change functionality removed - students cannot change their passwords

// Emoji Picker Functions
const emojiCategories = {
    smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '☺️', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '😶‍🌫️', '😵', '🤯', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'],
    people: ['👶', '🧒', '👦', '👧', '🧑', '👱', '👨', '🧔', '👨‍🦰', '👨‍🦱', '👨‍🦳', '👨‍🦲', '👩', '👩‍🦰', '🧑‍🦰', '👩‍🦱', '🧑‍🦱', '👩‍🦳', '🧑‍🦳', '👩‍🦲', '🧑‍🦲', '👱‍♀️', '👱‍♂️', '🧓', '👴', '👵', '🙍', '🙍‍♂️', '🙍‍♀️', '🙎', '🙎‍♂️', '🙎‍♀️', '🙅', '🙅‍♂️', '🙅‍♀️', '🙆', '🙆‍♂️', '🙆‍♀️', '💁', '💁‍♂️', '💁‍♀️', '🙋', '🙋‍♂️', '🙋‍♀️', '🧏', '🧏‍♂️', '🧏‍♀️', '🤦', '🤦‍♂️', '🤦‍♀️', '🤷', '🤷‍♂️', '🤷‍♀️', '🙇', '🙇‍♂️', '🙇‍♀️', '🤦', '🤦‍♂️', '🤦‍♀️', '🤷', '🤷‍♂️', '🤷‍♀️'],
    animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🦬', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🪶', '🦅', '🦉', '🦊', '🦝', '🐻', '🐻‍❄️', '🐨', '🐼', '🦥', '🦦', '🦨', '🦘', '🦡', '🐾'],
    food: ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🌽', '🥕', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🥞', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🌮', '🌯', '🥗', '🥘', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '☕️', '🍵', '🧃', '🥤', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾'],
    travel: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🏍️', '🛵', '🚲', '🛴', '🛹', '🛼', '🚁', '🛸', '✈️', '🛫', '🛬', '🛩️', '💺', '🚀', '🚂', '🚃', '🚄', '🚅', '🚆', '🚇', '🚈', '🚉', '🚊', '🚝', '🚞', '🚟', '🚠', '🚡', '⛱️', '🎢', '🎡', '🎠', '🎪', '🗼', '🗽', '⛲', '⛺', '🌁', '🌃', '🏙️', '🌄', '🌅', '🌆', '🌇', '🌉', '🎆', '🎇', '✨', '🌟', '💫', '⭐', '🌠', '🏔️', '⛰️', '🌋', '🗻', '🏕️', '🏖️', '🏜️', '🏝️', '🏞️', '🏟️', '🏛️', '🏗️', '🧱', '🏘️', '🏚️', '🏠', '🏡', '🏢', '🏣', '🏤', '🏥', '🏦', '🏨', '🏩', '🏪', '🏫', '🏬', '🏭', '🏯', '🏰', '🗺️', '🗿', '🗾', '🗼'],
    activities: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🥅', '⛳', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '⛹️', '🤺', '🤾', '🧘', '🏄', '🏊', '🤽', '🚣', '🧗', '🚵', '🚴', '🏇', '🤹', '🎪', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🪕', '🎻', '🎲', '♟️', '🎯', '🎳', '🎮', '🎰', '🧩'],
    objects: ['⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '🧯', '🪔', '🧨', '🗿', '🔮', '🔭', '🔬', '🕳️', '💊', '💉', '🩸', '🧬', '🦠', '🧫', '🧪', '🌡️', '🧹', '🧺', '🧻', '🚽', '🚰', '🚿', '🛁', '🛀', '🧼', '🪥', '🪒', '🧽', '🪣', '🧴', '🛎️', '🔑', '🗝️', '🚪', '🪑', '🛋️', '🛏️', '🛌', '🧸', '🪆', '🖼️', '🪞', '🪟', '🛍️', '🛒', '🎁', '🎈', '🎏', '🎀', '🪄', '🪅', '🎊', '🎉', '🎎', '🏮', '🎐', '🧧', '✉️', '📩', '📨', '📧', '💌', '📥', '📤', '📦', '🪧', '📪', '📫', '📬', '📭', '📮', '🗳️', '✏️', '✒️', '🖊️', '🖋️', '🖌️', '🖍️', '📝', '💼', '📁', '📂', '🗂️', '📅', '📆', '🗒️', '🗓️', '📇', '📈', '📉', '📊', '📋', '📌', '📍', '📎', '🖇️', '📏', '📐', '✂️', '🗑️', '🔒', '🔓', '🔏', '🔐', '🔑', '🗝️'],
    symbols: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❓', '❕', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '🚻', '🚮', '🎦', '📶', '🈁', '🔣', '🔄', '🔤', '🆕', '🆓', '🆒', '🆗', '🆙', '🆖', '🔟', '🔢', '#️⃣', '*️⃣', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔺', '🔻', '💠', '🔲', '🔳', '⚪', '⚫', '🔴', '🔵', '🟠', '🟡', '🟢', '🟣', '🟤', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '🟫', '⬛', '⬜', '🟰', '🔶', '🔷', '🔸', '🔹', '🔺', '🔻', '💠', '🔘', '🔳', '🔲']
};

let currentEmojiCategory = 'smileys';

function showEmojiPicker() {
    const modal = document.getElementById('emojiPickerModal');
    if (modal) {
        modal.style.display = 'block';
        currentEmojiCategory = 'smileys';
        document.getElementById('emojiSearchInput').value = '';
        renderEmojis();
    }
}

function closeEmojiPicker() {
    const modal = document.getElementById('emojiPickerModal');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('emojiSearchInput').value = '';
    }
}

function switchEmojiCategory(category) {
    currentEmojiCategory = category;
    
    // Update category buttons
    document.querySelectorAll('.emoji-category-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-category') === category) {
            btn.classList.add('active');
        }
    });
    
    // Clear search and render
    document.getElementById('emojiSearchInput').value = '';
    renderEmojis();
}

function renderEmojis() {
    const container = document.getElementById('emojiGrid');
    const emojis = emojiCategories[currentEmojiCategory] || [];
    
    container.innerHTML = emojis.map(emoji => `
        <span class="emoji-item" onclick="selectEmoji('${emoji}')" title="${emoji}">${emoji}</span>
    `).join('');
}

function filterEmojis() {
    const searchTerm = document.getElementById('emojiSearchInput').value.toLowerCase();
    const emojiItems = document.querySelectorAll('.emoji-item');
    
    if (!searchTerm) {
        // Show all emojis in current category
        renderEmojis();
        return;
    }
    
    // Search across all categories
    let found = false;
    emojiItems.forEach(item => {
        const emoji = item.textContent;
        const unicode = emoji.codePointAt(0);
        // Simple search - you could enhance this with emoji names
        if (emoji.includes(searchTerm) || item.getAttribute('title')?.toLowerCase().includes(searchTerm)) {
            item.style.display = 'inline-flex';
            found = true;
        } else {
            item.style.display = 'none';
        }
    });
    
    // If no results in current category, search all
    if (!found) {
        let allMatches = [];
        Object.values(emojiCategories).flat().forEach(emoji => {
            if (emoji.includes(searchTerm)) {
                allMatches.push(emoji);
            }
        });
        
        const container = document.getElementById('emojiGrid');
        container.innerHTML = allMatches.map(emoji => `
            <span class="emoji-item" onclick="selectEmoji('${emoji}')" title="${emoji}">${emoji}</span>
        `).join('');
    }
}

function selectEmoji(emoji) {
    const postInput = document.getElementById('postInput');
    if (postInput) {
        const cursorPosition = postInput.selectionStart || postInput.value.length;
        const textBefore = postInput.value.substring(0, cursorPosition);
        const textAfter = postInput.value.substring(cursorPosition);
        postInput.value = textBefore + emoji + textAfter;
        
        // Move cursor after inserted emoji
        const newPosition = cursorPosition + emoji.length;
        postInput.setSelectionRange(newPosition, newPosition);
        postInput.focus();
    }
    
    // Close modal
    closeEmojiPicker();
}

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const emojiModal = document.getElementById('emojiPickerModal');
    if (event.target === emojiModal) {
        closeEmojiPicker();
    }
    
    const liveModal = document.getElementById('liveVideoModal');
    if (event.target === liveModal) {
        closeLiveVideoModal();
    }
    
    const liveBroadcastModal = document.getElementById('liveVideoBroadcastModal');
    // Don't close broadcast modal on outside click - require explicit end
    // if (event.target === liveBroadcastModal && !isLive) {
    //     closeLiveBroadcast();
    // }
});

// Live Video Modal Functions
function showLiveVideoModal() {
    const modal = document.getElementById('liveVideoModal');
    if (modal) {
    modal.style.display = 'block';
        
        // Update host name if user is logged in
        if (currentUser && currentUser.role === 'admin') {
            document.getElementById('liveHostName').textContent = 'Administrator';
            document.getElementById('liveVideoWelcomeText').textContent = 'Welcome back, Administrator!';
        }
        
        // Reset posting options
        document.getElementById('liveVideoPostLocation').value = 'timeline';
        document.getElementById('liveVideoCourse').style.display = 'none';
        
        // Handle post location change
        const postLocation = document.getElementById('liveVideoPostLocation');
        postLocation.onchange = function() {
            const courseSelect = document.getElementById('liveVideoCourse');
            if (this.value === 'specific') {
                courseSelect.style.display = 'block';
            } else {
                courseSelect.style.display = 'none';
            }
        };
    }
}

function closeLiveVideoModal() {
    const modal = document.getElementById('liveVideoModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Live Video Streaming Variables
let liveStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let isLive = false;
let isMuted = false;
let currentFacingMode = 'user'; // 'user' for front, 'environment' for back
let liveViewerCount = 0;

async function initiateGoLive() {
    // Close the selection modal
    closeLiveVideoModal();
    
    // Show the live broadcast interface
    const broadcastModal = document.getElementById('liveVideoBroadcastModal');
    if (broadcastModal) {
        broadcastModal.style.display = 'block';
    }
    
    // Request camera and microphone access
    try {
        const constraints = {
            video: {
                facingMode: currentFacingMode,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: true
        };
        
        liveStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Display video preview
        const videoPreview = document.getElementById('liveVideoPreview');
        if (videoPreview && liveStream) {
            videoPreview.srcObject = liveStream;
            videoPreview.muted = true; // Mute preview to avoid feedback
            await videoPreview.play();
        }
        
        // Initialize MediaRecorder for recording
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
            mediaRecorder = new MediaRecorder(liveStream, {
                mimeType: 'video/webm;codecs=vp9'
            });
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
            mediaRecorder = new MediaRecorder(liveStream, {
                mimeType: 'video/webm'
            });
        } else {
            mediaRecorder = new MediaRecorder(liveStream);
        }
        
        recordedChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            saveLiveVideo(blob);
        };
        
        showToast('Camera access granted! Click "Start Live" when ready.', 'success');
    } catch (error) {
        console.error('Error accessing camera:', error);
        showToast('Failed to access camera. Please allow camera and microphone permissions.', 'error');
        closeLiveBroadcast();
    }
}

function toggleLiveVideo() {
    const toggleBtn = document.getElementById('toggleLiveBtn');
    const liveInfoPanel = document.getElementById('liveInfoPanel');
    
    if (!isLive) {
        // Start live broadcast
        if (liveStream && mediaRecorder) {
            mediaRecorder.start(1000); // Record chunks every second
            isLive = true;
            
            // Update UI
            toggleBtn.innerHTML = '<i class="fas fa-stop"></i><span>Stop Live</span>';
            toggleBtn.classList.add('stop-btn');
            liveInfoPanel.style.display = 'block';
            
            // Simulate viewer count updates
            startViewerCount();
            
            // Create live post announcement
            createLiveBroadcastPost();
            
            showToast('You are now live!', 'success');
        }
    } else {
        // Stop live broadcast
        stopLiveVideo();
    }
}

function stopLiveVideo() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    
    isLive = false;
    const toggleBtn = document.getElementById('toggleLiveBtn');
    const liveInfoPanel = document.getElementById('liveInfoPanel');
    
    toggleBtn.innerHTML = '<i class="fas fa-play"></i><span>Start Live</span>';
    toggleBtn.classList.remove('stop-btn');
    liveInfoPanel.style.display = 'none';
    
    stopViewerCount();
    showToast('Live broadcast ended.', 'info');
}

async function switchCamera() {
    try {
        // Stop current stream
        if (liveStream) {
            liveStream.getTracks().forEach(track => track.stop());
        }
        
        // Switch camera
        currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
        
        const constraints = {
            video: {
                facingMode: currentFacingMode,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: true
        };
        
        liveStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Update video preview
        const videoPreview = document.getElementById('liveVideoPreview');
        if (videoPreview) {
            videoPreview.srcObject = liveStream;
        }
        
        // Restart MediaRecorder if we were recording
        if (isLive && liveStream) {
            if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
                mediaRecorder = new MediaRecorder(liveStream, {
                    mimeType: 'video/webm;codecs=vp9'
                });
            } else if (MediaRecorder.isTypeSupported('video/webm')) {
                mediaRecorder = new MediaRecorder(liveStream, {
                    mimeType: 'video/webm'
                });
            } else {
                mediaRecorder = new MediaRecorder(liveStream);
            }
            
            recordedChunks = [];
            mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    recordedChunks.push(event.data);
                }
            };
            
            mediaRecorder.onstop = () => {
                const blob = new Blob(recordedChunks, { type: 'video/webm' });
                saveLiveVideo(blob);
            };
            
            mediaRecorder.start(1000);
        }
        
        showToast('Camera switched', 'success');
    } catch (error) {
        console.error('Error switching camera:', error);
        showToast('Failed to switch camera', 'error');
    }
}

function toggleMute() {
    if (!liveStream) return;
    
    const audioTracks = liveStream.getAudioTracks();
    const muteBtn = document.getElementById('toggleMuteBtn');
    
    if (audioTracks.length > 0) {
        isMuted = !isMuted;
        audioTracks.forEach(track => {
            track.enabled = !isMuted;
        });
        
        muteBtn.innerHTML = isMuted 
            ? '<i class="fas fa-microphone-slash"></i><span>Unmute</span>'
            : '<i class="fas fa-microphone"></i><span>Mute</span>';
        
        muteBtn.classList.toggle('muted', isMuted);
    }
}

function endLiveVideo() {
    if (confirm('Are you sure you want to end the live broadcast?')) {
        stopLiveVideo();
        
        // Stop all tracks
        if (liveStream) {
            liveStream.getTracks().forEach(track => track.stop());
            liveStream = null;
        }
        
        closeLiveBroadcast();
        showToast('Live broadcast ended successfully', 'success');
    }
}

function closeLiveBroadcast() {
    const broadcastModal = document.getElementById('liveVideoBroadcastModal');
    if (broadcastModal) {
        broadcastModal.style.display = 'none';
    }
    
    // Stop all tracks
    if (liveStream) {
        liveStream.getTracks().forEach(track => track.stop());
        liveStream = null;
    }
    
    // Reset state
    isLive = false;
    isMuted = false;
    liveViewerCount = 0;
    recordedChunks = [];
}

function startViewerCount() {
    // Simulate viewer count (in a real app, this would come from your server)
    liveViewerCount = 1;
    updateViewerCount();
    
    window.__viewerCountInterval = setInterval(() => {
        // Simulate random viewer additions
        if (Math.random() > 0.7) {
            liveViewerCount += Math.floor(Math.random() * 3);
            updateViewerCount();
        }
    }, 3000);
}

function stopViewerCount() {
    if (window.__viewerCountInterval) {
        clearInterval(window.__viewerCountInterval);
        window.__viewerCountInterval = null;
    }
}

function updateViewerCount() {
    const countElement = document.getElementById('liveViewerCount');
    if (countElement) {
        countElement.textContent = liveViewerCount;
    }
}

async function createLiveBroadcastPost() {
    const postLocation = document.getElementById('liveVideoPostLocation')?.value || 'students';
    const course = document.getElementById('liveVideoCourse')?.value || '';
    
    // Map post location to audience
    let audience = 'students';
    let courseValue = null;
    
    if (postLocation === 'timeline' || postLocation === 'students') {
        audience = 'students';
    } else if (postLocation === 'home') {
        audience = 'home';
    } else if (postLocation === 'specific') {
        audience = 'specific';
        courseValue = course || null;
    }
    
    // Create live broadcast post
    const livePostContent = '🔴 LIVE NOW - Join the broadcast!';
    
    try {
        const postData = {
            content: livePostContent,
            type: 'live',
            audience: audience,
            course: courseValue,
            layout: 'image-left',
            images: null
        };
        
        const response = await savePost(postData);
        
        if (response && response.success) {
            // Refresh feeds
            if (typeof loadAdminPosts === 'function') {
                await loadAdminPosts();
            }
            if (typeof loadHomeFeed === 'function') {
                loadHomeFeed();
            }
        }
    } catch (error) {
        console.error('Error creating live post:', error);
    }
}

function saveLiveVideo(blob) {
    // Convert blob to data URL for storage
    const reader = new FileReader();
    reader.onloadend = async () => {
        let videoDataUrl = reader.result;
        
        // Ensure the data URL has the correct video MIME type
        if (!videoDataUrl.startsWith('data:video/')) {
            // Get the blob type and ensure it's set correctly
            const blobType = blob.type || 'video/webm';
            // Recreate data URL with correct type if needed
            if (videoDataUrl.startsWith('data:')) {
                const base64Data = videoDataUrl.split(',')[1];
                videoDataUrl = `data:${blobType};base64,${base64Data}`;
        } else {
                videoDataUrl = `data:${blobType};base64,${videoDataUrl}`;
            }
        }
        
        // Get posting settings
        const postLocation = document.getElementById('liveVideoPostLocation')?.value || 'students';
        const course = document.getElementById('liveVideoCourse')?.value || '';
        
        let audience = 'students';
        let courseValue = null;
        
        if (postLocation === 'timeline' || postLocation === 'students') {
            audience = 'students';
        } else if (postLocation === 'home') {
            audience = 'home';
        } else if (postLocation === 'specific') {
            audience = 'specific';
            courseValue = course || null;
        }
        
        // Create post with video
        try {
            const postData = {
                content: '📹 Live video recording',
                type: 'live',
                audience: audience,
                course: courseValue,
                layout: 'image-left',
                images: [videoDataUrl] // Store video as base64 in images array
            };
            
            const response = await savePost(postData);
            
            if (response && response.success) {
                showToast('Live video saved successfully!', 'success');
                // Refresh feeds
                if (typeof loadAdminPosts === 'function') {
                    await loadAdminPosts();
                }
        }
    } catch (error) {
            console.error('Error saving live video:', error);
            showToast('Error saving live video', 'error');
        }
    };
    reader.readAsDataURL(blob);
}

function shareLiveLink() {
    // In a real app, this would generate a shareable link
    const liveLink = window.location.href + '#live=' + Date.now();
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(liveLink).then(() => {
            showToast('Live link copied to clipboard!', 'success');
        });
    } else {
        // Fallback
        const textArea = document.createElement('textarea');
        textArea.value = liveLink;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showToast('Live link copied to clipboard!', 'success');
    }
}

async function createLiveEvent() {
    // Close modal
    closeLiveVideoModal();
    
    // Prompt for event details
    const eventTitle = prompt('Enter event title:');
    if (!eventTitle) {
        return;
    }
    
    const eventDate = prompt('Enter event date and time (e.g., Dec 25, 2024 at 2:00 PM):');
    if (!eventDate) {
        return;
    }
    
    const eventDescription = prompt('Enter event description (optional):') || '';
    
    // Get posting location
    const postLocation = document.getElementById('liveVideoPostLocation').value;
    const course = document.getElementById('liveVideoCourse').value;
    
    // Map the post location to audience
    let audience = 'students';
    let courseValue = null;
    
    if (postLocation === 'timeline' || postLocation === 'students') {
        audience = 'students';
    } else if (postLocation === 'home') {
        audience = 'home';
    } else if (postLocation === 'specific') {
        audience = 'specific';
        courseValue = course || null;
    }
    
    // Set audience in the post creation interface
    const audienceSelect = document.getElementById('postAudience');
    const courseSelect = document.getElementById('postCourse');
    
    if (audienceSelect) {
        audienceSelect.value = audience;
    }
    
    if (courseSelect && courseValue) {
        courseSelect.value = courseValue;
        courseSelect.style.display = 'block';
    } else if (courseSelect) {
        courseSelect.style.display = 'none';
    }
    
    // Create event post content
    const postInput = document.getElementById('postInput');
    const eventContent = `📅 Live Video Event: ${eventTitle}\n🕒 When: ${eventDate}\n${eventDescription ? `📝 ${eventDescription}` : ''}\n\n🔴 Join us for a live session!`;
    
    if (postInput) {
        postInput.value = eventContent;
        postInput.focus();
    }
    
    // Set a flag to indicate this is a live post
    window.__pendingLivePost = true;
    
    // Show success message
    showToast('Live video event created! Click Publish when ready to post.', 'success');
}

