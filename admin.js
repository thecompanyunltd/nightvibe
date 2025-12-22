import { auth, db } from './firebase-config.js';
import { doc, getDoc, collection, getDocs, query, where, updateDoc, deleteDoc, writeBatch, serverTimestamp, arrayUnion } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
// Admin State
let currentAdminUser = null;
let allUsers = [];
let allMessages = [];
let allReports = [];
let currentPage = 1;
const usersPerPage = 20;

// Initialize admin panel
document.addEventListener('DOMContentLoaded', async () => {
    if (!auth.currentUser) {
        window.location.href = 'index.html';
        return;
    }
    
    // Check if user is admin
    const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
    if (!userDoc.exists() || !userDoc.data().isAdmin) {
        showNotification('Access denied. Admin privileges required.', 'error');
        window.location.href = 'dashboard.html';
        return;
    }
    
    currentAdminUser = auth.currentUser;
    await initializeAdminPanel();
    setupEventListeners();
});

// Initialize admin panel data
async function initializeAdminPanel() {
    await loadAllUsers();
    await loadAllMessages();
    await loadAllReports();
    updateAdminStats();
    showSection('users');
}

// Load all users
async function loadAllUsers() {
    try {
        const usersRef = collection(db, "users");
        const querySnapshot = await getDocs(usersRef);
        
        allUsers = [];
        querySnapshot.forEach(doc => {
            allUsers.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Sort by join date
        allUsers.sort((a, b) => b.createdAt?.toDate() - a.createdAt?.toDate());
        
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
    tableBody.innerHTML = '';
    
    // Apply filters
    const searchTerm = document.getElementById('userSearch')?.value.toLowerCase() || '';
    const filter = document.getElementById('userFilter')?.value || 'all';
    
    let filteredUsers = allUsers.filter(user => {
        // Search filter
        const matchesSearch = !searchTerm || 
            user.username?.toLowerCase().includes(searchTerm) ||
            user.realName?.toLowerCase().includes(searchTerm) ||
            user.phone?.includes(searchTerm);
        
        // Type filter
        let matchesFilter = true;
        switch (filter) {
            case 'admin':
                matchesFilter = user.isAdmin === true;
                break;
            case 'active':
                const lastActive = user.lastActive?.toDate();
                const today = new Date();
                matchesFilter = lastActive && 
                    lastActive.toDateString() === today.toDateString();
                break;
            case 'inactive':
                const lastActiveDate = user.lastActive?.toDate();
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
    pageUsers.forEach(user => {
        const row = document.createElement('tr');
        
        // Format join date
        const joinDate = user.createdAt?.toDate();
        const formattedDate = joinDate ? joinDate.toLocaleDateString() : 'N/A';
        
        // Format photos count
        const photosCount = user.photos?.length || 0;
        const photosBadge = photosCount >= 5 ? 
            `<span class="badge success">${photosCount}/5</span>` :
            `<span class="badge warning">${photosCount}/5</span>`;
        
        // Status badge
        const statusBadge = user.isBlocked ? 
            `<span class="badge danger">Blocked</span>` :
            user.isAdmin ? 
            `<span class="badge primary">Admin</span>` :
            `<span class="badge success">Active</span>`;
        
        row.innerHTML = `
            <td><code>${user.id.substring(0, 8)}...</code></td>
            <td>
                <div class="user-cell">
                    <img src="${user.photos?.[0] || 'https://via.placeholder.com/30'}" alt="${user.username}">
                    <span>${user.username || 'N/A'}</span>
                </div>
            </td>
            <td>${user.realName || 'N/A'}</td>
            <td>${user.phone || 'N/A'}</td>
            <td>${user.stats?.age || 'N/A'}</td>
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
    
    // Update pagination
    updatePagination(totalPages);
}

// Update pagination controls
function updatePagination(totalPages) {
    const pagination = document.getElementById('usersPagination');
    pagination.innerHTML = '';
    
    if (totalPages <= 1) return;
    
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
    for (let i = 1; i <= totalPages; i++) {
        const pageButton = document.createElement('button');
        pageButton.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
        pageButton.textContent = i;
        pageButton.onclick = () => {
            currentPage = i;
            displayUsers();
        };
        
        // Show first, last, and around current page
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            pagination.appendChild(pageButton);
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'pagination-ellipsis';
            ellipsis.textContent = '...';
            pagination.appendChild(ellipsis);
        }
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
        const userDoc = await getDoc(doc(db, "users", userId));
        if (!userDoc.exists()) {
            showNotification('User not found', 'error');
            return;
        }
        
        const userData = userDoc.data();
        const detailContent = document.getElementById('userDetailContent');
        
        // Format dates
        const joinDate = userData.createdAt?.toDate();
        const lastActive = userData.lastActive?.toDate();
        
        // Get user's messages count
        const messagesRef = collection(db, "messages");
        const messagesQuery = query(messagesRef, where("participants", "array-contains", userId));
        const messagesSnapshot = await getDocs(messagesQuery);
        const messagesCount = messagesSnapshot.size;
        
        detailContent.innerHTML = `
            <div class="user-detail-header">
                <div class="user-avatar-large">
                    <img src="${userData.photos?.[0] || 'https://via.placeholder.com/100'}" alt="${userData.username}">
                    <span class="user-status ${userData.status === 'online' ? 'online' : 'offline'}">
                        ${userData.status === 'online' ? 'Online' : 'Offline'}
                    </span>
                </div>
                <div class="user-header-info">
                    <h2>${userData.username}</h2>
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
                        <span class="detail-label">Real Name:</span>
                        <span class="detail-value">${userData.realName || 'Not provided'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Phone:</span>
                        <span class="detail-value">${userData.phone || 'Not provided'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Email:</span>
                        <span class="detail-value">${userId}@nightvibe.com</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">User ID:</span>
                        <span class="detail-value"><code>${userId}</code></span>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h3>Profile Information</h3>
                    <div class="detail-item">
                        <span class="detail-label">Age:</span>
                        <span class="detail-value">${userData.stats?.age || 'Not provided'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Position:</span>
                        <span class="detail-value">${userData.stats?.position || 'Not provided'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Relationship Status:</span>
                        <span class="detail-value">${userData.stats?.relationshipStatus || 'Not provided'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Interests:</span>
                        <span class="detail-value">${userData.stats?.iamInto || 'Not provided'}</span>
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
                        <span class="detail-value">${messagesCount}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Photos Uploaded:</span>
                        <span class="detail-value">${userData.photos?.length || 0}/5</span>
                    </div>
                </div>
                
                <div class="detail-section full-width">
                    <h3>Photos</h3>
                    <div class="user-photos-grid">
                        ${userData.photos?.map(photo => `
                            <div class="user-photo">
                                <img src="${photo}" alt="User photo">
                            </div>
                        `).join('') || '<p class="no-data">No photos uploaded</p>'}
                    </div>
                </div>
                
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
                            <span class="stat-value">${userData.messagesSent || 0}</span>
                        </div>
                        <div class="stat-box">
                            <span class="stat-label">Reports Made</span>
                            <span class="stat-value">${userData.reportsMade || 0}</span>
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
function editUser(userId) {
    // Find user
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    
    // For now, just show details
    viewUserDetails(userId);
}

// Block user
async function blockUser(userId) {
    if (!confirm('Are you sure you want to block this user?')) return;
    
    try {
        await updateDoc(doc(db, "users", userId), {
            isBlocked: true,
            blockedAt: serverTimestamp(),
            blockedBy: currentAdminUser.uid
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
        await updateDoc(doc(db, "users", userId), {
            isBlocked: false,
            unblockedAt: serverTimestamp(),
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
    if (!confirm('Are you sure you want to make this user an administrator?')) return;
    
    try {
        await updateDoc(doc(db, "users", userId), {
            isAdmin: true,
            adminSince: serverTimestamp(),
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
    if (!confirm('WARNING: This will permanently delete the user and all their data. This cannot be undone. Continue?')) return;
    
    const confirmation = prompt('Type "DELETE USER" to confirm:');
    if (confirmation !== 'DELETE USER') {
        showNotification('User deletion cancelled', 'info');
        return;
    }
    
    try {
        // Delete user from Firestore
        await deleteDoc(doc(db, "users", userId));
        
        // Delete user's messages
        const messagesRef = collection(db, "messages");
        const messagesQuery = query(messagesRef, where("participants", "array-contains", userId));
        const messagesSnapshot = await getDocs(messagesQuery);
        
        const batch = writeBatch(db);
        messagesSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        
        // Delete user's photos from storage (optional)
        // This would require listing and deleting files from storage
        
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
        const messagesRef = collection(db, "messages");
        const querySnapshot = await getDocs(messagesRef);
        
        allMessages = [];
        querySnapshot.forEach(doc => {
            allMessages.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Sort by timestamp
        allMessages.sort((a, b) => b.timestamp?.toDate() - a.timestamp?.toDate());
        
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
            message.content?.toLowerCase().includes(searchTerm);
        
        // Time filter
        const messageDate = message.timestamp?.toDate();
        let matchesTime = true;
        
        switch (filter) {
            case 'today':
                matchesTime = messageDate && messageDate.toDateString() === today.toDateString();
                break;
            case 'week':
                matchesTime = messageDate && messageDate >= weekAgo;
                break;
            case 'month':
                matchesTime = messageDate && messageDate >= monthAgo;
                break;
            case 'anonymous':
                matchesTime = message.isAnonymous === true;
                break;
            case 'reported':
                matchesTime = message.reported === true;
                break;
        }
        
        return matchesSearch && matchesTime;
    });
    
    // Limit to 100 messages for performance
    const displayMessages = filteredMessages.slice(0, 100);
    
    if (displayMessages.length === 0) {
        container.innerHTML = '<div class="no-data">No messages found</div>';
        return;
    }
    
    displayMessages.forEach(async message => {
        try {
            // Get sender and receiver info
            const [senderDoc, receiverDoc] = await Promise.all([
                getDoc(doc(db, "users", message.senderId)),
                getDoc(doc(db, "users", message.receiverId))
            ]);
            
            const senderData = senderDoc.exists() ? senderDoc.data() : null;
            const receiverData = receiverDoc.exists() ? receiverDoc.data() : null;
            
            const messageElement = document.createElement('div');
            messageElement.className = 'admin-message-item';
            
            const time = message.timestamp?.toDate().toLocaleString() || 'Unknown';
            const isAnonymous = message.isAnonymous;
            
            messageElement.innerHTML = `
                <div class="message-header">
                    <div class="message-participants">
                        <div class="participant">
                            <img src="${senderData?.photos?.[0] || 'https://via.placeholder.com/20'}" alt="Sender">
                            <span>${isAnonymous ? 'Anonymous' : senderData?.username || 'Unknown'}</span>
                        </div>
                        <i class="fas fa-arrow-right"></i>
                        <div class="participant">
                            <img src="${receiverData?.photos?.[0] || 'https://via.placeholder.com/20'}" alt="Receiver">
                            <span>${receiverData?.username || 'Unknown'}</span>
                        </div>
                    </div>
                    <span class="message-time">${time}</span>
                </div>
                <div class="message-content">
                    <p>${message.content || 'No content'}</p>
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
            
        } catch (error) {
            console.error('Error loading message details:', error);
        }
    });
}

// View message details
async function viewMessageDetails(messageId) {
    try {
        const messageDoc = await getDoc(doc(db, "messages", messageId));
        if (!messageDoc.exists()) {
            showNotification('Message not found', 'error');
            return;
        }
        
        const messageData = messageDoc.data();
        
        // Get sender and receiver info
        const [senderDoc, receiverDoc] = await Promise.all([
            getDoc(doc(db, "users", messageData.senderId)),
            getDoc(doc(db, "users", messageData.receiverId))
        ]);
        
        const senderData = senderDoc.exists() ? senderDoc.data() : null;
        const receiverData = receiverDoc.exists() ? receiverDoc.data() : null;
        
        const detailContent = document.getElementById('messageDetailContent');
        const time = messageData.timestamp?.toDate().toLocaleString() || 'Unknown';
        
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
                        <img src="${senderData?.photos?.[0] || 'https://via.placeholder.com/30'}" alt="Sender">
                        <div>
                            <span>${messageData.isAnonymous ? 'Anonymous' : senderData?.username || 'Unknown'}</span>
                            ${messageData.isAnonymous ? '<span class="badge warning">Anonymous</span>' : ''}
                            <br>
                            <small>ID: ${messageData.senderId}</small>
                        </div>
                    </div>
                </div>
                
                <div class="detail-item">
                    <span class="detail-label">Receiver:</span>
                    <div class="user-info">
                        <img src="${receiverData?.photos?.[0] || 'https://via.placeholder.com/30'}" alt="Receiver">
                        <div>
                            <span>${receiverData?.username || 'Unknown'}</span>
                            <br>
                            <small>ID: ${messageData.receiverId}</small>
                        </div>
                    </div>
                </div>
                
                <div class="detail-item">
                    <span class="detail-label">Read By:</span>
                    <span class="detail-value">
                        ${messageData.readBy?.join(', ') || 'Not read yet'}
                    </span>
                </div>
                
                <div class="detail-item full-width">
                    <span class="detail-label">Message Content:</span>
                    <div class="message-content-box">
                        <p>${messageData.content || 'No content'}</p>
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
        await deleteDoc(doc(db, "messages", messageId));
        showNotification('Message deleted', 'success');
        await loadAllMessages();
        
    } catch (error) {
        console.error('Error deleting message:', error);
        showNotification('Failed to delete message', 'error');
    }
}

// Delete all messages
async function deleteAllMessages() {
    const confirmation = prompt('Type "DELETE ALL MESSAGES" to confirm:');
    if (confirmation !== 'DELETE ALL MESSAGES') {
        showNotification('Operation cancelled', 'info');
        return;
    }
    
    if (!confirm('WARNING: This will delete ALL messages from the database. This cannot be undone. Continue?')) return;
    
    try {
        showNotification('Deleting all messages...', 'info');
        
        // In a real app, you might want to do this in batches
        const messagesRef = collection(db, "messages");
        const querySnapshot = await getDocs(messagesRef);
        
        const batch = writeBatch(db);
        querySnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        
        showNotification('All messages deleted successfully', 'success');
        await loadAllMessages();
        
    } catch (error) {
        console.error('Error deleting all messages:', error);
        showNotification('Failed to delete messages', 'error');
    }
}

// Load all reports
async function loadAllReports() {
    try {
        const reportsRef = collection(db, "reports");
        const querySnapshot = await getDocs(reportsRef);
        
        allReports = [];
        querySnapshot.forEach(doc => {
            allReports.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Sort by timestamp
        allReports.sort((a, b) => b.timestamp?.toDate() - a.timestamp?.toDate());
        
        displayReports();
        updateReportStats();
        
    } catch (error) {
        console.error('Error loading reports:', error);
        showNotification('Failed to load reports', 'error');
    }
}

// Display reports
function displayReports() {
    const container = document.getElementById('reportsList');
    container.innerHTML = '';
    
    // Apply filters
    const statusFilter = document.getElementById('reportStatusFilter')?.value || 'all';
    const typeFilter = document.getElementById('reportTypeFilter')?.value || 'all';
    
    const filteredReports = allReports.filter(report => {
        // Status filter
        const matchesStatus = statusFilter === 'all' || report.status === statusFilter;
        
        // Type filter
        const matchesType = typeFilter === 'all' || 
            (report.reasons && report.reasons.includes(typeFilter));
        
        return matchesStatus && matchesType;
    });
    
    if (filteredReports.length === 0) {
        container.innerHTML = '<div class="no-data">No reports found</div>';
        return;
    }
    
    filteredReports.forEach(async report => {
        try {
            // Get reporter and reported user info
            const [reporterDoc, reportedDoc] = await Promise.all([
                getDoc(doc(db, "users", report.reporterId)),
                getDoc(doc(db, "users", report.reportedUserId))
            ]);
            
            const reporterData = reporterDoc.exists() ? reporterDoc.data() : null;
            const reportedData = reportedDoc.exists() ? reportedDoc.data() : null;
            
            const reportElement = document.createElement('div');
            reportElement.className = `admin-report-item ${report.status}`;
            
            const time = report.timestamp?.toDate().toLocaleString() || 'Unknown';
            const statusClass = report.status === 'pending' ? 'warning' : 
                               report.status === 'resolved' ? 'success' : 
                               report.status === 'dismissed' ? 'secondary' : 'primary';
            
            reportElement.innerHTML = `
                <div class="report-header">
                    <div class="report-users">
                        <div class="user-pair">
                            <div class="user">
                                <img src="${reporterData?.photos?.[0] || 'https://via.placeholder.com/20'}" alt="Reporter">
                                <span>${reporterData?.username || 'Unknown'}</span>
                            </div>
                            <i class="fas fa-flag"></i>
                            <div class="user">
                                <img src="${reportedData?.photos?.[0] || 'https://via.placeholder.com/20'}" alt="Reported">
                                <span>${reportedData?.username || 'Unknown'}</span>
                            </div>
                        </div>
                    </div>
                    <div class="report-meta">
                        <span class="report-time">${time}</span>
                        <span class="report-status ${statusClass}">${report.status}</span>
                    </div>
                </div>
                <div class="report-body">
                    <div class="report-reasons">
                        <strong>Reasons:</strong>
                        <div class="reason-tags">
                            ${report.reasons?.map(reason => `
                                <span class="reason-tag">${reason}</span>
                            `).join('') || 'No reasons specified'}
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
            
        } catch (error) {
            console.error('Error loading report details:', error);
        }
    });
}

// View report details
async function viewReportDetails(reportId) {
    try {
        const reportDoc = await getDoc(doc(db, "reports", reportId));
        if (!reportDoc.exists()) {
            showNotification('Report not found', 'error');
            return;
        }
        
        const reportData = reportDoc.data();
        
        // Get reporter and reported user info
        const [reporterDoc, reportedDoc] = await Promise.all([
            getDoc(doc(db, "users", reportData.reporterId)),
            getDoc(doc(db, "users", reportData.reportedUserId))
        ]);
        
        const reporterData = reporterDoc.exists() ? reporterDoc.data() : null;
        const reportedData = reportedDoc.exists() ? reportedDoc.data() : null;
        
        const detailContent = document.getElementById('reportDetailContent');
        const time = reportData.timestamp?.toDate().toLocaleString() || 'Unknown';
        
        detailContent.innerHTML = `
            <div class="report-detail-header">
                <h3>Report Details</h3>
                <span class="report-id">ID: ${reportId}</span>
            </div>
            
            <div class="report-detail-info">
                <div class="detail-section">
                    <h4>Reporter</h4>
                    <div class="user-detail">
                        <img src="${reporterData?.photos?.[0] || 'https://via.placeholder.com/40'}" alt="Reporter">
                        <div>
                            <strong>${reporterData?.username || 'Unknown'}</strong>
                            <p>ID: ${reportData.reporterId}</p>
                            <p>Real Name: ${reporterData?.realName || 'Not available'}</p>
                        </div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>Reported User</h4>
                    <div class="user-detail">
                        <img src="${reportedData?.photos?.[0] || 'https://via.placeholder.com/40'}" alt="Reported">
                        <div>
                            <strong>${reportedData?.username || 'Unknown'}</strong>
                            <p>ID: ${reportData.reportedUserId}</p>
                            <p>Real Name: ${reportedData?.realName || 'Not available'}</p>
                            <p>Status: ${reportedData?.isBlocked ? 'Blocked' : 'Active'}</p>
                        </div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>Report Information</h4>
                    <div class="detail-item">
                        <span class="detail-label">Reported On:</span>
                        <span class="detail-value">${time}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Status:</span>
                        <span class="detail-value status-${reportData.status}">${reportData.status}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Handled By:</span>
                        <span class="detail-value">${reportData.handledBy || 'Not handled yet'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Resolution:</span>
                        <span class="detail-value">${reportData.resolution || 'Not resolved yet'}</span>
                    </div>
                </div>
                
                <div class="detail-section full-width">
                    <h4>Report Reasons</h4>
                    <div class="reason-tags">
                        ${reportData.reasons?.map(reason => `
                            <span class="reason-tag">${reason}</span>
                        `).join('') || 'No reasons specified'}
                    </div>
                </div>
                
                <div class="detail-section full-width">
                    <h4>Report Details</h4>
                    <div class="report-details-box">
                        <p>${reportData.details || 'No additional details provided'}</p>
                    </div>
                </div>
                
                ${reportData.evidence ? `
                <div class="detail-section full-width">
                    <h4>Evidence</h4>
                    <div class="report-evidence">
                        <p>${reportData.evidence}</p>
                    </div>
                </div>
                ` : ''}
            </div>
        `;
        
        document.getElementById('reportDetailModal').style.display = 'block';
        
    } catch (error) {
        console.error('Error loading report details:', error);
        showNotification('Failed to load report details', 'error');
    }
}

// Close report modal
function closeReportModal() {
    document.getElementById('reportDetailModal').style.display = 'none';
}

// Resolve report from list
async function resolveReportFromList(reportId) {
    if (!confirm('Mark this report as resolved?')) return;
    
    try {
        await updateDoc(doc(db, "reports", reportId), {
            status: 'resolved',
            resolvedAt: serverTimestamp(),
            resolvedBy: currentAdminUser.uid
        });
        
        showNotification('Report marked as resolved', 'success');
        await loadAllReports();
        
    } catch (error) {
        console.error('Error resolving report:', error);
        showNotification('Failed to resolve report', 'error');
    }
}

// Dismiss report from list
async function dismissReportFromList(reportId) {
    if (!confirm('Dismiss this report?')) return;
    
    try {
        await updateDoc(doc(db, "reports", reportId), {
            status: 'dismissed',
            dismissedAt: serverTimestamp(),
            dismissedBy: currentAdminUser.uid
        });
        
        showNotification('Report dismissed', 'success');
        await loadAllReports();
        
    } catch (error) {
        console.error('Error dismissing report:', error);
        showNotification('Failed to dismiss report', 'error');
    }
}

// Resolve report from modal
async function resolveReport() {
    const modal = document.getElementById('reportDetailModal');
    const reportId = modal.dataset.reportId;
    
    if (reportId) {
        await resolveReportFromList(reportId);
        closeReportModal();
    }
}

// Dismiss report from modal
async function dismissReport() {
    const modal = document.getElementById('reportDetailModal');
    const reportId = modal.dataset.reportId;
    
    if (reportId) {
        await dismissReportFromList(reportId);
        closeReportModal();
    }
}

// Take action on reported user
async function takeAction() {
    const modal = document.getElementById('reportDetailModal');
    const reportId = modal.dataset.reportId;
    
    if (!reportId) return;
    
    // Get report data to access reported user ID
    try {
        const reportDoc = await getDoc(doc(db, "reports", reportId));
        if (reportDoc.exists()) {
            const reportData = reportDoc.data();
            
            // Show action options
            const action = prompt('Choose action:\n1. Warn user\n2. Temporary ban (7 days)\n3. Permanent ban\n4. Delete user\n\nEnter number:');
            
            switch (action) {
                case '1':
                    await warnUser(reportData.reportedUserId, reportId);
                    break;
                case '2':
                    await temporaryBan(reportData.reportedUserId, reportId);
                    break;
                case '3':
                    await permanentBan(reportData.reportedUserId, reportId);
                    break;
                case '4':
                    await deleteUser(reportData.reportedUserId);
                    break;
                default:
                    showNotification('No action taken', 'info');
            }
        }
    } catch (error) {
        console.error('Error taking action:', error);
        showNotification('Failed to take action', 'error');
    }
}

async function warnUser(userId, reportId) {
    try {
        await updateDoc(doc(db, "users", userId), {
            warnings: arrayUnion({
                date: serverTimestamp(),
                reason: 'Report violation',
                reportId: reportId,
                warnedBy: currentAdminUser.uid
            })
        });
        
        await updateDoc(doc(db, "reports", reportId), {
            status: 'resolved',
            resolution: 'User warned',
            resolvedAt: serverTimestamp()
        });
        
        showNotification('User warned', 'success');
        await loadAllReports();
        closeReportModal();
        
    } catch (error) {
        console.error('Error warning user:', error);
        showNotification('Failed to warn user', 'error');
    }
}

async function temporaryBan(userId, reportId) {
    try {
        const banUntil = new Date();
        banUntil.setDate(banUntil.getDate() + 7);
        
        await updateDoc(doc(db, "users", userId), {
            isBlocked: true,
            banReason: 'Report violation',
            banUntil: banUntil,
            bannedBy: currentAdminUser.uid,
            banReportId: reportId
        });
        
        await updateDoc(doc(db, "reports", reportId), {
            status: 'resolved',
            resolution: 'User temporarily banned (7 days)',
            resolvedAt: serverTimestamp()
        });
        
        showNotification('User temporarily banned for 7 days', 'success');
        await loadAllUsers();
        await loadAllReports();
        closeReportModal();
        
    } catch (error) {
        console.error('Error temporary banning user:', error);
        showNotification('Failed to ban user', 'error');
    }
}

async function permanentBan(userId, reportId) {
    try {
        await updateDoc(doc(db, "users", userId), {
            isBlocked: true,
            banReason: 'Report violation - Permanent',
            bannedBy: currentAdminUser.uid,
            banReportId: reportId
        });
        
        await updateDoc(doc(db, "reports", reportId), {
            status: 'resolved',
            resolution: 'User permanently banned',
            resolvedAt: serverTimestamp()
        });
        
        showNotification('User permanently banned', 'success');
        await loadAllUsers();
        await loadAllReports();
        closeReportModal();
        
    } catch (error) {
        console.error('Error permanent banning user:', error);
        showNotification('Failed to ban user', 'error');
    }
}

// Resolve all reports
async function resolveAllReports() {
    if (!confirm('Mark all pending reports as resolved?')) return;
    
    try {
        const pendingReports = allReports.filter(r => r.status === 'pending');
        
        const batch = writeBatch(db);
        pendingReports.forEach(report => {
            const reportRef = doc(db, "reports", report.id);
            batch.update(reportRef, {
                status: 'resolved',
                resolvedAt: serverTimestamp(),
                resolvedBy: currentAdminUser.uid,
                resolution: 'Bulk resolution'
            });
        });
        
        await batch.commit();
        showNotification('All reports resolved', 'success');
        await loadAllReports();
        
    } catch (error) {
        console.error('Error resolving all reports:', error);
        showNotification('Failed to resolve all reports', 'error');
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
        const lastActive = user.lastActive?.toDate();
        const today = new Date();
        return lastActive && lastActive.toDateString() === today.toDateString();
    }).length;
    
    document.getElementById('totalUsers').textContent = totalUsers;
    document.getElementById('totalUsersCount').textContent = totalUsers;
    document.getElementById('activeUsersCount').textContent = activeToday;
}

function updateMessageStats() {
    const totalMessages = allMessages.length;
    const todayMessages = allMessages.filter(message => {
        const messageDate = message.timestamp?.toDate();
        const today = new Date();
        return messageDate && messageDate.toDateString() === today.toDateString();
    }).length;
    
    document.getElementById('totalMessagesAdmin').textContent = totalMessages;
    document.getElementById('totalMessagesCount').textContent = totalMessages;
}

function updateReportStats() {
    const totalReports = allReports.length;
    const pendingReports = allReports.filter(r => r.status === 'pending').length;
    
    document.getElementById('pendingReports').textContent = pendingReports;
    document.getElementById('totalReportsCount').textContent = totalReports;
}

function updateAnalyticsStats() {
    // You can add more analytics here
    // For now, we've updated the basic stats above
}

// Show different sections
function showSection(sectionName) {
    // Hide all sections
    const sections = ['users', 'messages', 'reports', 'analytics', 'settings'];
    sections.forEach(section => {
        document.getElementById(`${section}Section`).style.display = 'none';
    });
    
    // Show selected section
    document.getElementById(`${sectionName}Section`).style.display = 'block';
    
    // Update active menu items
    document.querySelectorAll('.sidebar-menu .menu-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // The main admin panel item stays active
    document.querySelector('.sidebar-menu .menu-item:nth-child(2)').classList.add('active');
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
                createdAt: user.createdAt?.toDate()?.toISOString(),
                lastActive: user.lastActive?.toDate()?.toISOString(),
                isAdmin: user.isAdmin,
                isBlocked: user.isBlocked
            })),
            messages: allMessages.slice(0, 1000).map(msg => ({
                id: msg.id,
                senderId: msg.senderId,
                receiverId: msg.receiverId,
                content: msg.content,
                isAnonymous: msg.isAnonymous,
                timestamp: msg.timestamp?.toDate()?.toISOString(),
                readBy: msg.readBy
            })),
            reports: allReports.map(report => ({
                id: report.id,
                reporterId: report.reporterId,
                reportedUserId: report.reportedUserId,
                reasons: report.reasons,
                details: report.details,
                status: report.status,
                timestamp: report.timestamp?.toDate()?.toISOString()
            })),
            exportDate: new Date().toISOString(),
            exportedBy: currentAdminUser.uid
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nightvibe-admin-export-${new Date().toISOString().split('T')[0]}.json`;
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

// Clear all data
async function clearAllData() {
    const confirmation = prompt('Type "CLEAR ALL DATA" to confirm:');
    if (confirmation !== 'CLEAR ALL DATA') {
        showNotification('Operation cancelled', 'info');
        return;
    }
    
    if (!confirm('WARNING: This will delete ALL data from the database. This cannot be undone. Continue?')) return;
    
    try {
        showNotification('Clearing all data...', 'info');
        
        // This is a dangerous operation and should be done carefully
        // In a real app, you might want to archive data instead of deleting
        
        showNotification('Data clear function is disabled for safety', 'error');
        
    } catch (error) {
        console.error('Error clearing data:', error);
        showNotification('Failed to clear data', 'error');
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
    
    try {
        // Create user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        // Create user document in Firestore
        await setDoc(doc(db, "users", userCredential.user.uid), {
            username: username,
            realName: realName,
            phone: phone,
            email: email,
            isAdmin: userType === 'admin',
            isModerator: userType === 'moderator',
            createdAt: serverTimestamp(),
            lastActive: serverTimestamp(),
            status: 'offline',
            photos: [],
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
    document.getElementById('addUserForm').addEventListener('submit', createNewUser);
    
    // Message search
    document.getElementById('messageSearchAdmin')?.addEventListener('input', displayMessages);
    document.getElementById('messageFilterAdmin')?.addEventListener('change', displayMessages);
    
    // Report filters
    document.getElementById('reportStatusFilter')?.addEventListener('change', displayReports);
    document.getElementById('reportTypeFilter')?.addEventListener('change', displayReports);
    
    // User search
    document.getElementById('userSearch')?.addEventListener('input', filterUsers);
    document.getElementById('userFilter')?.addEventListener('change', filterUsers);
    
    // Admin search
    document.getElementById('adminSearch')?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        // Implement global search across all sections
        showNotification(`Searching for: ${term}`, 'info');
    });
    
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
    showNotification('Refreshing analytics...', 'info');
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
            lastUpdated: serverTimestamp(),
            updatedBy: currentAdminUser.uid
        };
        
        // Save to Firestore
        await setDoc(doc(db, "admin", "settings"), settings, { merge: true });
        
        showNotification('Settings saved successfully', 'success');
        
    } catch (error) {
        console.error('Error saving settings:', error);
        showNotification('Failed to save settings', 'error');
    }
}