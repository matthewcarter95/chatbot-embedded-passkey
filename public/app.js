let currentUser = null;
const AUTH0_DOMAIN = window.AUTH0_CONFIG.domain;
const CLIENT_ID = window.AUTH0_CONFIG.clientId;

// Sign up with passkey using Auth0 Native Passkeys API
async function signup() {
    try {
        clearError();
        
        const email = prompt('Enter your email:');
        if (!email) return;
        
        // Step 1: Request signup challenge
        const challengeResponse = await fetch(`https://${AUTH0_DOMAIN}/api/v1/passkeys/signup/challenge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: CLIENT_ID,
                email: email
            })
        });
        
        const challengeData = await challengeResponse.json();
        if (!challengeResponse.ok) {
            throw new Error(challengeData.error_description || 'Challenge request failed');
        }
        
        // Step 2: Create WebAuthn credential
        const credential = await navigator.credentials.create({
            publicKey: challengeData.publicKey
        });
        
        // Step 3: Complete signup
        const signupResponse = await fetch(`https://${AUTH0_DOMAIN}/api/v1/passkeys/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: CLIENT_ID,
                challenge_id: challengeData.challenge_id,
                credential: {
                    id: credential.id,
                    rawId: Array.from(new Uint8Array(credential.rawId)),
                    response: {
                        clientDataJSON: Array.from(new Uint8Array(credential.response.clientDataJSON)),
                        attestationObject: Array.from(new Uint8Array(credential.response.attestationObject))
                    },
                    type: credential.type
                }
            })
        });
        
        const signupData = await signupResponse.json();
        if (!signupResponse.ok) {
            throw new Error(signupData.error_description || 'Signup failed');
        }
        
        localStorage.setItem('access_token', signupData.access_token);
        currentUser = { email: email, sub: signupData.user_id };
        showChatInterface();
        
    } catch (error) {
        showError('Signup failed: ' + error.message);
    }
}

// Login with passkey using Auth0 Native Passkeys API
async function login() {
    try {
        clearError();
        
        const email = prompt('Enter your email:');
        if (!email) return;
        
        // Step 1: Request login challenge
        const challengeResponse = await fetch(`https://${AUTH0_DOMAIN}/api/v1/passkeys/login/challenge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: CLIENT_ID,
                email: email
            })
        });
        
        const challengeData = await challengeResponse.json();
        if (!challengeResponse.ok) {
            throw new Error(challengeData.error_description || 'Challenge request failed');
        }
        
        // Step 2: Get WebAuthn assertion
        const assertion = await navigator.credentials.get({
            publicKey: challengeData.publicKey
        });
        
        // Step 3: Complete login
        const loginResponse = await fetch(`https://${AUTH0_DOMAIN}/api/v1/passkeys/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: CLIENT_ID,
                challenge_id: challengeData.challenge_id,
                credential: {
                    id: assertion.id,
                    rawId: Array.from(new Uint8Array(assertion.rawId)),
                    response: {
                        clientDataJSON: Array.from(new Uint8Array(assertion.response.clientDataJSON)),
                        authenticatorData: Array.from(new Uint8Array(assertion.response.authenticatorData)),
                        signature: Array.from(new Uint8Array(assertion.response.signature)),
                        userHandle: assertion.response.userHandle ? Array.from(new Uint8Array(assertion.response.userHandle)) : null
                    },
                    type: assertion.type
                }
            })
        });
        
        const loginData = await loginResponse.json();
        if (!loginResponse.ok) {
            throw new Error(loginData.error_description || 'Login failed');
        }
        
        localStorage.setItem('access_token', loginData.access_token);
        currentUser = { email: email, sub: loginData.user_id };
        showChatInterface();
        
    } catch (error) {
        showError('Login failed: ' + error.message);
    }
}

// Logout
function logout() {
    localStorage.removeItem('access_token');
    currentUser = null;
    showLoginInterface();
}

// Send chat message
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Add user message to chat
    addMessageToChat(message, 'user');
    input.value = '';
    
    try {
        const token = localStorage.getItem('access_token');
        
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                message: message,
                userId: currentUser.sub
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            addMessageToChat(data.response, 'bot');
        } else {
            addMessageToChat('Error: ' + data.error, 'bot');
        }
        
    } catch (error) {
        addMessageToChat('Error sending message: ' + error.message, 'bot');
    }
}

// Add message to chat box
function addMessageToChat(message, sender) {
    const chatBox = document.getElementById('chatBox');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    messageDiv.textContent = message;
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Show chat interface
function showChatInterface() {
    document.getElementById('loginContainer').classList.remove('active');
    document.getElementById('chatContainer').classList.add('active');
    
    // Display user info
    document.getElementById('userInfo').innerHTML = 
        `<p>Welcome, ${currentUser.name || currentUser.email || 'User'}!</p>`;
}

// Show login interface
function showLoginInterface() {
    document.getElementById('chatContainer').classList.remove('active');
    document.getElementById('loginContainer').classList.add('active');
    document.getElementById('chatBox').innerHTML = '';
}

// Error handling
function showError(message) {
    document.getElementById('authError').textContent = message;
}

function clearError() {
    document.getElementById('authError').textContent = '';
}

// Handle Enter key in message input
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('messageInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // Check if user is already authenticated
    const token = localStorage.getItem('access_token');
    if (token) {
        currentUser = { email: 'user@example.com', sub: 'auth0|user' };
        showChatInterface();
    }
});