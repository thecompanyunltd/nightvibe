// admin.js - FIREBASE V8 VERSION

// Admin State
let currentAdminUser = null;
let allUsers = [];
let allMessages = [];
let allReports = [];
let currentPage = 1;
const usersPerPage = 20;

// Initialize admin panel
document.addEventListener('DOMContentLoaded', function() {
    console.log("Admin panel initializing...");
    
    // Wait for Firebase to be ready
    setTimeout(() => {
        if (typeof firebase === 'undefined' || !firebase.apps.length) {
            console.error("Firebase not loaded!");
            showNotification("Firebase not loaded", "error");
            return;
        }
        
        // Get current authenticated user
        const user = firebase.auth().currentUser;
        if (!user) {
            console.log("No authenticated user, redirecting to login");
            window.location.href = 'index.html';
            return;
        }
        
        console.log("Checking admin status for user:", user.uid);
        
        // Check if user is admin
        checkAdminStatus(user);
        
    }, 1500);
});

// Check if user is admin
async function checkAdminStatus(user) {
    try {
        const db = firebase.firestore();
        const userDoc = await db.collection("users").doc(user.uid).get();
        
        if (!userDoc.exists() || !userDoc.data().isAdmin) {
            showNotification('Access denied. Admin privileges required.', 'error');
            setTimeout(() => window.location.href = 'dashboard.html', 2000);
            return;
        }
        
        currentAdminUser = user;
        console.log("Admin user authenticated:", user.uid);
        await initializeAdminPanel();
        setupEventListeners();
        
    } catch (error) {
        console.error("Error checking admin status:", error);
        showNotification('Error accessing admin panel', 'error');
    }
}

// Initialize admin panel data
async function initializeAdminPanel() {
    try {
        showLoading(true);
        await Promise.all([
            loadAllUsers(),
            loadAllMessages(),
            loadAllReports()
        ]);
        updateAdminStats();
        showSection('users');
        showLoading(false);
    } catch (error) {
        console.error("Error initializing admin panel:", error);
        showNotification('Failed to initialize admin panel', 'error');
        showLoading(false);
    }
}

