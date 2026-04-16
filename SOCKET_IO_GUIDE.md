# Socket.IO Real-Time Chat Integration

## Overview
Your chatbot now supports real-time communication using Socket.IO. The application integrates with OpenAI embeddings and the vector store for intelligent responses.

## Endpoints

### REST API Endpoints (HTTP)

1. **Send Message via HTTP** 
   - **Endpoint**: `POST /chat/send`
   - **Description**: Send a message and get immediate response
   - **Request Body**:
   ```json
   {
     "message": "What is the meaning of life?"
   }
   ```
   - **Response**:
   ```json
   {
     "conversationId": "uuid",
     "message": "What is the meaning of life?",
     "response": "The response from the chatbot...",
     "timestamp": "2024-04-15T17:20:00Z"
   }
   ```

2. **Get Conversation History via HTTP**
   - **Endpoint**: `GET /chat/response/:conversationId`
   - **Description**: Retrieve all messages in a conversation
   - **Response**:
   ```json
   {
     "conversationId": "uuid",
     "messages": [
       {
         "id": "msg-id",
         "message": "user message",
         "response": "bot response",
         "timestamp": "2024-04-15T17:20:00Z"
       }
     ]
   }
   ```

### WebSocket Events (Socket.IO)

1. **Connect**
   - Event: `connection`
   - Client automatically receives: `{ data: 'Connected to chat server' }`

2. **Send Message via WebSocket**
   - **Emit**: `message`
   - **Payload**:
   ```javascript
   socket.emit('message', { message: 'Your question here' })
   ```
   - **Listen**: `response`
   - **Response**:
   ```javascript
   socket.on('response', (data) => {
     console.log(data.response); // Bot response
     console.log(data.conversationId); // Conversation ID
   })
   ```

3. **Get Conversation History via WebSocket**
   - **Emit**: `getResponse`
   - **Payload**:
   ```javascript
   socket.emit('getResponse', { conversationId: 'conversation-uuid' })
   ```
   - **Listen**: `conversationHistory`
   - **Response**:
   ```javascript
   socket.on('conversationHistory', (data) => {
     console.log(data.messages); // Array of all messages
   })
   ```

4. **Ping/Pong (Keep-Alive)**
   - **Emit**: `ping`
   - **Response**: `pong`

5. **Error Handling**
   - **Listen**: `error`
   - **Error payload**:
   ```javascript
   socket.on('error', (error) => {
     console.error(error.message);
   })
   ```

## Client-Side Example (JavaScript)

```javascript
import { io } from 'socket.io-client';

// Connect to the server
const socket = io('http://localhost:3000', {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5
});

// Handle connection
socket.on('connection', (data) => {
  console.log('Connected:', data);
});

// Send a message
function sendMessage(message) {
  socket.emit('message', { message: message });
}

// Listen for response
socket.on('response', (data) => {
  console.log('Bot Response:', data.response);
  console.log('Conversation ID:', data.conversationId);
});

// Get conversation history
function getConversationHistory(conversationId) {
  socket.emit('getResponse', { conversationId: conversationId });
}

// Listen for conversation history
socket.on('conversationHistory', (data) => {
  console.log('All messages:', data.messages);
});

// Handle errors
socket.on('error', (error) => {
  console.error('Error:', error.message);
});

// Keep connection alive
setInterval(() => {
  socket.emit('ping');
}, 30000);
```

## How It Works

1. **User sends a message** - Either via HTTP or WebSocket
2. **Message is embedded** - Using OpenAI's embedding model
3. **Vector search** - Similarity search in the vector store retrieves relevant context
4. **GPT response** - OpenAI's GPT-3.5-turbo generates a response using the context
5. **Response sent back** - Immediately to the user via HTTP response or WebSocket event

## Configuration

Set these environment variables:

```bash
OPENAI_API_KEY=your-api-key-here
openai.embeddingModel=text-embedding-3-small
PORT=3000
```

## Features

✅ Real-time bidirectional communication via Socket.IO  
✅ REST API support for traditional HTTP requests  
✅ Semantic search using vector embeddings  
✅ RAG (Retrieval-Augmented Generation) responses  
✅ Conversation history tracking  
✅ Error handling and fallback responses  
✅ CORS enabled for cross-origin requests  

## Accessing the API

- **Swagger UI**: http://localhost:3000/api
- **WebSocket Connection**: ws://localhost:3000
- **REST API**: http://localhost:3000/chat/send
