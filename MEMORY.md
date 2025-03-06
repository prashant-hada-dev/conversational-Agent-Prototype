# AI Sales Agent Technical Memory Bank

## Architecture Decisions

### Backend Architecture
1. **Server Framework**: Express.js with TypeScript
   - Chosen for its robust ecosystem and TypeScript support
   - Easy integration with WebSocket and middleware
   - Strong typing for better development experience

2. **Real-time Communication**: Socket.IO
   - Provides reliable WebSocket implementation
   - Automatic fallback to polling if needed
   - Built-in reconnection and error handling
   - Event-based communication pattern

3. **Context Storage**: Redis
   - In-memory database for fast access
   - Perfect for session and context management
   - Supports data expiration for cleanup
   - Scalable for future growth

### Frontend Architecture
1. **Framework**: React with Vite
   - Migrated from CRA to Vite for better performance
   - Hot Module Replacement (HMR)
   - Faster build times
   - Better TypeScript integration

2. **State Management**: React Context
   - Centralized chat state management
   - Avoids prop drilling
   - Provides real-time updates
   - Easy integration with WebSocket

3. **Styling**: Tailwind CSS
   - Utility-first approach
   - Highly customizable
   - Responsive design support
   - Reduced bundle size with JIT

## Configuration Details

### Environment Variables
1. **Backend (.env)**
```
PORT=3002
OPENAI_API_KEY=<key>
SMALLEST_AI_API_KEY=<key>
JWT_SECRET=sales_agent_jwt_secret_2025
REDIS_HOST=localhost
REDIS_PORT=6379
WS_PATH=/socket
```

2. **Frontend (.env)**
```
VITE_API_URL=http://localhost:3002
VITE_WS_PATH=/socket
VITE_WS_RECONNECT_INTERVAL=5000
VITE_WS_MAX_RECONNECT_ATTEMPTS=5
```

### WebSocket Events
1. **Client to Server**
   - `chat:message`: Send text message
   - `chat:audio`: Send voice input
   - `chat:typing`: Send typing status
   - `chat:start`: Initialize chat session

2. **Server to Client**
   - `chat:response`: AI response with text/audio
   - `chat:error`: Error messages
   - `chat:status`: Connection/typing status

### API Endpoints
1. **Health Check**
   - `GET /health`: Server status check

2. **Future Endpoints**
   - `POST /api/chat/init`: Initialize chat session
   - `GET /api/chat/history`: Get chat history
   - `POST /api/voice/convert`: Convert text to speech

## Technical Specifications

### TypeScript Configurations
1. **Backend (tsconfig.json)**
   - Target: ES2020
   - Module: CommonJS
   - Strict mode enabled
   - Path aliases configured

2. **Frontend (tsconfig.json)**
   - Target: ES2020
   - Module: ESNext
   - React JSX mode
   - Vite-specific settings

### Dependencies
1. **Backend Dependencies**
   - express, socket.io, redis
   - openai, axios
   - typescript, ts-node
   - cors, dotenv

2. **Frontend Dependencies**
   - react, socket.io-client
   - tailwindcss, postcss
   - typescript, vite
   - react-icons

## Implementation Notes

### OpenAI Integration
- Using GPT-4 Turbo for responses
- Streaming responses enabled
- Context window management
- Prompt engineering for sales persona

### Voice Processing
- Web Speech API for voice input
- Smallest.ai for voice output
- Indian accent configuration
- Audio streaming and caching

### Error Handling
1. **WebSocket Errors**
   - Connection failures
   - Message delivery failures
   - Reconnection logic

2. **API Errors**
   - Rate limiting
   - Service unavailability
   - Invalid requests

### Performance Considerations
1. **Frontend**
   - Code splitting
   - Lazy loading components
   - Asset optimization
   - Memory management

2. **Backend**
   - Connection pooling
   - Request queuing
   - Caching strategies
   - Resource cleanup

## Security Measures

### Authentication
- JWT-based authentication
- Secure WebSocket connections
- API key validation
- Rate limiting implementation

### Data Protection
- Input sanitization
- XSS prevention
- CORS configuration
- Secure headers

## Future Considerations

### Scalability
- Horizontal scaling with Redis
- Load balancing
- Microservices architecture
- Caching strategies

### Monitoring
- Error tracking
- Performance metrics
- User analytics
- Resource utilization

### Integration Points
- CRM systems
- Payment processors
- Analytics platforms
- Email marketing tools