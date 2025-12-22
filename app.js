// app.js - Main Firebase App Code (v8 CDN version)

let currentUser = window.currentUser ||null;
let auth, db;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing app...');
    
    // Make sure Firebase is loaded
    if (typeof firebase === 'undefined') {
        console.error('Firebase not loaded! Check CDN scripts.');
        showNotification('Firebase not loaded. Please refresh page.', 'error');
        return;
    }
    
    try {
        // Initialize Firebase
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        
        auth = firebase.auth();
        db = firebase.firestore();
        
        console.log('Firebase initialized successfully');
        
        // Check authentication state
        auth.onAuthStateChanged(handleAuthStateChange);
        
        // Setup event listeners
        setupEventListeners();
        
    } catch (error) {
        console.error('Firebase initialization error:', error);
    }
});

// Handle authentication state changes
async function handleAuthStateChange(user) {
    if (user) {
        console.log('User logged in:', user.uid);
        currentUser = user;
        window.currentUser = user;
        
        try {
            const userDoc = await db.collection("users").doc(user.uid).get();
            
            if (userDoc.exists) {
                const userData = userDoc.data();

                // Update global sidebar elements (if present on the page)
                try {
                    const preferredName = userData.username || user.displayName || user.email || 'User';
                    const userNameEl = document.getElementById('userName');
                    const welcomeNameEl = document.getElementById('welcomeName');
                    const userAvatarEl = document.getElementById('userAvatar');

                    if (userNameEl) userNameEl.textContent = preferredName;
                    if (welcomeNameEl) welcomeNameEl.textContent = preferredName;

                    if (userAvatarEl) {
                        let avatar = 'after-dark-banner.jpg';
                        if (userData.photos && userData.photos.length > 0) {
                            const first = userData.photos[0];
                            avatar = typeof first === 'string' ? first : (first.url || first.secure_url || first.src || first.path || avatar);
                        } else if (user.photoURL) {
                            avatar = user.photoURL;
                        }
                        userAvatarEl.src = avatar;
                        userAvatarEl.onerror = function() { this.onerror = null; this.src = 'after-dark-banner.jpg'; };
                    }

                    // Expose latest user data globally and notify pages
                    window.currentUserData = userData;
                    try {
                        document.dispatchEvent(new CustomEvent('userProfileUpdated', { detail: { user, userData } }));
                    } catch (e) {
                        /* ignore */
                    }
                } catch (domError) {
                    console.warn('Could not update sidebar elements on this page:', domError);
                }

                // Redirect based on user state (only if on index page)
                if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
                    if (userData.isAdmin) {
                        window.location.href = 'admin.html';
                    } else if (!userData.photos || userData.photos.length < 5) {
                        window.location.href = 'upload-photos.html';
                    } else {
                        window.location.href = 'dashboard.html';
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
        }
        
    } else {
        console.log('No user logged in');
        currentUser = null;
        window.currentUser = null;
        
        // If not logged in and trying to access protected pages, redirect to index
        const protectedPages = ['dashboard.html', 'profile.html', 'browse.html', 'messages.html', 'admin.html', 'upload-photos.html'];
        const currentPage = window.location.pathname;
        
        const isProtectedPage = protectedPages.some(page => currentPage.includes(page));
        
        if (isProtectedPage) {
            window.location.href = 'index.html';
        }
    }
}

// Setup all event listeners
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Login Form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Registration Form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegistration);
    }
    
    // Logout buttons (if any)
    const logoutButtons = document.querySelectorAll('.logout-btn');
    logoutButtons.forEach(button => {
        button.addEventListener('click', handleLogout);
    });
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    console.log('Login attempt...');
    
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!username || !password) {
        showNotification('Please fill in all fields', 'error');
        return;
    }
    
    try {
        showNotification('Logging in...', 'info');
        
        // Use the custom email format
        const email = `${username}@nightvibe.com`;
        
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        console.log('Login successful:', userCredential.user.uid);
        
        showNotification('Welcome back!', 'success');
        
        // Ensure window.currentUser is set immediately and redirect to dashboard
        window.currentUser = userCredential.user;
        // Immediate redirect to dashboard after successful login
        window.location.href = 'dashboard.html';
        // Still call redirectAfterLogin as a safety net for profile-based routing (admin/upload), but it will usually not run because page navigates.
        redirectAfterLogin(userCredential.user.uid).catch(err => console.warn('Redirect after login failed:', err));
        
        // The auth state change listener will also run and keep state in sync
        
    } catch (error) {
        console.error('Login error:', error);
        let message = 'Login failed. ';
        
        switch (error.code) {
            case 'auth/user-not-found':
                message = 'User not found. Please check your username.';
                break;
            case 'auth/wrong-password':
                message = 'Incorrect password. Please try again.';
                break;
            case 'auth/too-many-requests':
                message = 'Too many failed attempts. Please try again later.';
                break;
            case 'auth/invalid-email':
                message = 'Invalid username format.';
                break;
            default:
                message += error.message;
        }
        
        showNotification(message, 'error');
        
        // Clear password field on error
        document.getElementById('loginPassword').value = '';
    }
}

