import React, { useRef, useEffect } from 'react';
import { FiMinimize2, FiMaximize2, FiMic, FiMicOff, FiSend } from 'react-icons/fi';
import { useChatContext } from '../contexts/ChatContext';
import MessageList from './MessageList';
import AudioControls from './AudioControls';
import VoiceChannel from './VoiceChannel';

const ChatWindow: React.FC = () => {
  const {
    messages,
    status,
    audioState,
    isRecording,
    sendMessage,
    startVoiceInput,
    stopVoiceInput,
    cancelVoiceInput,
    minimizeChat,
    maximizeChat,
  } = useChatContext();
  const [inputMessage, setInputMessage] = React.useState('');
  const [isMinimized, setIsMinimized] = React.useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    try {
      await sendMessage(inputMessage);
      setInputMessage('');
      inputRef.current?.focus();
    } catch (error) {
      console.error('Error sending message:', error);
      // Implement error handling UI here
    }
  };

  const [transcribing, setTranscribing] = React.useState(false);
  const [recordingError, setRecordingError] = React.useState<string | null>(null);

  const handleVoiceInput = async () => {
    setRecordingError(null);
    
    if (isRecording) {
      try {
        setTranscribing(true);
        console.log('Stopping voice recording and starting transcription...');
        await stopVoiceInput();
        console.log('Voice input processed successfully');
      } catch (error) {
        console.error('Error processing voice input:', error);
        setRecordingError(error instanceof Error ? error.message : 'Failed to process voice input');
      } finally {
        setTranscribing(false);
      }
    } else {
      try {
        console.log('Starting voice recording...');
        await startVoiceInput();
        console.log('Voice recording started');
      } catch (error) {
        console.error('Error starting voice input:', error);
        setRecordingError(error instanceof Error ? error.message : 'Failed to start recording');
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Cancel recording on Escape key
    if (e.key === 'Escape' && isRecording) {
      cancelVoiceInput();
      return;
    }

    // Send message on Enter (without shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isRecording) {
        stopVoiceInput();
      } else if (inputMessage.trim()) {
        handleSendMessage(e);
      }
    }
  };

  const toggleMinimize = () => {
    if (isMinimized) {
      maximizeChat();
    } else {
      minimizeChat();
    }
    setIsMinimized(!isMinimized);
  };

  return (
    <div className={`chat-container ${isMinimized ? 'h-16' : ''}`}>
      {/* Chat Header */}
      <div className="chat-header">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center">
            <div className={`status-indicator ${status.connected ? 'status-online' : 'status-offline'}`} />
            <span className="ml-2 font-semibold">AI Sales Assistant</span>
          </div>
          <div className="flex items-center gap-2">
            <VoiceChannel />
            <button
              onClick={toggleMinimize}
              className="minimize-button"
              aria-label={isMinimized ? 'Maximize chat' : 'Minimize chat'}
            >
              {isMinimized ? <FiMaximize2 /> : <FiMinimize2 />}
            </button>
          </div>
        </div>
      </div>

      {/* Chat Content */}
      {!isMinimized && (
        <>
          {/* Messages */}
          <div ref={chatContainerRef} className="chat-messages">
            <MessageList messages={messages} />
            {status.typing && (
              <div className="typing-indicator">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span>AI is typing</span>
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                  </div>
                  {status.processing && (
                    <span className="text-xs text-secondary-500">
                      Generating voice response...
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Audio Controls */}
          {audioState.url && <AudioControls />}

          {/* Input Area */}
          <form onSubmit={handleSendMessage} className="chat-input">
            <div className="input-container">
              <button
                type="button"
                onClick={handleVoiceInput}
                className={`icon-button ${isRecording ? 'text-red-500' : ''}`}
                aria-label={isRecording ? 'Stop recording' : 'Start recording'}
              >
                {isRecording ? <FiMicOff /> : <FiMic />}
              </button>
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isRecording
                    ? 'Recording... Press Esc to cancel'
                    : transcribing
                      ? 'Transcribing voice...'
                      : 'Type your message or use voice input...'
                }
                className={`text-input ${isRecording ? 'bg-red-50' : transcribing ? 'bg-yellow-50' : ''}`}
                disabled={isRecording || transcribing}
              />
              {(isRecording || transcribing) && (
                <div className="recording-indicator">
                  <div className={`recording-pulse ${transcribing ? 'pulse-yellow' : ''}`} />
                  <span className="recording-time">
                    {transcribing ? 'Transcribing...' : 'Recording...'}
                  </span>
                </div>
              )}
              {recordingError && (
                <div className="text-red-500 text-xs mt-1 absolute -bottom-6 left-0 right-0 text-center">
                  {recordingError}
                </div>
              )}
              <button
                type="submit"
                className="icon-button"
                disabled={!inputMessage.trim() && !isRecording}
                aria-label="Send message"
              >
                <FiSend />
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
};

export default ChatWindow;