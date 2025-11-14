import React from 'react';
import { MicIcon, StopIcon, LoadingSpinner } from './Icons';
import { AppState } from '../types';

interface VoiceButtonProps {
  appState: AppState;
  isSpeaking: boolean;
  audioLevel: number;
  onToggle: () => void;
  statusText: string;
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({
  appState,
  isSpeaking,
  audioLevel,
  onToggle,
  statusText,
}) => {
  const isConnecting = appState === AppState.CONNECTING;
  const isConnected = appState === AppState.CONNECTED;

  return (
    <div className="w-full flex flex-col items-center">
      <div className="relative flex items-center justify-center w-64 h-64">
        {/* Speaking/Listening animation */}
        {(isSpeaking || (isConnected && !isSpeaking)) && (
          <div
            className={`absolute w-full h-full rounded-full bg-pink-400/50 ${
              isSpeaking ? 'animate-ping' : 'animate-pulse'
            }`}
          ></div>
        )}

        {/* Audio level indicator rings */}
        {isConnected && !isSpeaking && audioLevel > 5 && (
          <>
            <div
              className="absolute rounded-full bg-pink-300/40 transition-all duration-100"
              style={{
                width: `${Math.min(100, 50 + audioLevel * 2)}%`,
                height: `${Math.min(100, 50 + audioLevel * 2)}%`,
              }}
            ></div>
            {audioLevel > 20 && (
              <div
                className="absolute rounded-full bg-pink-400/30 transition-all duration-100"
                style={{
                  width: `${Math.min(100, 40 + audioLevel * 2.5)}%`,
                  height: `${Math.min(100, 40 + audioLevel * 2.5)}%`,
                }}
              ></div>
            )}
          </>
        )}

        <button
          onClick={onToggle}
          disabled={isConnecting}
          className={`relative z-10 w-48 h-48 rounded-full flex items-center justify-center text-white transition-all duration-300 ease-in-out shadow-2xl focus:outline-none focus:ring-4 focus:ring-pink-400 focus:ring-opacity-50
            ${appState === AppState.IDLE ? 'bg-pink-500 hover:bg-pink-600' : ''}
            ${isConnecting ? 'bg-gray-500 cursor-not-allowed' : ''}
            ${isConnected ? 'bg-red-500 hover:bg-red-600' : ''}
            ${appState === AppState.ERROR ? 'bg-yellow-500 hover:bg-yellow-600' : ''}
          `}
          aria-label={
            appState === AppState.IDLE
              ? 'Start conversation'
              : appState === AppState.CONNECTED
              ? 'Stop conversation'
              : 'Loading'
          }
          aria-pressed={isConnected}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onToggle();
            }
          }}
        >
          {isConnecting && <LoadingSpinner />}
          {appState === AppState.IDLE && <MicIcon className="w-20 h-20" />}
          {isConnected && <StopIcon className="w-20 h-20" />}
          {appState === AppState.ERROR && <MicIcon className="w-20 h-20" />}
        </button>

        {/* Audio level bar indicator */}
        {isConnected && audioLevel > 0 && (
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-20 w-48">
            <div className="bg-gray-300/50 rounded-full h-2 overflow-hidden">
              <div
                className="bg-pink-500 h-full transition-all duration-100 rounded-full"
                style={{ width: `${Math.min(100, audioLevel)}%` }}
                role="progressbar"
                aria-valuenow={Math.round(audioLevel)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Microphone input level"
              ></div>
            </div>
          </div>
        )}
      </div>

      <p
        className="mt-8 text-xl text-center h-8 font-medium text-gray-700 transition-opacity duration-300"
        role="status"
        aria-live="polite"
      >
        {statusText}
      </p>
    </div>
  );
};
