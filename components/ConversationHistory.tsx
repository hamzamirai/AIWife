import React, { useRef, useEffect } from 'react';
import { DownloadIcon, TrashIcon } from './Icons';

interface ConversationMessage {
  speaker: 'user' | 'evelyn';
  text: string;
  timestamp?: number;
}

interface ConversationHistoryProps {
  history: ConversationMessage[];
  currentInputTranscription: string;
  currentOutputTranscription: string;
  onClearHistory: () => void;
  onExportJSON: () => void;
  onExportText: () => void;
  isActionInProgress: boolean;
}

export const ConversationHistory: React.FC<ConversationHistoryProps> = ({
  history,
  currentInputTranscription,
  currentOutputTranscription,
  onClearHistory,
  onExportJSON,
  onExportText,
  isActionInProgress,
}) => {
  const historyContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (historyContainerRef.current) {
      historyContainerRef.current.scrollTop = historyContainerRef.current.scrollHeight;
    }
  }, [history, currentInputTranscription, currentOutputTranscription]);

  return (
    <div className="flex-grow w-full max-w-3xl my-4 flex flex-col">
      <div className="flex justify-end mb-2 gap-2">
        <div className="relative group">
          <button
            onClick={onExportJSON}
            disabled={isActionInProgress || history.length === 0}
            className="px-4 py-1 bg-white/60 text-sm text-gray-700 rounded-md hover:bg-white/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            aria-label="Export conversation as JSON"
          >
            <DownloadIcon className="w-4 h-4" />
            Export JSON
          </button>
        </div>
        <button
          onClick={onExportText}
          disabled={isActionInProgress || history.length === 0}
          className="px-4 py-1 bg-white/60 text-sm text-gray-700 rounded-md hover:bg-white/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          aria-label="Export conversation as text"
        >
          <DownloadIcon className="w-4 h-4" />
          Export Text
        </button>
        <button
          onClick={onClearHistory}
          disabled={isActionInProgress || history.length === 0}
          className="px-4 py-1 bg-white/60 text-sm text-gray-700 rounded-md hover:bg-white/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          aria-label="Clear conversation history"
        >
          <TrashIcon className="w-4 h-4" />
          Clear
        </button>
      </div>
      <div
        ref={historyContainerRef}
        className="flex-grow p-4 bg-white/50 rounded-lg shadow-inner overflow-y-auto space-y-4"
        role="log"
        aria-live="polite"
        aria-label="Conversation history"
      >
        {history.length === 0 && !currentInputTranscription && !currentOutputTranscription && (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>Your conversation with Evelyn will appear here</p>
          </div>
        )}
        {history.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.speaker === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`p-3 rounded-2xl max-w-lg ${
                msg.speaker === 'user'
                  ? 'bg-pink-200 rounded-br-none'
                  : 'bg-purple-200 rounded-bl-none'
              }`}
              role="article"
              aria-label={`Message from ${msg.speaker === 'user' ? 'you' : 'Evelyn'}`}
            >
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
  );
};
