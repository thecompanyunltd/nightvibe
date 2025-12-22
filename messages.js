// messages.js - Updated version with Firebase v8 and proper variable handling

// Check if currentUser is already defined in app.js
let currentUser = window.currentUser || null;
let conversations = [];
let activeConversation = null;
let conversationListeners = [];
let selectedRecipients = [];

// Initialize messages page
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Messages page initializing...");
    
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
        
        currentUser = user;
        console.log("Current user:", currentUser.uid);
        
        await initializeMessages();
        setupEventListeners();
        updateSidebarUserInfo();
    }, 1000);
});

// Initialize messages functionality
async function initializeMessages() {
    try {
        await loadConversations();
        setupRealTimeListeners();
        updateUnreadCount();
    } catch (error) {
        console.error('Error initializing messages:', error);
        showNotification('Failed to initialize messages', 'error');
    }
}

// Load conversations from Firestore
async function loadConversations() {
    try {
        const db = firebase.firestore();
        
        // Get all messages where user is sender or receiver
        const messagesRef = db.collection("messages");
        const querySnapshot = await messagesRef
            .where("participants", "array-contains", currentUser.uid)
            .get();
        
        // Process messages into conversations
        const conversationsMap = new Map();
        
        querySnapshot.forEach(doc => {
            const message = { id: doc.id, ...doc.data() };
            
            // Find other participant
            const otherParticipant = message.participants.find(id => id !== currentUser.uid);
            if (!otherParticipant) return;
            
            // Get or create conversation
            if (!conversationsMap.has(otherParticipant)) {
                conversationsMap.set(otherParticipant, {
                    participantId: otherParticipant,
                    messages: [],
                    unreadCount: 0,
                    lastMessage: null
                });
            }
            
            const conversation = conversationsMap.get(otherParticipant);
            conversation.messages.push(message);
            
            // Update last message
            if (!conversation.lastMessage || message.timestamp > conversation.lastMessage.timestamp) {
                conversation.lastMessage = message;
            }
            
            // Update unread count
            if (!message.readBy?.includes(currentUser.uid)) {
                conversation.unreadCount++;
            }
        });
        
        // Convert map to array and sort by last message timestamp
        conversations = Array.from(conversationsMap.values());
        conversations.sort((a, b) => {
            const timeA = a.lastMessage?.timestamp?.toDate() || new Date(0);
            const timeB = b.lastMessage?.timestamp?.toDate() || new Date(0);
            return timeB - timeA;
        });
        
        displayConversations();
        
    } catch (error) {
        console.error('Error loading conversations:', error);
        showNotification('Failed to load conversations', 'error');
    }
}

// Display conversations in sidebar
function displayConversations() {
    const conversationsList = document.getElementById('conversationsList');
    const totalConversations = document.getElementById('totalConversations');
    
    if (!conversationsList) return;
    
    if (conversations.length === 0) {
        conversationsList.innerHTML = `
            <div class="empty-conversations">
                <i class="fas fa-comments"></i>
                <p>No conversations yet</p>
                <button class="btn-small" onclick="composeNewMessage()">Start Chatting</button>
            </div>
        `;
        if (totalConversations) totalConversations.textContent = '0';
        return;
    }
    
    if (totalConversations) totalConversations.textContent = conversations.length;
    conversationsList.innerHTML = '';
    
    conversations.forEach(conversation => {
        const conversationElement = createConversationElement(conversation);
        conversationsList.appendChild(conversationElement);
    });
}

