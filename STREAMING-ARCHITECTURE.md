# Streaming Voice Channel Architecture

## Overview
This document outlines the architecture for the real-time voice interaction channel in our AI Sales Agent. The system enables natural conversation through voice with automatic silence detection and seamless audio response streaming.

## System Components

### Frontend Components
- WebSocket Client for real-time communication
- Web Speech API for voice input
- Web Audio API for audio playback
- Audio Queue Manager for sequential playback
- Text Display UI for visual feedback

### Backend Components
- WebSocket Server for bi-directional communication
- Text Chunker Service for response processing
- TTS Service Integration (smallest.ai)
- Audio Processing Queue

## Data Flow

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant WebSocket
    participant Server
    participant LLM
    participant TTS

    Note over Browser: Web Speech API
    Note over Browser: Web Audio API Queue
    
    User->>Browser: Speak
    activate Browser
    Note over Browser: Silence Detection
    Browser->>WebSocket: Send Speech Input
    deactivate Browser
    
    WebSocket->>Server: Forward Input
    
    Server->>LLM: Generate Response
    LLM-->>Server: Complete Response Text
    
    Note over Server: Split into chunks
    Note over Server: (300 char limit)
    
    loop For each chunk
        Server->>TTS: Generate Audio
        TTS-->>Server: Audio Blob
        Server->>WebSocket: Send {text: chunk, audio: blob}
        WebSocket->>Browser: Receive Chunk
        Note over Browser: Queue Audio
        Note over Browser: Display Text
    end
```

## Component Details

### Frontend Architecture

```mermaid
graph TD
    subgraph Browser
        WS[WebSocket Client]
        Speech[Speech Recognition]
        Audio[Web Audio Context]
        Queue[Audio Queue Manager]
        UI[Text Display]
        
        Speech -->|Input| WS
        WS -->|Chunks| Queue
        Queue -->|Play| Audio
        WS -->|Text| UI
    end
```

### Backend Architecture

```mermaid
graph TD
    subgraph Server
        WSS[WebSocket Server]
        Chunk[Text Chunker]
        TTS[TTS Service]
        Queue[Audio Processing Queue]
        
        WSS -->|Full Text| Chunk
        Chunk -->|300 chars| TTS
        TTS -->|Audio Blob| Queue
        Queue -->|Send| WSS
    end
```

## Implementation Details

### 1. Speech Input Handler
- Utilizes Web Speech API for voice capture
- Implements silence detection (1.5s threshold)
- Auto-restarts recognition after input sent
- Handles voice input errors gracefully

### 2. Text Chunker Service
- Splits response text into 300-character chunks
- Preserves word boundaries during splitting
- Maintains text coherence
- Queues chunks for TTS processing

### 3. Audio Queue Manager
- Manages incoming audio blob queue
- Implements Web Audio API for playback
- Ensures sequential chunk playback
- Handles smooth transitions between chunks
- Manages playback state

### 4. WebSocket Communication

#### Client to Server Events
```typescript
{
  type: 'speech_input',
  data: string  // Transcribed speech text
}
```

#### Server to Client Events
```typescript
{
  type: 'response_chunk',
  data: {
    text: string,      // Chunk text content
    audio: Blob,       // Audio blob for chunk
    isLast: boolean    // Indicates final chunk
  }
}
```

## Error Handling

### Frontend
- Speech recognition fallbacks
- Audio playback error recovery
- WebSocket reconnection logic
- Queue state management

### Backend
- Chunk processing error handling
- TTS service error recovery
- WebSocket connection management
- Queue overflow prevention

## Performance Considerations

### Frontend
- Audio buffer management
- Memory usage optimization
- Smooth playback transitions
- UI responsiveness

### Backend
- Efficient chunk processing
- TTS request optimization
- WebSocket message handling
- Queue size management

## Future Enhancements
1. Adjustable chunk sizes based on content
2. Dynamic silence threshold
3. Audio quality improvements
4. Enhanced error recovery
5. Performance optimizations

## Notes
- This architecture focuses on functional implementation
- Maintains existing LLM integration
- Prioritizes real-time interaction
- Designed for rapid implementation