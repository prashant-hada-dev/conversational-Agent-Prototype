# AI Sales Agent

An intelligent sales assistant powered by GPT-4 Turbo with voice interaction capabilities.

## Features

- Real-time chat with streaming responses
- Voice input and output support
- Context-aware conversations
- Professional sales agent persona
- Modern, responsive UI

## Prerequisites

- Node.js v18 or higher
- Docker and Docker Compose
- OpenAI API key
- Smallest.ai API key

## Setup Instructions

1. **Clone the repository:**
```bash
git clone <repository-url>
cd sales-agent-prototype
```

2. **Set up environment variables:**
Copy the example .env file and update with your API keys:
```bash
cp .env.example .env
```

3. **Start Redis using Docker:**
```bash
docker-compose up -d
```
This will start Redis on port 6379.

4. **Install and start the backend server:**
```bash
cd server
npm install
npm run dev
```

5. **In a new terminal, install and start the frontend:**
```bash
cd client
npm install
npm run dev
```

The application will be available at http://localhost:3000

## Environment Variables

### Backend (.env)
- `OPENAI_API_KEY`: Your OpenAI API key
- `SMALLEST_AI_API_KEY`: Your Smallest.ai API key
- `REDIS_HOST`: Redis host (default: localhost)
- `REDIS_PORT`: Redis port (default: 6379)
- `JWT_SECRET`: Secret for JWT tokens

### Frontend (client/.env)
- `VITE_API_URL`: Backend API URL
- `VITE_WS_PATH`: WebSocket path
- `VITE_WS_RECONNECT_INTERVAL`: WebSocket reconnect interval
- `VITE_WS_MAX_RECONNECT_ATTEMPTS`: Maximum reconnection attempts

## Architecture

- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express + TypeScript
- Real-time: Socket.IO
- State Management: React Context
- Styling: Tailwind CSS
- Storage: Redis
- AI: GPT-4 Turbo
- Voice: Smallest.ai + Web Speech API

## Development

### Available Scripts

Backend:
```bash
npm run dev     # Start development server
npm run build   # Build for production
npm start       # Start production server
```

Frontend:
```bash
npm run dev     # Start development server
npm run build   # Build for production
npm run preview # Preview production build
```

## Troubleshooting

1. **Redis Connection Issues:**
   - Ensure Docker is running
   - Check if Redis container is up: `docker ps`
   - Verify Redis logs: `docker-compose logs redis`

2. **WebSocket Connection Issues:**
   - Check if backend server is running
   - Verify WebSocket path in frontend config
   - Check browser console for connection errors

3. **Voice Input Issues:**
   - Ensure browser has microphone permissions
   - Check if audio recording is supported
   - Verify WebSocket connection for streaming