// Show loading indicator
function showLoading(show) {
    const loading = document.getElementById('adminLoading');
    if (!loading) {
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'adminLoading';
        loadingDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            color: white;
            font-size: 20px;
        `;
        loadingDiv.innerHTML = `
            <div style="text-align: center;">
                <i class="fas fa-spinner fa-spin fa-3x"></i>
                <p>Loading admin panel...</p>
            </div>
        `;
        document.body.appendChild(loadingDiv);
    }
    document.getElementById('adminLoading').style.display = show ? 'flex' : 'none';
}

// Load all users
async function loadAllUsers() {
    try {
        const db = firebase.firestore();
        const querySnapshot = await db.collection("users").get();
        
        allUsers = [];
        querySnapshot.forEach(doc => {
            const data = doc.data();
            allUsers.push({
                id: doc.id,
                ...data,
                // Handle both field name variations
                senderId: data.senderId || data.senderrId,
                receiverId: data.receiverId || data.receiverrId,
                senderName: data.senderName || data.senderrName
            });
        });
        
        // Sort by join date
        allUsers.sort((a, b) => {
            const dateA = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt)) : new Date(0);
            const dateB = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt)) : new Date(0);
            return dateB - dateA;
        });
        
        displayUsers();
        updateUserStats();
        
    } catch (error) {
        console.error('Error loading users:', error);
        showNotification('Failed to load users', 'error');
    }
}

// Display users in table
function displayUsers() {
    const tableBody = document.getElementById('usersTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    // Apply filters
    const searchTerm = document.getElementById('userSearch')?.value.toLowerCase() || '';
    const filter = document.getElementById('userFilter')?.value || 'all';
    
    let filteredUsers = allUsers.filter(user => {
        // Search filter
        const matchesSearch = !searchTerm || 
            (user.username && user.username.toLowerCase().includes(searchTerm)) ||
            (user.realName && user.realName.toLowerCase().includes(searchTerm)) ||
            (user.phone && user.phone.includes(searchTerm)) ||
            user.id.toLowerCase().includes(searchTerm);
        
        // Type filter
        let matchesFilter = true;
        switch (filter) {
            case 'admin':
                matchesFilter = user.isAdmin === true;
                break;
            case 'active':
                const lastActive = user.lastActive ? (user.lastActive.toDate ? user.lastActive.toDate() : new Date(user.lastActive)) : null;
                const today = new Date();
                matchesFilter = lastActive && lastActive.toDateString() === today.toDateString();
                break;
            case 'inactive':
                const lastActiveDate = user.lastActive ? (user.lastActive.toDate ? user.lastActive.toDate() : new Date(user.lastActive)) : null;
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                matchesFilter = !lastActiveDate || lastActiveDate < thirtyDaysAgo;
                break;
            case 'reported':
                matchesFilter = user.reportedCount > 0;
                break;
            case 'blocked':
                matchesFilter = user.isBlocked === true;
                break;
        }
        
        return matchesSearch && matchesFilter;
    });
    
    // Pagination
    const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
    const startIndex = (currentPage - 1) * usersPerPage;
    const endIndex = startIndex + usersPerPage;
    const pageUsers = filteredUsers.slice(startIndex, endIndex);
    
    // Display users
    if (pageUsers.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" class="no-data">No users found</td>
            </tr>
        `;
    } else {
        pageUsers.forEach(user => {
            const row = document.createElement('tr');
            
            // Format join date
            const joinDate = user.createdAt ? (user.createdAt.toDate ? user.createdAt.toDate() : new Date(user.createdAt)) : null;
            const formattedDate = joinDate ? joinDate.toLocaleDateString() : 'N/A';
            
            // Format photos count
            const photosCount = user.photos ? user.photos.length : 0;
            const photosBadge = photosCount >= 5 ? 
                `<span class="badge success">${photosCount}/5</span>` :
                `<span class="badge warning">${photosCount}/5</span>`;
            
            // Status badge
            let statusBadge;
            if (user.isBlocked) {
                statusBadge = `<span class="badge danger">Blocked</span>`;
            } else if (user.isAdmin) {
                statusBadge = `<span class="badge primary">Admin</span>`;
            } else if (user.status === 'online') {
                statusBadge = `<span class="badge success">Online</span>`;
            } else {
                statusBadge = `<span class="badge secondary">Offline</span>`;
            }
            
            row.innerHTML = `
                <td><code title="${user.id}">${user.id.substring(0, 8)}...</code></td>
                <td>
                    <div class="user-cell">
                        <img src="${user.photos && user.photos[0] ? user.photos[0] : 'after-dark-banner.jpg'}" 
                             alt="${user.username || ''}" 
                             onerror="this.src='after-dark-banner.jpg'">
                        <span>${user.username || 'N/A'}</span>
                    </div>
                </td>
                <td>${user.realName || 'N/A'}</td>
                <td>${user.phone || 'N/A'}</td>
                <td>${user.stats && user.stats.age ? user.stats.age : 'N/A'}</td>
                <td>${statusBadge}</td>
                <td>${photosBadge}</td>
                <td>${formattedDate}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn view" onclick="viewUserDetails('${user.id}')" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="action-btn edit" onclick="editUser('${user.id}')" title="Edit User">
                            <i class="fas fa-edit"></i>
                        </button>
                        ${user.isBlocked ? 
                            `<button class="action-btn success" onclick="unblockUser('${user.id}')" title="Unblock User">
                                <i class="fas fa-unlock"></i>
                            </button>` :
                            `<button class="action-btn warning" onclick="blockUser('${user.id}')" title="Block User">
                                <i class="fas fa-ban"></i>
                            </button>`
                        }
                        ${!user.isAdmin ? 
                            `<button class="action-btn primary" onclick="makeAdmin('${user.id}')" title="Make Admin">
                                <i class="fas fa-shield-alt"></i>
                            </button>` : ''
                        }
                        <button class="action-btn danger" onclick="deleteUser('${user.id}')" title="Delete User">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
    }
    
    // Update pagination
    updatePagination(totalPages);
}

// Update pagination controls
function updatePagination(totalPages) {
    const pagination = document.getElementById('usersPagination');
    if (!pagination) return;
    
    pagination.innerHTML = '';
    
    if (totalPages <= 1) {
        pagination.innerHTML = '<div class="no-pagination">Showing all users</div>';
        return;
    }
    
    // Previous button
    const prevButton = document.createElement('button');
    prevButton.className = 'pagination-btn';
    prevButton.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevButton.disabled = currentPage === 1;
    prevButton.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            displayUsers();
        }
    };
    pagination.appendChild(prevButton);
    
    // Page numbers
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    // Adjust start page if we're near the end
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    // First page
    if (startPage > 1) {
        const firstButton = document.createElement('button');
        firstButton.className = 'pagination-btn';
        firstButton.textContent = '1';
        firstButton.onclick = () => {
            currentPage = 1;
            displayUsers();
        };
        pagination.appendChild(firstButton);
        
        if (startPage > 2) {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'pagination-ellipsis';
            ellipsis.textContent = '...';
            pagination.appendChild(ellipsis);
        }
    }
    
    // Page buttons
    for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement('button');
        pageButton.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
        pageButton.textContent = i;
        pageButton.onclick = () => {
            currentPage = i;
            displayUsers();
        };
        pagination.appendChild(pageButton);
    }
    
    // Last page
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'pagination-ellipsis';
            ellipsis.textContent = '...';
            pagination.appendChild(ellipsis);
        }
        
        const lastButton = document.createElement('button');
        lastButton.className = 'pagination-btn';
        lastButton.textContent = totalPages;
        lastButton.onclick = () => {
            currentPage = totalPages;
            displayUsers();
        };
        pagination.appendChild(lastButton);
    }
    
    // Next button
    const nextButton = document.createElement('button');
    nextButton.className = 'pagination-btn';
    nextButton.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextButton.disabled = currentPage === totalPages;
    nextButton.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            displayUsers();
        }
    };
    pagination.appendChild(nextButton);
}

// Filter users
function filterUsers() {
    currentPage = 1;
    displayUsers();
}

// View user details
async function viewUserDetails(userId) {
    try {
        const db = firebase.firestore();
        const userDoc = await db.collection("users").doc(userId).get();
        if (!userDoc.exists()) {
            showNotification('User not found', 'error');
            return;
        }
        
        const userData = userDoc.data();
        const detailContent = document.getElementById('userDetailContent');
        
        // Format dates
        const joinDate = userData.createdAt ? (userData.createdAt.toDate ? userData.createdAt.toDate() : new Date(userData.createdAt)) : null;
        const lastActive = userData.lastActive ? (userData.lastActive.toDate ? userData.lastActive.toDate() : new Date(userData.lastActive)) : null;
        
        // Get user's messages count
        const messagesRef = db.collection("messages");
        const sentQuery = messagesRef.where("senderId", "==", userId);
        const receivedQuery = messagesRef.where("receiverId", "==", userId);
        const [sentSnapshot, receivedSnapshot] = await Promise.all([
            sentQuery.get(),
            receivedQuery.get()
        ]);
        const totalMessages = sentSnapshot.size + receivedSnapshot.size;
        
        // Get photos
        const photos = userData.photos || [];
        
        detailContent.innerHTML = `
            <div class="user-detail-header">
                <div class="user-avatar-large">
                    <img src="${photos[0] || 'after-dark-banner.jpg'}" 
                         alt="${userData.username || ''}"
                         onerror="this.src='after-dark-banner.jpg'">
                    <span class="user-status ${userData.status === 'online' ? 'online' : 'offline'}">
                        ${userData.status === 'online' ? 'Online' : 'Offline'}
                    </span>
                </div>
                <div class="user-header-info">
                    <h2>${userData.username || 'Unknown User'}</h2>
                    <div class="user-badges">
                        ${userData.isAdmin ? '<span class="badge primary">Administrator</span>' : ''}
                        ${userData.isBlocked ? '<span class="badge danger">Blocked</span>' : ''}
                        ${userData.reportedCount > 0 ? `<span class="badge warning">Reported (${userData.reportedCount})</span>` : ''}
                    </div>
                </div>
            </div>
            
            <div class="user-detail-grid">
                <div class="detail-section">
                    <h3>Basic Information</h3>
                    <div class="detail-item">
                        <span class="detail-label">User ID:</span>
                        <span class="detail-value"><code>${userId}</code></span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Real Name:</span>
                        <span class="detail-value">${userData.realName || 'Not provided'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Phone:</span>
                        <span class="detail-value">${userData.phone || 'Not provided'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Profile Complete:</span>
                        <span class="detail-value">
                            ${userData.profileComplete ? 
                                '<span class="badge success">Complete</span>' : 
                                '<span class="badge warning">Incomplete</span>'}
                        </span>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h3>Profile Information</h3>
                    <div class="detail-item">
                        <span class="detail-label">Age:</span>
                        <span class="detail-value">${userData.stats && userData.stats.age ? userData.stats.age : 'Not provided'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Position:</span>
                        <span class="detail-value">${userData.stats && userData.stats.position ? userData.stats.position : 'Not provided'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Looking for:</span>
                        <span class="detail-value">${userData.stats && userData.stats.iamInto ? userData.stats.iamInto : 'Not provided'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Relationship Status:</span>
                        <span class="detail-value">${userData.stats && userData.stats.relationshipStatus ? userData.stats.relationshipStatus : 'Not provided'}</span>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h3>Activity</h3>
                    <div class="detail-item">
                        <span class="detail-label">Joined:</span>
                        <span class="detail-value">${joinDate ? joinDate.toLocaleString() : 'Unknown'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Last Active:</span>
                        <span class="detail-value">${lastActive ? lastActive.toLocaleString() : 'Never'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Total Messages:</span>
                        <span class="detail-value">${totalMessages}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Photos Uploaded:</span>
                        <span class="detail-value">${photos.length}/5</span>
                    </div>
                </div>
                
                ${photos.length > 0 ? `
                <div class="detail-section full-width">
                    <h3>Photos</h3>
                    <div class="user-photos-grid">
                        ${photos.map((photo, index) => `
                            <div class="user-photo">
                                <img src="${photo}" alt="User photo ${index + 1}" 
                                     onerror="this.src='after-dark-banner.jpg'">
                                <span class="photo-number">${index + 1}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
                
                <div class="detail-section full-width">
                    <h3>User Statistics</h3>
                    <div class="user-stats-grid">
                        <div class="stat-box">
                            <span class="stat-label">Profile Views</span>
                            <span class="stat-value">${userData.profileViews || 0}</span>
                        </div>
                        <div class="stat-box">
                            <span class="stat-label">Likes Received</span>
                            <span class="stat-value">${userData.likes || 0}</span>
                        </div>
                        <div class="stat-box">
                            <span class="stat-label">Messages Sent</span>
                            <span class="stat-value">${sentSnapshot.size}</span>
                        </div>
                        <div class="stat-box">
                            <span class="stat-label">Messages Received</span>
                            <span class="stat-value">${receivedSnapshot.size}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('userDetailModal').style.display = 'block';
        
    } catch (error) {
        console.error('Error loading user details:', error);
        showNotification('Failed to load user details', 'error');
    }
}

// Close user modal
function closeUserModal() {
    document.getElementById('userDetailModal').style.display = 'none';
}

// Edit user
async function editUser(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) {
        showNotification('User not found', 'error');
        return;
    }
    
    const newUsername = prompt('Edit username:', user.username || '');
    if (newUsername === null || newUsername.trim() === '') return;
    
    try {
        const db = firebase.firestore();
        await db.collection("users").doc(userId).update({
            username: newUsername.trim()
        });
        
        showNotification('Username updated', 'success');
        await loadAllUsers();
        
    } catch (error) {
        console.error('Error updating user:', error);
        showNotification('Failed to update user', 'error');
    }
}

// Block user
async function blockUser(userId) {
    if (!confirm('Are you sure you want to block this user?\n\nThey will not be able to:\n• Send messages\n• View profiles\n• Use chat features')) return;
    
    try {
        const db = firebase.firestore();
        await db.collection("users").doc(userId).update({
            isBlocked: true,
            blockedAt: firebase.firestore.FieldValue.serverTimestamp(),
            blockedBy: currentAdminUser.uid,
            status: 'offline'
        });
        
        showNotification('User blocked successfully', 'success');
        await loadAllUsers();
        
    } catch (error) {
        console.error('Error blocking user:', error);
        showNotification('Failed to block user', 'error');
    }
}

// Unblock user
async function unblockUser(userId) {
    if (!confirm('Are you sure you want to unblock this user?')) return;
    
    try {
        const db = firebase.firestore();
        await db.collection("users").doc(userId).update({
            isBlocked: false,
            unblockedAt: firebase.firestore.FieldValue.serverTimestamp(),
            unblockedBy: currentAdminUser.uid
        });
        
        showNotification('User unblocked successfully', 'success');
        await loadAllUsers();
        
    } catch (error) {
        console.error('Error unblocking user:', error);
        showNotification('Failed to unblock user', 'error');
    }
}

// Make user admin
async function makeAdmin(userId) {
    if (!confirm('Are you sure you want to make this user an administrator?\n\nThey will have full access to the admin panel.')) return;
    
    try {
        const db = firebase.firestore();
        await db.collection("users").doc(userId).update({
            isAdmin: true,
            adminSince: firebase.firestore.FieldValue.serverTimestamp(),
            adminGrantedBy: currentAdminUser.uid
        });
        
        showNotification('User promoted to administrator', 'success');
        await loadAllUsers();
        
    } catch (error) {
        console.error('Error making user admin:', error);
        showNotification('Failed to promote user', 'error');
    }
}

// Delete user
async function deleteUser(userId) {
    if (!confirm('WARNING: This will permanently delete the user and all their data. This cannot be undone.\n\nType "DELETE" to confirm:')) {
        return;
    }
    
    try {
        showNotification('Deleting user...', 'info');
        const db = firebase.firestore();
        
        // Delete user document
        await db.collection("users").doc(userId).delete();
        
        // Delete user's messages
        const messagesRef = db.collection("messages");
        
        // Delete sent messages
        const sentQuery = messagesRef.where("senderId", "==", userId);
        const sentSnapshot = await sentQuery.get();
        
        let batch = db.batch();
        let count = 0;
        sentSnapshot.forEach(doc => {
            batch.delete(doc.ref);
            count++;
            if (count === 500) {
                batch.commit();
                batch = db.batch();
                count = 0;
            }
        });
        if (count > 0) await batch.commit();
        
        // Delete received messages
        const receivedQuery = messagesRef.where("receiverId", "==", userId);
        const receivedSnapshot = await receivedQuery.get();
        
        batch = db.batch();
        count = 0;
        receivedSnapshot.forEach(doc => {
            batch.delete(doc.ref);
            count++;
            if (count === 500) {
                batch.commit();
                batch = db.batch();
                count = 0;
            }
        });
        if (count > 0) await batch.commit();
        
        showNotification('User deleted successfully', 'success');
        await loadAllUsers();
        
    } catch (error) {
        console.error('Error deleting user:', error);
        showNotification('Failed to delete user', 'error');
    }
}

// Load all messages
async function loadAllMessages() {
    try {
        const db = firebase.firestore();
        const querySnapshot = await db.collection("messages").get();
        
        allMessages = [];
        querySnapshot.forEach(doc => {
            const data = doc.data();
            allMessages.push({
                id: doc.id,
                ...data,
                // Handle field name variations
                senderId: data.senderId || data.senderrId,
                receiverId: data.receiverId || data.receiverrId,
                senderName: data.senderName || data.senderrName,
                content: data.content || data.message || 'No content'
            });
        });
        
        // Sort by timestamp (newest first)
        allMessages.sort((a, b) => {
            const dateA = a.timestamp ? (a.timestamp.toDate ? a.timestamp.toDate() : new Date(a.timestamp)) : new Date(0);
            const dateB = b.timestamp ? (b.timestamp.toDate ? b.timestamp.toDate() : new Date(b.timestamp)) : new Date(0);
            return dateB - dateA;
        });
        
        displayMessages();
        updateMessageStats();
        
    } catch (error) {
        console.error('Error loading messages:', error);
        showNotification('Failed to load messages', 'error');
    }
}

// Display messages
function displayMessages() {
    const container = document.getElementById('messagesListAdmin');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Apply filters
    const searchTerm = document.getElementById('messageSearchAdmin')?.value.toLowerCase() || '';
    const filter = document.getElementById('messageFilterAdmin')?.value || 'all';
    
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const filteredMessages = allMessages.filter(message => {
        // Search filter
        const matchesSearch = !searchTerm || 
            message.content.toLowerCase().includes(searchTerm);
        
        // Time/type filter
        const messageDate = message.timestamp ? (message.timestamp.toDate ? message.timestamp.toDate() : new Date(message.timestamp)) : null;
        let matchesFilter = true;
        
        switch (filter) {
            case 'today':
                matchesFilter = messageDate && messageDate.toDateString() === today.toDateString();
                break;
            case 'week':
                matchesFilter = messageDate && messageDate >= weekAgo;
                break;
            case 'month':
                matchesFilter = messageDate && messageDate >= monthAgo;
                break;
            case 'anonymous':
                matchesFilter = message.isAnonymous === true;
                break;
            case 'reported':
                matchesFilter = message.reported === true;
                break;
        }
        
        return matchesSearch && matchesFilter;
    });
    
    // Limit to 50 messages for performance
    const displayMessages = filteredMessages.slice(0, 50);
    
    if (displayMessages.length === 0) {
        container.innerHTML = '<div class="no-data">No messages found</div>';
        return;
    }
    
    displayMessages.forEach(message => {
        const messageElement = document.createElement('div');
        messageElement.className = 'admin-message-item';
        
        const time = message.timestamp ? (message.timestamp.toDate ? message.timestamp.toDate().toLocaleString() : new Date(message.timestamp).toLocaleString()) : 'Unknown';
        const isAnonymous = message.isAnonymous;
        
        messageElement.innerHTML = `
            <div class="message-header">
                <div class="message-participants">
                    <div class="participant">
                        <i class="fas fa-user"></i>
                        <span>${isAnonymous ? 'Anonymous' : message.senderName || 'Unknown'}</span>
                    </div>
                    <i class="fas fa-arrow-right"></i>
                    <div class="participant">
                        <i class="fas fa-user"></i>
                        <span>Receiver (ID: ${message.receiverId ? message.receiverId.substring(0, 8) + '...' : 'Unknown'})</span>
                    </div>
                </div>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-content">
                <p>${message.content}</p>
            </div>
            <div class="message-footer">
                <span class="message-id">ID: ${message.id.substring(0, 8)}...</span>
                <div class="message-actions">
                    <button class="action-btn view" onclick="viewMessageDetails('${message.id}')">
                        <i class="fas fa-eye"></i> Details
                    </button>
                    <button class="action-btn danger" onclick="deleteMessage('${message.id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
        
        container.appendChild(messageElement);
    });
}

// View message details
async function viewMessageDetails(messageId) {
    try {
        const db = firebase.firestore();
        const messageDoc = await db.collection("messages").doc(messageId).get();
        if (!messageDoc.exists()) {
            showNotification('Message not found', 'error');
            return;
        }
        
        const messageData = messageDoc.data();
        const detailContent = document.getElementById('messageDetailContent');
        
        // Get sender and receiver info
        const [senderDoc, receiverDoc] = await Promise.all([
            db.collection("users").doc(messageData.senderId).get(),
            db.collection("users").doc(messageData.receiverId).get()
        ]);
        
        const senderData = senderDoc.exists() ? senderDoc.data() : null;
        const receiverData = receiverDoc.exists() ? receiverDoc.data() : null;
        
        const time = messageData.timestamp ? (messageData.timestamp.toDate ? messageData.timestamp.toDate().toLocaleString() : new Date(messageData.timestamp).toLocaleString()) : 'Unknown';
        
        detailContent.innerHTML = `
            <div class="message-detail-header">
                <h3>Message Details</h3>
                <span class="message-id">ID: ${messageId}</span>
            </div>
            
            <div class="message-detail-info">
                <div class="detail-item">
                    <span class="detail-label">Sent:</span>
                    <span class="detail-value">${time}</span>
                </div>
                
                <div class="detail-item">
                    <span class="detail-label">Sender:</span>
                    <div class="user-info">
                        <i class="fas fa-user-circle fa-2x"></i>
                        <div>
                            <span>${messageData.isAnonymous ? 'Anonymous' : senderData ? senderData.username : 'Unknown'}</span>
                            ${messageData.isAnonymous ? '<span class="badge warning">Anonymous</span>' : ''}
                            <br>
                            <small>ID: ${messageData.senderId}</small>
                        </div>
                    </div>
                </div>
                
                <div class="detail-item">
                    <span class="detail-label">Receiver:</span>
                    <div class="user-info">
                        <i class="fas fa-user-circle fa-2x"></i>
                        <div>
                            <span>${receiverData ? receiverData.username : 'Unknown'}</span>
                            <br>
                            <small>ID: ${messageData.receiverId}</small>
                        </div>
                    </div>
                </div>
                
                <div class="detail-item">
                    <span class="detail-label">Read Status:</span>
                    <span class="detail-value">
                        ${messageData.readBy && messageData.readBy.length > 0 ? 
                            'Read by user(s)' : 
                            '<span class="badge warning">Unread</span>'}
                    </span>
                </div>
                
                <div class="detail-item full-width">
                    <span class="detail-label">Message Content:</span>
                    <div class="message-content-box">
                        <p>${messageData.content || messageData.message || 'No content'}</p>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('messageDetailModal').style.display = 'block';
        
    } catch (error) {
        console.error('Error loading message details:', error);
        showNotification('Failed to load message details', 'error');
    }
}

// Close message modal
function closeMessageModal() {
    document.getElementById('messageDetailModal').style.display = 'none';
}

// Delete message
async function deleteMessage(messageId) {
    if (!confirm('Delete this message?')) return;
    
    try {
        const db = firebase.firestore();
        await db.collection("messages").doc(messageId).delete();
        showNotification('Message deleted', 'success');
        await loadAllMessages();
        
    } catch (error) {
        console.error('Error deleting message:', error);
        showNotification('Failed to delete message', 'error');
    }
}

// Delete all messages
async function deleteAllMessages() {
    if (!confirm('WARNING: This will delete ALL messages from the database.\n\nType "DELETE ALL" to confirm:')) {
        return;
    }
    
    try {
        showNotification('Deleting all messages...', 'info');
        const db = firebase.firestore();
        
        // Get all messages
        const querySnapshot = await db.collection("messages").get();
        
        // Delete in batches of 500
        let batch = db.batch();
        let count = 0;
        
        querySnapshot.forEach(doc => {
            batch.delete(doc.ref);
            count++;
            
            if (count === 500) {
                batch.commit();
                batch = db.batch();
                count = 0;
            }
        });
        
        if (count > 0) {
            await batch.commit();
        }
        
        showNotification('All messages deleted successfully', 'success');
        await loadAllMessages();
        
    } catch (error) {
        console.error('Error deleting all messages:', error);
        showNotification('Failed to delete messages', 'error');
    }
}

// Load all reports (stub)
async function loadAllReports() {
    try {
        const db = firebase.firestore();
        const querySnapshot = await db.collection("reports").get();
        
        allReports = [];
        querySnapshot.forEach(doc => {
            allReports.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        displayReports();
        updateReportStats();
        
    } catch (error) {
        console.error('Error loading reports:', error);
        // Don't show error if reports collection doesn't exist yet
        if (error.code !== 'failed-precondition') {
            showNotification('Failed to load reports', 'error');
        }
    }
}

// Display reports
function displayReports() {
    const container = document.getElementById('reportsList');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (allReports.length === 0) {
        container.innerHTML = '<div class="no-data">No reports found</div>';
        return;
    }
    
    allReports.forEach(report => {
        const reportElement = document.createElement('div');
        reportElement.className = `admin-report-item ${report.status || 'pending'}`;
        
        const time = report.timestamp ? (report.timestamp.toDate ? report.timestamp.toDate().toLocaleString() : new Date(report.timestamp).toLocaleString()) : 'Unknown';
        const statusClass = report.status === 'pending' ? 'warning' : 
                           report.status === 'resolved' ? 'success' : 
                           report.status === 'dismissed' ? 'secondary' : 'primary';
        
        reportElement.innerHTML = `
            <div class="report-header">
                <div class="report-users">
                    <div class="user-pair">
                        <div class="user">
                            <i class="fas fa-user"></i>
                            <span>Reporter: ${report.reporterId ? report.reporterId.substring(0, 8) + '...' : 'Unknown'}</span>
                        </div>
                        <i class="fas fa-flag"></i>
                        <div class="user">
                            <i class="fas fa-user"></i>
                            <span>Reported: ${report.reportedUserId ? report.reportedUserId.substring(0, 8) + '...' : 'Unknown'}</span>
                        </div>
                    </div>
                </div>
                <div class="report-meta">
                    <span class="report-time">${time}</span>
                    <span class="report-status ${statusClass}">${report.status || 'pending'}</span>
                </div>
            </div>
            <div class="report-body">
                <div class="report-reasons">
                    <strong>Reasons:</strong>
                    <div class="reason-tags">
                        ${report.reasons ? report.reasons.map(reason => `
                            <span class="reason-tag">${reason}</span>
                        `).join('') : 'No reasons specified'}
                    </div>
                </div>
                <div class="report-details">
                    <strong>Details:</strong>
                    <p>${report.details || 'No additional details'}</p>
                </div>
            </div>
            <div class="report-footer">
                <button class="action-btn view" onclick="viewReportDetails('${report.id}')">
                    <i class="fas fa-eye"></i> View Details
                </button>
                <button class="action-btn success" onclick="resolveReportFromList('${report.id}')">
                    <i class="fas fa-check"></i> Resolve
                </button>
                <button class="action-btn secondary" onclick="dismissReportFromList('${report.id}')">
                    <i class="fas fa-times"></i> Dismiss
                </button>
            </div>
        `;
        
        container.appendChild(reportElement);
    });
}

// Show different sections
function showSection(sectionName) {
    // Hide all sections
    const sections = ['users', 'messages', 'reports', 'analytics', 'settings'];
    sections.forEach(section => {
        const element = document.getElementById(`${section}Section`);
        if (element) element.style.display = 'none';
    });
    
    // Show selected section
    const selectedSection = document.getElementById(`${sectionName}Section`);
    if (selectedSection) {
        selectedSection.style.display = 'block';
    }
    
    // Refresh data for the section
    switch(sectionName) {
        case 'users':
            loadAllUsers();
            break;
        case 'messages':
            loadAllMessages();
            break;
        case 'reports':
            loadAllReports();
            break;
        case 'analytics':
            updateAnalyticsStats();
            break;
    }
}

// Update admin statistics
function updateAdminStats() {
    updateUserStats();
    updateMessageStats();
    updateReportStats();
    updateAnalyticsStats();
}

function updateUserStats() {
    const totalUsers = allUsers.length;
    const activeToday = allUsers.filter(user => {
        const lastActive = user.lastActive ? (user.lastActive.toDate ? user.lastActive.toDate() : new Date(user.lastActive)) : null;
        const today = new Date();
        return lastActive && lastActive.toDateString() === today.toDateString();
    }).length;
    
    const totalUsersElement = document.getElementById('totalUsers');
    const totalUsersCountElement = document.getElementById('totalUsersCount');
    const activeUsersCountElement = document.getElementById('activeUsersCount');
    
    if (totalUsersElement) totalUsersElement.textContent = totalUsers;
    if (totalUsersCountElement) totalUsersCountElement.textContent = totalUsers;
    if (activeUsersCountElement) activeUsersCountElement.textContent = activeToday;
}

function updateMessageStats() {
    const totalMessages = allMessages.length;
    const totalMessagesAdminElement = document.getElementById('totalMessagesAdmin');
    const totalMessagesCountElement = document.getElementById('totalMessagesCount');
    
    if (totalMessagesAdminElement) totalMessagesAdminElement.textContent = totalMessages;
    if (totalMessagesCountElement) totalMessagesCountElement.textContent = totalMessages;
}

function updateReportStats() {
    const totalReports = allReports.length;
    const pendingReports = allReports.filter(r => r.status === 'pending').length;
    
    const pendingReportsElement = document.getElementById('pendingReports');
    const totalReportsCountElement = document.getElementById('totalReportsCount');
    
    if (pendingReportsElement) pendingReportsElement.textContent = pendingReports;
    if (totalReportsCountElement) totalReportsCountElement.textContent = totalReports;
}

function updateAnalyticsStats() {
    // Calculate additional analytics
    const newUsersToday = allUsers.filter(user => {
        const joinDate = user.createdAt ? (user.createdAt.toDate ? user.createdAt.toDate() : new Date(user.createdAt)) : null;
        const today = new Date();
        return joinDate && joinDate.toDateString() === today.toDateString();
    }).length;
    
    const messagesToday = allMessages.filter(message => {
        const messageDate = message.timestamp ? (message.timestamp.toDate ? message.timestamp.toDate() : new Date(message.timestamp)) : null;
        const today = new Date();
        return messageDate && messageDate.toDateString() === today.toDateString();
    }).length;
    
    // Update charts if implemented
    updateCharts();
}

function updateCharts() {
    // Chart.js implementation would go here
    console.log('Charts would be updated here');
}

// Export data
async function exportData() {
    try {
        const exportData = {
            users: allUsers.map(user => ({
                id: user.id,
                username: user.username,
                realName: user.realName,
                phone: user.phone,
                stats: user.stats,
                createdAt: user.createdAt ? (user.createdAt.toDate ? user.createdAt.toDate().toISOString() : new Date(user.createdAt).toISOString()) : null,
                lastActive: user.lastActive ? (user.lastActive.toDate ? user.lastActive.toDate().toISOString() : new Date(user.lastActive).toISOString()) : null,
                isAdmin: user.isAdmin,
                isBlocked: user.isBlocked,
                status: user.status
            })),
            messages: allMessages.slice(0, 1000).map(msg => ({
                id: msg.id,
                senderId: msg.senderId,
                receiverId: msg.receiverId,
                content: msg.content,
                isAnonymous: msg.isAnonymous,
                timestamp: msg.timestamp ? (msg.timestamp.toDate ? msg.timestamp.toDate().toISOString() : new Date(msg.timestamp).toISOString()) : null,
                readBy: msg.readBy
            })),
            reports: allReports.map(report => ({
                id: report.id,
                reporterId: report.reporterId,
                reportedUserId: report.reportedUserId,
                reasons: report.reasons,
                details: report.details,
                status: report.status,
                timestamp: report.timestamp ? (report.timestamp.toDate ? report.timestamp.toDate().toISOString() : new Date(report.timestamp).toISOString()) : null
            })),
            exportDate: new Date().toISOString(),
            exportedBy: currentAdminUser.uid
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nightvibe-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification('Data exported successfully', 'success');
        
    } catch (error) {
        console.error('Error exporting data:', error);
        showNotification('Failed to export data', 'error');
    }
}

// Add new user
function addNewUser() {
    document.getElementById('addUserModal').style.display = 'block';
}

function closeAddUserModal() {
    document.getElementById('addUserModal').style.display = 'none';
    document.getElementById('addUserForm').reset();
}

async function createNewUser(e) {
    e.preventDefault();
    
    const username = document.getElementById('newUsername').value.trim();
    const email = document.getElementById('newEmail').value.trim();
    const password = document.getElementById('newPassword').value;
    const realName = document.getElementById('newRealName').value.trim();
    const phone = document.getElementById('newPhone').value.trim();
    const userType = document.getElementById('newUserType').value;
    
    if (!username || !email || !password || !realName || !phone) {
        showNotification('Please fill in all fields', 'error');
        return;
    }
    
    try {
        // Create user in Firebase Auth
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
        
        // Create user document in Firestore
        const db = firebase.firestore();
        await db.collection("users").doc(userCredential.user.uid).set({
            username: username,
            realName: realName,
            phone: phone,
            email: email,
            isAdmin: userType === 'admin',
            isModerator: userType === 'moderator',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastActive: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'offline',
            photos: [],
            profileComplete: false,
            isBlocked: false,
            stats: {
                age: 0,
                position: '',
                relationshipStatus: '',
                iamInto: ''
            },
            preferences: {
                showAge: true,
                showStatus: true,
                receiveMessages: true,
                showOnline: true
            }
        });
        
        showNotification('User created successfully', 'success');
        closeAddUserModal();
        await loadAllUsers();
        
    } catch (error) {
        console.error('Error creating user:', error);
        showNotification('Failed to create user: ' + error.message, 'error');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Add user form
    const addUserForm = document.getElementById('addUserForm');
    if (addUserForm) {
        addUserForm.addEventListener('submit', createNewUser);
    }
    
    // Message search
    const messageSearch = document.getElementById('messageSearchAdmin');
    if (messageSearch) {
        messageSearch.addEventListener('input', displayMessages);
    }
    
    const messageFilter = document.getElementById('messageFilterAdmin');
    if (messageFilter) {
        messageFilter.addEventListener('change', displayMessages);
    }
    
    // User search
    const userSearch = document.getElementById('userSearch');
    if (userSearch) {
        userSearch.addEventListener('input', filterUsers);
    }
    
    const userFilter = document.getElementById('userFilter');
    if (userFilter) {
        userFilter.addEventListener('change', filterUsers);
    }
    
    // Admin search
    const adminSearch = document.getElementById('adminSearch');
    if (adminSearch) {
        adminSearch.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            if (term.length > 2) {
                // Simple search across users for now
                document.getElementById('userSearch').value = term;
                filterUsers();
                showSection('users');
            }
        });
    }
    
    // Close modals when clicking outside
    window.onclick = function(event) {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (event.target == modal) {
                modal.style.display = 'none';
            }
        });
    };
}

// Refresh users
function refreshUsers() {
    loadAllUsers();
    showNotification('Refreshing users...', 'info');
}

// Refresh analytics
function refreshAnalytics() {
    updateAnalyticsStats();
    showNotification('Analytics refreshed', 'info');
}

// Save settings
async function saveSettings() {
    try {
        // Collect settings from form
        const settings = {
            maintenanceMode: document.getElementById('maintenanceMode').checked,
            maintenanceMessage: document.getElementById('maintenanceMessage').value,
            allowRegistrations: document.getElementById('allowRegistrations').checked,
            requireEmailVerification: document.getElementById('requireEmailVerification').checked,
            requirePhoneVerification: document.getElementById('requirePhoneVerification').checked,
            autoFilterContent: document.getElementById('autoFilterContent').checked,
            scanPhotos: document.getElementById('scanPhotos').checked,
            monitorMessages: document.getElementById('monitorMessages').checked,
            sessionTimeout: parseInt(document.getElementById('sessionTimeout').value) || 60,
            maxLoginAttempts: parseInt(document.getElementById('maxLoginAttempts').value) || 5,
            passwordResetTimeout: parseInt(document.getElementById('passwordResetTimeout').value) || 24,
            sendWelcomeEmails: document.getElementById('sendWelcomeEmails').checked,
            sendReportNotifications: document.getElementById('sendReportNotifications').checked,
            sendSystemAlerts: document.getElementById('sendSystemAlerts').checked,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: currentAdminUser.uid
        };
        
        // Save to Firestore
        const db = firebase.firestore();
        await db.collection("admin").doc("settings").set(settings, { merge: true });
        
        showNotification('Settings saved successfully', 'success');
        
    } catch (error) {
        console.error('Error saving settings:', error);
        showNotification('Failed to save settings', 'error');
    }
}

// Logout
async function logout() {
    try {
        await firebase.auth().signOut();
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error signing out:', error);
        showNotification('Error signing out', 'error');
    }
}

// Toggle sidebar
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.classList.toggle('active');
}

// Show notification
function showNotification(message, type = 'info') {
    console.log(`[${type}] ${message}`);
    
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.admin-notification');
    existingNotifications.forEach(n => n.remove());
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `admin-notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
        <button class="close-notification" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 10px;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }, 5000);
}

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .admin-notification .close-notification {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        opacity: 0.7;
        transition: opacity 0.2s;
    }
    
    .admin-notification .close-notification:hover {
        opacity: 1;
    }
`;
document.head.appendChild(style);

// Make functions available globally
window.showSection = showSection;
window.viewUserDetails = viewUserDetails;
window.closeUserModal = closeUserModal;
window.editUser = editUser;
window.blockUser = blockUser;
window.unblockUser = unblockUser;
window.makeAdmin = makeAdmin;
window.deleteUser = deleteUser;
window.viewMessageDetails = viewMessageDetails;
window.closeMessageModal = closeMessageModal;
window.deleteMessage = deleteMessage;
window.deleteAllMessages = deleteAllMessages;
window.refreshUsers = refreshUsers;
window.refreshAnalytics = refreshAnalytics;
window.exportData = exportData;
window.clearAllData = deleteAllMessages; // Alias for now
window.addNewUser = addNewUser;
window.closeAddUserModal = closeAddUserModal;
window.saveSettings = saveSettings;
window.toggleSidebar = toggleSidebar;
window.logout = logout;

// Initialize
console.log("Admin JS loaded successfully");