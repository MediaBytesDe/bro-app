"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Send,
  Paperclip,
  Image as ImageIcon,
  File,
  X,
  Check,
  CheckCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Mock data
const mockProject = {
  id: "1",
  name: "PV Müller (Esens)",
  customer_name: "Familie Müller",
};

const mockParticipants = [
  { id: "brojekt", name: "BROjekt GmbH", role: "coordinator", initials: "BR", color: "bg-[#fa432a]" },
  { id: "customer", name: "Familie Müller", role: "customer", initials: "FM", color: "bg-green-500" },
  { id: "partner1", name: "Elektro Meier", role: "partner", initials: "EM", color: "bg-orange-500" },
  { id: "partner2", name: "Dach & Solar GmbH", role: "partner", initials: "DS", color: "bg-purple-500" },
];

const mockMessages = [
  {
    id: "1",
    sender_id: "brojekt",
    sender_name: "André (BROjekt)",
    content: "Hallo zusammen! Das Projekt startet am 05.02. Familie Müller freut sich schon 😊",
    timestamp: "2026-02-03T09:15:00",
    read_by: ["brojekt", "customer", "partner1", "partner2"],
  },
  {
    id: "2",
    sender_id: "customer",
    sender_name: "Herr Müller",
    content: "Guten Tag! Ja, wir sind gespannt. Wo sollen die Monteure parken?",
    timestamp: "2026-02-03T09:22:00",
    read_by: ["brojekt", "customer", "partner1"],
  },
  {
    id: "3",
    sender_id: "partner1",
    sender_name: "Max (Elektro Meier)",
    content: "Wir bringen einen Transporter mit. Gibt es eine Einfahrt oder sollen wir auf der Straße parken?",
    timestamp: "2026-02-03T09:30:00",
    read_by: ["brojekt", "customer", "partner1"],
  },
  {
    id: "4",
    sender_id: "customer",
    sender_name: "Herr Müller",
    content: "Sie können in die Einfahrt fahren, da ist genug Platz. Ich mache das Tor auf.",
    timestamp: "2026-02-03T09:35:00",
    read_by: ["brojekt", "customer"],
  },
  {
    id: "5",
    sender_id: "partner2",
    sender_name: "Lisa (Dach & Solar)",
    content: "Perfekt! Wir kommen dann mit dem Gerüst gegen 7:30 Uhr. Bis dann! 👋",
    timestamp: "2026-02-03T10:00:00",
    read_by: ["partner2"],
  },
];

const currentUser = {
  id: "partner1",
  name: "Max (Elektro Meier)",
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(timestamp: string) {
  const date = new Date(timestamp);
  const today = new Date("2026-02-04"); // Mock today
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) {
    return "Heute";
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return "Gestern";
  }
  return date.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
  });
}