// Create conversation element
async function createConversationElement(conversation) {
    try {
        const db = firebase.firestore();
        
        // Get participant info
        const participantDoc = await db.collection("users").doc(conversation.participantId).get();
        const participantData = participantDoc.exists ? participantDoc.data() : null;
        
        const element = document.createElement('div');
        element.className = `conversation-item ${conversation.unreadCount > 0 ? 'unread' : ''}`;
        element.onclick = () => openConversation(conversation);
        
        // Get last message preview
        const lastMessage = conversation.lastMessage;
        let messagePreview = 'No messages';
        let messageTime = '';
        
        if (lastMessage) {
            const senderName = lastMessage.senderId === currentUser.uid 
                ? 'You' 
                : participantData?.username || 'Anonymous';
            
            messagePreview = `${senderName}: ${lastMessage.content?.substring(0, 30)}${lastMessage.content?.length > 30 ? '...' : ''}`;
            messageTime = formatMessageTime(lastMessage.timestamp?.toDate());
        }
        
        element.innerHTML = `
            <div class="conversation-avatar">
                <img src="${participantData?.photos?.[0]?.url || participantData?.photos?.[0] || 'https://via.placeholder.com/40'}" alt="${participantData?.username || 'User'}">
                ${conversation.unreadCount > 0 ? '<span class="unread-badge"></span>' : ''}
            </div>
            <div class="conversation-info">
                <h4>${participantData?.username || 'Anonymous User'}</h4>
                <p class="message-preview">${messagePreview}</p>
                <span class="message-time">${messageTime}</span>
            </div>
            ${conversation.unreadCount > 0 ? `<span class="unread-count">${conversation.unreadCount}</span>` : ''}
        `;
        
        return element;
    } catch (error) {
        console.error('Error creating conversation element:', error);
        const element = document.createElement('div');
        element.className = 'conversation-item';
        element.innerHTML = '<p>Error loading conversation</p>';
        return element;
    }
}

