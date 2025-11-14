import React from 'react';

export interface VoiceOption {
  value: string;
  label: string;
}

export interface PersonalityOption {
  value: string;
  label: string;
  instruction: string;
}

interface ControlPanelProps {
  selectedVoice: string;
  selectedPersonality: string;
  volume: number;
  onVoiceChange: (voice: string) => void;
  onPersonalityChange: (personality: string) => void;
  onVolumeChange: (volume: number) => void;
  voiceOptions: VoiceOption[];
  personalityOptions: PersonalityOption[];
  disabled: boolean;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  selectedVoice,
  selectedPersonality,
  volume,
  onVoiceChange,
  onPersonalityChange,
  onVolumeChange,
  voiceOptions,
  personalityOptions,
  disabled,
}) => {
  return (
    <div className="w-full max-w-xs flex flex-col items-center gap-6 mb-6">
      <div className="w-full text-center">
        <label
          htmlFor="personality-select"
          className="block text-lg font-medium text-gray-700 mb-2"
        >
          Evelyn's Personality
        </label>
        <select
          id="personality-select"
          value={selectedPersonality}
          onChange={(e) => onPersonalityChange(e.target.value)}
          disabled={disabled}
          className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-pink-500 focus:border-pink-500 disabled:opacity-50 disabled:bg-gray-200 disabled:cursor-not-allowed transition-colors"
          aria-label="Select Evelyn's personality"
        >
          {personalityOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="w-full text-center">
        <label
          htmlFor="voice-select"
          className="block text-lg font-medium text-gray-700 mb-2"
        >
          Evelyn's Voice
        </label>
        <select
          id="voice-select"
          value={selectedVoice}
          onChange={(e) => onVoiceChange(e.target.value)}
          disabled={disabled}
          className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-pink-500 focus:border-pink-500 disabled:opacity-50 disabled:bg-gray-200 disabled:cursor-not-allowed transition-colors"
          aria-label="Select Evelyn's voice"
        >
          {voiceOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="w-full text-center">
        <label
          htmlFor="volume-slider"
          className="block text-lg font-medium text-gray-700 mb-2"
        >
          Volume ({Math.round(volume * 100)}%)
        </label>
        <input
          id="volume-slider"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          disabled={disabled}
          className="w-full h-2 bg-gray-300/80 rounded-lg appearance-none cursor-pointer accent-pink-500 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Adjust volume"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(volume * 100)}
        />
      </div>
    </div>
  );
};
