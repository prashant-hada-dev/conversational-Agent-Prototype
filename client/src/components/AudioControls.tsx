import React from 'react';
import { FiPlay, FiPause, FiVolume2, FiLoader } from 'react-icons/fi';
import { useChatContext } from '../contexts/ChatContext';

const AudioControls: React.FC = () => {
  const { audioState, playAudio, pauseAudio } = useChatContext();
  const { isPlaying, currentTime, duration, url, isStreaming, streamProgress, queueSize } = audioState;

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
          className={`audio-button ${isStreaming ? 'opacity-50' : ''}`}
          disabled={!url || isStreaming}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <FiPause /> : <FiPlay />}
        </button>
        
        <div className="flex items-center gap-2 flex-1">
          {isStreaming ? (
            <FiLoader className="animate-spin text-primary-500" />
          ) : (
            <FiVolume2 className="text-secondary-400" />
          )}
          
          <div className="audio-progress relative">
            <div
              className="audio-progress-bar"
              style={{ width: `${progress}%` }}
            />
            {isStreaming && (
              <div 
                className="absolute top-0 left-0 h-full bg-primary-200 opacity-30"
                style={{ width: `${(streamProgress ?? 0) * 10}%` }}
              />
            )}
          </div>

          <div className="flex flex-col items-end">
            <span className="text-xs text-secondary-500">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            {isStreaming && (queueSize ?? 0) > 0 && (
              <span className="text-xs text-primary-500">
                Streaming... ({queueSize ?? 0} chunks remaining)
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioControls;