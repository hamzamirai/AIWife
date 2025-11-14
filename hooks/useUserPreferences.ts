import { useState, useEffect } from 'react';
import { loadPreferences, savePreferences, UserPreferences } from '../utils/storage';

const DEFAULT_PREFERENCES: UserPreferences = {
  selectedVoice: 'Kore',
  selectedPersonality: 'supportive',
  volume: 1,
};

export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load preferences on mount
  useEffect(() => {
    const loaded = loadPreferences();
    if (loaded) {
      setPreferences(loaded);
    }
    setIsLoaded(true);
  }, []);

  // Save preferences when they change (with debouncing handled by storage util)
  useEffect(() => {
    if (isLoaded) {
      savePreferences(preferences);
    }
  }, [preferences, isLoaded]);

  const updatePreferences = (updates: Partial<UserPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...updates }));
  };

  return {
    preferences,
    updatePreferences,
    isLoaded,
  };
}
