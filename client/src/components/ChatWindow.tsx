import React, { useRef, useEffect } from 'react';
import { FiMinimize2, FiMaximize2, FiMic, FiMicOff, FiSend } from 'react-icons/fi';
import { useChatContext } from '../contexts/ChatContext';
import MessageList from './MessageList';
import AudioControls from './AudioControls';

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

  const handleVoiceInput = async () => {
    if (isRecording) {
      try {
        await stopVoiceInput();
      } catch (error) {
        console.error('Error stopping voice input:', error);
        // Show error notification
      }
    } else {
      try {
        await startVoiceInput();
      } catch (error) {
        console.error('Error starting voice input:', error);
        // Show error notification
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Cancel recording on Escape key
    if (e.key === 'Escape' && isRecording) {
      cancelVoiceInput();
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
        <div className="flex items-center">
          <div className={`status-indicator ${status.connected ? 'status-online' : 'status-offline'}`} />
          <span className="ml-2 font-semibold">AI Sales Assistant</span>
        </div>
        <button
          onClick={toggleMinimize}
          className="minimize-button"
          aria-label={isMinimized ? 'Maximize chat' : 'Minimize chat'}
        >
          {isMinimized ? <FiMaximize2 /> : <FiMinimize2 />}
        </button>
      </div>

      {/* Chat Content */}
      {!isMinimized && (
        <>
          {/* Messages */}
          <div ref={chatContainerRef} className="chat-messages">
            <MessageList messages={messages} />
            {status.typing && (
              <div className="typing-indicator">
                <span>AI is typing</span>
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
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
                placeholder={isRecording ? 'Recording... Press Esc to cancel' : 'Type your message...'}
                className={`text-input ${isRecording ? 'bg-red-50' : ''}`}
                disabled={isRecording}
              />
              {isRecording && (
                <div className="recording-indicator">
                  <div className="recording-pulse" />
                  <span className="recording-time">Recording...</span>
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