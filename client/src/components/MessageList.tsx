import React from 'react';
import { ChatMessage } from '../types/chat';

interface MessageListProps {
  messages: ChatMessage[];
}

const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`message ${
            message.role === 'user' ? 'message-user' : 'message-assistant'
          }`}
        >
          <div className="message-bubble">
            <p className="text-sm">{message.content}</p>
            <span className="text-xs opacity-50">
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MessageList;