// Redirect helper used after successful login
async function redirectAfterLogin(uid) {
    try {
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            // Decide destination
            if (userData.isAdmin) {
                window.location.href = 'admin.html';
                return;
            }
            if (!userData.photos || userData.photos.length < 5) {
                window.location.href = 'upload-photos.html';
                return;
            }
            window.location.href = 'dashboard.html';
            return;
        } else {
            // No user doc — send to upload flow to create profile
            window.location.href = 'upload-photos.html';
            return;
        }
    } catch (error) {
        console.error('Error in redirectAfterLogin:', error);
        // As a safe fallback go to dashboard
        window.location.href = 'dashboard.html';
    }
}


// Handle registration
async function handleRegistration(e) {
    e.preventDefault();
    console.log('Registration attempt...');
    
    // Get form values
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const realName = document.getElementById('realName').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const age = parseInt(document.getElementById('age').value);
    const position = document.getElementById('position').value;
    const iamInto = document.getElementById('iamInto').value.trim();
    const relationshipStatus = document.getElementById('relationshipStatus').value;
    
    // Validation
    if (!username || !password || !realName || !phone || !age || !position || !relationshipStatus) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    if (age < 18 || age > 65) {
        showNotification('Age must be between 18 and 65', 'error');
        return;
    }
    
    if (username.length < 3) {
        showNotification('Username must be at least 3 characters', 'error');
        return;
    }
    
    if (password.length < 6) {
        showNotification('Password must be at least 6 characters', 'error');
        return;
    }
    
    if (phone.length < 10) {
        showNotification('Please enter a valid phone number', 'error');
        return;
    }
    
    try {
        showNotification('Creating your account...', 'info');
        
        // Check if username already exists
        const usersRef = db.collection("users");
        const q = usersRef.where("username", "==", username);
        const querySnapshot = await q.get();
        
        if (!querySnapshot.empty) {
            showNotification('Username already exists. Please choose another.', 'error');
            return;
        }
        
        // Create user with email/password
        const email = `${username}@nightvibe.com`;
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        console.log('User created:', userCredential.user.uid);
        
        // Save user profile to Firestore
        await usersRef.doc(userCredential.user.uid).set({
            username: username,
            realName: realName,
            phone: phone,
            stats: {
                age: age,
                position: position,
                iamInto: iamInto,
                relationshipStatus: relationshipStatus
            },
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastActive: firebase.firestore.FieldValue.serverTimestamp(),
            isAdmin: false,
            photos: [],
            status: 'online',
            preferences: {
                showAge: true,
                showStatus: true,
                receiveMessages: true
            },
            profileComplete: false
        });
        
        showNotification('Account created successfully! Redirecting...', 'success');
        
        // Redirect to photo upload after delay
        setTimeout(() => {
            window.location.href = 'upload-photos.html';
        }, 2000);
        
    } catch (error) {
        console.error('Registration error:', error);
        
        let message = 'Registration failed. ';
        if (error.code === 'auth/email-already-in-use') {
            message = 'Username already exists. Please choose another.';
        } else if (error.code === 'auth/weak-password') {
            message = 'Password is too weak. Use at least 6 characters.';
        } else if (error.code === 'auth/invalid-email') {
            message = 'Invalid username format.';
        } else {
            message += error.message;
        }
        
        showNotification(message, 'error');
        
        // Clear password field on error
        document.getElementById('password').value = '';
    }
}

// Handle logout
async function handleLogout() {
    try {
        await auth.signOut();
        showNotification('Logged out successfully', 'success');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
    } catch (error) {
        console.error('Logout error:', error);
        showNotification('Logout failed', 'error');
    }
}

// Notification system
function showNotification(message, type = 'info') {
    console.log(`Notification [${type}]: ${message}`);
    
    // Remove existing notification
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icon = type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ';
    notification.innerHTML = `
        <span class="notification-icon">${icon}</span>
        <span class="notification-message">${message}</span>
        <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    document.body.appendChild(notification);
    
    // Add styles if not already present
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 8px;
                background: white;
                border-left: 4px solid #ddd;
                color: #333;
                display: flex;
                align-items: center;
                gap: 12px;
                z-index: 10000;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                max-width: 400px;
                animation: slideIn 0.3s ease;
                font-family: Arial, sans-serif;
            }
            
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            
            .notification.success {
                border-left-color: #4CAF50;
                background: #f0f9f0;
            }
            
            .notification.error {
                border-left-color: #f44336;
                background: #fdf2f2;
            }
            
            .notification.info {
                border-left-color: #2196F3;
                background: #f0f7ff;
            }
            
            .notification-icon {
                font-weight: bold;
                font-size: 18px;
            }
            
            .notification.success .notification-icon {
                color: #4CAF50;
            }
            
            .notification.error .notification-icon {
                color: #f44336;
            }
            
            .notification.info .notification-icon {
                color: #2196F3;
            }
            
            .notification-message {
                flex: 1;
                font-size: 14px;
            }
            
            .notification-close {
                background: none;
                border: none;
                color: #666;
                font-size: 20px;
                cursor: pointer;
                padding: 0;
                margin: 0;
                line-height: 1;
            }
            
            .notification-close:hover {
                color: #333;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

// Make functions globally available
window.logout = handleLogout;
window.showNotification = showNotification;