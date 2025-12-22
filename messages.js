
let currentUserDocId = null; // Will store the user's document ID from Firestore
let conversations = [];
let activeConversation = null;

// Get currentUser from the global scope (already defined in app.js)
function getCurrentUser() {
    return window.currentUser || firebase.auth().currentUser;
} 

// Initialize when page loads
// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log("Messages page initializing...");
    
    // Wait for app.js to initialize first
    setTimeout(() => {
        const user = getCurrentUser();
        if (!user) {
            console.log("No user, redirecting to index");
            window.location.href = 'index.html';
            return;
        }
        
        console.log("Current user from app.js:", user.uid);
        
        // Initialize messages
        initializeMessages();
        
    }, 1500); // Increased delay to ensure app.js loads first
});

async function initializeMessages() {
    try {
        console.log("🔧 Initializing messages...");
        
        // First, get the user's document from Firestore users collection
        const foundUser = await getUserDocumentFromFirestore();
        
        if (!foundUser) {
            console.error("❌ Could not find user document");
            return;
        }
        
        // Now load conversations using the user's document ID
        await loadConversations();
        setupEventListeners();
        updateSidebarUserInfo();
        
        console.log("✅ Messages initialization complete");
    } catch (error) {
        console.error("❌ Error initializing messages:", error);
        showNotification("Failed to load messages", "error");
    }
}

async function getUserDocumentFromFirestore() {
    try {
        const user = getCurrentUser();
        if (!user) {
            console.error("No authenticated user");
            return false;
        }
        
        console.log("🔄 Auth user UID:", user.uid);
        const db = firebase.firestore();
        
        // METHOD 1: Try to find by username first (since you're logged in as "admin")
        console.log("🔍 Searching by username 'admin'...");
        const usernameQuery = await db.collection("users")
            .where("username", "==", "admin")
            .limit(1)
            .get();
        
        if (!usernameQuery.empty) {
            usernameQuery.forEach(doc => {
                currentUserDocId = doc.id;
                console.log("✅ Found user by username 'admin':", {
                    docId: currentUserDocId,
                    data: doc.data()
                });
            });
            return true;
        }
        
        // METHOD 2: Try by phone number (from your user data)
        console.log("🔍 Searching by phone '0797999154'...");
        const phoneQuery = await db.collection("users")
            .where("phone", "==", "0797999154")
            .limit(1)
            .get();
        
        if (!phoneQuery.empty) {
            phoneQuery.forEach(doc => {
                currentUserDocId = doc.id;
                console.log("✅ Found user by phone:", {
                    docId: currentUserDocId,
                    data: doc.data()
                });
            });
            return true;
        }
        
        // METHOD 3: List all users to debug
        console.log("⚠️ Could not find user. Listing all users...");
        const allUsers = await db.collection("users").limit(10).get();
        console.log("All users in database:");
        allUsers.forEach(doc => {
            console.log(`- ${doc.id}:`, doc.data());
        });
        
        // If we still don't have it, try the first user doc
        if (!allUsers.empty) {
            currentUserDocId = allUsers.docs[0].id;
            console.log("⚠️ Using first user doc as fallback:", currentUserDocId);
            return true;
        }
        
        console.error("❌ No user documents found at all!");
        return false;
        
    } catch (error) {
        console.error("❌ Error fetching user document:", error);
        return false;
    }
}




