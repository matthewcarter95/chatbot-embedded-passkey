# Chatbot AI Gateway with Embedded Passkey Authentication

A minimal implementation of an AI chatbot with Auth0 embedded passkey authentication using the Native Passkey SDK.

## Features

- **Embedded Passkey Authentication**: No redirect, browser-based passkey signup and login
- **AI Chat Gateway**: Integrated OpenAI chat functionality
- **Secure**: Rate limiting and token-based authentication
- **Minimal**: Clean, focused implementation

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure Auth0**:
   - Create an Auth0 application (Single Page Application)
   - Enable Passkey connection in Auth0 Dashboard
   - Update `public/config.js` with your Auth0 domain and client ID
   - Copy `.env.example` to `.env` and fill in your credentials

3. **Auth0 Configuration Required**:
   - Application Type: Single Page Application
   - Allowed Callback URLs: `http://localhost:3000`
   - Allowed Web Origins: `http://localhost:3000`
   - Enable Passkey connection in Authentication > Database

4. **Start the server**:
   ```bash
   npm start
   ```

5. **Access the application**:
   Open `http://localhost:3000`

## Usage

1. Click "Sign Up with Passkey" to create a new account and register a passkey
2. Use "Login with Passkey" to authenticate with your registered passkey
3. Start chatting with the AI once authenticated

## Environment Variables

```
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
AUTH0_AUDIENCE=your-api-audience
OPENAI_API_KEY=your-openai-api-key
PORT=3000
```

## API Endpoints

- `POST /api/chat` - Send message to AI chatbot
- `GET /api/user/:userId` - Get user profile information

## Security Features

- Rate limiting (100 requests per 15 minutes)
- JWT token validation
- CORS protection
- Environment variable configuration