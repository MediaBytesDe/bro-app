'use client';

import { memo } from 'react';
import { MessageSquare } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  sender_type: string;
  sender_name: string;
  created_at: string;
}

interface MessagesSectionProps {
  messages: Message[];
  onSendMessage?: (text: string) => void;
  canSendMessage: boolean;
}

export const MessagesSection = memo(function MessagesSection({
  messages,
  onSendMessage,
  canSendMessage,
}: MessagesSectionProps) {
  return (
    <div className="bg-neutral-800 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="h-5 w-5 text-blue-400" />
        <h2 className="text-lg font-semibold">Nachrichten ({messages.length})</h2>
      </div>

      {messages.length > 0 ? (
        <div className="space-y-3">
          {messages.slice(-5).map((msg) => (
            <div
              key={msg.id}
              className={`p-3 rounded-lg ${
                msg.sender_type === 'customer'
                  ? 'bg-blue-900/20 border border-blue-800'
                  : 'bg-neutral-700/50'
              }`}
            >
              <div className="flex items-start justify-between mb-1">
                <p className="font-medium text-sm">{msg.sender_name}</p>
                <p className="text-xs text-neutral-400">
                  {new Date(msg.created_at).toLocaleString('de-DE')}
                </p>
              </div>
              <p className="text-neutral-200">{msg.text}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-neutral-500 text-center py-8">Keine Nachrichten</p>
      )}

      {canSendMessage && messages.length > 5 && (
        <button
          className="mt-4 w-full px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg transition text-sm"
        >
          Alle Nachrichten anzeigen ({messages.length})
        </button>
      )}
    </div>
  );
});