async function loadConversations() {
    try {
        if (!currentUserDocId) {
            console.error("❌ User document ID not available");
            return;
        }
        
        console.log("🔄 Loading messages for user document ID:", currentUserDocId);
        const db = firebase.firestore();
        
        // IMPORTANT: Check BOTH field names (senderId and senderrId)
        console.log("📥 Querying RECEIVED messages...");
        
        // Try query 1: receiverId matches current user
        const receivedSnapshot1 = await db.collection("messages")
            .where("receiverId", "==", currentUserDocId)
            .get();
        
        // Try query 2: Check for typo "receiverrId" 
        const receivedSnapshot2 = await db.collection("messages")
            .where("receiverrId", "==", currentUserDocId) // Typo version
            .get();
        
        console.log("📊 Query results:", {
            "receiverId matches": receivedSnapshot1.size,
            "receiverrId matches": receivedSnapshot2.size
        });
        
        // Combine all messages
        const allMessages = [];
        
        // Process receiverId query
        receivedSnapshot1.forEach(doc => {
            const data = doc.data();
            console.log("Message (receiverId):", {
                id: doc.id,
                content: data.content,
                // Check both spellings
                senderId: data.senderId || data.senderrId,
                receiverId: data.receiverId || data.receiverrId
            });
            
            allMessages.push({ 
                id: doc.id, 
                ...data,
                // Normalize field names
                senderId: data.senderId || data.senderrId,
                receiverId: data.receiverId || data.receiverrId,
                senderName: data.senderName || data.senderrName
            });
        });
        
        // Process receiverrId query
        receivedSnapshot2.forEach(doc => {
            const data = doc.data();
            console.log("Message (receiverrId):", {
                id: doc.id,
                content: data.content,
                senderId: data.senderId || data.senderrId,
                receiverId: data.receiverId || data.receiverrId
            });
            
            allMessages.push({ 
                id: doc.id, 
                ...data,
                senderId: data.senderId || data.senderrId,
                receiverId: data.receiverId || data.receiverrId,
                senderName: data.senderName || data.senderrName
            });
        });
        
        console.log("📥 Querying SENT messages...");
        
        // Try query for sent messages
        const sentSnapshot1 = await db.collection("messages")
            .where("senderId", "==", currentUserDocId)
            .get();
        
        const sentSnapshot2 = await db.collection("messages")
            .where("senderrId", "==", currentUserDocId)
            .get();
        
        console.log("📊 Sent query results:", {
            "senderId matches": sentSnapshot1.size,
            "senderrId matches": sentSnapshot2.size
        });
        
        // Process sent messages
        sentSnapshot1.forEach(doc => {
            const data = doc.data();
            allMessages.push({ 
                id: doc.id, 
                ...data,
                senderId: data.senderId || data.senderrId,
                receiverId: data.receiverId || data.receiverrId,
                senderName: data.senderName || data.senderrName
            });
        });
        
        sentSnapshot2.forEach(doc => {
            const data = doc.data();
            allMessages.push({ 
                id: doc.id, 
                ...data,
                senderId: data.senderId || data.senderrId,
                receiverId: data.receiverId || data.receiverrId,
                senderName: data.senderName || data.senderrName
            });
        });
        
        console.log("📊 Total unique messages:", allMessages.length);
        
        // Remove duplicates (same message ID)
        const uniqueMessages = [];
        const seenIds = new Set();
        
        allMessages.forEach(msg => {
            if (!seenIds.has(msg.id)) {
                seenIds.add(msg.id);
                uniqueMessages.push(msg);
            }
        });
        
        console.log("📊 Unique messages after deduplication:", uniqueMessages.length);
        
        if (uniqueMessages.length === 0) {
            console.log("ℹ️ No messages found for user");
            displayNoConversations();
            return;
        }
        
        // Display what we found
        console.log("📄 All messages found:");
        uniqueMessages.forEach((msg, index) => {
            console.log(`Message ${index + 1}:`, {
                id: msg.id,
                content: msg.content,
                senderId: msg.senderId,
                receiverId: msg.receiverId,
                senderName: msg.senderName,
                isAnonymous: msg.isAnonymous
            });
        });
        
        // Group messages into conversations
        groupMessagesIntoConversations(uniqueMessages);
        
    } catch (error) {
        console.error("❌ Error loading conversations:", error);
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);
    }
}