// Format message time
function formatMessageTime(date) {
    if (!date) return '';
    
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

// Open conversation
async function openConversation(conversation) {
    activeConversation = conversation;
    
    // Hide no conversation view, show active conversation
    const noConversationView = document.getElementById('noConversationView');
    const activeConversationView = document.getElementById('activeConversationView');
    
    if (noConversationView) noConversationView.style.display = 'none';
    if (activeConversationView) activeConversationView.style.display = 'flex';
    
    // Load conversation data
    await loadConversationData(conversation);
    
    // Mark messages as read
    await markMessagesAsRead(conversation);
    
    // Setup real-time listener for new messages
    setupConversationListener(conversation);
}

// Load conversation data
async function loadConversationData(conversation) {
    try {
        const db = firebase.firestore();
        
        // Get participant info
        const participantDoc = await db.collection("users").doc(conversation.participantId).get();
        const participantData = participantDoc.exists ? participantDoc.data() : null;
        
        // Update conversation header
        const partnerAvatar = document.getElementById('partnerAvatar');
        const partnerUsername = document.getElementById('partnerUsername');
        const partnerOnlineStatus = document.getElementById('partnerOnlineStatus');
        const partnerLastSeen = document.getElementById('partnerLastSeen');
        const blockUsername = document.getElementById('blockUsername');
        
        if (partnerAvatar) {
            const photoUrl = participantData?.photos?.[0]?.url || participantData?.photos?.[0] || 'https://via.placeholder.com/50';
            partnerAvatar.src = photoUrl;
        }
        if (partnerUsername) partnerUsername.textContent = participantData?.username || 'Anonymous User';
        if (partnerOnlineStatus) {
            partnerOnlineStatus.className = participantData?.status === 'online' 
                ? 'partner-online online' 
                : 'partner-online offline';
        }
        if (partnerLastSeen) {
            partnerLastSeen.textContent = participantData?.status === 'online' 
                ? 'Online now' 
                : 'Last seen recently';
        }
        if (blockUsername) blockUsername.textContent = participantData?.username || 'this user';
        
        // Load messages
        displayMessages(conversation.messages);
        
    } catch (error) {
        console.error('Error loading conversation data:', error);
        showNotification('Failed to load conversation', 'error');
    }
}

// Display messages
function displayMessages(messages) {
    const messagesList = document.getElementById('messagesList');
    if (!messagesList) return;
    
    messagesList.innerHTML = '';
    
    // Sort messages by timestamp
    const sortedMessages = [...messages].sort((a, b) => 
        (a.timestamp?.toDate?.() || new Date(0)) - (b.timestamp?.toDate?.() || new Date(0))
    );
    
    sortedMessages.forEach(message => {
        const messageElement = createMessageElement(message);
        messagesList.appendChild(messageElement);
    });
    
    // Scroll to bottom
    messagesList.scrollTop = messagesList.scrollHeight;
}

// Create message element
async function createMessageElement(message) {
    const isCurrentUser = message.senderId === currentUser.uid;
    
    const element = document.createElement('div');
    element.className = `message ${isCurrentUser ? 'sent' : 'received'}`;
    
    const time = message.timestamp?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '';
    const isAnonymous = message.isAnonymous && !isCurrentUser;
    
    // Get sender info if not anonymous
    let senderName = 'Anonymous';
    let senderPhoto = 'https://via.placeholder.com/30';
    
    if (!isCurrentUser && !isAnonymous) {
        try {
            const db = firebase.firestore();
            const senderDoc = await db.collection("users").doc(message.senderId).get();
            const senderData = senderDoc.exists ? senderDoc.data() : null;
            
            if (senderData) {
                senderName = senderData.username || 'User';
                senderPhoto = senderData.photos?.[0]?.url || senderData.photos?.[0] || 'https://via.placeholder.com/30';
            }
        } catch (error) {
            console.error('Error getting sender info:', error);
        }
    }
    
    element.innerHTML = `
        <div class="message-content">
            ${!isCurrentUser && !isAnonymous ? `
                <div class="message-sender">
                    <img src="${senderPhoto}" alt="${senderName}">
                    <span>${senderName}</span>
                </div>
            ` : ''}
            ${!isCurrentUser && isAnonymous ? `
                <div class="message-sender anonymous">
                    <i class="fas fa-user-secret"></i>
                    <span>Anonymous</span>
                </div>
            ` : ''}
            <div class="message-text">${message.content || ''}</div>
            <div class="message-time">${time}</div>
            ${message.readBy?.includes(currentUser.uid) && isCurrentUser ? '<span class="message-read"><i class="fas fa-check-double"></i></span>' : ''}
        </div>
    `;
    
    return element;
}

// Send message
async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const content = messageInput?.value?.trim();
    const sendAnonymously = document.getElementById('sendAnonymously')?.checked || false;
    
    if (!content || !activeConversation) {
        showNotification('Please enter a message', 'error');
        return;
    }
    
    try {
        const db = firebase.firestore();
        
        const messageData = {
            content: content,
            senderId: currentUser.uid,
            receiverId: activeConversation.participantId,
            participants: [currentUser.uid, activeConversation.participantId],
            isAnonymous: sendAnonymously,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            readBy: [currentUser.uid]
        };
        
        // Add message to Firestore
        await db.collection("messages").add(messageData);
        
        // Clear input
        if (messageInput) messageInput.value = '';
        
        // Update character counter
        updateCharCounter();
        
        // Add message to UI immediately
        const tempMessage = {
            ...messageData,
            id: 'temp-' + Date.now(),
            timestamp: { toDate: () => new Date() }
        };
        
        const messageElement = await createMessageElement(tempMessage);
        const messagesList = document.getElementById('messagesList');
        if (messagesList) messagesList.appendChild(messageElement);
        
        // Scroll to bottom
        if (messagesList) messagesList.scrollTop = messagesList.scrollHeight;
        
    } catch (error) {
        console.error('Error sending message:', error);
        showNotification('Failed to send message', 'error');
    }
}

// Send anonymous message
function sendAnonymousMessage() {
    const anonymousCheckbox = document.getElementById('sendAnonymously');
    if (anonymousCheckbox) anonymousCheckbox.checked = true;
    sendMessage();
}

// Compose new message
function composeNewMessage() {
    const composeSidebar = document.getElementById('composeSidebar');
    const noConversationView = document.getElementById('noConversationView');
    const activeConversationView = document.getElementById('activeConversationView');
    
    if (composeSidebar) composeSidebar.style.display = 'block';
    if (noConversationView) noConversationView.style.display = 'none';
    if (activeConversationView) activeConversationView.style.display = 'none';
}

// Close compose sidebar
function closeCompose() {
    const composeSidebar = document.getElementById('composeSidebar');
    const noConversationView = document.getElementById('noConversationView');
    const activeConversationView = document.getElementById('activeConversationView');
    
    if (composeSidebar) composeSidebar.style.display = 'none';
    if (noConversationView) noConversationView.style.display = 'block';
    if (activeConversationView) activeConversationView.style.display = 'none';
    
    clearRecipientSearch();
}

// Search for recipients
let searchTimeout;
const recipientSearch = document.getElementById('recipientSearch');
if (recipientSearch) {
    recipientSearch.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => searchUsers(e.target.value), 300);
    });
}

async function searchUsers(query) {
    if (!query?.trim()) {
        const searchResults = document.getElementById('searchResults');
        if (searchResults) searchResults.innerHTML = '';
        return;
    }
    
    try {
        const db = firebase.firestore();
        const usersRef = db.collection("users");
        const querySnapshot = await usersRef
            .where("username", ">=", query)
            .where("username", "<=", query + "\uf8ff")
            .limit(10)
            .get();
        
        const results = [];
        querySnapshot.forEach(doc => {
            if (doc.id !== currentUser.uid) {
                results.push({ id: doc.id, ...doc.data() });
            }
        });
        
        displaySearchResults(results);
    } catch (error) {
        console.error('Error searching users:', error);
    }
}

function displaySearchResults(users) {
    const resultsContainer = document.getElementById('searchResults');
    if (!resultsContainer) return;
    
    resultsContainer.innerHTML = '';
    
    if (users.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results">No users found</div>';
        return;
    }
    
    users.forEach(user => {
        const resultElement = document.createElement('div');
        resultElement.className = 'search-result';
        const photoUrl = user.photos?.[0]?.url || user.photos?.[0] || 'https://via.placeholder.com/30';
        resultElement.innerHTML = `
            <img src="${photoUrl}" alt="${user.username}">
            <span>${user.username}</span>
            <button class="btn-small" onclick="addRecipient('${user.id}', '${user.username.replace(/'/g, "\\'")}')">Add</button>
        `;
        resultsContainer.appendChild(resultElement);
    });
}

function addRecipient(userId, username) {
    if (!selectedRecipients.some(r => r.id === userId)) {
        selectedRecipients.push({ id: userId, username });
        updateSelectedRecipients();
    }
    const recipientSearch = document.getElementById('recipientSearch');
    const searchResults = document.getElementById('searchResults');
    if (recipientSearch) recipientSearch.value = '';
    if (searchResults) searchResults.innerHTML = '';
}

function updateSelectedRecipients() {
    const container = document.getElementById('selectedRecipients');
    if (!container) return;
    
    container.innerHTML = '';
    
    selectedRecipients.forEach(recipient => {
        const tag = document.createElement('div');
        tag.className = 'recipient-tag';
        tag.innerHTML = `
            ${recipient.username}
            <button onclick="removeRecipient('${recipient.id}')">
                <i class="fas fa-times"></i>
            </button>
        `;
        container.appendChild(tag);
    });
}

function removeRecipient(userId) {
    selectedRecipients = selectedRecipients.filter(r => r.id !== userId);
    updateSelectedRecipients();
}

function clearRecipientSearch() {
    selectedRecipients = [];
    const recipientSearch = document.getElementById('recipientSearch');
    const searchResults = document.getElementById('searchResults');
    const selectedRecipientsContainer = document.getElementById('selectedRecipients');
    const composeSubject = document.getElementById('composeSubject');
    const composeMessage = document.getElementById('composeMessage');
    const composeAnonymous = document.getElementById('composeAnonymous');
    
    if (recipientSearch) recipientSearch.value = '';
    if (searchResults) searchResults.innerHTML = '';
    if (selectedRecipientsContainer) selectedRecipientsContainer.innerHTML = '';
    if (composeSubject) composeSubject.value = '';
    if (composeMessage) composeMessage.value = '';
    if (composeAnonymous) composeAnonymous.checked = true;
}

async function sendComposedMessage() {
    const composeSubject = document.getElementById('composeSubject');
    const composeMessage = document.getElementById('composeMessage');
    const composeAnonymous = document.getElementById('composeAnonymous');
    
    const subject = composeSubject?.value?.trim();
    const content = composeMessage?.value?.trim();
    const sendAnonymously = composeAnonymous?.checked || false;
    
    if (selectedRecipients.length === 0) {
        showNotification('Please select at least one recipient', 'error');
        return;
    }
    
    if (!content) {
        showNotification('Please enter a message', 'error');
        return;
    }
    
    try {
        const db = firebase.firestore();
        
        for (const recipient of selectedRecipients) {
            const messageData = {
                content: content,
                subject: subject || null,
                senderId: currentUser.uid,
                receiverId: recipient.id,
                participants: [currentUser.uid, recipient.id],
                isAnonymous: sendAnonymously,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                readBy: [currentUser.uid]
            };
            
            await db.collection("messages").add(messageData);
        }
        
        showNotification('Message sent successfully', 'success');
        closeCompose();
        refreshMessages();
        
    } catch (error) {
        console.error('Error sending composed message:', error);
        showNotification('Failed to send message', 'error');
    }
}

// Mark messages as read
async function markMessagesAsRead(conversation) {
    try {
        const db = firebase.firestore();
        const batch = db.batch();
        
        const unreadMessages = conversation.messages.filter(
            msg => !msg.readBy?.includes(currentUser.uid) && msg.senderId !== currentUser.uid
        );
        
        for (const message of unreadMessages) {
            const messageRef = db.collection("messages").doc(message.id);
            batch.update(messageRef, {
                readBy: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
            });
        }
        
        if (unreadMessages.length > 0) {
            await batch.commit();
        }
        
        // Update unread count
        conversation.unreadCount = 0;
        updateUnreadCount();
        
    } catch (error) {
        console.error('Error marking messages as read:', error);
    }
}

// Update unread count
function updateUnreadCount() {
    const totalUnread = conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);
    const unreadCountElement = document.getElementById('unreadCount');
    if (unreadCountElement) unreadCountElement.textContent = totalUnread || '';
    
    // Update badge in sidebar
    const badge = document.querySelector('.menu-item.active .menu-badge');
    if (badge) {
        badge.textContent = totalUnread || '';
        badge.style.display = totalUnread > 0 ? 'block' : 'none';
    }
}

