console.log('app.js loading...');

let currentUser = null;
const AUTH0_DOMAIN = window.AUTH0_CONFIG?.domain;
const CLIENT_ID = window.AUTH0_CONFIG?.clientId;

console.log('app.js loaded, AUTH0_DOMAIN:', AUTH0_DOMAIN, 'CLIENT_ID:', CLIENT_ID);

// Sign up with passkey using Auth0 Native Passkeys API
window.signup = async function signup() {
    console.log('signup function called');
    try {
        clearError();
        
        const email = prompt('Enter your email:');
        if (!email) return;
        
        // Step 1: Request signup challenge
        const challengeResponse = await fetch(`https://${AUTH0_DOMAIN}/passkey/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: CLIENT_ID,
                realm: 'DefaultTenantPasskey',
                user_profile: {
                    email: email
                }
            })
        });
        
        const challengeData = await challengeResponse.json();
        console.log(challengeData);
        if (!challengeResponse.ok) {
            throw new Error(challengeData.error_description || 'Register request failed');
        }

        // --- Step 2: Create WebAuthn credential ---
        // The challenge and user.id must be converted from Base64URL string (from Auth0) 
        // into an ArrayBuffer (expected by WebAuthn API).
        const publicKeyOptions = challengeData.authn_params_public_key;
        
        publicKeyOptions.challenge = base64UrlToBuffer(publicKeyOptions.challenge);
        publicKeyOptions.user.id = base64UrlToBuffer(publicKeyOptions.user.id);
        
        try {
            
            // This prompts the user to create the passkey.
            const credential = await navigator.credentials.create({
                publicKey: publicKeyOptions
            });

            // The 'credential' object is the assertion/response we need to format.
            // It's a PublicKeyCredential object.

            // --- Step 3: Format the Assertion and Complete Signup ---
            
            // 3a. Extract and Base64URL-encode the necessary ArrayBuffer properties
            const assertion = {
                id: credential.id,
                rawId: bufferToBase64Url(credential.rawId),
                type: credential.type,
                response: {
                    clientDataJSON: bufferToBase64Url(credential.response.clientDataJSON),
                    // For Registration, we send attestationObject, not authenticatorData/signature.
                    attestationObject: bufferToBase64Url(credential.response.attestationObject),
                    
                    // These properties are for authentication, not registration.
                    // signature: (not needed for registration)
                    // authenticatorData: (not needed for registration)
                    // userHandle: (not needed for registration)
                }
            };

        // 3b. Call the Auth0 /oauth/token endpoint with the assertion
        const loginResponse = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grant_type: 'urn:okta:params:oauth:grant-type:webauthn',
                client_id: CLIENT_ID,
                realm: 'DefaultTenantPasskey',
                audience: `https://passkey.demo-connect.us`,
                auth_session: challengeData.auth_session,
                
                // CRITICAL CORRECTION: Use 'webauthn_credential_assertion' field.
                webauthn_credential_assertion: assertion
            })
        });
        
        const loginData = await loginResponse.json();
        if (!loginResponse.ok) {
            throw new Error(loginData.error_description || 'Login failed');
        }
        
        const tokenData = await loginResponse.json();
        if (!loginResponse.ok) {
            throw new Error(tokenData.error_description || 'Token request failed');
        }

        console.log("Passkey Registration Successful. Tokens:", tokenData);

        localStorage.setItem('access_token', loginData.access_token);
        currentUser = { email: email, sub: loginData.user_id };
        showChatInterface();
        
    } catch (error) {
        showError('Signup failed: ' + error.message);
    }
}

// Login with passkey using Auth0 Native Passkeys API
window.login = async function login() {
    console.log('login function called');
    try {
        clearError();
        
        const email = prompt('Enter your email:');
        if (!email) return;
        
        // Step 1: Request login challenge
        const challengeResponse = await fetch(`https://${AUTH0_DOMAIN}/passkey/challenge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: CLIENT_ID,
                realm: 'DefaultTenantPasskey'
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
        const loginResponse = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grant_type: 'urn:okta:params:oauth:grant-type:webauthn',
                client_id: CLIENT_ID,
                realm: 'DefaultTenantPasskey',
                audience: `https://passkey.demo-connect.us`,
                auth_session: challengeData.auth_session,
                authn_response: {
                    id: assertion.id,
                    rawId: Array.from(new Uint8Array(assertion.rawId)),
                    response: {
                        clientDataJSON: Array.from(new Uint8Array(assertion.response.clientDataJSON)),
                        authenticatorData: Array.from(new Uint8Array(assertion.response.authenticatorData)),
                        signature: Array.from(new Uint8Array(assertion.response.signature)),
                        userHandle: assertion.response.userHandle ? Array.from(new Uint8Array(assertion.response.userHandle)) : null
                    },
                    type: assertion.type
                },
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
window.logout = function logout() {
    console.log('logout function called');
    localStorage.removeItem('access_token');
    currentUser = null;
    showLoginInterface();
}

// Send chat message
window.sendMessage = async function sendMessage() {
    console.log('sendMessage function called');
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
    document.getElementById('userInfo').innerHTML = `<p>Welcome, ${currentUser.email}!</p>`;
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

// Base64URL conversion functions
function base64UrlToBuffer(base64url) {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64);
    const buffer = new ArrayBuffer(binary.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) {
        view[i] = binary.charCodeAt(i);
    }
    return buffer;
}

function bufferToBase64Url(buffer) {
    const binary = String.fromCharCode(...new Uint8Array(buffer));
    const base64 = btoa(binary);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
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
});ctive');
    
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


const bufferToBase64Url = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let str = '';
    for (const charCode of bytes) {
        str += String.fromCharCode(charCode);
    }
    return btoa(str) // Standard Base64
        .replace(/\+/g, '-') // Replace + with -
        .replace(/\//g, '_') // Replace / with _
        .replace(/=+$/, ''); // Remove trailing =
};

/** Converts a Base64URL string to an ArrayBuffer */
const base64UrlToBuffer = (base64Url) => {
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
        base64 += '=';
    }
    const raw = atob(base64);
    const outputArray = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
        outputArray[i] = raw.charCodeAt(i);
    }
    return outputArray.buffer;
};

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