import { useState, useEffect, useCallback } from 'react';
import {
  loadConversationHistory,
  saveConversationHistory,
  clearConversationHistory as clearStoredHistory,
  exportConversationAsJSON,
  exportConversationAsText,
} from '../utils/storage';

export interface ConversationMessage {
  speaker: 'user' | 'evelyn';
  text: string;
  timestamp?: number;
}

export function useConversationHistory() {
  const [history, setHistory] = useState<ConversationMessage[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load history on mount
  useEffect(() => {
    const loaded = loadConversationHistory();
    setHistory(loaded);
    setIsLoaded(true);
  }, []);

  // Save history when it changes (with debouncing handled by storage util)
  useEffect(() => {
    if (isLoaded && history.length > 0) {
      saveConversationHistory(history);
    }
  }, [history, isLoaded]);

  const addMessage = useCallback((message: ConversationMessage) => {
    setHistory((prev) => [...prev, { ...message, timestamp: Date.now() }]);
  }, []);

  const addMessages = useCallback((messages: ConversationMessage[]) => {
    setHistory((prev) => [
      ...prev,
      ...messages.map((msg) => ({ ...msg, timestamp: Date.now() })),
    ]);
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    clearStoredHistory();
  }, []);

  const exportAsJSON = useCallback(() => {
    exportConversationAsJSON(history);
  }, [history]);

  const exportAsText = useCallback(() => {
    exportConversationAsText(history);
  }, [history]);

  return {
    history,
    addMessage,
    addMessages,
    clearHistory,
    exportAsJSON,
    exportAsText,
    isLoaded,
  };
}