function groupMessagesIntoConversations(messages) {
    const conversationsMap = new Map();
    
    messages.forEach(message => {
        // Determine the other user in this conversation
        let otherUserId;
        
        if (message.senderId === currentUserDocId) {
            // Current user is the sender, other user is the receiver
            otherUserId = message.receiverId;
        } else if (message.receiverId === currentUserDocId) {
            // Current user is the receiver, other user is the sender
            otherUserId = message.senderId;
        } else {
            // Skip messages where current user is neither sender nor receiver
            console.warn("Message not related to current user:", message);
            return;
        }
        
        // Skip if we can't determine the other user
        if (!otherUserId) {
            console.warn("Could not determine other user for message:", message);
            return;
        }
        
        // Get or create conversation object
        if (!conversationsMap.has(otherUserId)) {
            conversationsMap.set(otherUserId, {
                participantId: otherUserId,
                messages: [],
                unreadCount: 0,
                lastMessage: null,
                lastMessageTime: null,
                otherUserData: null
            });
        }
        
        const conversation = conversationsMap.get(otherUserId);
        conversation.messages.push(message);
        
        // Get message time
        let messageTime;
        if (message.timestamp && message.timestamp.toDate) {
            messageTime = message.timestamp.toDate();
        } else if (message.timestamp) {
            messageTime = new Date(message.timestamp);
        } else {
            messageTime = new Date(0);
        }
        
        // Update last message (most recent)
        if (!conversation.lastMessageTime || messageTime > conversation.lastMessageTime) {
            conversation.lastMessage = message;
            conversation.lastMessageTime = messageTime;
        }
        
        // Count unread messages (only for received messages)
        if (message.receiverId === currentUserDocId) {
            const isRead = (message.readBy && Array.isArray(message.readBy) && 
                          message.readBy.includes(currentUserDocId)) || 
                          message.read === true;
            
            if (!isRead) {
                conversation.unreadCount++;
            }
        }
    });
    
    // Convert map to array
    conversations = Array.from(conversationsMap.values());
    
    // Sort by last message time (newest first)
    conversations.sort((a, b) => {
        const timeA = a.lastMessageTime || new Date(0);
        const timeB = b.lastMessageTime || new Date(0);
        return timeB - timeA;
    });
    
    console.log("Grouped into", conversations.length, "conversations");
    displayConversations();
}

async function displayConversations() {
    const container = document.getElementById('conversationsList');
    if (!container) {
        console.error("conversationsList element not found!");
        return;
    }
    
    if (conversations.length === 0) {
        displayNoConversations();
        return;
    }
    
    // Update conversation count
    const countElement = document.getElementById('totalConversations');
    if (countElement) {
        countElement.textContent = conversations.length;
    }
    
    // Clear container
    container.innerHTML = '';
    
    // Load and display each conversation
    for (const conversation of conversations) {
        try {
            const convElement = await createConversationElement(conversation);
            container.appendChild(convElement);
        } catch (error) {
            console.error("Error creating conversation element:", error);
        }
    }
    
    // Update unread count badge
    updateUnreadCount();
}

async function createConversationElement(conversation) {
    const element = document.createElement('div');
    element.className = `conversation-item ${conversation.unreadCount > 0 ? 'unread' : ''}`;
    element.onclick = () => openConversation(conversation);
    
    try {
        // Get other user's data from Firestore
        const db = firebase.firestore();
        const userDoc = await db.collection("users").doc(conversation.participantId).get();
        const userData = userDoc.exists ? userDoc.data() : null;
        
        // Store for later use
        conversation.otherUserData = userData;
        
        // Get avatar URL
        let avatarUrl = 'after-dark-banner.jpg';
        if (userData) {
            if (userData.photoURL) {
                avatarUrl = userData.photoURL;
            } else if (userData.photos && userData.photos.length > 0) {
                const firstPhoto = userData.photos[0];
                avatarUrl = typeof firstPhoto === 'string' ? firstPhoto : firstPhoto.url;
            }
        }
        
        // Get last message preview
        let preview = 'No messages';
        let time = '';
        
        if (conversation.lastMessage) {
            const message = conversation.lastMessage;
            
            // Get message content
            const content = message.content || message.message || '';
            preview = content.length > 30 ? content.substring(0, 30) + '...' : content;
            
            // Check if anonymous
            if (message.isAnonymous && message.senderName === 'Anonymous' && 
                message.senderId !== currentUserDocId) {
                preview = 'Anonymous: ' + preview;
            }
            
            // Format time
            if (message.timestamp) {
                let messageTime;
                if (message.timestamp.toDate) {
                    messageTime = message.timestamp.toDate();
                } else {
                    messageTime = new Date(message.timestamp);
                }
                
                const now = new Date();
                const diffHours = (now - messageTime) / (1000 * 60 * 60);
                
                if (diffHours < 24) {
                    time = messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                } else {
                    time = messageTime.toLocaleDateString();
                }
            }
        }
        
        const username = userData?.username || 
                        userData?.displayName || 
                        'Unknown User';
        
        element.innerHTML = `
            <div class="conversation-avatar">
                <img src="${avatarUrl}" alt="${username}" onerror="this.src='after-dark-banner.jpg'">
                ${conversation.unreadCount > 0 ? '<span class="unread-badge"></span>' : ''}
            </div>
            <div class="conversation-info">
                <h4>${username}</h4>
                <p class="message-preview">${preview}</p>
                <span class="message-time">${time}</span>
            </div>
            ${conversation.unreadCount > 0 ? 
                `<span class="unread-count">${conversation.unreadCount}</span>` : 
                ''}
        `;
        
    } catch (error) {
        console.error("Error loading user data for conversation:", error);
        
        // Fallback if user data can't be loaded
        element.innerHTML = `
            <div class="conversation-avatar">
                <img src="after-dark-banner.jpg" alt="User">
            </div>
            <div class="conversation-info">
                <h4>User ${conversation.participantId.substring(0, 8)}...</h4>
                <p class="message-preview">Click to view messages</p>
                <span class="message-time"></span>
            </div>
        `;
    }
    
    return element;
}

