import React from 'react';
import { FiPhoneCall, FiPhoneOff } from 'react-icons/fi';
import { useChatContext } from '../contexts/ChatContext';

const VoiceChannel: React.FC = () => {
  const {
    startVoiceChannel,
    stopVoiceChannel,
    isVoiceChannelActive,
    voiceChannelStatus
  } = useChatContext();

  const handleToggleCall = async () => {
    if (isVoiceChannelActive) {
      await stopVoiceChannel();
    } else {
      await startVoiceChannel();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleToggleCall}
        className={`p-2 rounded-full transition-colors ${
          isVoiceChannelActive 
            ? 'bg-red-500 hover:bg-red-600 text-white' 
            : 'bg-green-500 hover:bg-green-600 text-white'
        }`}
        aria-label={isVoiceChannelActive ? 'End call' : 'Start call'}
      >
        {isVoiceChannelActive ? <FiPhoneOff /> : <FiPhoneCall />}
      </button>
      {isVoiceChannelActive && (
        <div className="flex items-center text-sm">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse mr-2" />
          <span className="text-gray-600">{voiceChannelStatus}</span>
        </div>
      )}
    </div>
  );
};

export default VoiceChannel;