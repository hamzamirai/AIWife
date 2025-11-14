// API utility functions

/**
 * Fetches the Gemini API key
 * If VITE_API_ENDPOINT is set, fetches from backend
 * Otherwise uses VITE_GEMINI_API_KEY directly (not recommended for production)
 */
export async function getGeminiApiKey(): Promise<string> {
  const apiEndpoint = import.meta.env.VITE_API_ENDPOINT;

  if (apiEndpoint) {
    try {
      const response = await fetch(`${apiEndpoint}/api/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'getApiKey' }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch API key from backend');
      }

      const data = await response.json();
      return data.apiKey;
    } catch (error) {
      console.error('Error fetching API key from backend:', error);
      throw error;
    }
  }

  // Fallback to direct API key (not secure for production)
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('Gemini API key not configured. Please set VITE_GEMINI_API_KEY or VITE_API_ENDPOINT in .env.local');
  }

  if (process.env.NODE_ENV === 'production') {
    console.warn('⚠️ WARNING: Using API key directly from client. This is not secure for production!');
  }

  return apiKey;
}
