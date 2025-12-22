// cloudinary.js
const CLOUDINARY_CLOUD_NAME = 'do71fxllc';
const CLOUDINARY_UPLOAD_PRESET = 'nightvibe_upload';

// Upload image to Cloudinary
async function uploadToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    
    try {
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
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
            bytes: data.bytes
        };
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        throw error;
    }
}

// Delete image from Cloudinary
async function deleteFromCloudinary(publicId) {
    try {
        const timestamp = Math.round(new Date().getTime() / 1000);
        const signature = ''; // You can generate if needed
        
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/destroy`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    public_id: publicId,
                    timestamp: timestamp,
                    api_key: 'YOUR_API_KEY', // Optional
                    signature: signature // Optional
                })
            }
        );
        
        return response.json();
    } catch (error) {
        console.error('Delete error:', error);
    }
}

export { uploadToCloudinary, deleteFromCloudinary };