export default function ProjectChatPage() {
  const params = useParams();
  const [messages, setMessages] = useState(mockMessages);
  const [newMessage, setNewMessage] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  
  const handleSend = () => {
    if (!newMessage.trim() && attachments.length === 0) return;
    
    const message = {
      id: String(Date.now()),
      sender_id: currentUser.id,
      sender_name: currentUser.name,
      content: newMessage,
      timestamp: new Date().toISOString(),
      read_by: [currentUser.id],
    };
    
    setMessages([...messages, message]);
    setNewMessage("");
    setAttachments([]);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments([...attachments, ...files]);
  };
  
  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };
  
  // Group messages by date
  const messagesByDate = messages.reduce((acc, message) => {
    const date = formatDate(message.timestamp);
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(message);
    return acc;
  }, {} as Record<string, typeof messages>);
  
  const getParticipant = (senderId: string) => {
    return mockParticipants.find((p) => p.id === senderId);
  };
  
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center gap-4 pb-4 border-b border-neutral-800">
        <Link 
          href={`/partner/auftraege/${params.id}`}
          className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-neutral-400" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-white">{mockProject.name}</h1>
          <p className="text-sm text-neutral-500">
            {mockParticipants.length} Teilnehmer
          </p>
        </div>
        <div className="flex -space-x-2">
          {mockParticipants.slice(0, 4).map((participant) => (
            <div
              key={participant.id}
              className={cn(
                "w-8 h-8 rounded-full border-2 border-[#0a0a0a] flex items-center justify-center",
                participant.color
              )}
            >
              <span className="text-xs text-white font-medium">
                {participant.initials}
              </span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Participants bar */}
      <div className="flex gap-2 py-3 border-b border-neutral-800 overflow-x-auto scrollbar-hide">
        {mockParticipants.map((participant) => (
          <span
            key={participant.id}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a1a] rounded-full text-sm text-neutral-300 whitespace-nowrap"
          >
            <span
              className={cn(
                "w-2 h-2 rounded-full",
                participant.id === currentUser.id ? "bg-green-500" : "bg-neutral-500"
              )}
            />
            {participant.name}
            {participant.role === "coordinator" && (
              <span className="text-xs text-neutral-500">(Koordinator)</span>
            )}
            {participant.role === "customer" && (
              <span className="text-xs text-neutral-500">(Kunde)</span>
            )}
          </span>
        ))}
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-6">
        {Object.entries(messagesByDate).map(([date, dateMessages]) => (
          <div key={date}>
            {/* Date separator */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1 border-t border-neutral-800" />
              <span className="text-xs text-neutral-500">{date}</span>
              <div className="flex-1 border-t border-neutral-800" />
            </div>
            
            {/* Messages for this date */}
            <div className="space-y-4">
              {dateMessages.map((message) => {
                const isOwn = message.sender_id === currentUser.id;
                const participant = getParticipant(message.sender_id);
                const isReadByAll = message.read_by.length === mockParticipants.length;
                
                return (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3",
                      isOwn && "flex-row-reverse"
                    )}
                  >
                    {!isOwn && (
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                          participant?.color || "bg-neutral-600"
                        )}
                      >
                        <span className="text-xs text-white font-medium">
                          {participant?.initials || getInitials(message.sender_name)}
                        </span>
                      </div>
                    )}
                    
                    <div
                      className={cn(
                        "max-w-[70%] space-y-1",
                        isOwn && "items-end"
                      )}
                    >
                      {!isOwn && (
                        <p className="text-xs font-medium text-neutral-500">
                          {message.sender_name}
                        </p>
                      )}
                      <div
                        className={cn(
                          "rounded-2xl px-4 py-2",
                          isOwn
                            ? "bg-[#fa432a] text-white rounded-br-sm"
                            : "bg-[#1a1a1a] text-neutral-200 rounded-bl-sm"
                        )}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      </div>
                      <div
                        className={cn(
                          "flex items-center gap-1 text-xs text-neutral-500",
                          isOwn && "justify-end"
                        )}
                      >
                        <span>{formatTime(message.timestamp)}</span>
                        {isOwn && (
                          isReadByAll ? (
                            <CheckCheck className="h-3 w-3 text-[#fa432a]" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="flex gap-2 p-2 border-t border-neutral-800 overflow-x-auto">
          {attachments.map((file, index) => (
            <div
              key={index}
              className="relative flex items-center gap-2 bg-[#1a1a1a] rounded-lg px-3 py-2"
            >
              {file.type.startsWith("image/") ? (
                <ImageIcon className="h-4 w-4 text-neutral-400" />
              ) : (
                <File className="h-4 w-4 text-neutral-400" />
              )}
              <span className="text-sm text-neutral-300 truncate max-w-[100px]">{file.name}</span>
              <button
                onClick={() => removeAttachment(index)}
                className="text-neutral-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      
      {/* Input */}
      <div className="flex items-center gap-2 pt-4 border-t border-neutral-800">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          accept="image/*,.pdf,.doc,.docx"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors"
        >
          <Paperclip className="h-5 w-5 text-neutral-400" />
        </button>
        <input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nachricht schreiben..."
          className="flex-1 bg-[#111] border border-neutral-700 rounded-lg px-4 py-2 text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#fa432a]"
        />
        <button
          onClick={handleSend}
          disabled={!newMessage.trim() && attachments.length === 0}
          className="btn-primary p-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
