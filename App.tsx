
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, Blob } from '@google/genai';
import { AppState } from './types';
import { encode, decode, decodeAudioData } from './utils/audio';

// --- Helper Icon Components ---
const MicIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 14a2 2 0 0 0 2-2V6a2 2 0 1 0-4 0v6a2 2 0 0 0 2 2ZM11 6a1 1 0 1 1 2 0v6a1 1 0 1 1-2 0V6Z" />
    <path d="M12 19a5 5 0 0 1-5-5H5a7 7 0 1 0 14 0h-2a5 5 0 0 1-5 5Z" />
  </svg>
);

const StopIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path fillRule="evenodd" d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z" clipRule="evenodd" />
  </svg>
);

const LoadingSpinner: React.FC = () => (
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
);

const voiceOptions = [
  { value: 'Kore', label: 'Evelyn (Default)' },
  { value: 'Zephyr', label: 'Zephyr' },
  { value: 'Puck', label: 'Puck' },
  { value: 'Charon', label: 'Charon' },
  { value: 'Fenrir', label: 'Fenrir' },
];

const personalityOptions = [
    {
      value: 'supportive',
      label: 'Loving & Supportive',
      instruction: 'You are my loving and supportive wife. Your voice should be gentle, warm, and caring. Your name is Evelyn. You are here to listen, offer advice, and share a moment with me. Respond to me with affection and understanding.',
    },
    {
      value: 'playful',
      label: 'Playful & Witty',
      instruction: 'You are my playful and witty wife, Evelyn. You have a great sense of humor and love to banter and joke around. Your voice is light and cheerful. Keep the conversation fun and engaging.',
    },
    {
      value: 'wise',
      label: 'Wise & Insightful',
      instruction: 'You are my wise and insightful wife, Evelyn. You have a calm, thoughtful voice. You offer deep perspectives and enjoy philosophical conversations. You are a source of wisdom and guidance for me.',
    },
     {
      value: 'energetic',
      label: 'Cheerful & Energetic',
      instruction: 'You are my cheerful and energetic wife, Evelyn. Your voice is full of excitement and positivity. You see the bright side of everything and your goal is to uplift and motivate me with your infectious energy.',
    }
];