// Setup real-time listeners
function setupRealTimeListeners() {
    const db = firebase.firestore();
    
    // Listen for new messages
    const messagesRef = db.collection("messages");
    const unsubscribe = messagesRef
        .where("participants", "array-contains", currentUser.uid)
        .orderBy("timestamp", "desc")
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === 'added') {
                    const message = { id: change.doc.id, ...change.doc.data() };
                    
                    // Find conversation or create new
                    const otherParticipant = message.participants.find(id => id !== currentUser.uid);
                    let conversation = conversations.find(c => c.participantId === otherParticipant);
                    
                    if (!conversation) {
                        conversation = {
                            participantId: otherParticipant,
                            messages: [],
                            unreadCount: 0,
                            lastMessage: null
                        };
                        conversations.unshift(conversation);
                    }
                    
                    // Add message to conversation
                    conversation.messages.push(message);
                    conversation.lastMessage = message;
                    
                    // Update unread count if message is from other user
                    if (message.senderId !== currentUser.uid && !message.readBy?.includes(currentUser.uid)) {
                        conversation.unreadCount++;
                    }
                    
                    // Sort conversations
                    conversations.sort((a, b) => {
                        const timeA = a.lastMessage?.timestamp?.toDate() || new Date(0);
                        const timeB = b.lastMessage?.timestamp?.toDate() || new Date(0);
                        return timeB - timeA;
                    });
                    
                    // Update UI
                    displayConversations();
                    updateUnreadCount();
                    
                    // If this conversation is active, add message to UI
                    if (activeConversation?.participantId === otherParticipant) {
                        const messageElement = await createMessageElement(message);
                        const messagesList = document.getElementById('messagesList');
                        if (messagesList) messagesList.appendChild(messageElement);
                        
                        // Scroll to bottom
                        if (messagesList) messagesList.scrollTop = messagesList.scrollHeight;
                        
                        // Mark as read
                        if (message.senderId !== currentUser.uid) {
                            try {
                                await db.collection("messages").doc(message.id).update({
                                    readBy: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
                                });
                                conversation.unreadCount = 0;
                                updateUnreadCount();
                            } catch (error) {
                                console.error('Error marking message as read:', error);
                            }
                        }
                    }
                }
            });
        });
    
    conversationListeners.push(unsubscribe);
}

// Setup conversation-specific listener
function setupConversationListener(conversation) {
    // Clean up previous listeners
    conversationListeners.forEach(unsubscribe => unsubscribe());
    conversationListeners = [];
    
    if (!conversation) return;
    
    const db = firebase.firestore();
    const unsubscribe = db.collection("messages")
        .where("participants", "array-contains", currentUser.uid)
        .where("participants", "array-contains", conversation.participantId)
        .orderBy("timestamp", "asc")
        .onSnapshot((snapshot) => {
            const messages = [];
            snapshot.forEach(doc => {
                messages.push({ id: doc.id, ...doc.data() });
            });
            
            conversation.messages = messages;
            displayMessages(messages);
        });
    
    conversationListeners.push(unsubscribe);
}

// View partner profile
function viewPartnerProfile() {
    if (activeConversation) {
        sessionStorage.setItem('viewProfileId', activeConversation.participantId);
        window.location.href = 'view-profile.html';
    }
}

// Block user
function blockUser() {
    const blockModal = document.getElementById('blockModal');
    if (blockModal) blockModal.style.display = 'block';
}

function closeBlockModal() {
    const blockModal = document.getElementById('blockModal');
    if (blockModal) blockModal.style.display = 'none';
}

async function confirmBlock() {
    if (!activeConversation) return;
    
    try {
        const db = firebase.firestore();
        
        // Add to blocked users list
        await db.collection("users").doc(currentUser.uid).update({
            blockedUsers: firebase.firestore.FieldValue.arrayUnion(activeConversation.participantId)
        });
        
        showNotification('User blocked successfully', 'success');
        closeBlockModal();
        refreshMessages();
        
    } catch (error) {
        console.error('Error blocking user:', error);
        showNotification('Failed to block user', 'error');
    }
}

// Report user
function reportUser() {
    const reportModal = document.getElementById('reportModal');
    if (reportModal) reportModal.style.display = 'block';
}

function closeReportModal() {
    const reportModal = document.getElementById('reportModal');
    const reportForm = document.getElementById('reportForm');
    
    if (reportModal) reportModal.style.display = 'none';
    if (reportForm) reportForm.reset();
}

async function submitReport(e) {
    e.preventDefault();
    
    if (!activeConversation) return;
    
    try {
        const db = firebase.firestore();
        const formData = new FormData(e.target);
        const reasons = Array.from(formData.getAll('reason'));
        const details = document.getElementById('reportDetails')?.value || '';
        
        const reportData = {
            reporterId: currentUser.uid,
            reportedUserId: activeConversation.participantId,
            reasons: reasons,
            details: details,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'pending'
        };
        
        await db.collection("reports").add(reportData);
        
        showNotification('Report submitted successfully', 'success');
        closeReportModal();
        
    } catch (error) {
        console.error('Error submitting report:', error);
        showNotification('Failed to submit report', 'error');
    }
}

