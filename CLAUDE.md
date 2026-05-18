# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI chatbot application with Auth0 embedded passkey authentication using the Native Passkey SDK. The application demonstrates browser-based, redirect-free passkey signup and login integrated with OpenAI chat functionality.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server with auto-reload
npm run dev

# Start production server
npm start
```

The application runs on `http://localhost:3000` by default (configurable via PORT environment variable).

## Architecture

### Dual Deployment Structure

The application supports both local development and Vercel serverless deployment:

- **Local development**: `server.js` runs an Express server that serves static files and handles all API routes
- **Vercel deployment**: Individual serverless functions in `/api` directory handle API routes, with static files served from `/public`

### API Endpoints

#### Passkey Authentication Flow

1. **Signup Challenge** (`POST /api/passkey-signup-challenge`)
   - Proxies to `https://${AUTH0_DOMAIN}/passkey/register`
   - Returns WebAuthn challenge and options for credential creation
   - Frontend must convert Base64URL strings to ArrayBuffers for WebAuthn API

2. **Signup Completion** (`POST /api/passkey-signup`)
   - Proxies to `https://${AUTH0_DOMAIN}/oauth/token`
   - Uses grant type: `urn:okta:params:oauth:grant-type:webauthn`
   - Returns access token after passkey registration

3. **Login Challenge** (`POST /api/passkey-login-challenge`)
   - Proxies to `https://${AUTH0_DOMAIN}/passkey/challenge`
   - Returns WebAuthn challenge for authentication

4. **Login Completion** (`POST /api/passkey-login`)
   - Verifies passkey assertion and returns access token

#### Chat Endpoint

- **Chat** (`POST /api/chat`)
  - Forwards user messages to OpenAI API (`gpt-3.5-turbo`)
  - Requires `message` and `userId` in request body

### Frontend Architecture

The frontend is contained in `index.html` (and `public/index.html` for Vercel) with inline JavaScript that:

1. Handles passkey registration/authentication using WebAuthn API
2. Manages Base64URL ↔ ArrayBuffer conversions for WebAuthn
3. Stores access tokens in localStorage
4. Implements chat UI with message history
5. Configures RP ID as `demo-connect.us` (must match Auth0 passkey settings)

**Critical Configuration**: The `publicKeyOptions.rp.id` and `publicKeyOptions.rpId` are hardcoded to `demo-connect.us`. This must match the Auth0 tenant's passkey configuration.

## Environment Variables

Copy `.env.example` to `.env` and configure:

```
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
AUTH0_AUDIENCE=your-api-audience
OPENAI_API_KEY=your-openai-api-key
PORT=3000
```

**Note**: The frontend also requires Auth0 configuration in `public/config.js` (or inline in `index.html`).

## Auth0 Configuration Requirements

1. **Application Type**: Single Page Application
2. **Passkey Connection**: Must be enabled in Authentication > Database
3. **Allowed Callback URLs**: `http://localhost:3000` (and production URLs)
4. **Allowed Web Origins**: `http://localhost:3000` (and production URLs)
5. **RP ID**: Must be configured to match the domain used in frontend (e.g., `demo-connect.us`)

## Key Implementation Details

### WebAuthn Base64URL Conversion

The frontend includes a `base64UrlToBuffer()` helper that converts Auth0's Base64URL-encoded challenge and user ID into ArrayBuffers required by the WebAuthn API. This conversion is critical for both signup and login flows.

### Serverless Function Pattern

Each API endpoint in `/api` exports a standard Vercel serverless function:

```javascript
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  // Implementation
};
```

### Rate Limiting

The Express server applies rate limiting (100 requests per 15 minutes) to all `/api/*` routes in local development. Vercel deployments should configure rate limiting at the platform level.

## Testing Passkey Flows

1. User clicks "Sign Up with Passkey" → enters email → browser prompts for biometric/PIN
2. Credential is created and registered with Auth0
3. User clicks "Login with Passkey" → enters email → browser prompts for biometric/PIN
4. Auth0 verifies the passkey and returns access token
5. User can now interact with the chatbot

Passkeys are device-bound. Testing on different devices/browsers requires separate registrations.
