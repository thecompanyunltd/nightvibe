// my-profile.js - Updated for Firebase v8 (no ES6 imports)

// DOM Elements and State
let currentProfileData = null;
// Remove: let currentUser = null; (using global from app.js)

// Initialize profile page
document.addEventListener('DOMContentLoaded', async () => {
    console.log("My Profile page initializing...");
    
    // Wait for Firebase to be ready
    setTimeout(async () => {
        if (typeof firebase === 'undefined' || !firebase.apps.length) {
            console.error('Firebase not loaded!');
            showNotification('Firebase not loaded. Please refresh page.', 'error');
            return;
        }
        
        // Get current user from Firebase auth
        const user = firebase.auth().currentUser;
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        
        // Use global currentUser if available, otherwise set it
        if (!window.currentUser) {
            window.currentUser = user;
        }
        
        console.log("Current user:", window.currentUser.uid);
        
        await loadProfileData();
        setupEventListeners();
        updateSidebarUserInfo();
    }, 1000);
});

// Load profile data from Firestore
async function loadProfileData() {
    try {
        const db = firebase.firestore();
        const userDoc = await db.collection("users").doc(currentUser.uid).get();
        
        if (userDoc.exists) {
            currentProfileData = {
                id: userDoc.id,
                ...userDoc.data()
            };
            displayProfileData();
            loadUserPhotos();
        } else {
            showNotification('Profile not found', 'error');
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        showNotification('Failed to load profile', 'error');
    }
}

// Display profile data in the UI
function displayProfileData() {
    if (!currentProfileData) return;
    
    // Basic info
    const userName = document.getElementById('userName');
    const profileUsername = document.getElementById('profileUsername');
    const mainAvatar = document.getElementById('mainAvatar');
    const userAvatar = document.getElementById('userAvatar');
    
    if (userName) userName.textContent = currentProfileData.username || 'User';
    if (profileUsername) profileUsername.textContent = currentProfileData.username || 'User';
    
    // Get first photo URL (handle both string and object formats)
    let firstPhotoUrl = 'https://via.placeholder.com/150';
    if (currentProfileData.photos && currentProfileData.photos.length > 0) {
        const firstPhoto = currentProfileData.photos[0];
        firstPhotoUrl = typeof firstPhoto === 'string' ? firstPhoto : firstPhoto.url;
    }
    
    if (mainAvatar) mainAvatar.src = firstPhotoUrl;
    if (userAvatar) userAvatar.src = firstPhotoUrl;
    
    // Stats
    const profileFollowers = document.getElementById('profileFollowers');
    const profileViews = document.getElementById('profileViews');
    const profileRating = document.getElementById('profileRating');
    const totalMessages = document.getElementById('totalMessages');
    const totalLikes = document.getElementById('totalLikes');
    
    if (profileFollowers) profileFollowers.textContent = currentProfileData.followers || 0;
    if (profileViews) profileViews.textContent = currentProfileData.views || 0;
    if (profileRating) profileRating.textContent = (currentProfileData.rating || 0).toFixed(1);
    if (totalMessages) totalMessages.textContent = currentProfileData.totalMessages || 0;
    if (totalLikes) totalLikes.textContent = currentProfileData.likes || 0;
    
    // Calculate member days
    const memberDays = document.getElementById('memberDays');
    if (memberDays && currentProfileData.createdAt) {
        const joinDate = currentProfileData.createdAt.toDate();
        const days = Math.floor((new Date() - joinDate) / (1000 * 60 * 60 * 24));
        memberDays.textContent = days;
    }
    
    // Personal info
    if (currentProfileData.stats) {
        const infoAge = document.getElementById('infoAge');
        const editAge = document.getElementById('editAge');
        const infoPosition = document.getElementById('infoPosition');
        const editPosition = document.getElementById('editPosition');
        const infoStatus = document.getElementById('infoStatus');
        const editStatus = document.getElementById('editStatus');
        const interestsContent = document.getElementById('interestsContent');
        const editInterests = document.getElementById('editInterests');
        
        if (infoAge) infoAge.textContent = currentProfileData.stats.age || 'N/A';
        if (editAge) editAge.value = currentProfileData.stats.age || '';
        
        // Position mapping
        const positionMap = {
            'T': 'T (Top)',
            'TV': 'TV (Versatile Top)',
            'V': 'V (Versatile)',
            'BV': 'BV (Versatile Bottom)',
            'B': 'B (Bottom)'
        };
        if (infoPosition) infoPosition.textContent = positionMap[currentProfileData.stats.position] || 'N/A';
        if (editPosition) editPosition.value = currentProfileData.stats.position || '';
        
        // Relationship status
        if (infoStatus) infoStatus.textContent = currentProfileData.stats.relationshipStatus?.split(':')[0] || 'N/A';
        if (editStatus) editStatus.value = currentProfileData.stats.relationshipStatus || '';
        
        // Interests
        if (interestsContent && currentProfileData.stats.iamInto) {
            interestsContent.innerHTML = `<p>${currentProfileData.stats.iamInto}</p>`;
        }
        if (editInterests) editInterests.value = currentProfileData.stats.iamInto || '';
    }
    
    // Dates
    const infoMemberSince = document.getElementById('infoMemberSince');
    const infoLastActive = document.getElementById('infoLastActive');
    
    if (infoMemberSince && currentProfileData.createdAt) {
        infoMemberSince.textContent = currentProfileData.createdAt.toDate().toLocaleDateString();
    }
    
    if (infoLastActive && currentProfileData.lastActive) {
        infoLastActive.textContent = currentProfileData.lastActive.toDate().toLocaleDateString();
    }
    
    // Admin info (hidden by default)
    const infoRealName = document.getElementById('infoRealName');
    const infoPhone = document.getElementById('infoPhone');
    
    if (infoRealName) infoRealName.textContent = currentProfileData.realName || 'Hidden';
    if (infoPhone) infoPhone.textContent = currentProfileData.phone || 'Hidden';
    
    // About me
    const aboutContent = document.getElementById('aboutContent');
    const editAbout = document.getElementById('editAbout');
    
    if (aboutContent && currentProfileData.about) {
        aboutContent.innerHTML = `<p>${currentProfileData.about}</p>`;
    }
    if (editAbout) editAbout.value = currentProfileData.about || '';
    
    // Preferences
    const toggleAge = document.getElementById('toggleAge');
    const toggleStatus = document.getElementById('toggleStatus');
    const toggleMessages = document.getElementById('toggleMessages');
    const toggleOnline = document.getElementById('toggleOnline');
    
    if (currentProfileData.preferences) {
        if (toggleAge) toggleAge.checked = currentProfileData.preferences.showAge !== false;
        if (toggleStatus) toggleStatus.checked = currentProfileData.preferences.showStatus !== false;
        if (toggleMessages) toggleMessages.checked = currentProfileData.preferences.receiveMessages !== false;
        if (toggleOnline) toggleOnline.checked = currentProfileData.preferences.showOnline !== false;
    }
}

// Load user photos
function loadUserPhotos() {
    const photosGrid = document.getElementById('photosGrid');
    if (!photosGrid) return;
    
    photosGrid.innerHTML = '';
    
    if (!currentProfileData.photos || currentProfileData.photos.length === 0) {
        photosGrid.innerHTML = `
            <div class="no-photos">
                <i class="fas fa-camera"></i>
                <p>No photos uploaded yet</p>
            </div>
        `;
        return;
    }
    
    currentProfileData.photos.forEach((photo, index) => {
        const photoItem = document.createElement('div');
        photoItem.className = 'photo-item';
        
        // Get photo URL (handle both string and object formats)
        const photoUrl = typeof photo === 'string' ? photo : photo.url;
        
        photoItem.innerHTML = `
            <img src="${photoUrl}" alt="Photo ${index + 1}">
            <div class="photo-actions">
                <button class="photo-action-btn" onclick="setAsProfilePhoto(${index})" title="Set as profile">
                    <i class="fas fa-user"></i>
                </button>
                <button class="photo-action-btn" onclick="deletePhoto(${index})" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        photosGrid.appendChild(photoItem);
    });
}

// Setup event listeners
function setupEventListeners() {
    // Edit profile form
    const editProfileForm = document.getElementById('editProfileForm');
    if (editProfileForm) {
        editProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveProfileChanges();
        });
    }
    
    // Photo upload
    const photoInput = document.getElementById('photoInput');
    if (photoInput) {
        photoInput.addEventListener('change', handlePhotoUpload);
    }
    
    // Preference toggles
    const toggleAge = document.getElementById('toggleAge');
    const toggleStatus = document.getElementById('toggleStatus');
    const toggleMessages = document.getElementById('toggleMessages');
    const toggleOnline = document.getElementById('toggleOnline');
    
    if (toggleAge) toggleAge.addEventListener('change', updatePreference);
    if (toggleStatus) toggleStatus.addEventListener('change', updatePreference);
    if (toggleMessages) toggleMessages.addEventListener('change', updatePreference);
    if (toggleOnline) toggleOnline.addEventListener('change', updatePreference);
    
    // Drag and drop for photo upload
    const uploadArea = document.getElementById('uploadArea');
    if (uploadArea) {
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            handlePhotoFiles(files);
        });
    }
}

// Open edit modal
function editProfile() {
    const editProfileModal = document.getElementById('editProfileModal');
    if (editProfileModal) editProfileModal.style.display = 'block';
}

// Close edit modal
function closeEditModal() {
    const editProfileModal = document.getElementById('editProfileModal');
    if (editProfileModal) editProfileModal.style.display = 'none';
}

// Open photo upload modal
function openPhotoUpload() {
    const photoUploadModal = document.getElementById('photoUploadModal');
    if (photoUploadModal) photoUploadModal.style.display = 'block';
}

// Close photo upload modal
function closePhotoModal() {
    const photoUploadModal = document.getElementById('photoUploadModal');
    const uploadedPhotos = document.getElementById('uploadedPhotos');
    const uploadProgress = document.getElementById('uploadProgress');
    const photoInput = document.getElementById('photoInput');
    
    if (photoUploadModal) photoUploadModal.style.display = 'none';
    if (uploadedPhotos) uploadedPhotos.innerHTML = '';
    if (uploadProgress) uploadProgress.style.display = 'none';
    if (photoInput) photoInput.value = '';
}

// Open avatar upload
function openAvatarUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            await uploadProfilePhoto(file, true);
        }
    };
    input.click();
}

// Handle photo upload
async function handlePhotoUpload(e) {
    const files = e.target.files;
    handlePhotoFiles(files);
}

async function handlePhotoFiles(files) {
    if (!files || !files.length) return;
    
    // Clear previous uploads
    const uploadedPhotos = document.getElementById('uploadedPhotos');
    const uploadProgress = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    if (uploadedPhotos) uploadedPhotos.innerHTML = '';
    if (uploadProgress) uploadProgress.style.display = 'block';
    if (progressFill) progressFill.style.width = '0%';
    if (progressText) progressText.textContent = 'Starting upload...';
    
    const uploadedUrls = [];
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Update progress
        if (progressFill && progressText) {
            const progress = ((i + 1) / files.length) * 100;
            progressFill.style.width = `${progress}%`;
            progressText.textContent = `Uploading ${i + 1}/${files.length}...`;
        }
        
        try {
            const photoData = await uploadProfilePhoto(file);
            uploadedUrls.push(photoData);
            
            // Show preview
            if (uploadedPhotos) {
                const preview = document.createElement('div');
                preview.className = 'uploaded-photo-preview';
                preview.innerHTML = `
                    <img src="${photoData.url}" alt="Uploaded">
                    <div class="preview-overlay">
                        <i class="fas fa-check"></i>
                    </div>
                `;
                uploadedPhotos.appendChild(preview);
            }
            
        } catch (error) {
            console.error('Error uploading photo:', error);
            showNotification(`Failed to upload ${file.name}`, 'error');
        }
    }
    
    // Update user's photos in Firestore
    if (uploadedUrls.length > 0) {
        const updatedPhotos = [...(currentProfileData.photos || []), ...uploadedUrls];
        await updateUserPhotos(updatedPhotos);
        
        if (progressFill) progressFill.style.width = '100%';
        if (progressText) progressText.textContent = 'Upload complete!';
        
        setTimeout(() => {
            closePhotoModal();
            loadProfileData(); // Refresh profile data
            showNotification('Photos uploaded successfully', 'success');
        }, 1000);
    }
}

// Upload profile photo to Cloudinary
async function uploadProfilePhoto(file, isAvatar = false) {
    try {
        const result = await uploadToCloudinary(file);
        
        const photoData = {
            url: result.url,
            publicId: result.publicId,
            uploadedAt: new Date().toISOString(),
            format: result.format,
            bytes: result.bytes
        };
        
        if (isAvatar) {
            // Set as profile photo (move to first position)
            const currentPhotos = currentProfileData.photos || [];
            const otherPhotos = currentPhotos.filter(p => {
                const existingUrl = typeof p === 'string' ? p : p.url;
                return existingUrl !== result.url;
            });
            const updatedPhotos = [photoData, ...otherPhotos];
            await updateUserPhotos(updatedPhotos);
            showNotification('Profile photo updated', 'success');
            loadProfileData();
        }
        
        return photoData;
        
    } catch (error) {
        console.error('Upload error:', error);
        throw error;
    }
}

// Upload to Cloudinary
async function uploadToCloudinary(file) {
    const cloudName = window.CLOUDINARY_CONFIG?.CLOUDINARY_CLOUD_NAME || 'do71fxllc';
    const uploadPreset = window.CLOUDINARY_CONFIG?.CLOUDINARY_UPLOAD_PRESET || 'nightvibe_upload';
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);
    formData.append('cloud_name', cloudName);
    
    try {
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
            {
                method: 'POST',
                body: formData
            }
        );
        
        if (!response.ok) {
            throw new Error('Upload failed');
        }
        
        const data = await response.json();
        return {
            url: data.secure_url,
            publicId: data.public_id,
            format: data.format,
            bytes: data.bytes,
            width: data.width,
            height: data.height
        };
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        throw error;
    }
}

// Update user photos in Firestore
async function updateUserPhotos(photos) {
    try {
        const db = firebase.firestore();
        await db.collection("users").doc(currentUser.uid).update({
            photos: photos,
            lastActive: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Update local data
        currentProfileData.photos = photos;
        
    } catch (error) {
        console.error('Error updating photos:', error);
        throw error;
    }
}

// Set photo as profile photo
async function setAsProfilePhoto(index) {
    if (!currentProfileData.photos || !currentProfileData.photos[index]) return;
    
    // Move the selected photo to first position
    const selectedPhoto = currentProfileData.photos[index];
    const otherPhotos = currentProfileData.photos.filter((_, i) => i !== index);
    const updatedPhotos = [selectedPhoto, ...otherPhotos];
    
    await updateUserPhotos(updatedPhotos);
    showNotification('Profile photo updated', 'success');
    loadProfileData();
}

// Delete photo
async function deletePhoto(index) {
    if (!confirm('Are you sure you want to delete this photo?')) return;
    
    try {
        // Remove from array
        const updatedPhotos = currentProfileData.photos.filter((_, i) => i !== index);
        
        // Update Firestore
        await updateUserPhotos(updatedPhotos);
        
        // Try to delete from Cloudinary if we have publicId
        const photoToDelete = currentProfileData.photos[index];
        if (photoToDelete && photoToDelete.publicId) {
            try {
                await deleteFromCloudinary(photoToDelete.publicId);
            } catch (cloudinaryError) {
                console.warn('Could not delete from Cloudinary:', cloudinaryError);
            }
        }
        
        showNotification('Photo deleted', 'success');
        loadProfileData();
        
    } catch (error) {
        console.error('Error deleting photo:', error);
        showNotification('Failed to delete photo', 'error');
    }
}

// Delete from Cloudinary
async function deleteFromCloudinary(publicId) {
    const cloudName = window.CLOUDINARY_CONFIG?.CLOUDINARY_CLOUD_NAME || 'do71fxllc';
    const uploadPreset = window.CLOUDINARY_CONFIG?.CLOUDINARY_UPLOAD_PRESET || 'nightvibe_upload';
    
    const formData = new FormData();
    formData.append('public_id', publicId);
    formData.append('upload_preset', uploadPreset);
    formData.append('cloud_name', cloudName);
    
    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
        {
            method: 'POST',
            body: formData
        }
    );
    
    const data = await response.json();
    return data.result === 'ok';
}

// Save profile changes
async function saveProfileChanges() {
    try {
        const editAge = document.getElementById('editAge');
        const editPosition = document.getElementById('editPosition');
        const editStatus = document.getElementById('editStatus');
        const editAbout = document.getElementById('editAbout');
        const editInterests = document.getElementById('editInterests');
        
        const age = editAge ? parseInt(editAge.value) : null;
        const position = editPosition ? editPosition.value : '';
        const relationshipStatus = editStatus ? editStatus.value : '';
        const about = editAbout ? editAbout.value : '';
        const interests = editInterests ? editInterests.value : '';
        
        // Validation
        if (age && (age < 18 || age > 65)) {
            showNotification('Age must be between 18 and 65', 'error');
            return;
        }
        
        // Prepare update data
        const updateData = {
            lastActive: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Add stats if provided
        if (age || position || relationshipStatus || interests) {
            updateData.stats = {};
            if (currentProfileData.stats) {
                updateData.stats = { ...currentProfileData.stats };
            }
            
            if (age) updateData.stats.age = age;
            if (position) updateData.stats.position = position;
            if (relationshipStatus) updateData.stats.relationshipStatus = relationshipStatus;
            if (interests) updateData.stats.iamInto = interests;
        }
        
        if (about) updateData.about = about;
        
        // Update Firestore
        const db = firebase.firestore();
        await db.collection("users").doc(currentUser.uid).update(updateData);
        
        // Update local data
        if (updateData.stats) {
            if (!currentProfileData.stats) currentProfileData.stats = {};
            Object.assign(currentProfileData.stats, updateData.stats);
        }
        if (about) currentProfileData.about = about;
        
        // Update UI
        displayProfileData();
        
        closeEditModal();
        showNotification('Profile updated successfully', 'success');
        
    } catch (error) {
        console.error('Error saving profile:', error);
        showNotification('Failed to update profile', 'error');
    }
}

// Update preference
async function updatePreference(e) {
    const preference = e.target.id.replace('toggle', '').toLowerCase();
    const value = e.target.checked;
    
    try {
        const db = firebase.firestore();
        await db.collection("users").doc(currentUser.uid).update({
            [`preferences.${preference}`]: value,
            lastActive: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Update local data
        if (!currentProfileData.preferences) currentProfileData.preferences = {};
        currentProfileData.preferences[preference] = value;
        
        showNotification('Preference updated', 'success');
        
    } catch (error) {
        console.error('Error updating preference:', error);
        showNotification('Failed to update preference', 'error');
        e.target.checked = !value; // Revert UI
    }
}

// Edit about section
function editAbout() {
    editProfile();
}

// Edit interests
function editInterests() {
    editProfile();
}

// Edit preferences
function editPreferences() {
    // Already handled by toggle switches
}

// Share profile
function shareProfile() {
    const profileUrl = `${window.location.origin}/view-profile.html?id=${currentUser.uid}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(profileUrl)
            .then(() => showNotification('Profile link copied to clipboard', 'success'))
            .catch(() => showNotification('Failed to copy link', 'error'));
    } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = profileUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showNotification('Profile link copied to clipboard', 'success');
    }
}

// View as others
function viewAsOthers() {
    // Toggle admin-only info visibility
    const adminElements = document.querySelectorAll('.admin-only');
    adminElements.forEach(el => {
        el.style.display = el.style.display === 'none' ? 'inline' : 'none';
    });
    
    showNotification('Toggled admin view', 'info');
}

// Change password
async function changePassword() {
    const newPassword = prompt('Enter new password (min 6 characters):');
    if (!newPassword || newPassword.length < 6) {
        showNotification('Password must be at least 6 characters', 'error');
        return;
    }
    
    if (confirm('Are you sure you want to change your password?')) {
        try {
            await currentUser.updatePassword(newPassword);
            showNotification('Password changed successfully', 'success');
        } catch (error) {
            console.error('Error changing password:', error);
            showNotification('Failed to change password', 'error');
        }
    }
}

// Download user data
async function downloadData() {
    try {
        const db = firebase.firestore();
        const userDoc = await db.collection("users").doc(currentUser.uid).get();
        
        if (userDoc.exists) {
            const data = {
                userData: userDoc.data(),
                downloadDate: new Date().toISOString()
            };
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `nightvibe-data-${currentUser.uid}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showNotification('Data download started', 'success');
        }
    } catch (error) {
        console.error('Error downloading data:', error);
        showNotification('Failed to download data', 'error');
    }
}

// Delete account
async function deleteAccount() {
    const confirmation = prompt('Type "DELETE" to confirm account deletion:');
    if (confirmation !== 'DELETE') {
        showNotification('Account deletion cancelled', 'info');
        return;
    }
    
    if (confirm('WARNING: This will permanently delete your account and all data. This cannot be undone. Continue?')) {
        try {
            const db = firebase.firestore();
            
            // Delete from Firestore
            await db.collection("users").doc(currentUser.uid).delete();
            
            // Delete from Authentication
            await currentUser.delete();
            
            showNotification('Account deleted successfully', 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
            
        } catch (error) {
            console.error('Error deleting account:', error);
            showNotification('Failed to delete account', 'error');
        }
    }
}

// Update sidebar user info
function updateSidebarUserInfo() {
    if (currentProfileData) {
        const userName = document.getElementById('userName');
        const userAvatar = document.getElementById('userAvatar');
        
        if (userName) userName.textContent = currentProfileData.username || 'User';
        if (userAvatar) {
            let avatarUrl = 'https://via.placeholder.com/100';
            if (currentProfileData.photos && currentProfileData.photos.length > 0) {
                const firstPhoto = currentProfileData.photos[0];
                avatarUrl = typeof firstPhoto === 'string' ? firstPhoto : firstPhoto.url;
            }
            userAvatar.src = avatarUrl;
        }
    }
}

// Toggle sidebar (for mobile)
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.classList.toggle('active');
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    });
};

// Notification function
function showNotification(message, type = 'info') {
    console.log(`Notification [${type}]: ${message}`);
    
    // Use app.js notification if available
    if (window.showNotification && window.showNotification !== showNotification) {
        window.showNotification(message, type);
        return;
    }
    
    // Fallback notification
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">×</button>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Make functions globally available
window.editProfile = editProfile;
window.closeEditModal = closeEditModal;
window.openPhotoUpload = openPhotoUpload;
window.closePhotoModal = closePhotoModal;
window.openAvatarUpload = openAvatarUpload;
window.setAsProfilePhoto = setAsProfilePhoto;
window.deletePhoto = deletePhoto;
window.saveProfileChanges = saveProfileChanges;
window.editAbout = editAbout;
window.editInterests = editInterests;
window.editPreferences = editPreferences;
window.shareProfile = shareProfile;
window.viewAsOthers = viewAsOthers;
window.changePassword = changePassword;
window.downloadData = downloadData;
window.deleteAccount = deleteAccount;
window.toggleSidebar = toggleSidebar;
window.logout = function() {
    if (firebase.auth().currentUser) {
        firebase.auth().signOut().then(() => {
            window.location.href = 'index.html';
        });
    } else {
        window.location.href = 'index.html';
    }
};