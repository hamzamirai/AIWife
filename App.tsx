import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, Blob } from '@google/genai';
import { AppState } from './types';
import { encode, decode, decodeAudioData } from './utils/audio';
import { getGeminiApiKey } from './utils/api';
import { ConversationHistory } from './components/ConversationHistory';
import { ControlPanel } from './components/ControlPanel';
import { VoiceButton } from './components/VoiceButton';
import { useUserPreferences } from './hooks/useUserPreferences';
import { useConversationHistory } from './hooks/useConversationHistory';
import { useAudioLevel } from './hooks/useAudioLevel';
import { voiceOptions, personalityOptions } from './constants';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [currentInputTranscription, setCurrentInputTranscription] = useState<string>('');
  const [currentOutputTranscription, setCurrentOutputTranscription] = useState<string>('');

  // Use custom hooks
  const { preferences, updatePreferences } = useUserPreferences();
  const {
    history,
    addMessages,
    clearHistory,
    exportAsJSON,
    exportAsText,
  } = useConversationHistory();

  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Audio level visualization
  const audioLevel = useAudioLevel(mediaStreamRef.current);

  const stopSession = useCallback(async () => {
    if (sessionPromiseRef.current) {
      const session = await sessionPromiseRef.current;
      session.close();
      sessionPromiseRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioWorkletNodeRef.current) {
      audioWorkletNodeRef.current.disconnect();
      audioWorkletNodeRef.current = null;
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
      audioSourcesRef.current.forEach((source) => source.stop());
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

      // Get API key securely
      const apiKey = await getGeminiApiKey();
      const ai = new GoogleGenAI({ apiKey });

      const currentPersonality = personalityOptions.find(
        (p) => p.value === preferences.selectedPersonality
      );
      const systemInstruction = currentPersonality
        ? currentPersonality.instruction
        : personalityOptions[0].instruction;

      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: async () => {
            if (!mediaStreamRef.current) return;

            // Set up input audio context with AudioWorklet
            inputAudioContextRef.current = new (
              window.AudioContext || (window as any).webkitAudioContext
            )({ sampleRate: 16000 });

            // Set up output audio context
            outputAudioContextRef.current = new (
              window.AudioContext || (window as any).webkitAudioContext
            )({ sampleRate: 24000 });

            gainNodeRef.current = outputAudioContextRef.current.createGain();
            gainNodeRef.current.gain.value = preferences.volume;
            gainNodeRef.current.connect(outputAudioContextRef.current.destination);

            // Load AudioWorklet processor
            try {
              await inputAudioContextRef.current.audioWorklet.addModule(
                '/audio-processor.js'
              );

              const source = inputAudioContextRef.current.createMediaStreamSource(
                mediaStreamRef.current
              );
              mediaStreamSourceRef.current = source;

              const workletNode = new AudioWorkletNode(
                inputAudioContextRef.current,
                'audio-capture-processor'
              );
              audioWorkletNodeRef.current = workletNode;

              // Handle audio data from worklet
              workletNode.port.onmessage = (event) => {
                if (event.data.type === 'audioData') {
                  const int16Array = new Int16Array(event.data.data);
                  const pcmBlob: Blob = {
                    data: encode(new Uint8Array(int16Array.buffer)),
                    mimeType: 'audio/pcm;rate=16000',
                  };

                  if (sessionPromiseRef.current) {
                    sessionPromiseRef.current.then((session) => {
                      session.sendRealtimeInput({ media: pcmBlob });
                    });
                  }
                }
              };

              source.connect(workletNode);
              workletNode.connect(inputAudioContextRef.current.destination);

              setAppState(AppState.CONNECTED);
            } catch (workletError) {
              console.error('AudioWorklet error, falling back to ScriptProcessor:', workletError);
              // Fallback to ScriptProcessor if AudioWorklet fails
              const source = inputAudioContextRef.current.createMediaStreamSource(
                mediaStreamRef.current
              );
              mediaStreamSourceRef.current = source;

              const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(
                4096,
                1,
                1
              );

              scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                const pcmBlob: Blob = {
                  data: encode(new Uint8Array(new Int16Array(inputData.map((x) => x * 32768)).buffer)),
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
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current && gainNodeRef.current) {
              setIsSpeaking(true);
              const audioContext = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(
                nextStartTimeRef.current,
                audioContext.currentTime
              );

              const audioBuffer = await decodeAudioData(
                decode(base64Audio),
                audioContext,
                24000,
                1
              );

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

            if (message.serverContent?.interrupted) {
              audioSourcesRef.current.forEach((s) => s.stop());
              audioSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsSpeaking(false);
            }

            if (message.serverContent?.inputTranscription) {
              setCurrentInputTranscription(
                (prev) => prev + message.serverContent.inputTranscription.text
              );
            }

            if (message.serverContent?.outputTranscription) {
              setCurrentOutputTranscription(
                (prev) => prev + message.serverContent.outputTranscription.text
              );
            }

            if (message.serverContent?.turnComplete) {
              const finalInput = currentInputTranscription;
              const finalOutput = currentOutputTranscription;

              const newMessages = [];
              if (finalInput.trim()) {
                newMessages.push({ speaker: 'user' as const, text: finalInput.trim() });
              }
              if (finalOutput.trim()) {
                newMessages.push({ speaker: 'evelyn' as const, text: finalOutput.trim() });
              }

              if (newMessages.length > 0) {
                addMessages(newMessages);
              }

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
            voiceConfig: { prebuiltVoiceConfig: { voiceName: preferences.selectedVoice } },
          },
          systemInstruction: systemInstruction,
        },
      });
    } catch (err) {
      console.error('Error starting session:', err);
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError(
          'Microphone permission denied. Please allow microphone access in your browser settings.'
        );
      } else if (err instanceof Error) {
        setError(`Failed to start the session: ${err.message}`);
      } else {
        setError('Failed to start the session. Please check your microphone and try again.');
      }
      setAppState(AppState.ERROR);
      await stopSession();
    }
  }, [
    stopSession,
    preferences.selectedVoice,
    preferences.selectedPersonality,
    preferences.volume,
    currentInputTranscription,
    currentOutputTranscription,
    addMessages,
  ]);

  // Update gain node volume when volume preference changes
  useEffect(() => {
    if (gainNodeRef.current && outputAudioContextRef.current) {
      gainNodeRef.current.gain.setValueAtTime(
        preferences.volume,
        outputAudioContextRef.current.currentTime
      );
    }
  }, [preferences.volume]);

  const handleToggleConversation = () => {
    if (appState === AppState.IDLE || appState === AppState.ERROR) {
      startSession();
    } else {
      stopSession();
    }
  };

  const getStatusText = () => {
    switch (appState) {
      case AppState.IDLE:
        return 'Tap to start conversation';
      case AppState.CONNECTING:
        return 'Connecting to Evelyn...';
      case AppState.CONNECTED:
        return isSpeaking ? 'Evelyn is speaking...' : 'Listening...';
      case AppState.ERROR:
        return `Error: ${error}`;
      default:
        return '';
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isActionInProgress = appState === AppState.CONNECTING || appState === AppState.CONNECTED;

  return (
    <main className="w-full h-screen flex flex-col items-center justify-between bg-gradient-to-br from-pink-200 via-purple-200 to-indigo-300 p-4 text-gray-800 font-sans">
      <div className="text-center w-full">
        <h1 className="text-5xl font-bold text-gray-900 tracking-tight">AI Wife</h1>
        <p className="text-2xl text-gray-700 mt-2">Evelyn</p>
      </div>

      <ConversationHistory
        history={history}
        currentInputTranscription={currentInputTranscription}
        currentOutputTranscription={currentOutputTranscription}
        onClearHistory={clearHistory}
        onExportJSON={exportAsJSON}
        onExportText={exportAsText}
        isActionInProgress={isActionInProgress}
      />

      <div className="w-full flex flex-col items-center pb-4">
        <ControlPanel
          selectedVoice={preferences.selectedVoice}
          selectedPersonality={preferences.selectedPersonality}
          volume={preferences.volume}
          onVoiceChange={(voice) => updatePreferences({ selectedVoice: voice })}
          onPersonalityChange={(personality) =>
            updatePreferences({ selectedPersonality: personality })
          }
          onVolumeChange={(volume) => updatePreferences({ volume })}
          voiceOptions={voiceOptions}
          personalityOptions={personalityOptions}
          disabled={isActionInProgress}
        />

        <VoiceButton
          appState={appState}
          isSpeaking={isSpeaking}
          audioLevel={audioLevel}
          onToggle={handleToggleConversation}
          statusText={getStatusText()}
        />
      </div>
    </main>
  );
};

export default App;
