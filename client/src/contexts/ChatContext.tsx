import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import WebSocketService from '../services/websocket.service';
import { AudioRecorder } from '../services/audio.service';
import { audioQueueManager } from '../services/audio-queue.service';
import config from '../config/config';
import { ChatContextType, ChatMessage, ChatStatus, AudioState } from '../types/chat';
import { AudioChunk, STREAMING_EVENTS } from '../types/streaming';
import { urlToBlob } from '../utils/audio';

interface Props {
  children: React.ReactNode;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
};

export const ChatProvider = ({ children }: Props) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>({
    connected: false,
    voiceChannel: {
      active: false,
      status: 'idle'
    }
  });
  const [audioState, setAudioState] = useState<AudioState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    url: null,
    isStreaming: false,
    streamProgress: 0,
    queueSize: 0
  });
  const [isVoiceChannelActive, setIsVoiceChannelActive] = useState(false);
  const [voiceChannelStatus, setVoiceChannelStatus] = useState('Ready');

  const wsRef = useRef<WebSocketService | null>(null);
  const { audioRecorder } = useRef({ audioRecorder: new AudioRecorder() }).current;

  // Initialize WebSocket service
  useEffect(() => {
    wsRef.current = new WebSocketService(config.ws);
    wsRef.current.connect().catch(console.error);

    return () => {
      wsRef.current?.disconnect();
    };
  }, []);

  // Handle audio playback
  const playAudio = useCallback(async (url: string) => {
    try {
      const audioBlob = await urlToBlob(url);
      await audioQueueManager.enqueueChunk({
        id: 'single-' + Date.now(),
        text: '',
        audio: audioBlob,
        isLast: true,
        timestamp: Date.now()
      });
      setAudioState(prev => ({ ...prev, isPlaying: true, url }));
    } catch (error) {
      console.error('Error playing audio:', error);
      setAudioState(prev => ({ ...prev, isPlaying: false }));
    }
  }, []);

  const pauseAudio = useCallback(() => {
    audioQueueManager.pause();
    setAudioState(prev => ({ ...prev, isPlaying: false }));
  }, []);

  // Send message
  const sendMessage = useCallback(async (message: string) => {
    if (!wsRef.current?.isConnected()) {
      throw new Error('Not connected to server');
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    wsRef.current.sendMessage(message);
  }, []);

  // Voice input handling
  const [isRecording, setIsRecording] = useState(false);

  const startVoiceInput = useCallback(async () => {
    try {
      await audioRecorder.startRecording();
      setIsRecording(true);
      wsRef.current?.sendSpeechStart();
    } catch (error) {
      console.error('Error starting voice input:', error);
      throw error;
    }
  }, []);

  const stopVoiceInput = useCallback(async () => {
    try {
      if (!audioRecorder.isRecording()) return;

      const { text } = await audioRecorder.stopRecording();
      setIsRecording(false);
      wsRef.current?.sendSpeechEnd();

      if (!text) {
        console.warn('No text transcribed from voice input');
        return;
      }

      if (wsRef.current?.isConnected()) {
        const userMessage: ChatMessage = {
          id: Date.now().toString(),
          role: 'user',
          content: text,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, userMessage]);
        wsRef.current.sendMessage(text);
      }
    } catch (error) {
      console.error('Error stopping voice input:', error);
      setIsRecording(false);
    }
  }, []);

  const cancelVoiceInput = useCallback(() => {
    try {
      audioRecorder.cancelRecording();
      setIsRecording(false);
      wsRef.current?.sendSpeechEnd();
    } catch (error) {
      console.error('Error canceling voice input:', error);
    }
  }, []);

  // Chat window state
  const [isMinimized, setIsMinimized] = useState(false);
  const minimizeChat = useCallback(() => setIsMinimized(true), []);
  const maximizeChat = useCallback(() => setIsMinimized(false), []);

  // Set up WebSocket event handlers
  useEffect(() => {
    if (!wsRef.current) return;

    // Set up audio queue state updates
    audioQueueManager.onQueueStateChange((state) => {
      setAudioState(prev => ({
        ...prev,
        isPlaying: state.isPlaying,
        isStreaming: state.remainingChunks > 0,
        queueSize: state.remainingChunks
      }));
    });

    // Handle streaming events
    wsRef.current.onStreamStart(() => {
      setStatus(prev => ({ ...prev, streaming: true }));
      setAudioState(prev => ({ ...prev, isStreaming: true, streamProgress: 0 }));
    });

    wsRef.current.onStreamEnd(() => {
      setStatus(prev => ({ ...prev, streaming: false }));
      setAudioState(prev => ({ ...prev, isStreaming: false }));
    });

    wsRef.current.onStreamChunk(async (chunk: AudioChunk) => {
      try {
        // Log chunk details for debugging
        console.log('Received stream chunk:', {
          id: chunk.id,
          textLength: chunk.text.length,
          isLast: chunk.isLast
        });

        // Only process chunks that haven't been processed before
        const isDuplicate = messages.some(msg => msg.id === chunk.id);
        if (isDuplicate) {
          console.log(`Skipping duplicate chunk: ${chunk.id}`);
          return;
        }

        // Convert audio URL to Blob
        const audioBlob = await urlToBlob(chunk.audio as string);
        const processedChunk = {
          ...chunk,
          audio: audioBlob
        };

        // Log before enqueueing
        console.log('Enqueueing audio chunk:', {
          id: chunk.id,
          isLast: chunk.isLast,
          queueSize: audioState.queueSize
        });
        
        await audioQueueManager.enqueueChunk(processedChunk);
        
        // Update messages with chunk text
        setMessages(prev => {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage?.role === 'assistant' && !lastMessage.id.startsWith('stream-')) {
            // If last message is not a streaming message, create new one
            return [...prev, {
              id: chunk.id,
              role: 'assistant',
              content: chunk.text,
              timestamp: chunk.timestamp
            }];
          } else if (lastMessage?.role === 'assistant') {
            // Update existing streaming message
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = {
              ...lastMessage,
              content: lastMessage.content + chunk.text
            };
            return newMessages;
          } else {
            // First chunk of a new streaming message
            return [...prev, {
              id: chunk.id,
              role: 'assistant',
              content: chunk.text,
              timestamp: chunk.timestamp
            }];
          }
        });

        // Update streaming progress
        setAudioState(prev => ({
          ...prev,
          streamProgress: (prev.streamProgress || 0) + 1
        }));
      } catch (error) {
        console.error('Error handling audio chunk:', error);
      }
    });

    wsRef.current.onMessage(async (response) => {
      // Skip message handling for streaming responses
      if (response.message.id.startsWith('stream-')) {
        return;
      }
      
      // Only handle non-streaming messages
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        // If the last message has the same content, don't add it again
        if (lastMessage && lastMessage.content === response.message.content) {
          return prev;
        }
        return [...prev, response.message];
      });
    });

    wsRef.current.onStatus((newStatus) => {
      setStatus(newStatus);
    });

    wsRef.current.onError((error) => {
      console.error('WebSocket error:', error);
      audioQueueManager.clear();
      setAudioState(prev => ({
        ...prev,
        isPlaying: false,
        isStreaming: false,
        streamProgress: 0,
        queueSize: 0
      }));
    });

    wsRef.current.onDisconnect(() => {
      setStatus(prev => ({ ...prev, connected: false, streaming: false }));
      audioQueueManager.clear();
    });
  }, []);

  // Voice channel methods
  const startVoiceChannel = useCallback(async () => {
    try {
      setIsVoiceChannelActive(true);
      setVoiceChannelStatus('Connecting...');
      setStatus(prev => ({
        ...prev,
        voiceChannel: { active: true, status: 'connecting' }
      }));

      // Start continuous voice input first
      await startVoiceInput();
      setVoiceChannelStatus('Listening...');
      setStatus(prev => ({
        ...prev,
        voiceChannel: { active: true, status: 'listening' }
      }));

      // Set up automatic restart of voice input after processing
      audioRecorder.setOnSpeechEnd(() => {
        if (isVoiceChannelActive) {
          setTimeout(() => {
            startVoiceInput().catch(console.error);
          }, 1000); // Wait 1s before restarting
        }
      });

    } catch (error) {
      console.error('Error starting voice channel:', error);
      setIsVoiceChannelActive(false);
      setVoiceChannelStatus('Failed to start');
      setStatus(prev => ({
        ...prev,
        voiceChannel: { active: false, status: 'idle' }
      }));
    }
  }, [playAudio, startVoiceInput, isVoiceChannelActive]);

  const stopVoiceChannel = useCallback(async () => {
    try {
      setIsVoiceChannelActive(false);
      setVoiceChannelStatus('Disconnecting...');
      
      // Stop current recording if any
      if (isRecording) {
        await stopVoiceInput();
      }

      // Reset voice channel state
      setStatus(prev => ({
        ...prev,
        voiceChannel: { active: false, status: 'idle' }
      }));
      setVoiceChannelStatus('Ready');

      // Clear audio queue and reset state
      audioQueueManager.clear();
      setAudioState(prev => ({
        ...prev,
        isPlaying: false,
        isStreaming: false,
        streamProgress: 0,
        queueSize: 0
      }));

    } catch (error) {
      console.error('Error stopping voice channel:', error);
      setVoiceChannelStatus('Error disconnecting');
    }
  }, [isRecording, stopVoiceInput]);

  const value: ChatContextType = {
    messages,
    status,
    audioState,
    isRecording,
    isMinimized,
    isVoiceChannelActive,
    voiceChannelStatus,
    sendMessage,
    startVoiceInput,
    stopVoiceInput,
    cancelVoiceInput,
    startVoiceChannel,
    stopVoiceChannel,
    playAudio,
    pauseAudio,
    minimizeChat,
    maximizeChat,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};