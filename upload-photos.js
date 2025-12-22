// upload-photos.js - Photo Upload with Cloudinary
// Updated version with better Firebase initialization handling

let currentUser = null;
let uploadedPhotos = [];
let isUploading = false;
let currentPreviewIndex = -1;

// Cloudinary Configuration
const CLOUDINARY_CLOUD_NAME = window.CLOUDINARY_CONFIG?.CLOUDINARY_CLOUD_NAME || 'do71fxllc';
const CLOUDINARY_UPLOAD_PRESET = window.CLOUDINARY_CONFIG?.CLOUDINARY_UPLOAD_PRESET || 'nightvibe_upload';

console.log('Cloudinary config in JS:', { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET });

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Initializing upload page...');
    
    // Wait a moment for Firebase to be fully loaded
    setTimeout(() => {
        if (typeof firebase === 'undefined' || !firebase.apps.length) {
            console.error('Firebase not properly initialized');
            showNotification('Firebase initialization failed. Please refresh the page.', 'error');
            return;
        }
        
        console.log('Firebase is initialized, checking auth...');
        
        // Check if user is logged in
        firebase.auth().onAuthStateChanged(async (user) => {
            if (!user) {
                // Not logged in, redirect to login
                showNotification('Please login first', 'error');
                setTimeout(() => window.location.href = 'index.html', 1500);
                return;
            }
            
            currentUser = user;
            console.log('User authenticated:', user.uid);
            
            try {
                await loadExistingPhotos();
                setupEventListeners();
                updateSidebarUserInfo();
                updateProgress();
                
                // Check if user already has enough photos
                if (uploadedPhotos.length >= 5) {
                    const completeButton = document.getElementById('completeButton');
                    const skipButton = document.getElementById('skipButton');
                    if (completeButton) completeButton.disabled = false;
                    if (skipButton) skipButton.style.display = 'none';
                }
                
            } catch (error) {
                console.error('Initialization error:', error);
                showNotification('Failed to initialize page', 'error');
            }
        });
    }, 500); // Small delay to ensure Firebase is ready
});

// [Rest of the upload-photos.js code remains the same as before...]
// All the functions below stay exactly as in the previous version I provided

// Load existing photos from Firestore
async function loadExistingPhotos() {
    try {
        const userDoc = await firebase.firestore().collection("users").doc(currentUser.uid).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            uploadedPhotos = userData.photos || [];
            console.log('Loaded photos:', uploadedPhotos.length);
            displayUploadedPhotos();
        }
    } catch (error) {
        console.error('Error loading photos:', error);
        showNotification('Failed to load existing photos', 'error');
    }
}

