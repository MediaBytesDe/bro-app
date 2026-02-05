"use client";

import { useState } from "react";
import { useOpenClaw } from "@/hooks/useOpenClaw";
import type { OpenClawAgent } from "@/hooks/useOpenClaw";
import {
  Bot,
  Send,
  Loader2,
  AlertCircle,
  User,
} from "lucide-react";

const AGENTS = [
  { id: "main" as const, name: "Bro (Main)", color: "blue" },
  { id: "einkauf" as const, name: "Einkauf", color: "green" },
  { id: "kundenservice" as const, name: "Kundenservice", color: "purple" },
];

interface Message {
  role: "user" | "assistant";
  content: string;
  agent: OpenClawAgent;
  timestamp: string;
}

export default function OpenClawPage() {
  const [activeAgent, setActiveAgent] = useState<OpenClawAgent>("main");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);

  const { ask, loading, error } = useOpenClaw();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    const timestamp = new Date().toISOString();

    setInput("");

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: userMessage,
        agent: activeAgent,
        timestamp,
      },
    ]);

    const response = await ask(userMessage, activeAgent);

    if (response) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response,
          agent: activeAgent,
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  };

  const activeAgentInfo = AGENTS.find((a) => a.id === activeAgent);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="p-6 border-b border-[#1f1f1f]">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Bot className="w-6 h-6 text-orange-400" />
          OpenClaw AI Assistenten
        </h1>
        <p className="text-sm text-neutral-400 mt-1">
          Chatten Sie mit spezialisierten KI-Agenten
        </p>
      </div>

      {/* Agent Tabs */}
      <div className="flex border-b border-[#1f1f1f] bg-[#0d0d0d]">
        {AGENTS.map((agent) => (
          <button
            key={agent.id}
            onClick={() => setActiveAgent(agent.id)}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeAgent === agent.id
                ? agent.id === "main"
                  ? "bg-[#111] text-white border-b-2 border-blue-500"
                  : agent.id === "einkauf"
                  ? "bg-[#111] text-white border-b-2 border-green-500"
                  : "bg-[#111] text-white border-b-2 border-purple-500"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-[#111]/50"
            }`}
          >
            {agent.name}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-6 space-y-4 bg-[#0a0a0a]">
        {messages.length === 0 && (
          <div className="text-center text-neutral-500 mt-8">
            <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Keine Nachrichten. Stellen Sie eine Frage an {activeAgentInfo?.name}.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-white" />
              </div>
            )}

            <div
              className={`max-w-[80%] rounded-lg px-4 py-3 ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-[#111] text-neutral-100 border border-[#262626]"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              <p className="text-xs opacity-50 mt-1">
                {new Date(msg.timestamp).toLocaleTimeString("de-DE")}
              </p>
            </div>

            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-neutral-300" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="bg-[#111] text-neutral-100 rounded-lg px-4 py-3 border border-[#262626]">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="px-6 py-2">
          <div className="card bg-red-900/20 border border-red-900/50 p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-[#1f1f1f] p-4 bg-[#0d0d0d]">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={`Fragen Sie ${activeAgentInfo?.name}...`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="input flex-1"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="btn btn-primary"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                Senden
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
