// view-profile.js - Firebase v8 version
let currentProfile = null;
let selectedUserId = null;

async function loadProfile() {
    const profileId = sessionStorage.getItem('viewProfileId');
    
    if (!profileId) {
        showNotification('No profile selected', 'error');
        setTimeout(() => window.location.href = 'browse-profiles.html', 1000);
        return;
    }
    
    try {
        const db = firebase.firestore();
        const profileDoc = await db.collection("users").doc(profileId).get();
        
        if (profileDoc.exists) {
            currentProfile = {
                id: profileDoc.id,
                ...profileDoc.data()
            };
            displayProfile(currentProfile);
        } else {
            showNotification('Profile not found', 'error');
            setTimeout(() => window.location.href = 'browse-profiles.html', 2000);
        }
    } catch (error) {
        console.error("Error loading profile:", error);
        showNotification('Failed to load profile: ' + error.message, 'error');
    }
}

function displayProfile(profile) {
    const container = document.getElementById('profileViewContainer');
    if (!container) return;
    
    const positionMap = {
        'T': 'Top',
        'TV': 'Versatile Top',
        'V': 'Versatile',
        'BV': 'Versatile Bottom',
        'B': 'Bottom'
    };
    
    // Create photo gallery - handle both string and object photo formats
    let photoGallery = '<p class="no-photos">No photos uploaded</p>';
    if (profile.photos && profile.photos.length > 0) {
        const photosHtml = profile.photos.map(photo => {
            const photoUrl = typeof photo === 'string' ? photo : (photo.url || '');
            return `
                <div class="gallery-item">
                    <img src="${photoUrl}" alt="Profile photo" onerror="this.src='after-dark-banner.jpg'">
                </div>
            `;
        }).join('');
        
        photoGallery = `
            <div class="photo-gallery">
                ${photosHtml}
            </div>
        `;
    }
    
    // Format dates safely
    const createdAt = profile.createdAt ? 
        new Date(profile.createdAt.toDate ? profile.createdAt.toDate() : profile.createdAt).toLocaleDateString() : 
        'Unknown';
    
    const lastActive = profile.lastActive ? 
        new Date(profile.lastActive.toDate ? profile.lastActive.toDate() : profile.lastActive).toLocaleDateString() : 
        'Unknown';
    
    container.innerHTML = `
        <div class="full-profile">
            <div class="profile-header">
                <h2>${profile.username || 'Unknown User'}</h2>
                <button onclick="openMessageModal('${profile.id}', '${(profile.username || '').replace(/'/g, "\\'")}')" class="message-btn-large">
                    <i class="fas fa-comment"></i> Send Anonymous Message
                </button>
            </div>
            
            ${photoGallery}
            
            <div class="profile-details">
                <h3>Profile Information</h3>
                <div class="details-grid">
                    <div class="detail-item">
                        <strong>Age:</strong>
                        <span>${profile.stats?.age || profile.age || 'N/A'}</span>
                    </div>
                    <div class="detail-item">
                        <strong>Position:</strong>
                        <span>${positionMap[profile.stats?.position || profile.position] || 'N/A'}</span>
                    </div>
                    <div class="detail-item">
                        <strong>Relationship Status:</strong>
                        <span>${(profile.stats?.relationshipStatus || profile.relationshipStatus || 'N/A').split(':')[0]}</span>
                    </div>
                    <div class="detail-item full-width">
                        <strong>I am into:</strong>
                        <p>${profile.stats?.iamInto || profile.iamInto || 'Not specified'}</p>
                    </div>
                    <div class="detail-item">
                        <strong>Member Since:</strong>
                        <span>${createdAt}</span>
                    </div>
                    <div class="detail-item">
                        <strong>Last Active:</strong>
                        <span>${lastActive}</span>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Message Modal -->
        <div id="messageModal" class="modal">
            <div class="modal-content">
                <span class="close-modal" onclick="closeMessageModal()">&times;</span>
                <h3>Send Anonymous Message to <span id="modalUsername"></span></h3>
                <textarea id="anonymousMessage" placeholder="Type your anonymous message here..." rows="6"></textarea>
                <button onclick="sendMessageToProfile()" class="send-btn">Send Anonymously</button>
            </div>
        </div>
    `;
}

// Message functions for view-profile page
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

// Update this function in view-profile.js
async function sendMessageToProfile() {
    const messageInput = document.getElementById('anonymousMessage');
    if (!messageInput) return;
    
    const message = messageInput.value.trim();
    
    if (!message) {
        showNotification('Please enter a message', 'error');
        return;
    }
    
    if (!selectedUserId || !currentProfile) {
        showNotification('No profile selected', 'error');
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
        
        await db.collection("messages").add({
            senderId: currentUser.uid,
            receiverId: selectedUserId,
            participants: [currentUser.uid, selectedUserId],
            message: message,
            content: message,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            isAnonymous: true,
            read: false,
            readBy: [currentUser.uid]
        });
        
        showNotification('Message sent anonymously!', 'success');
        closeMessageModal();
    } catch (error) {
        console.error("Error sending message:", error);
        showNotification('Failed to send message: ' + error.message, 'error');
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log("view-profile.js loaded");
    
    // Check if Firebase is loaded
    if (typeof firebase === 'undefined') {
        console.error("Firebase not loaded!");
        showNotification("Firebase not loaded. Please refresh.", "error");
        return;
    }
    
    // Check auth state
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            console.log("User authenticated in view-profile:", user.uid);
            loadProfile();
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
window.openMessageModal = openMessageModal;
window.closeMessageModal = closeMessageModal;
window.sendMessageToProfile = sendMessageToProfile;