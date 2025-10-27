
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

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());


  const stopSession = useCallback(async () => {
    // Resolve session to close it
    if (sessionPromiseRef.current) {
        const session = await sessionPromiseRef.current;
        session.close();
        sessionPromiseRef.current = null;
    }

    // Stop microphone stream
    if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
    }
    
    // Disconnect audio processing
    if (scriptProcessorRef.current && inputAudioContextRef.current) {
        scriptProcessorRef.current.disconnect(inputAudioContextRef.current.destination);
        scriptProcessorRef.current = null;
    }

    if (mediaStreamSourceRef.current && scriptProcessorRef.current) {
        mediaStreamSourceRef.current.disconnect(scriptProcessorRef.current);
        mediaStreamSourceRef.current = null;
    }

    // Close audio contexts
    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
        inputAudioContextRef.current.close();
        inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
         // Stop any ongoing playback before closing
        audioSourcesRef.current.forEach(source => source.stop());
        audioSourcesRef.current.clear();
        outputAudioContextRef.current.close();
        outputAudioContextRef.current = null;
    }
    nextStartTimeRef.current = 0;
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
      
      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            if (!mediaStreamRef.current) return;

            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
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
            if (base64Audio && outputAudioContextRef.current) {
              setIsSpeaking(true);
              const audioContext = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioContext.currentTime);

              const audioBuffer = await decodeAudioData(decode(base64Audio), audioContext, 24000, 1);

              const source = audioContext.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(audioContext.destination);

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
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: 'You are my loving and supportive wife. Your voice should be gentle, warm, and caring. Your name is Evelyn. You are here to listen, offer advice, and share a moment with me. Respond to me with affection and understanding.',
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
  }, [stopSession]);

  const handleToggleConversation = () => {
    if (appState === AppState.IDLE || appState === AppState.ERROR) {
      startSession();
    } else {
      stopSession();
    }
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
    <main className="w-full h-screen flex flex-col items-center justify-center bg-gradient-to-br from-pink-200 via-purple-200 to-indigo-300 p-4 text-gray-800">
      <div className="text-center mb-8">
        <h1 className="text-5xl font-bold text-gray-900 tracking-tight">AI Wife</h1>
        <p className="text-2xl text-gray-700 mt-2">Evelyn</p>
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
    </main>
  );
};

export default App;
