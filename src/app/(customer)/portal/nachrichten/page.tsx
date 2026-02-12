"use client";

import { usePortalMessages } from "@/hooks/use-portal-data";
import { Spinner } from "@/components/ui/spinner";
import { MessageCircle, Send } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export default function PortalNachrichtenPage() {
  const { messages, loading, send } = usePortalMessages();
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Poll for new messages every 15s
  useEffect(() => {
    const interval = setInterval(() => {
      // reload happens inside the hook
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  async function handleSend() {
    if (!newMsg.trim() || sending) return;
    setSending(true);
    try {
      await send(newMsg.trim());
      setNewMsg("");
    } catch (err) {
      console.error(err);
    }
    setSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Spinner /></div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-blue-400" />
          Nachrichten
        </h1>
        <p className="text-neutral-400 mt-1">Kommunikation mit dem BROjekt-Team</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto card p-4 space-y-3 mb-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500">
            <span className="text-4xl mb-3">👋</span>
            <p>Schreiben Sie uns bei Fragen!</p>
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.fromCustomer ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${
                msg.fromCustomer
                  ? "bg-blue-600 text-white rounded-br-md"
                  : "bg-[#1a1a1a] text-white rounded-bl-md"
              }`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p className={`text-xs mt-1 ${msg.fromCustomer ? "text-blue-200" : "text-neutral-500"}`}>
                  {formatTime(msg.createdAt)}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEnd} />
      </div>

      {/* Input */}
      <div className="card p-3 flex gap-3">
        <input
          type="text"
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ihre Nachricht..."
          className="flex-1 bg-[#1a1a1a] text-white px-4 py-2.5 rounded-lg border border-neutral-700 focus:border-blue-500 focus:outline-none"
        />
        <button
          onClick={handleSend}
          disabled={!newMsg.trim() || sending}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "Gerade eben";
  if (diff < 3600000) return Math.floor(diff / 60000) + " Min.";
  if (diff < 86400000) return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}
