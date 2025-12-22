let currentProfile = null;

async function loadProfile() {
    const profileId = sessionStorage.getItem('viewProfileId');
    
    if (!profileId) {
        window.location.href = 'browse-profiles.html';
        return;
    }
    
    try {
        const profileDoc = await getDoc(doc(db, "users", profileId));
        
        if (profileDoc.exists()) {
            currentProfile = {
                id: profileDoc.id,
                ...profileDoc.data()
            };
            displayProfile(currentProfile);
        } else {
            alert('Profile not found');
            window.location.href = 'browse-profiles.html';
        }
    } catch (error) {
        console.error("Error loading profile:", error);
    }
}

function displayProfile(profile) {
    const container = document.getElementById('profileViewContainer');
    
    const positionMap = {
        'T': 'Top',
        'TV': 'Versatile Top',
        'V': 'Versatile',
        'BV': 'Versatile Bottom',
        'B': 'Bottom'
    };
    
    // Create photo gallery
    const photoGallery = profile.photos && profile.photos.length > 0 
        ? `
            <div class="photo-gallery">
                ${profile.photos.map(photo => `
                    <div class="gallery-item">
                        <img src="${photo}" alt="Profile photo">
                    </div>
                `).join('')}
            </div>
        `
        : '<p class="no-photos">No photos uploaded</p>';
    
    container.innerHTML = `
        <div class="full-profile">
            <div class="profile-header">
                <h2>${profile.username}</h2>
                <button onclick="openMessageModal('${profile.id}', '${profile.username}')" class="message-btn-large">
                    💬 Send Anonymous Message
                </button>
            </div>
            
            ${photoGallery}
            
            <div class="profile-details">
                <h3>Profile Information</h3>
                <div class="details-grid">
                    <div class="detail-item">
                        <strong>Age:</strong>
                        <span>${profile.stats?.age || 'N/A'}</span>
                    </div>
                    <div class="detail-item">
                        <strong>Position:</strong>
                        <span>${positionMap[profile.stats?.position] || 'N/A'}</span>
                    </div>
                    <div class="detail-item">
                        <strong>Relationship Status:</strong>
                        <span>${profile.stats?.relationshipStatus || 'N/A'}</span>
                    </div>
                    <div class="detail-item full-width">
                        <strong>I am into:</strong>
                        <p>${profile.stats?.iamInto || 'Not specified'}</p>
                    </div>
                    <div class="detail-item">
                        <strong>Member Since:</strong>
                        <span>${new Date(profile.createdAt?.toDate()).toLocaleDateString()}</span>
                    </div>
                    <div class="detail-item">
                        <strong>Last Active:</strong>
                        <span>${new Date(profile.lastActive?.toDate()).toLocaleDateString()}</span>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Message Modal -->
        <div id="messageModal" class="modal">
            <div class="modal-content">
                <span class="close-modal" onclick="closeMessageModal()">&times;</span>
                <h3>Send Anonymous Message to ${profile.username}</h3>
                <textarea id="anonymousMessage" placeholder="Type your anonymous message here..." rows="6"></textarea>
                <button onclick="sendMessageToProfile()" class="send-btn">Send Anonymously</button>
            </div>
        </div>
    `;
}

// Message functions for view-profile page
function openMessageModal(userId, username) {
    document.getElementById('messageModal').style.display = 'block';
    document.getElementById('modalUsername').textContent = username;
    selectedUserId = userId;
}

function closeMessageModal() {
    document.getElementById('messageModal').style.display = 'none';
    document.getElementById('anonymousMessage').value = '';
}

async function sendMessageToProfile() {
    const message = document.getElementById('anonymousMessage').value.trim();
    
    if (!message) {
        alert('Please enter a message');
        return;
    }
    
    try {
        const currentUser = auth.currentUser;
        
        await addDoc(collection(db, "messages"), {
            senderId: currentUser.uid,
            receiverId: currentProfile.id,
            message: message,
            timestamp: new Date(),
            isAnonymous: true,
            read: false
        });
        
        alert('Message sent anonymously!');
        closeMessageModal();
    } catch (error) {
        console.error("Error sending message:", error);
        alert('Failed to send message: ' + error.message);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (auth.currentUser) {
        loadProfile();
    } else {
        window.location.href = 'index.html';
    }
});