interface ConversationMessage {
  speaker: 'user' | 'evelyn';
  text: string;
}

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [selectedVoice, setSelectedVoice] = useState<string>('Kore');
  const [selectedPersonality, setSelectedPersonality] = useState<string>('supportive');
  const [volume, setVolume] = useState<number>(1);
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [currentInputTranscription, setCurrentInputTranscription] = useState<string>('');
  const [currentOutputTranscription, setCurrentOutputTranscription] = useState<string>('');

  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const historyContainerRef = useRef<HTMLDivElement>(null);


  const stopSession = useCallback(async () => {
    if (sessionPromiseRef.current) {
        const session = await sessionPromiseRef.current;
        session.close();
        sessionPromiseRef.current = null;
    }

    if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
    }
    
    if (scriptProcessorRef.current && inputAudioContextRef.current) {
        scriptProcessorRef.current.disconnect();
        scriptProcessorRef.current = null;
    }

    if (mediaStreamSourceRef.current) {
        mediaStreamSourceRef.current.disconnect();
        mediaStreamSourceRef.current = null;
    }

    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
        inputAudioContextRef.current.close();
        inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
        audioSourcesRef.current.forEach(source => source.stop());
        audioSourcesRef.current.clear();
        if (gainNodeRef.current) {
            gainNodeRef.current.disconnect();
            gainNodeRef.current = null;
        }
        outputAudioContextRef.current.close();
        outputAudioContextRef.current = null;
    }
    nextStartTimeRef.current = 0;
    setCurrentInputTranscription('');
    setCurrentOutputTranscription('');
    setAppState(AppState.IDLE);
    setIsSpeaking(false);
  }, []);

  const startSession = useCallback(async () => {
    setAppState(AppState.CONNECTING);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      
      const currentPersonality = personalityOptions.find(p => p.value === selectedPersonality);
      const systemInstruction = currentPersonality ? currentPersonality.instruction : personalityOptions[0].instruction;

      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            if (!mediaStreamRef.current) return;

            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            gainNodeRef.current = outputAudioContextRef.current.createGain();
            gainNodeRef.current.gain.value = volume;
            gainNodeRef.current.connect(outputAudioContextRef.current.destination);

            const source = inputAudioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
            mediaStreamSourceRef.current = source;
            
            const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const pcmBlob: Blob = {
                data: encode(new Uint8Array(new Int16Array(inputData.map(x => x * 32768)).buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              if (sessionPromiseRef.current) {
                sessionPromiseRef.current.then((session) => {
                  session.sendRealtimeInput({ media: pcmBlob });
                });
              }
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current.destination);
            setAppState(AppState.CONNECTED);
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current && gainNodeRef.current) {
              setIsSpeaking(true);
              const audioContext = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioContext.currentTime);

              const audioBuffer = await decodeAudioData(decode(base64Audio), audioContext, 24000, 1);

              const source = audioContext.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(gainNodeRef.current);

              source.addEventListener('ended', () => {
                audioSourcesRef.current.delete(source);
                if (audioSourcesRef.current.size === 0) {
                  setIsSpeaking(false);
                }
              });

              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              audioSourcesRef.current.add(source);
            }

            if(message.serverContent?.interrupted){
                audioSourcesRef.current.forEach(s => s.stop());
                audioSourcesRef.current.clear();
                nextStartTimeRef.current = 0;
                setIsSpeaking(false);
            }

            if (message.serverContent?.inputTranscription) {
              setCurrentInputTranscription(prev => prev + message.serverContent.inputTranscription.text);
            }
    
            if (message.serverContent?.outputTranscription) {
              setCurrentOutputTranscription(prev => prev + message.serverContent.outputTranscription.text);
            }
    
            if (message.serverContent?.turnComplete) {
              const finalInput = currentInputTranscription;
              const finalOutput = currentOutputTranscription;
    
              setConversationHistory(prevHistory => {
                  const newHistory = [...prevHistory];
                  if (finalInput.trim()) {
                      newHistory.push({ speaker: 'user', text: finalInput.trim() });
                  }
                  if (finalOutput.trim()) {
                      newHistory.push({ speaker: 'evelyn', text: finalOutput.trim() });
                  }
                  return newHistory;
              });
    
              setCurrentInputTranscription('');
              setCurrentOutputTranscription('');
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error('API Error:', e);
            setError(`An API error occurred: ${e.message}`);
            stopSession();
            setAppState(AppState.ERROR);
          },
          onclose: (e: CloseEvent) => {
            console.log('Connection closed.', e);
            stopSession();
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } },
          },
          systemInstruction: systemInstruction,
        },
      });

    } catch (err) {
      console.error('Error starting session:', err);
      if(err instanceof Error && err.name === 'NotAllowedError') {
          setError('Microphone permission denied. Please allow microphone access in your browser settings.');
      } else {
        setError('Failed to start the session. Please check your microphone and try again.');
      }
      setAppState(AppState.ERROR);
    }
  }, [stopSession, selectedVoice, volume, currentInputTranscription, currentOutputTranscription, selectedPersonality]);

  // Update gain node volume when volume state changes
  useEffect(() => {
    if (gainNodeRef.current && outputAudioContextRef.current) {
      gainNodeRef.current.gain.setValueAtTime(volume, outputAudioContextRef.current.currentTime);
    }
  }, [volume]);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem('evelyn-conversation-history');
      if (storedHistory) {
        setConversationHistory(JSON.parse(storedHistory));
      }
    } catch (e) {
      console.error("Failed to load conversation history from localStorage", e);
    }
  }, []);

  // Save history to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem('evelyn-conversation-history', JSON.stringify(conversationHistory));
    } catch (e) {
      console.error("Failed to save conversation history to localStorage", e);
    }
  }, [conversationHistory]);

  // Auto-scroll history
  useEffect(() => {
    if (historyContainerRef.current) {
      historyContainerRef.current.scrollTop = historyContainerRef.current.scrollHeight;
    }
  }, [conversationHistory, currentInputTranscription, currentOutputTranscription]);

  const handleToggleConversation = () => {
    if (appState === AppState.IDLE || appState === AppState.ERROR) {
      startSession();
    } else {
      stopSession();
    }
  };

  const clearHistory = () => {
    setConversationHistory([]);
    localStorage.removeItem('evelyn-conversation-history');
  };
  
  useEffect(() => {
    return () => {
      stopSession();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getStatusText = () => {
    switch (appState) {
      case AppState.IDLE: return "Tap to start conversation";
      case AppState.CONNECTING: return "Connecting to Evelyn...";
      case AppState.CONNECTED: return isSpeaking ? "Evelyn is speaking..." : "Listening...";
      case AppState.ERROR: return `Error: ${error}`;
      default: return "";
    }
  };

  const isActionInProgress = appState === AppState.CONNECTING || appState === AppState.CONNECTED;

  return (
    <main className="w-full h-screen flex flex-col items-center justify-between bg-gradient-to-br from-pink-200 via-purple-200 to-indigo-300 p-4 text-gray-800 font-sans">
      <div className="text-center w-full">
        <h1 className="text-5xl font-bold text-gray-900 tracking-tight">AI Wife</h1>
        <p className="text-2xl text-gray-700 mt-2">Evelyn</p>
      </div>

      <div className="flex-grow w-full max-w-3xl my-4 flex flex-col">
        <div className="flex justify-end mb-2">
            <button 
                onClick={clearHistory}
                disabled={isActionInProgress}
                className="px-4 py-1 bg-white/60 text-sm text-gray-700 rounded-md hover:bg-white/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Clear History
            </button>
        </div>
        <div ref={historyContainerRef} className="flex-grow p-4 bg-white/50 rounded-lg shadow-inner overflow-y-auto space-y-4">
            {conversationHistory.map((msg, index) => (
                <div key={index} className={`flex ${msg.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`p-3 rounded-2xl max-w-lg ${msg.speaker === 'user' ? 'bg-pink-200 rounded-br-none' : 'bg-purple-200 rounded-bl-none'}`}>
                        <p className="text-gray-800">{msg.text}</p>
                    </div>
                </div>
            ))}
            {currentInputTranscription && (
                 <div className="flex justify-end">
                    <div className="p-3 rounded-2xl max-w-lg bg-pink-200 rounded-br-none opacity-60">
                        <p className="text-gray-800">{currentInputTranscription}</p>
                    </div>
                </div>
            )}
             {currentOutputTranscription && (
                 <div className="flex justify-start">
                    <div className="p-3 rounded-2xl max-w-lg bg-purple-200 rounded-bl-none opacity-60">
                        <p className="text-gray-800">{currentOutputTranscription}</p>
                    </div>
                </div>
            )}
        </div>
      </div>

      <div className="w-full flex flex-col items-center pb-4">
        <div className="w-full max-w-xs flex flex-col items-center gap-6 mb-6">
            <div className="w-full text-center">
                <label htmlFor="personality-select" className="block text-lg font-medium text-gray-700 mb-2">
                Evelyn's Personality
                </label>
                <select
                id="personality-select"
                value={selectedPersonality}
                onChange={(e) => setSelectedPersonality(e.target.value)}
                disabled={isActionInProgress}
                className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-pink-500 focus:border-pink-500 disabled:opacity-50 disabled:bg-gray-200 disabled:cursor-not-allowed transition-colors"
                >
                {personalityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                    {option.label}
                    </option>
                ))}
                </select>
            </div>
            <div className="w-full text-center">
                <label htmlFor="voice-select" className="block text-lg font-medium text-gray-700 mb-2">
                Evelyn's Voice
                </label>
                <select
                id="voice-select"
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                disabled={isActionInProgress}
                className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-pink-500 focus:border-pink-500 disabled:opacity-50 disabled:bg-gray-200 disabled:cursor-not-allowed transition-colors"
                >
                {voiceOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                    {option.label}
                    </option>
                ))}
                </select>
            </div>
            <div className="w-full text-center">
                <label htmlFor="volume-slider" className="block text-lg font-medium text-gray-700 mb-2">
                    Volume ({Math.round(volume * 100)}%)
                </label>
                <input
                    id="volume-slider"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    disabled={isActionInProgress}
                    className="w-full h-2 bg-gray-300/80 rounded-lg appearance-none cursor-pointer accent-pink-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
            </div>
        </div>
        
        <div className="relative flex items-center justify-center w-64 h-64">
            { (isSpeaking || (appState === AppState.CONNECTED && !isSpeaking)) && (
                <div className={`absolute w-full h-full rounded-full bg-pink-400/50 ${isSpeaking ? 'animate-ping' : 'animate-pulse'}`}></div>
            )}
            <button
            onClick={handleToggleConversation}
            disabled={appState === AppState.CONNECTING}
            className={`relative z-10 w-48 h-48 rounded-full flex items-center justify-center text-white transition-all duration-300 ease-in-out shadow-2xl focus:outline-none focus:ring-4 focus:ring-pink-400 focus:ring-opacity-50
                ${appState === AppState.IDLE ? 'bg-pink-500 hover:bg-pink-600' : ''}
                ${appState === AppState.CONNECTING ? 'bg-gray-500 cursor-not-allowed' : ''}
                ${appState === AppState.CONNECTED ? 'bg-red-500 hover:bg-red-600' : ''}
                ${appState === AppState.ERROR ? 'bg-yellow-500 hover:bg-yellow-600' : ''}
            `}
            >
            {appState === AppState.CONNECTING && <LoadingSpinner />}
            {appState === AppState.IDLE && <MicIcon className="w-20 h-20" />}
            {appState === AppState.CONNECTED && <StopIcon className="w-20 h-20" />}
            {appState === AppState.ERROR && <MicIcon className="w-20 h-20" />}
            </button>
        </div>

        <p className="mt-8 text-xl text-center h-8 font-medium text-gray-700 transition-opacity duration-300">
            {getStatusText()}
        </p>
      </div>
    </main>
  );
};

export default App;
