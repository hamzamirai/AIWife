# AI Wife - Evelyn 💝

A compassionate and loving AI companion that listens and talks to you in real-time. Experience warm, supportive conversations with Evelyn whenever you need someone to talk to.

![AI Wife Banner](https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6)

## Features ✨

### 🎙️ Real-time Voice Conversation
- Natural voice interaction using Google's Gemini 2.5 Flash with native audio
- Real-time transcription of both your input and Evelyn's responses
- Low-latency audio processing with AudioWorklet API

### 🎭 Multiple Personalities
Choose from four distinct personality modes:
- **Loving & Supportive** - Gentle, warm, and caring (default)
- **Playful & Witty** - Fun, engaging, and humorous
- **Wise & Insightful** - Thoughtful and philosophical
- **Cheerful & Energetic** - Uplifting and motivational

### 🗣️ Voice Selection
Pick from 5 different voice options:
- Evelyn (Kore) - Default
- Zephyr
- Puck
- Charon
- Fenrir

### 💾 Conversation Management
- Automatic conversation history with localStorage persistence
- Export conversations as JSON or plain text
- History limited to 100 messages for optimal performance
- Clear history when needed

### 🎚️ Audio Controls
- Volume control slider
- Visual microphone input level indicator
- Real-time audio level visualization

### ♿ Accessibility
- Full ARIA label support
- Keyboard navigation
- Screen reader friendly
- Semantic HTML structure

### 💾 User Preferences
- Persistent settings across sessions
- Debounced localStorage writes for performance
- Automatic preference restoration on app launch

## Tech Stack 🛠️

- **Frontend Framework**: React 19.2 with TypeScript
- **Build Tool**: Vite 6.2
- **AI Provider**: Google Gemini 2.5 Flash (Native Audio)
- **Audio Processing**: Web Audio API with AudioWorklet
- **Styling**: Tailwind CSS (via CDN)
- **State Management**: React Hooks with custom hooks

## Prerequisites 📋

- Node.js 18+
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
- Modern web browser with microphone access

## Installation 🚀

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd AIWife
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Copy the example environment file:
```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your Gemini API key:
```env
VITE_GEMINI_API_KEY=your_api_key_here
```

⚠️ **Security Warning**: For development only! In production, use the backend proxy (see Security section below).

### 4. Run the development server
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### 5. Build for production
```bash
npm run build
```

The built files will be in the `dist` folder.

## Security Considerations 🔒

### ⚠️ API Key Exposure

By default, the Gemini API key is loaded from environment variables and exposed to the client. **This is NOT secure for production use.**

### Recommended Production Setup

#### Option 1: Serverless Functions (Recommended)

Deploy the API proxy using Netlify Functions or Vercel Serverless:

1. Set `GEMINI_API_KEY` in your hosting platform's environment variables
2. Set `VITE_API_ENDPOINT` to your deployment URL
3. The `/api/session.ts` function will handle API key management securely

**For Netlify:**
```bash
netlify deploy
```

**For Vercel:**
```bash
vercel deploy
```

#### Option 2: Traditional Backend Server

Run the Express server for API proxying:

1. Install server dependencies:
```bash
cd server
npm install express cors dotenv
```

2. Create `.env` file in the server directory:
```env
GEMINI_API_KEY=your_api_key_here
PORT=3001
```

3. Run the server:
```bash
node server/index.js
```

4. Update `.env.local`:
```env
VITE_API_ENDPOINT=http://localhost:3001
```

**Note**: For true security with WebSocket connections, implement a WebSocket proxy that handles the entire Gemini session on the backend.

## Project Structure 📁

```
AIWife/
├── api/                      # Serverless functions
│   └── session.ts           # API key management endpoint
├── components/              # React components
│   ├── ConversationHistory.tsx
│   ├── ControlPanel.tsx
│   ├── Icons.tsx
│   └── VoiceButton.tsx
├── constants/              # Application constants
│   └── index.ts           # Voice and personality options
├── hooks/                 # Custom React hooks
│   ├── useAudioLevel.ts  # Microphone level detection
│   ├── useConversationHistory.ts
│   └── useUserPreferences.ts
├── public/               # Static assets
│   └── audio-processor.js # AudioWorklet processor
├── server/              # Express backend (optional)
│   └── index.js        # API proxy server
├── utils/              # Utility functions
│   ├── api.ts         # API key fetching
│   ├── audio.ts       # Audio encoding/decoding
│   └── storage.ts     # localStorage utilities
├── App.tsx            # Main application component
├── index.tsx          # React entry point
├── types.ts           # TypeScript type definitions
└── vite.config.ts     # Vite configuration
```

## Architecture Highlights 🏗️

### AudioWorklet Implementation
The app uses the modern AudioWorklet API for audio processing, with automatic fallback to ScriptProcessorNode for older browsers:

- **AudioWorklet** (`/public/audio-processor.js`): High-performance audio capture
- **Fallback**: Deprecated ScriptProcessorNode for compatibility
- **Real-time Processing**: 16kHz input sampling with PCM encoding

### Custom Hooks Pattern
Clean separation of concerns using custom hooks:

- `useUserPreferences`: Manages voice, personality, and volume settings
- `useConversationHistory`: Handles message history with export capabilities
- `useAudioLevel`: Real-time microphone level visualization

### Component Architecture
Modular, reusable components with full TypeScript support:

- **ConversationHistory**: Message display with export options
- **ControlPanel**: Settings management
- **VoiceButton**: Main interaction button with animations

## Browser Compatibility 🌐

- Chrome 89+
- Edge 89+
- Firefox 88+ (with AudioWorklet polyfill)
- Safari 14.1+

**Note**: Microphone permission is required for the app to function.

## Development 💻

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Adding New Features

#### Adding a New Voice
Edit `constants/index.ts`:
```typescript
export const voiceOptions: VoiceOption[] = [
  // ... existing voices
  { value: 'NewVoiceName', label: 'Display Name' },
];
```

#### Adding a New Personality
Edit `constants/index.ts`:
```typescript
export const personalityOptions: PersonalityOption[] = [
  // ... existing personalities
  {
    value: 'unique-id',
    label: 'Display Name',
    instruction: 'System instruction for the AI...',
  },
];
```

## Troubleshooting 🔧

### Microphone not working
- Ensure microphone permissions are granted in browser settings
- Check if another application is using the microphone
- Try a different browser

### API errors
- Verify your Gemini API key is correct
- Check your API quota at [Google AI Studio](https://aistudio.google.com/)
- Ensure your API key has access to the Gemini 2.5 Flash model

### Audio playback issues
- Check browser audio permissions
- Verify volume slider is not at 0%
- Try refreshing the page

### AudioWorklet errors
- Ensure `/audio-processor.js` is accessible
- Check browser console for detailed error messages
- The app will automatically fallback to ScriptProcessor

## Contributing 🤝

Contributions are welcome! Please feel free to submit issues or pull requests.

### Development Guidelines
- Use TypeScript for type safety
- Follow the existing component structure
- Add proper ARIA labels for accessibility
- Test on multiple browsers
- Update documentation for new features

## License 📄

This project is licensed under the MIT License.

## Acknowledgments 🙏

- Built with [Google Gemini](https://ai.google.dev/)
- Powered by [React](https://react.dev/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)

## Support 💬

If you encounter any issues or have questions:
1. Check the Troubleshooting section
2. Review [Google Gemini API documentation](https://ai.google.dev/gemini-api/docs)
3. Open an issue on GitHub

---

Made with ❤️ for meaningful conversations
