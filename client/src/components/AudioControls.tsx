import React from 'react';
import { FiPlay, FiPause, FiVolume2 } from 'react-icons/fi';
import { useChatContext } from '../contexts/ChatContext';

const AudioControls: React.FC = () => {
  const { audioState, playAudio, pauseAudio } = useChatContext();
  const { isPlaying, currentTime, duration, url } = audioState;

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    if (url) {
      if (isPlaying) {
        pauseAudio();
      } else {
        playAudio(url);
      }
    }
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="px-4 py-2 bg-secondary-50 border-t border-secondary-100">
      <div className="flex items-center gap-2">
        <button
          onClick={handlePlayPause}
          className="audio-button"
          disabled={!url}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <FiPause /> : <FiPlay />}
        </button>
        
        <div className="flex items-center gap-2 flex-1">
          <FiVolume2 className="text-secondary-400" />
          <div className="audio-progress">
            <div
              className="audio-progress-bar"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-secondary-500">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default AudioControls;