// Display uploaded photos
function displayUploadedPhotos() {
    const grid = document.getElementById('photosPreviewGrid');
    const photoCount = document.getElementById('photoCount');
    
    if (photoCount) {
        photoCount.textContent = `(${uploadedPhotos.length}/5)`;
    }
    
    if (!grid) return;
    
    if (uploadedPhotos.length === 0) {
        grid.innerHTML = `
            <div class="empty-photos">
                <i class="fas fa-images"></i>
                <p>No photos uploaded yet</p>
                <p class="empty-hint">Drag & drop photos here or click to browse</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = '';
    
    uploadedPhotos.forEach((photo, index) => {
        const photoUrl = typeof photo === 'string' ? photo : photo.url;
        const photoItem = document.createElement('div');
        photoItem.className = 'preview-photo-item';
        photoItem.innerHTML = `
            <img src="${photoUrl}" alt="Photo ${index + 1}" onclick="previewPhoto(${index})">
            <div class="photo-overlay">
                <button class="photo-action-btn" onclick="setAsPrimary(${index})" title="Set as primary">
                    <i class="fas fa-star"></i>
                </button>
                <button class="photo-action-btn" onclick="removePhoto(${index})" title="Remove">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            ${index === 0 ? '<span class="primary-badge">Primary</span>' : ''}
        `;
        grid.appendChild(photoItem);
    });
    
    updateProgress();
}

// Setup event listeners
function setupEventListeners() {
    console.log('Setting up upload event listeners...');
    
    // File input change
    const photoUploadInput = document.getElementById('photoUploadInput');
    if (photoUploadInput) {
        photoUploadInput.addEventListener('change', handleFileSelect);
        
        // Also make upload box clickable
        const uploadBox = document.getElementById('uploadBox');
        if (uploadBox) {
            uploadBox.addEventListener('click', () => {
                photoUploadInput.click();
            });
        }
    }
    
    // Drag and drop
    const uploadBox = document.getElementById('uploadBox');
    if (uploadBox) {
        uploadBox.addEventListener('dragover', handleDragOver);
        uploadBox.addEventListener('dragleave', handleDragLeave);
        uploadBox.addEventListener('drop', handleDrop);
    }
    
    // Skip button
    const skipButton = document.getElementById('skipButton');
    if (skipButton) {
        skipButton.addEventListener('click', skipForNow);
    }
    
    // Complete button
    const completeButton = document.getElementById('completeButton');
    if (completeButton) {
        completeButton.addEventListener('click', completeUpload);
    }
    
    // Close preview button
    const closePreview = document.querySelector('.close-preview');
    if (closePreview) {
        closePreview.addEventListener('click', closePreviewModal);
    }
    
    // Remove current photo button
    const removeCurrentBtn = document.getElementById('removeCurrentPhoto');
    if (removeCurrentBtn) {
        removeCurrentBtn.addEventListener('click', removeCurrentPhoto);
    }
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('photoPreviewModal');
        if (event.target === modal) {
            closePreviewModal();
        }
    });
}

// Drag and drop handlers
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    const uploadBox = document.getElementById('uploadBox');
    if (uploadBox) uploadBox.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    const uploadBox = document.getElementById('uploadBox');
    if (uploadBox) uploadBox.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const uploadBox = document.getElementById('uploadBox');
    if (uploadBox) uploadBox.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    handleFiles(files);
}

// File selection handler
function handleFileSelect(e) {
    const files = e.target.files;
    handleFiles(files);
}

// Handle files
function handleFiles(files) {
    if (isUploading) {
        showNotification('Please wait for current uploads to complete', 'warning');
        return;
    }
    
    if (!files || files.length === 0) return;
    
    // Check total photos limit
    const totalAfterUpload = uploadedPhotos.length + files.length;
    if (totalAfterUpload > 10) {
        showNotification(`You can only upload up to 10 photos total. You have ${uploadedPhotos.length} already.`, 'error');
        return;
    }
    
    // Filter valid image files
    const validFiles = Array.from(files).filter(file => {
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
        return validTypes.includes(file.type);
    });
    
    if (validFiles.length === 0) {
        showNotification('No valid image files selected. Please select JPG, PNG, WebP, or GIF files.', 'error');
        return;
    }
    
    if (validFiles.length < files.length) {
        showNotification(`Some files were skipped. Only ${validFiles.length} valid image(s) will be uploaded.`, 'warning');
    }
    
    // Process valid files
    processFiles(validFiles);
}

// Process and upload files
async function processFiles(files) {
    isUploading = true;
    
    // Show progress container
    const progressContainer = document.getElementById('uploadProgressDetails');
    const progressItemsContainer = document.getElementById('progressItems');
    
    if (progressContainer) progressContainer.style.display = 'block';
    if (progressItemsContainer) progressItemsContainer.innerHTML = '';
    
    try {
        // Create progress items
        const progressItems = files.map((file, index) => {
            const progressId = `progress-${Date.now()}-${index}`;
            if (progressItemsContainer) {
                const item = document.createElement('div');
                item.className = 'progress-item';
                item.id = progressId;
                item.innerHTML = `
                    <div class="progress-file-info">
                        <span class="file-name">${file.name}</span>
                        <span class="file-size">${formatFileSize(file.size)}</span>
                    </div>
                    <div class="progress-bar-small">
                        <div class="progress-fill-small" id="${progressId}-fill"></div>
                    </div>
                    <div class="progress-status" id="${progressId}-status">Pending</div>
                `;
                progressItemsContainer.appendChild(item);
            }
            return { file, progressId };
        });
        
        // Upload files sequentially
        for (const item of progressItems) {
            await uploadFile(item.file, item.progressId);
        }
        
        showNotification('All photos uploaded successfully!', 'success');
        
    } catch (error) {
        console.error('Upload process error:', error);
        showNotification('Some uploads failed', 'error');
    } finally {
        isUploading = false;
        
        // Hide progress after delay
        setTimeout(() => {
            const progressContainer = document.getElementById('uploadProgressDetails');
            if (progressContainer) progressContainer.style.display = 'none';
        }, 3000);
    }
}

// Upload single file
async function uploadFile(file, progressId) {
    return new Promise(async (resolve, reject) => {
        try {
            // Check file size (10MB limit)
            const MAX_SIZE = 10 * 1024 * 1024;
            if (file.size > MAX_SIZE) {
                updateProgressStatus(progressId, 'File too large (max 10MB)', 'error');
                reject(new Error('File too large'));
                return;
            }
            
            // Check file type
            const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
            if (!validTypes.includes(file.type)) {
                updateProgressStatus(progressId, 'Invalid file type', 'error');
                reject(new Error('Invalid file type'));
                return;
            }
            
            updateProgressStatus(progressId, 'Processing...', 'uploading');
            
            // Upload to Cloudinary
            const result = await uploadToCloudinary(file, (progress) => {
                updateProgressFill(progressId, progress);
                updateProgressStatus(progressId, `Uploading... ${progress}%`, 'uploading');
            });
            
            // Create photo data
            const photoData = {
                url: result.url,
                publicId: result.publicId,
                uploadedAt: new Date().toISOString(),
                format: result.format,
                bytes: result.bytes
            };
            
            // Add to uploaded photos
            uploadedPhotos.push(photoData);
            
            // Update Firestore
            await firebase.firestore().collection("users").doc(currentUser.uid).update({
                photos: uploadedPhotos,
                lastActive: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Update UI
            displayUploadedPhotos();
            updateProgressStatus(progressId, 'Uploaded', 'success');
            
            // Enable complete button if we have enough photos
            if (uploadedPhotos.length >= 5) {
                const completeButton = document.getElementById('completeButton');
                const skipButton = document.getElementById('skipButton');
                if (completeButton) completeButton.disabled = false;
                if (skipButton) skipButton.style.display = 'none';
            }
            
            resolve(result.url);
            
        } catch (error) {
            console.error('Upload file error:', error);
            updateProgressStatus(progressId, 'Upload failed', 'error');
            reject(error);
        }
    });
}

// Upload to Cloudinary
async function uploadToCloudinary(file, onProgress) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        formData.append('cloud_name', CLOUDINARY_CLOUD_NAME);
        
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable && onProgress) {
                const percentComplete = Math.round((event.loaded / event.total) * 100);
                onProgress(percentComplete);
            }
        });
        
        xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    resolve({
                        url: data.secure_url,
                        publicId: data.public_id,
                        format: data.format,
                        bytes: data.bytes,
                        width: data.width,
                        height: data.height
                    });
                } catch (error) {
                    reject(new Error('Invalid response from Cloudinary'));
                }
            } else {
                reject(new Error(`Upload failed: ${xhr.statusText}`));
            }
        });
        
        xhr.addEventListener('error', () => {
            reject(new Error('Network error during upload'));
        });
        
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`);
        xhr.send(formData);
    });
}

