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
      console.log('[AudioControls] Audio URL:', url);
      if (isPlaying) {
        console.log('[AudioControls] Pausing audio');
        pauseAudio();
      } else {
        console.log('[AudioControls] Playing audio');
        playAudio(url);
      }
    }
  };

  // Log when audio state changes
  React.useEffect(() => {
    console.log('[AudioControls] Audio state changed:', {
      isPlaying,
      currentTime,
      duration,
      url
    });
  }, [isPlaying, currentTime, duration, url]);

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

      {/* Manual audio element for testing */}
      {url && (
        <div className="mt-2 px-2">
          <p className="text-xs text-secondary-500 mb-1">Manual audio player for testing:</p>
          <audio
            src={url}
            controls
            className="w-full h-8"
            onPlay={() => console.log('[AudioControls] Manual audio play')}
            onPause={() => console.log('[AudioControls] Manual audio pause')}
            onError={(e) => console.error('[AudioControls] Manual audio error:', e)}
          />
        </div>
      )}
    </div>
  );
};

export default AudioControls;