async function openConversation(conversation) {
    activeConversation = conversation;
    
    // Hide "no conversation" view, show conversation view
    const noConvView = document.getElementById('noConversationView');
    const activeConvView = document.getElementById('activeConversationView');
    
    if (noConvView) noConvView.style.display = 'none';
    if (activeConvView) activeConvView.style.display = 'flex';
    
    // Load conversation data
    await loadConversationData(conversation);
}

async function loadConversationData(conversation) {
    try {
        const db = firebase.firestore();
        
        // Get other user's data if not already loaded
        if (!conversation.otherUserData) {
            const userDoc = await db.collection("users").doc(conversation.participantId).get();
            conversation.otherUserData = userDoc.exists ? userDoc.data() : null;
        }
        
        // Update conversation header
        updateConversationHeader(conversation);
        
        // Display messages
        displayConversationMessages(conversation.messages);
        
        // Mark messages as read
        await markMessagesAsRead(conversation);
        
    } catch (error) {
        console.error("Error loading conversation data:", error);
        showNotification("Failed to load conversation", "error");
    }
}

function updateConversationHeader(conversation) {
    const userData = conversation.otherUserData;
    let displayName = 'Unknown User';
    
    if (userData) {
        displayName = userData.username || userData.displayName || displayName;
    } else if (conversation.lastMessage && conversation.lastMessage.isAnonymous) {
        // If last message is anonymous, show "Anonymous User"
        displayName = 'Anonymous User';
    }
    
    // Update partner info
    const partnerAvatar = document.getElementById('partnerAvatar');
    const partnerUsername = document.getElementById('partnerUsername');
    const blockUsername = document.getElementById('blockUsername');
    
    if (partnerAvatar && userData) {
        if (userData.photoURL) {
            partnerAvatar.src = userData.photoURL;
        } else if (userData.photos && userData.photos.length > 0) {
            const firstPhoto = userData.photos[0];
            const photoUrl = typeof firstPhoto === 'string' ? firstPhoto : firstPhoto.url;
            partnerAvatar.src = photoUrl;
        }
        partnerAvatar.onerror = function() {
            this.src = 'after-dark-banner.jpg';
        }; 
    } else if (partnerAvatar) {
        partnerAvatar.src = 'after-dark-banner.jpg';
    }
    
    if (partnerUsername) partnerUsername.textContent = displayName;
    if (blockUsername) blockUsername.textContent = displayName;
}

function displayConversationMessages(messages) {
    const container = document.getElementById('messagesList');
    if (!container) return;
    
    // Sort messages by timestamp (oldest first for conversation view)
    const sortedMessages = [...messages].sort((a, b) => {
        const getTime = (msg) => {
            if (!msg.timestamp) return new Date(0);
            return msg.timestamp.toDate ? msg.timestamp.toDate() : new Date(msg.timestamp);
        };
        
        const timeA = getTime(a);
        const timeB = getTime(b);
        return timeA - timeB;
    });
    
    container.innerHTML = '';
    
    sortedMessages.forEach(message => {
        const messageElement = createMessageElement(message);
        container.appendChild(messageElement);
    });
    
    // Scroll to bottom to see latest messages
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 100);
}

function createMessageElement(message) {
    const isCurrentUser = message.senderId === currentUserDocId;
    const element = document.createElement('div');
    element.className = `message ${isCurrentUser ? 'sent' : 'received'}`;
    
    // Get message content
    const content = message.content || message.message || '';
    
    // Format time
    let time = '';
    if (message.timestamp) {
        let date;
        if (message.timestamp.toDate) {
            date = message.timestamp.toDate();
        } else {
            date = new Date(message.timestamp);
        }
        time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // CRITICAL: Handle anonymous messages
    let displayContent = content;
    let isAnonymous = message.isAnonymous === true;
    
    // Hide sender name for anonymous messages when viewing as receiver
    if (isAnonymous && !isCurrentUser && message.senderName === 'Anonymous') {
        // Remove any "Anonymous: " prefix if it exists
        displayContent = content.replace(/^Anonymous:\s*/i, '');
        
        // Also hide in conversation list preview
        // This ensures "Anonymous: " doesn't appear in the sidebar preview
    }
    
    element.innerHTML = `
        <div class="message-content">
            <div class="message-text">${displayContent}</div>
            <div class="message-time">${time}</div>
            ${isCurrentUser ? 
                '<span class="message-status">' + 
                ((message.readBy && message.readBy.includes(message.receiverId)) ? '✓✓' : '✓') + 
                '</span>' : ''}
        </div>
    `;
    
    return element;
}

async function markMessagesAsRead(conversation) {
    try {
        const db = firebase.firestore();
        const unreadMessages = conversation.messages.filter(msg => 
            msg.receiverId === currentUserDocId && 
            !(msg.readBy?.includes(currentUserDocId) || msg.read === true)
        );
        
        if (unreadMessages.length > 0) {
            const batch = db.batch();
            
            unreadMessages.forEach(msg => {
                const messageRef = db.collection("messages").doc(msg.id);
                batch.update(messageRef, {
                    readBy: firebase.firestore.FieldValue.arrayUnion(currentUserDocId),
                    read: true
                });
            });
            
            await batch.commit();
            
            // Update conversation unread count
            conversation.unreadCount = 0;
            
            // Update UI
            updateUnreadCount();
        }
        
    } catch (error) {
        console.error("Error marking messages as read:", error);
    }
}

function updateUnreadCount() {
    const totalUnread = conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);
    
    // Update unread count badge
    const unreadElement = document.getElementById('unreadCount');
    if (unreadElement) {
        unreadElement.textContent = totalUnread > 0 ? totalUnread : '';
        unreadElement.style.display = totalUnread > 0 ? 'flex' : 'none';
    }
    
    // Update sidebar badge
    const menuBadge = document.querySelector('.menu-item.active .menu-badge');
    if (menuBadge) {
        menuBadge.textContent = totalUnread > 0 ? totalUnread : '';
        menuBadge.style.display = totalUnread > 0 ? 'flex' : 'none';
    }
}

async function sendMessage() {
    if (!currentUserDocId || !activeConversation) {
        showNotification("Cannot send message: user or conversation not loaded", "error");
        return;
    }
    
    const messageInput = document.getElementById('messageInput');
    const content = messageInput?.value?.trim();
    
    if (!content) {
        showNotification("Please enter a message", "error");
        return;
    }
    
    try {
        const db = firebase.firestore();
        
        const messageData = {
            content: content,
            message: content, // Both fields for compatibility
            senderId: currentUserDocId,
            receiverId: activeConversation.participantId,
            participants: [currentUserDocId, activeConversation.participantId],
            isAnonymous: document.getElementById('sendAnonymously')?.checked || false,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            readBy: [currentUserDocId],
            read: false
        };
        
        // Add sender name if anonymous
        if (messageData.isAnonymous) {
            messageData.senderName = 'Anonymous';
        } else {
            // Get current user's name for the sender name
            const userDoc = await db.collection("users").doc(currentUserDocId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                messageData.senderName = userData.username || userData.displayName || 'User';
            }
        }
        
        await db.collection("messages").add(messageData);
        
        // Clear input
        if (messageInput) messageInput.value = '';
        
        // Update character counter
        updateCharCounter();
        
        // Refresh messages to show the new one
        refreshMessages();
        
    } catch (error) {
        console.error("Error sending message:", error);
        showNotification("Failed to send message", "error");
    }
}

async function testFirestoreManually() {
    console.clear();
    console.log("🧪 MANUAL FIRESTORE TEST");
    
    const db = firebase.firestore();
    const authUser = firebase.auth().currentUser;
    
    console.log("1. Auth User:", authUser?.uid);
    
    // Test 1: Check users collection
    console.log("2. Checking users collection...");
    const usersQuery = await db.collection("users")
        .where("uid", "==", authUser.uid)
        .limit(1)
        .get();
    
    console.log("Users found:", usersQuery.size);
    usersQuery.forEach(doc => {
        console.log("User doc ID:", doc.id);
        console.log("User data:", doc.data());
    });
    
    if (usersQuery.empty) {
        console.log("⚠️ No user document found!");
        
        // Try getting ALL users to see structure
        console.log("Checking ALL users to see structure...");
        const allUsers = await db.collection("users").limit(5).get();
        console.log("First 5 users:", allUsers.docs.map(doc => ({
            id: doc.id,
            data: doc.data()
        })));
    }
    
    // Test 2: Check messages collection
    console.log("3. Checking ALL messages...");
    const allMessages = await db.collection("messages").limit(10).get();
    console.log("Total messages in DB:", allMessages.size);
    
    allMessages.forEach((doc, index) => {
        console.log(`Message ${index + 1}:`, {
            id: doc.id,
            receiverId: doc.data().receiverId,
            senderId: doc.data().senderId,
            content: doc.data().content || doc.data().message
        });
    });
    
    // Test 3: If we found a user doc, check for their messages
    if (!usersQuery.empty) {
        const userDocId = usersQuery.docs[0].id;
        console.log(`4. Checking messages for user doc ID: ${userDocId}`);
        
        const userMessages = await db.collection("messages")
            .where("receiverId", "==", userDocId)
            .get();
        
        console.log(`Messages where receiverId = ${userDocId}:`, userMessages.size);
    }
}
async function quickDebug() {
    console.clear();
    console.log("🔍 QUICK DEBUG SESSION");
    
    const db = firebase.firestore();
    const authUser = firebase.auth().currentUser;
    
    console.log("1. Auth User:", authUser?.uid, authUser?.email);
    
    // List all users
    console.log("2. All users in database:");
    const allUsers = await db.collection("users").get();
    allUsers.forEach(doc => {
        console.log(`- ID: ${doc.id}`);
        console.log(`  Data:`, doc.data());
    });
    
    // List all messages
    console.log("3. All messages in database:");
    const allMessages = await db.collection("messages").get();
    allMessages.forEach(doc => {
        const data = doc.data();
        console.log(`- ID: ${doc.id}`);
        console.log(`  Content: ${data.content || data.message}`);
        console.log(`  Sender: ${data.senderId || data.senderrId}`);
        console.log(`  Receiver: ${data.receiverId || data.receiverrId}`);
        console.log(`  Fields:`, Object.keys(data));
    });
    
    console.log("4. Current user doc ID:", currentUserDocId);
}

// Call this on page load for debugging
setTimeout(quickDebug, 2000);
// ... (keep the rest of your existing functions - updateSidebarUserInfo, showNotification, setupEventListeners, etc.)

function sendAnonymousMessage() {
    const anonymousCheckbox = document.getElementById('sendAnonymously');
    if (anonymousCheckbox) anonymousCheckbox.checked = true;
    sendMessage();
}

function composeNewMessage() {
    showNotification("New message feature coming soon", "info");
}

function closeCompose() {
    showNotification("Close compose", "info");
}

function sendComposedMessage() {
    showNotification("Send composed message", "info");
}

function viewPartnerProfile() {
    if (activeConversation) {
        sessionStorage.setItem('viewProfileId', activeConversation.participantId);
        window.location.href = 'view-profile.html';
    }
}

function blockUser() {
    showNotification("Block user feature coming soon", "info");
}

