// browse-profiles.js - Firebase v8 version
let allProfiles = [];
let selectedUserId = null;

// Load all profiles
async function loadProfiles() {
    try {
        console.log("Starting to load profiles...");
        
        const db = firebase.firestore();
        const currentUser = firebase.auth().currentUser;
        
        if (!currentUser) {
            console.error("No current user found");
            window.location.href = 'index.html';
            return;
        }
        
        console.log("Current user UID:", currentUser.uid);
        
        const usersRef = db.collection("users");
        const querySnapshot = await usersRef.get();
        
        console.log("Total users in database:", querySnapshot.size);
        
        allProfiles = [];
        
        querySnapshot.forEach(doc => {
            const userData = doc.data();
            console.log("Processing user:", doc.id, userData.username);
            
            // Skip current user and admins
            if (doc.id !== currentUser.uid && !userData.isAdmin) {
                console.log("Adding to profiles:", userData.username);
                allProfiles.push({
                    id: doc.id,
                    ...userData
                });
            } else {
                console.log("Skipping:", doc.id === currentUser.uid ? "current user" : "admin");
            }
        });
        
        console.log("Total profiles loaded:", allProfiles.length);
        
        if (allProfiles.length === 0) {
            console.warn("No profiles found (excluding current user and admins)");
            // Check if we have any users at all
            querySnapshot.forEach(doc => {
                const userData = doc.data();
                console.log("User in DB:", doc.id, "username:", userData.username, "isAdmin:", userData.isAdmin);
            });
        }
        
        displayProfiles(allProfiles);
        
    } catch (error) {
        console.error("Error loading profiles:", error);
        showNotification('Failed to load profiles: ' + error.message, 'error');
    }
}

// Display profiles in grid
function displayProfiles(profiles) {
    const container = document.getElementById('profilesContainer');
    if (!container) {
        console.error("profilesContainer element not found!");
        return;
    }
    
    console.log("Displaying", profiles.length, "profiles");
    
    container.innerHTML = '';
    
    if (profiles.length === 0) {
        container.innerHTML = `
            <div class="no-profiles-message">
                <i class="fas fa-users" style="font-size: 48px; margin-bottom: 20px; color: #666;"></i>
                <h3>No profiles found</h3>
                <p>Try adjusting your filters or check back later.</p>
                <p style="font-size: 12px; color: #888; margin-top: 10px;">
                    Debug: ${allProfiles.length} total users in system
                </p>
            </div>
        `;
        return;
    }
    
    profiles.forEach(profile => {
        const profileCard = document.createElement('div');
        profileCard.className = 'profile-card';
        
        // Debug the profile data
        console.log("Creating card for:", profile.username, "Photos:", profile.photos);
        
        // Get first photo or placeholder - handle both string and object formats
        let profilePhoto = 'after-dark-banner.jpg';
        if (profile.photos && profile.photos.length > 0) {
            if (typeof profile.photos[0] === 'string') {
                profilePhoto = profile.photos[0];
            } else if (profile.photos[0] && profile.photos[0].url) {
                profilePhoto = profile.photos[0].url;
            }
        }
        
        console.log("Using photo URL:", profilePhoto);
        
        // Position mapping for display
        const positionMap = {
            'T': 'Top',
            'TV': 'Versatile Top',
            'V': 'Versatile',
            'BV': 'Versatile Bottom',
            'B': 'Bottom'
        };
        
        // Safely get profile data with defaults
        const username = profile.username || 'Unknown User';
        const age = profile.stats?.age || profile.age || 'N/A';
        const position = profile.stats?.position || profile.position || '';
        const status = profile.stats?.relationshipStatus || profile.relationshipStatus || '';
        const iamInto = profile.stats?.iamInto || profile.iamInto || 'No interests listed';
        
        profileCard.innerHTML = `
            <div class="profile-photo">
                <img src="${profilePhoto}" alt="${username}" onerror="this.src='after-dark-banner.jpg'">
                <div class="photo-count">${profile.photos?.length || 0}/5</div>
            </div>
            <div class="profile-info">
                <h3>${username}</h3>
                <div class="profile-stats">
                    <div class="stat-item">
                        <span class="stat-label">Age:</span>
                        <span class="stat-value">${age}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Position:</span>
                        <span class="stat-value">${positionMap[position] || 'N/A'}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Status:</span>
                        <span class="stat-value">${status.split(':')[0] || 'N/A'}</span>
                    </div>
                </div>
                <div class="profile-interests">
                    <p><strong>Into:</strong> ${iamInto.substring(0, 50)}${iamInto.length > 50 ? '...' : ''}</p>
                </div>
                <div class="profile-actions">
                    <button onclick="openMessageModal('${profile.id}', '${username.replace(/'/g, "\\'")}')" class="message-btn">
                        <i class="fas fa-comment"></i> Message
                    </button>
                    <button onclick="viewProfile('${profile.id}')" class="view-btn">
                        <i class="fas fa-eye"></i> View Profile
                    </button>
                </div>
            </div>
        `;
        
        container.appendChild(profileCard);
    });
}

