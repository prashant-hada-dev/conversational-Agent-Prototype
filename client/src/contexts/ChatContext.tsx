import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import WebSocketService from '../services/websocket.service';
import { AudioRecorder } from '../services/audio.service';
import config from '../config/config';
import { ChatContextType, ChatMessage, ChatStatus, AudioState } from '../types/chat';

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
  const [status, setStatus] = useState<ChatStatus>({ connected: false });
  const [audioState, setAudioState] = useState<AudioState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    url: null,
  });

  const wsRef = useRef<WebSocketService | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }

    try {
      audioRef.current.src = url;
      await audioRef.current.play();
      setAudioState(prev => ({ ...prev, isPlaying: true, url }));

      audioRef.current.onended = () => {
        setAudioState(prev => ({ ...prev, isPlaying: false }));
      };

      audioRef.current.ontimeupdate = () => {
        setAudioState(prev => ({
          ...prev,
          currentTime: audioRef.current?.currentTime || 0,
        }));
      };

      audioRef.current.onloadedmetadata = () => {
        setAudioState(prev => ({
          ...prev,
          duration: audioRef.current?.duration || 0,
        }));
      };
    } catch (error) {
      console.error('Error playing audio:', error);
      setAudioState(prev => ({ ...prev, isPlaying: false }));
    }
  }, []);

  const pauseAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setAudioState(prev => ({ ...prev, isPlaying: false }));
    }
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
  const { audioRecorder } = useRef({ audioRecorder: new AudioRecorder() }).current;

  const startVoiceInput = useCallback(async () => {
    try {
      await audioRecorder.startRecording();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting voice input:', error);
      // Add error notification here
      throw error;
    }
  }, []);

  const stopVoiceInput = useCallback(async () => {
    try {
      if (!audioRecorder.isRecording()) {
        return;
      }

      const { text } = await audioRecorder.stopRecording();
      setIsRecording(false);

      if (!text) {
        console.warn('No text transcribed from voice input');
        return;
      }

      // Send transcribed text to server
      if (wsRef.current?.isConnected()) {
        // First add the user's voice message to the chat
        const userMessage: ChatMessage = {
          id: Date.now().toString(),
          role: 'user',
          content: text,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, userMessage]);

        // Send the text to the server as a regular message
        wsRef.current.sendMessage(text);
      }
    } catch (error) {
      console.error('Error stopping voice input:', error);
      setIsRecording(false);
      // Add error notification here
    }
  }, []);

  const cancelVoiceInput = useCallback(() => {
    try {
      audioRecorder.cancelRecording();
      setIsRecording(false);
    } catch (error) {
      console.error('Error canceling voice input:', error);
      // Add error notification here
    }
  }, []);

  // Chat window state
  const [isMinimized, setIsMinimized] = useState(false);
  const minimizeChat = useCallback(() => setIsMinimized(true), []);
  const maximizeChat = useCallback(() => setIsMinimized(false), []);

  // Set up WebSocket event handlers
  useEffect(() => {
    if (!wsRef.current) return;

    wsRef.current.onMessage(async (response) => {
      // Handle streaming messages
      if (response.message.id.startsWith('stream-')) {
        // Update or add streaming message
        setMessages(prev => {
          const streamIndex = prev.findIndex(msg => msg.id === response.message.id);
          if (streamIndex >= 0) {
            // Update existing streaming message
            const newMessages = [...prev];
            newMessages[streamIndex] = response.message;
            return newMessages;
          } else {
            // Add new streaming message
            return [...prev, response.message];
          }
        });
      } else {
        // Handle final message with audio
        console.log('Received final message:', response);
        
        // Update messages
        setMessages(prev => {
          // Remove streaming message if exists
          const withoutStreaming = prev.filter(msg => !msg.id.startsWith('stream-'));
          return [...withoutStreaming, response.message];
        });

        // Handle audio URL from either message or response
        const audioUrl = response.audioUrl || response.message.audioUrl;
        if (audioUrl) {
          console.log('Received audio URL:', audioUrl);
          // First update audio state
          setAudioState(prev => ({
            ...prev,
            url: audioUrl,
            isPlaying: false,
            currentTime: 0,
            duration: 0
          }));

          // Then try to play audio
          try {
            await playAudio(audioUrl);
          } catch (error) {
            console.error('Failed to play audio:', error);
            // Keep the URL in state even if playback fails
            setAudioState(prev => ({
              ...prev,
              url: audioUrl,
              isPlaying: false
            }));
          }
        } else {
          console.warn('No audio URL in response');
          // Reset audio state if no URL
          setAudioState(prev => ({
            ...prev,
            url: null,
            isPlaying: false,
            currentTime: 0,
            duration: 0
          }));
        }
      }
    });

    wsRef.current.onStatus((newStatus) => {
      setStatus(newStatus);
    });

    wsRef.current.onError((error) => {
      console.error('WebSocket error:', error);
      // Implement error handling UI here
    });

    wsRef.current.onDisconnect(() => {
      setStatus(prev => ({ ...prev, connected: false }));
    });
  }, [playAudio]);

  const value: ChatContextType = {
    messages,
    status,
    audioState,
    isRecording,
    isMinimized,
    sendMessage,
    startVoiceInput,
    stopVoiceInput,
    cancelVoiceInput,
    playAudio,
    pauseAudio,
    minimizeChat,
    maximizeChat,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};