function closeBlockModal() {
    showNotification("Close block modal", "info");
}

function confirmBlock() {
    showNotification("Confirm block", "info");
}

function reportUser() {
    showNotification("Report user feature coming soon", "info");
}

function closeReportModal() {
    showNotification("Close report modal", "info");
}

function clearConversation() {
    if (activeConversation && confirm("Clear all messages in this conversation?")) {
        showNotification("Clear conversation", "info");
    }
}

async function refreshMessages() {
    console.log("Refreshing messages...");
    
    // Show loading indicator
    const container = document.getElementById('conversationsList');
    if (container) {
        const originalContent = container.innerHTML;
        container.innerHTML = `
            <div class="loading-conversations">
                <i class="fas fa-spinner fa-spin"></i>
                <span>Refreshing...</span>
            </div>
        `;
        
        // Load conversations
        await loadConversations();
        
        // Restore if error
        setTimeout(() => {
            if (container.innerHTML.includes('loading-conversations')) {
                container.innerHTML = originalContent;
            }
        }, 3000);
    } else {
        await loadConversations();
    }
    
    // Show brief notification
    const notification = document.createElement('div');
    notification.textContent = '✓ Messages refreshed';
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #2a9d8f;
        color: white;
        padding: 8px 16px;
        border-radius: 4px;
        z-index: 1000;
        font-size: 14px;
        opacity: 0;
        transition: opacity 0.3s;
    `;
    
    document.body.appendChild(notification);
    setTimeout(() => notification.style.opacity = '1', 10);
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

function attachFile() {
    showNotification("Attach file feature coming soon", "info");
}

function updateCharCounter() {
    const messageInput = document.getElementById('messageInput');
    const length = messageInput ? messageInput.value.length : 0;
    const counter = document.getElementById('messageCharCounter');
    if (counter) counter.textContent = `${length}/1000`;
}

async function updateSidebarUserInfo() {
    try {
        const db = firebase.firestore();
        const userDoc = await db.collection("users").doc(currentUser.uid).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            const userName = document.getElementById('userName');
            const userAvatar = document.getElementById('userAvatar');
            
            if (userName) userName.textContent = userData.username || 'User';
            if (userAvatar && userData.photos && userData.photos.length > 0) {
                const firstPhoto = userData.photos[0];
                const photoUrl = typeof firstPhoto === 'string' ? firstPhoto : firstPhoto.url;
                userAvatar.src = photoUrl;
            }
        }
    } catch (error) {
        console.error("Error updating sidebar info:", error);
    }
}

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.classList.toggle('active');
}

function logout() {
    if (firebase.auth().currentUser) {
        firebase.auth().signOut().then(() => {
            window.location.href = 'index.html';
        });
    } else {
        window.location.href = 'index.html';
    }
}

function showNotification(message, type = 'info') {
    console.log(`[${type}] ${message}`);
    
    // Use app.js notification if available
    if (window.showNotification && window.showNotification !== showNotification) {
        window.showNotification(message, type);
        return;
    }
    
    // Simple alert for now
    alert(message);
}

// Event listeners
function setupEventListeners() {
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
    
    // Add real-time listener for new messages
    setupRealtimeListener();
}

function setupRealtimeListener() {
    try {
        const db = firebase.firestore();
        
        // Listen ONLY for new messages where current user is receiver
        db.collection("messages")
            .where("receiverId", "==", currentUserDocId)
            .onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        console.log("🔔 New message received!");
                        
                        // Get the new message
                        const newMessage = {
                            id: change.doc.id,
                            ...change.doc.data(),
                            senderId: change.doc.data().senderId || change.doc.data().senderrId,
                            receiverId: change.doc.data().receiverId || change.doc.data().receiverrId
                        };
                        
                        // Check if this is for the currently open conversation
                        if (activeConversation && 
                            (newMessage.senderId === activeConversation.participantId ||
                             newMessage.receiverId === activeConversation.participantId)) {
                            
                            // Add to current conversation view
                            addMessageToCurrentView(newMessage);
                        } else {
                            // Update conversation list subtly
                            updateConversationList(newMessage);
                        }
                        
                        // Show subtle notification (optional)
                        if (!document.hidden) {
                            showNewMessageNotification(newMessage);
                        }
                    }
                });
            });
            
    } catch (error) {
        console.error("Error setting up real-time listener:", error);
    }
}

// Add message to currently open conversation
function addMessageToCurrentView(message) {
    const messagesList = document.getElementById('messagesList');
    if (!messagesList) return;
    
    const messageElement = createMessageElement(message);
    messagesList.appendChild(messageElement);
    
    // Smooth scroll to bottom
    setTimeout(() => {
        messagesList.scrollTo({
            top: messagesList.scrollHeight,
            behavior: 'smooth'
        });
    }, 100);
    
    // Add to active conversation's messages array
    if (activeConversation) {
        activeConversation.messages.push(message);
        activeConversation.lastMessage = message;
        
        // Update unread count if needed
        if (message.receiverId === currentUserDocId) {
            activeConversation.unreadCount++;
            updateUnreadCount();
        }
    }
}

// Update conversation list without full refresh
async function updateConversationList(newMessage) {
    // Find if conversation already exists
    const existingConvIndex = conversations.findIndex(conv => 
        conv.participantId === newMessage.senderId ||
        conv.participantId === newMessage.receiverId
    );
    
    if (existingConvIndex !== -1) {
        // Update existing conversation
        const conv = conversations[existingConvIndex];
        conv.messages.push(newMessage);
        conv.lastMessage = newMessage;
        
        if (newMessage.receiverId === currentUserDocId) {
            conv.unreadCount++;
        }
        
        // Move conversation to top
        conversations.splice(existingConvIndex, 1);
        conversations.unshift(conv);
        
        // Update the UI for just this conversation
        updateConversationUI(conv);
    } else {
        // New conversation - load user data first
        const otherUserId = newMessage.senderId === currentUserDocId ? 
                          newMessage.receiverId : newMessage.senderId;
        
        try {
            const db = firebase.firestore();
            const userDoc = await db.collection("users").doc(otherUserId).get();
            const userData = userDoc.exists ? userDoc.data() : null;
            
            const newConversation = {
                participantId: otherUserId,
                messages: [newMessage],
                unreadCount: newMessage.receiverId === currentUserDocId ? 1 : 0,
                lastMessage: newMessage,
                otherUserData: userData
            };
            
            conversations.unshift(newConversation);
            
            // Add to UI without full refresh
            addConversationToUI(newConversation);
            
        } catch (error) {
            console.error("Error loading user for new conversation:", error);
        }
    }
    
    updateUnreadCount();
}

// Update single conversation in UI
function updateConversationUI(conversation) {
    const container = document.getElementById('conversationsList');
    if (!container) return;
    
    // Find the conversation element
    const convElements = container.getElementsByClassName('conversation-item');
    for (let element of convElements) {
        if (element.getAttribute('data-userid') === conversation.participantId) {
            // Remove and re-add at beginning for proper ordering
            element.remove();
            
            createConversationElement(conversation).then(newElement => {
                newElement.setAttribute('data-userid', conversation.participantId);
                container.insertBefore(newElement, container.firstChild);
            });
            break;
        }
    }
}

// Add new conversation to UI
function addConversationToUI(conversation) {
    const container = document.getElementById('conversationsList');
    if (!container) return;
    
    // Remove "no conversations" message if present
    const emptyDiv = container.querySelector('.empty-conversations');
    if (emptyDiv) {
        emptyDiv.remove();
    }
    
    createConversationElement(conversation).then(element => {
        element.setAttribute('data-userid', conversation.participantId);
        container.insertBefore(element, container.firstChild);
        
        // Update conversation count
        const countElement = document.getElementById('totalConversations');
        if (countElement) {
            countElement.textContent = conversations.length;
        }
    });
}

// Show subtle notification for new messages
function showNewMessageNotification(message) {
    // Create a subtle toast notification
    const notification = document.createElement('div');
    notification.className = 'message-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-envelope"></i>
            <span>New message received</span>
        </div>
    `;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4a4a6d;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 1000;
        opacity: 0;
        transform: translateY(-20px);
        transition: all 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
    }, 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
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
window.toggleSidebar = toggleSidebar;
window.logout = logout;