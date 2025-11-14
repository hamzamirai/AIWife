// LocalStorage utilities with debouncing

export interface UserPreferences {
  selectedVoice: string;
  selectedPersonality: string;
  volume: number;
}

const PREFERENCES_KEY = 'evelyn-user-preferences';
const HISTORY_KEY = 'evelyn-conversation-history';
const MAX_HISTORY_ITEMS = 100; // Limit history to prevent performance issues

// Debounce helper
function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(later, wait);
  };
}

// Save preferences with debouncing (500ms)
export const savePreferences = debounce((preferences: UserPreferences) => {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.error('Failed to save preferences to localStorage:', error);
  }
}, 500);

// Load preferences
export function loadPreferences(): UserPreferences | null {
  try {
    const stored = localStorage.getItem(PREFERENCES_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Failed to load preferences from localStorage:', error);
    return null;
  }
}

// Save conversation history with debouncing (1000ms)
export const saveConversationHistory = debounce((history: any[]) => {
  try {
    // Limit history size
    const limitedHistory = history.slice(-MAX_HISTORY_ITEMS);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(limitedHistory));
  } catch (error) {
    console.error('Failed to save conversation history to localStorage:', error);
  }
}, 1000);

// Load conversation history
export function loadConversationHistory(): any[] {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load conversation history from localStorage:', error);
    return [];
  }
}

// Clear conversation history
export function clearConversationHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch (error) {
    console.error('Failed to clear conversation history from localStorage:', error);
  }
}

// Export conversation as JSON
export function exportConversationAsJSON(history: any[]): void {
  const dataStr = JSON.stringify(history, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `evelyn-conversation-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Export conversation as text
export function exportConversationAsText(history: any[]): void {
  const textContent = history
    .map((msg) => `${msg.speaker === 'user' ? 'You' : 'Evelyn'}: ${msg.text}`)
    .join('\n\n');

  const dataBlob = new Blob([textContent], { type: 'text/plain' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `evelyn-conversation-${new Date().toISOString().split('T')[0]}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
