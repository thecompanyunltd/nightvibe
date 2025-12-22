let allProfiles = [];
let selectedUserId = null;

// Load all profiles
async function loadProfiles() {
    try {
        const usersRef = collection(db, "users");
        const querySnapshot = await getDocs(usersRef);
        
        allProfiles = [];
        const currentUser = auth.currentUser;
        
        querySnapshot.forEach(doc => {
            if (doc.id !== currentUser.uid && !doc.data().isAdmin) {
                allProfiles.push({
                    id: doc.id,
                    ...doc.data()
                });
            }
        });
        
        displayProfiles(allProfiles);
    } catch (error) {
        console.error("Error loading profiles:", error);
    }
}

// Display profiles in grid
function displayProfiles(profiles) {
    const container = document.getElementById('profilesContainer');
    container.innerHTML = '';
    
    if (profiles.length === 0) {
        container.innerHTML = '<p class="no-profiles">No profiles found matching your filters.</p>';
        return;
    }
    
    profiles.forEach(profile => {
        const profileCard = document.createElement('div');
        profileCard.className = 'profile-card';
        
        // Get first photo or placeholder
        const profilePhoto = profile.photos && profile.photos.length > 0 
            ? profile.photos[0] 
            : 'https://via.placeholder.com/200x200?text=No+Photo';
        
        // Position mapping for display
        const positionMap = {
            'T': 'Top',
            'TV': 'Versatile Top',
            'V': 'Versatile',
            'BV': 'Versatile Bottom',
            'B': 'Bottom'
        };
        
        profileCard.innerHTML = `
            <div class="profile-photo">
                <img src="${profilePhoto}" alt="${profile.username}">
                <div class="photo-count">${profile.photos?.length || 0}/5</div>
            </div>
            <div class="profile-info">
                <h3>${profile.username}</h3>
                <div class="profile-stats">
                    <div class="stat-item">
                        <span class="stat-label">Age:</span>
                        <span class="stat-value">${profile.stats?.age || 'N/A'}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Position:</span>
                        <span class="stat-value">${positionMap[profile.stats?.position] || 'N/A'}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Status:</span>
                        <span class="stat-value">${profile.stats?.relationshipStatus?.split(':')[0] || 'N/A'}</span>
                    </div>
                </div>
                <div class="profile-interests">
                    <p><strong>Into:</strong> ${profile.stats?.iamInto?.substring(0, 50) || 'No interests listed'}...</p>
                </div>
                <button onclick="openMessageModal('${profile.id}', '${profile.username}')" class="message-btn">
                    💬 Send Anonymous Message
                </button>
                <button onclick="viewProfile('${profile.id}')" class="view-btn">View Full Profile</button>
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
    
    let filtered = [...allProfiles];
    
    if (ageFilter) {
        const [min, max] = ageFilter.split('-').map(Number);
        filtered = filtered.filter(profile => {
            const age = profile.stats?.age;
            return age >= min && age <= max;
        });
    }
    
    if (positionFilter) {
        filtered = filtered.filter(profile => 
            profile.stats?.position === positionFilter
        );
    }
    
    if (statusFilter) {
        filtered = filtered.filter(profile => 
            profile.stats?.relationshipStatus?.startsWith(statusFilter)
        );
    }
    
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
    document.getElementById('modalUsername').textContent = username;
    document.getElementById('messageModal').style.display = 'block';
}

function closeMessageModal() {
    document.getElementById('messageModal').style.display = 'none';
    document.getElementById('anonymousMessage').value = '';
    selectedUserId = null;
}

// Send anonymous message
async function sendMessageToUser() {
    const message = document.getElementById('anonymousMessage').value.trim();
    
    if (!message) {
        alert('Please enter a message');
        return;
    }
    
    if (!selectedUserId) {
        alert('No user selected');
        return;
    }
    
    try {
        const currentUser = auth.currentUser;
        
        await addDoc(collection(db, "messages"), {
            senderId: currentUser.uid,
            receiverId: selectedUserId,
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

// View full profile
async function viewProfile(userId) {
    // Store in session storage and redirect to profile view page
    sessionStorage.setItem('viewProfileId', userId);
    window.location.href = 'view-profile.html';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    if (auth.currentUser) {
        loadProfiles();
    } else {
        window.location.href = 'index.html';
    }
});

// Close modal if clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('messageModal');
    if (event.target == modal) {
        closeMessageModal();
    }
}