// Update progress UI
function updateProgressFill(progressId, percentage) {
    const fillElement = document.getElementById(`${progressId}-fill`);
    if (fillElement) {
        fillElement.style.width = `${percentage}%`;
    }
}

function updateProgressStatus(progressId, status, type) {
    const statusElement = document.getElementById(`${progressId}-status`);
    if (statusElement) {
        statusElement.textContent = status;
        statusElement.className = `progress-status ${type}`;
    }
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Update progress bar
function updateProgress() {
    const progress = (uploadedPhotos.length / 5) * 100;
    const progressFill = document.getElementById('photoProgressFill');
    const progressText = document.getElementById('photoProgressText');
    
    if (progressFill) {
        progressFill.style.width = `${Math.min(progress, 100)}%`;
    }
    
    if (progressText) {
        progressText.textContent = `${uploadedPhotos.length}/5 photos`;
        
        if (uploadedPhotos.length >= 5) {
            progressText.innerHTML += ' <i class="fas fa-check-circle"></i>';
        }
    }
}

// Photo preview functions
function previewPhoto(index) {
    currentPreviewIndex = index;
    const photo = uploadedPhotos[index];
    const photoUrl = typeof photo === 'string' ? photo : photo.url;
    const previewImage = document.getElementById('previewImage');
    const previewModal = document.getElementById('photoPreviewModal');
    
    if (previewImage) previewImage.src = photoUrl;
    if (previewModal) previewModal.style.display = 'block';
}

function closePreviewModal() {
    const previewModal = document.getElementById('photoPreviewModal');
    if (previewModal) previewModal.style.display = 'none';
    currentPreviewIndex = -1;
}

function removeCurrentPhoto() {
    if (currentPreviewIndex >= 0) {
        removePhoto(currentPreviewIndex);
        closePreviewModal();
    }
}

// Remove photo
async function removePhoto(index) {
    if (index < 0 || index >= uploadedPhotos.length) return;
    
    if (!confirm('Are you sure you want to remove this photo?')) return;
    
    try {
        const photo = uploadedPhotos[index];
        
        // Try to delete from Cloudinary if publicId exists
        if (photo && photo.publicId) {
            try {
                await deleteFromCloudinary(photo.publicId);
            } catch (error) {
                console.warn('Could not delete from Cloudinary:', error);
            }
        }
        
        // Remove from array
        uploadedPhotos.splice(index, 1);
        
        // Update Firestore
        await firebase.firestore().collection("users").doc(currentUser.uid).update({
            photos: uploadedPhotos,
            lastActive: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Update UI
        displayUploadedPhotos();
        showNotification('Photo removed', 'success');
        
        // Update button states
        if (uploadedPhotos.length < 5) {
            const completeButton = document.getElementById('completeButton');
            const skipButton = document.getElementById('skipButton');
            if (completeButton) completeButton.disabled = true;
            if (skipButton) skipButton.style.display = 'block';
        }
        
    } catch (error) {
        console.error('Error removing photo:', error);
        showNotification('Failed to remove photo', 'error');
    }
}

// Delete from Cloudinary
async function deleteFromCloudinary(publicId) {
    const formData = new FormData();
    formData.append('public_id', publicId);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('cloud_name', CLOUDINARY_CLOUD_NAME);
    
    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/destroy`,
        {
            method: 'POST',
            body: formData
        }
    );
    
    const data = await response.json();
    return data.result === 'ok';
}

// Set photo as primary
async function setAsPrimary(index) {
    if (index === 0 || index >= uploadedPhotos.length) return;
    
    try {
        const photo = uploadedPhotos[index];
        const updatedPhotos = [photo, ...uploadedPhotos.filter((_, i) => i !== index)];
        
        // Update Firestore
        await firebase.firestore().collection("users").doc(currentUser.uid).update({
            photos: updatedPhotos,
            lastActive: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Update local array
        uploadedPhotos = updatedPhotos;
        
        // Update UI
        displayUploadedPhotos();
        showNotification('Primary photo updated', 'success');
        
    } catch (error) {
        console.error('Error setting primary photo:', error);
        showNotification('Failed to update primary photo', 'error');
    }
}

// Skip for now
function skipForNow() {
    if (uploadedPhotos.length === 0) {
        if (!confirm('You haven\'t uploaded any photos. Without photos, your profile will not be visible to others. Continue anyway?')) {
            return;
        }
    }
    
    window.location.href = 'dashboard.html';
}

// Complete upload
async function completeUpload() {
    if (uploadedPhotos.length < 5) {
        showNotification('You need at least 5 photos to complete setup', 'error');
        return;
    }
    
    try {
        await firebase.firestore().collection("users").doc(currentUser.uid).update({
            profileComplete: true,
            lastActive: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showNotification('Profile setup complete! Redirecting...', 'success');
        
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1500);
        
    } catch (error) {
        console.error('Error completing setup:', error);
        showNotification('Failed to complete setup', 'error');
    }
}

// Update sidebar user info
async function updateSidebarUserInfo() {
    try {
        const userDoc = await firebase.firestore().collection("users").doc(currentUser.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            
            const userName = document.getElementById('userName');
            const userAvatar = document.getElementById('userAvatar');
            const userStatus = document.getElementById('userStatus');
            
            if (userName) userName.textContent = userData.username || 'User';
            if (userStatus) userStatus.textContent = userData.profileComplete ? 'Profile Complete' : 'Setup Required';
            
            if (userAvatar) {
                let avatarUrl = 'https://via.placeholder.com/100';
                if (userData.photos && userData.photos.length > 0) {
                    const firstPhoto = userData.photos[0];
                    avatarUrl = typeof firstPhoto === 'string' ? firstPhoto : firstPhoto.url;
                }
                userAvatar.src = avatarUrl;
            }
        }
    } catch (error) {
        console.error('Error updating sidebar info:', error);
    }
}

// Toggle sidebar
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.classList.toggle('active');
    }
}

// Show notification
function showNotification(message, type = 'info') {
    // Use the showNotification function from app.js if it exists
    if (window.showNotification) {
        window.showNotification(message, type);
        return;
    }
    
    // Fallback notification
    alert(`${type.toUpperCase()}: ${message}`);
}

// Make functions globally available
window.previewPhoto = previewPhoto;
window.closePreviewModal = closePreviewModal;
window.removeCurrentPhoto = removeCurrentPhoto;
window.removePhoto = removePhoto;
window.setAsPrimary = setAsPrimary;
window.toggleSidebar = toggleSidebar;
window.skipForNow = skipForNow;
window.completeUpload = completeUpload;
window.logout = function() {
    if (window.logout) {
        window.logout();
    } else {
        firebase.auth().signOut().then(() => {
            window.location.href = 'index.html';
        });
    }
};