// Apply filters
function applyFilters() {
    const ageFilter = document.getElementById('filterAge').value;
    const positionFilter = document.getElementById('filterPosition').value;
    const statusFilter = document.getElementById('filterStatus').value;
    
    console.log("Applying filters:", { ageFilter, positionFilter, statusFilter });
    
    let filtered = [...allProfiles];
    
    if (ageFilter) {
        const [min, max] = ageFilter.split('-').map(Number);
        filtered = filtered.filter(profile => {
            const age = profile.stats?.age || profile.age;
            return age && age >= min && age <= max;
        });
    }
    
    if (positionFilter) {
        filtered = filtered.filter(profile => {
            const position = profile.stats?.position || profile.position;
            return position === positionFilter;
        });
    }
    
    if (statusFilter) {
        filtered = filtered.filter(profile => {
            const status = profile.stats?.relationshipStatus || profile.relationshipStatus;
            return status && status.startsWith(statusFilter);
        });
    }
    
    console.log("After filtering:", filtered.length, "profiles");
    displayProfiles(filtered);
}

function clearFilters() {
    document.getElementById('filterAge').value = '';
    document.getElementById('filterPosition').value = '';
    document.getElementById('filterStatus').value = '';
    displayProfiles(allProfiles);
}

// Open message modal
function openMessageModal(userId, username) {
    selectedUserId = userId;
    const modalUsername = document.getElementById('modalUsername');
    if (modalUsername) {
        modalUsername.textContent = username;
    }
    const modal = document.getElementById('messageModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

function closeMessageModal() {
    const modal = document.getElementById('messageModal');
    if (modal) {
        modal.style.display = 'none';
    }
    const messageInput = document.getElementById('anonymousMessage');
    if (messageInput) {
        messageInput.value = '';
    }
    selectedUserId = null;
}

// Send anonymous message
// Update this function in browse-profiles.js
async function sendMessageToUser() {
    const messageInput = document.getElementById('anonymousMessage');
    if (!messageInput) return;
    
    const message = messageInput.value.trim();
    
    if (!message) {
        showNotification('Please enter a message', 'error');
        return;
    }
    
    if (!selectedUserId) {
        showNotification('No user selected', 'error');
        return;
    }
    
    try {
        // USE FIREBASE V8 SYNTAX
        const db = firebase.firestore();
        const currentUser = firebase.auth().currentUser;
        
        if (!currentUser) {
            showNotification('You must be logged in to send messages', 'error');
            return;
        }
        
        // This creates/updates the "messages" collection
        await db.collection("messages").add({
            senderId: currentUser.uid,
            receiverId: selectedUserId,
            participants: [currentUser.uid, selectedUserId],
            message: message,  // Use "message" field
            content: message,   // Also add "content" field for compatibility
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),  // CORRECT timestamp
            isAnonymous: true,
            read: false,
            readBy: [currentUser.uid]  // Add readBy array
        });
        
        showNotification('Message sent anonymously!', 'success');
        closeMessageModal();
    } catch (error) {
        console.error("Error sending message:", error);
        showNotification('Failed to send message: ' + error.message, 'error');
    }
}

// View full profile
function viewProfile(userId) {
    // Store in session storage and redirect to profile view page
    sessionStorage.setItem('viewProfileId', userId);
    window.location.href = 'view-profile.html';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log("browse-profiles.js loaded, checking auth...");
    
    // Check if Firebase is loaded
    if (typeof firebase === 'undefined') {
        console.error("Firebase not loaded!");
        showNotification("Firebase not loaded. Please refresh.", "error");
        return;
    }
    
    // Check auth state
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            console.log("User authenticated:", user.uid);
            loadProfiles();
        } else {
            console.log("No user, redirecting to index");
            window.location.href = 'index.html';
        }
    });
});

// Close modal if clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('messageModal');
    if (event.target == modal) {
        closeMessageModal();
    }
}

// Make functions globally available
window.loadProfiles = loadProfiles;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.openMessageModal = openMessageModal;
window.closeMessageModal = closeMessageModal;
window.sendMessageToUser = sendMessageToUser;
window.viewProfile = viewProfile;