// Clear conversation
async function clearConversation() {
    if (!activeConversation || !confirm('Clear all messages in this conversation?')) return;
    
    try {
        const db = firebase.firestore();
        const batch = db.batch();
        
        for (const message of activeConversation.messages) {
            if (message.senderId === currentUser.uid) {
                const messageRef = db.collection("messages").doc(message.id);
                batch.update(messageRef, {
                    deletedBySender: true,
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        }
        
        await batch.commit();
        
        // Clear messages from UI
        activeConversation.messages = activeConversation.messages.filter(
            msg => msg.senderId !== currentUser.uid
        );
        
        displayMessages(activeConversation.messages);
        showNotification('Conversation cleared', 'success');
        
    } catch (error) {
        console.error('Error clearing conversation:', error);
        showNotification('Failed to clear conversation', 'error');
    }
}

// Refresh messages
function refreshMessages() {
    loadConversations();
    showNotification('Refreshing messages...', 'info');
}

// Setup event listeners
function setupEventListeners() {
    // Message input
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('input', updateCharCounter);
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    
    // Compose message input
    const composeMessage = document.getElementById('composeMessage');
    if (composeMessage) {
        composeMessage.addEventListener('input', () => {
            const length = composeMessage.value.length;
            const composeCharCounter = document.getElementById('composeCharCounter');
            if (composeCharCounter) composeCharCounter.textContent = `${length}/1000`;
        });
    }
    
    // Report form
    const reportForm = document.getElementById('reportForm');
    if (reportForm) {
        reportForm.addEventListener('submit', submitReport);
    }
    
    // Message filter
    const messageFilter = document.getElementById('messageFilter');
    if (messageFilter) {
        messageFilter.addEventListener('change', filterMessages);
    }
}

function updateCharCounter() {
    const messageInput = document.getElementById('messageInput');
    const length = messageInput ? messageInput.value.length : 0;
    const charCounter = document.getElementById('messageCharCounter');
    if (charCounter) charCounter.textContent = `${length}/1000`;
}

function filterMessages() {
    const filter = document.getElementById('messageFilter')?.value;
    showNotification(`Filtering: ${filter}`, 'info');
}

// Attach file (placeholder)
function attachFile() {
    showNotification('File attachment feature coming soon', 'info');
}

// Update sidebar user info
async function updateSidebarUserInfo() {
    try {
        const db = firebase.firestore();
        const userDoc = await db.collection("users").doc(currentUser.uid).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            const userName = document.getElementById('userName');
            const userAvatar = document.getElementById('userAvatar');
            
            if (userName) userName.textContent = userData.username || 'User';
            if (userAvatar) {
                const photoUrl = userData.photos?.[0]?.url || userData.photos?.[0] || 'https://via.placeholder.com/100';
                userAvatar.src = photoUrl;
            }
        }
    } catch (error) {
        console.error('Error updating sidebar info:', error);
    }
}

// Toggle sidebar
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.classList.toggle('active');
}

// Clean up listeners when leaving page
window.addEventListener('beforeunload', () => {
    conversationListeners.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') unsubscribe();
    });
});

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
window.composeNewMessage = composeNewMessage;
window.closeCompose = closeCompose;
window.sendComposedMessage = sendComposedMessage;
window.sendMessage = sendMessage;
window.sendAnonymousMessage = sendAnonymousMessage;
window.viewPartnerProfile = viewPartnerProfile;
window.blockUser = blockUser;
window.closeBlockModal = closeBlockModal;
window.confirmBlock = confirmBlock;
window.reportUser = reportUser;
window.closeReportModal = closeReportModal;
window.clearConversation = clearConversation;
window.refreshMessages = refreshMessages;
window.attachFile = attachFile;
window.addRecipient = addRecipient;
window.removeRecipient = removeRecipient;
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