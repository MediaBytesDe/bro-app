"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/auth-context";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import {
  Send,
  Paperclip,
  Check,
  CheckCheck,
  Image as ImageIcon,
  File,
  X,
  MessageSquare,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  text: string;
  sender_type: "customer" | "brojekt" | "partner";
  sender_id: string | null;
  sender_name: string;
  created_at: string;
  read_by: Array<{
    type: string;
    id: string;
    at: string;
  }>;
  attachments: any[];
  is_internal: boolean;
  project?: {
    id: string;
    name: string;
  };
}

interface Project {
  id: string;
  name: string;
  customer_name: string;
  unread_count: number;
}

export default function AdminNachrichtenPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isInternal, setIsInternal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  useEffect(() => {
    loadProjects();
  }, [profile]);

  useEffect(() => {
    if (selectedProject) {
      loadMessages();

      // Setup realtime subscription
      const channel = supabase
        .channel(`messages:${selectedProject}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `project_id=eq.${selectedProject}`,
          },
          (payload) => {
            console.log("New message received:", payload);
            const newMessage = payload.new as Message;
            setMessages((prev) => [...prev, newMessage]);

            // Scroll to bottom
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 100);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter: `project_id=eq.${selectedProject}`,
          },
          (payload) => {
            console.log("Message updated:", payload);
            const updatedMessage = payload.new as Message;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === updatedMessage.id ? updatedMessage : msg
              )
            );
          }
        )
        .subscribe();

      // Cleanup subscription
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedProject]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadProjects() {
    if (!profile?.id) {
      setLoading(false);
      return;
    }

    try {
      // Admin hat Zugriff auf alle Projekte
      const { data: projectsData } = await supabase
        .from("projects")
        .select(`
          id,
          name,
          customer:customers(id, company_name, first_name, last_name)
        `)
        .order("updated_at", { ascending: false });

      if (projectsData && projectsData.length > 0) {
        // Format customer name und lade unread counts
        const projectsWithCounts = await Promise.all(
          projectsData.map(async (p: any) => {
            const customerName =
              p.customer?.company_name ||
              `${p.customer?.first_name || ""} ${p.customer?.last_name || ""}`.trim();

            // Lade Nachrichten für unread count
            const { data: messages } = await supabase
              .from("messages")
              .select("read_by")
              .eq("project_id", p.id)
              .neq("sender_type", "brojekt");

            const unreadCount =
              messages?.filter(
                (m: any) =>
                  !m.read_by.some(
                    (r: any) => r.type === "profile" && r.id === profile.id
                  )
              ).length || 0;

            return {
              id: p.id,
              name: p.name,
              customer_name: customerName,
              unread_count: unreadCount,
            };
          })
        );

        setProjects(projectsWithCounts);

        // Auto-select first project
        if (!selectedProject) {
          setSelectedProject(projectsWithCounts[0].id);
        }
      }
    } catch (err) {
      console.error("Error loading projects:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages() {
    if (!selectedProject || !profile?.id) return;

    const { data: messagesData } = await supabase
      .from("messages")
      .select(`
        id, text, sender_type, sender_id, sender_name, created_at, read_by, attachments, is_internal,
        project:projects(id, name)
      `)
      .eq("project_id", selectedProject)
      .order("created_at", { ascending: true });

    setMessages(messagesData || []);

    // Mark messages as read
    if (messagesData && profile.id) {
      const unreadMessages = messagesData.filter(
        (m) =>
          m.sender_type !== "brojekt" &&
          !m.read_by.some((r) => r.type === "profile" && r.id === profile.id)
      );

      if (unreadMessages.length > 0) {
        for (const msg of unreadMessages) {
          const updatedReadBy = [
            ...msg.read_by,
            {
              type: "profile",
              id: profile.id,
              at: new Date().toISOString(),
            },
          ];

          await supabase
            .from("messages")
            .update({ read_by: updatedReadBy })
            .eq("id", msg.id);
        }
      }
    }
  }

  async function sendMessage() {
    if (
      (!newMessage.trim() && attachments.length === 0) ||
      !selectedProject ||
      !profile?.id
    )
      return;

    setSending(true);

    // Upload attachments first
    const uploadedAttachments = [];
    for (const file of attachments) {
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `messages/${selectedProject}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file);

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from("documents")
          .getPublicUrl(filePath);

        uploadedAttachments.push({
          name: file.name,
          url: urlData.publicUrl,
          type: file.type,
          size: file.size,
        });
      }
    }

    const { error } = await supabase.from("messages").insert({
      project_id: selectedProject,
      sender_type: "brojekt",
      sender_id: profile.id,
      sender_name: profile.display_name || "BROjekt Team",
      text: newMessage.trim(),
      attachments: uploadedAttachments.length > 0 ? uploadedAttachments : [],
      visible_to_customer: !isInternal,
      visible_to_partners: !isInternal,
      is_internal: isInternal,
    });

    if (error) {
      console.error("Error sending message:", error);
      toast.error("Fehler beim Senden");
    } else {
      setNewMessage("");
      setAttachments([]);
      setIsInternal(false);
      // Removed loadMessages() - Realtime subscription will add the message automatically
    }

    setSending(false);
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments([...attachments, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  function formatTime(timestamp: string) {
    return new Date(timestamp).toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatDate(timestamp: string) {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Heute";
    if (date.toDateString() === yesterday.toDateString()) return "Gestern";
    return date.toLocaleDateString("de-DE", { day: "numeric", month: "long" });
  }

  // Group messages by date
  const messagesByDate = messages.reduce((acc, msg) => {
    const date = formatDate(msg.created_at);
    if (!acc[date]) acc[date] = [];
    acc[date].push(msg);
    return acc;
  }, {} as Record<string, Message[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Nachrichten</h1>
          <p className="text-neutral-400 mt-1">
            Projekt-Kommunikation mit Kunden und Partnern
          </p>
        </div>
        <div className="card p-12 text-center">
          <MessageSquare className="w-12 h-12 mx-auto text-neutral-600 mb-4" />
          <p className="text-neutral-400">Keine Projekte vorhanden</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Nachrichten</h1>
        <p className="text-neutral-400 mt-1">
          Projekt-Kommunikation mit Kunden und Partnern
        </p>
      </div>

      <div className="grid md:grid-cols-[280px_1fr] gap-6 h-[calc(100vh-16rem)]">
        {/* Project List */}
        <div className="card p-4 overflow-y-auto">
          <h2 className="font-semibold text-white mb-3 text-sm">Projekte</h2>
          <div className="space-y-1">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => setSelectedProject(project.id)}
                className={cn(
                  "w-full text-left px-3 py-3 rounded-lg transition-colors",
                  selectedProject === project.id
                    ? "bg-blue-600"
                    : "hover:bg-[#1a1a1a]"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div
                      className={cn(
                        "text-sm font-medium truncate",
                        selectedProject === project.id
                          ? "text-white"
                          : "text-neutral-300"
                      )}
                    >
                      {project.name}
                    </div>
                    <div
                      className={cn(
                        "text-xs truncate",
                        selectedProject === project.id
                          ? "text-blue-200"
                          : "text-neutral-500"
                      )}
                    >
                      {project.customer_name}
                    </div>
                  </div>
                  {project.unread_count > 0 && (
                    <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full shrink-0">
                      {project.unread_count}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="card flex flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {Object.entries(messagesByDate).map(([date, dateMessages]) => (
              <div key={date}>
                {/* Date separator */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex-1 border-t border-neutral-700" />
                  <span className="text-xs text-neutral-500">{date}</span>
                  <div className="flex-1 border-t border-neutral-700" />
                </div>

                {/* Messages */}
                <div className="space-y-3">
                  {dateMessages.map((msg) => {
                    const isOwn = msg.sender_type === "brojekt";

                    return (
                      <div
                        key={msg.id}
                        className={cn("flex gap-3", isOwn && "flex-row-reverse")}
                      >
                        <div
                          className={cn(
                            "max-w-[70%] space-y-1",
                            isOwn && "items-end"
                          )}
                        >
                          {!isOwn && (
                            <p className="text-xs font-medium text-neutral-500">
                              {msg.sender_name}
                              {msg.sender_type === "customer" && (
                                <span className="ml-1 text-blue-400">
                                  (Kunde)
                                </span>
                              )}
                              {msg.sender_type === "partner" && (
                                <span className="ml-1 text-green-400">
                                  (Partner)
                                </span>
                              )}
                            </p>
                          )}
                          <div
                            className={cn(
                              "rounded-2xl px-4 py-2 relative",
                              isOwn
                                ? msg.is_internal
                                  ? "bg-orange-600 text-white rounded-br-sm"
                                  : "bg-blue-600 text-white rounded-br-sm"
                                : "bg-[#1a1a1a] text-neutral-200 rounded-bl-sm"
                            )}
                          >
                            {msg.is_internal && (
                              <div className="flex items-center gap-1 text-xs text-orange-200 mb-1">
                                <Lock className="w-3 h-3" />
                                <span>Interne Notiz</span>
                              </div>
                            )}
                            <p className="text-sm whitespace-pre-wrap">
                              {msg.text}
                            </p>

                            {/* Attachments */}
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {msg.attachments.map((att: any, i: number) => (
                                  <a
                                    key={i}
                                    href={att.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={cn(
                                      "flex items-center gap-2 text-xs p-2 rounded",
                                      isOwn
                                        ? "bg-blue-700 hover:bg-blue-800"
                                        : "bg-[#111] hover:bg-[#222]"
                                    )}
                                  >
                                    {att.type?.startsWith("image/") ? (
                                      <ImageIcon className="w-4 h-4" />
                                    ) : (
                                      <File className="w-4 h-4" />
                                    )}
                                    <span className="truncate">{att.name}</span>
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                          <div
                            className={cn(
                              "flex items-center gap-1 text-xs text-neutral-500",
                              isOwn && "justify-end"
                            )}
                          >
                            <span>{formatTime(msg.created_at)}</span>
                            {isOwn &&
                              (msg.read_by.length > 0 ? (
                                <CheckCheck className="w-3 h-3 text-blue-400" />
                              ) : (
                                <Check className="w-3 h-3" />
                              ))}
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

          {/* Attachments Preview */}
          {attachments.length > 0 && (
            <div className="flex gap-2 px-4 py-2 border-t border-neutral-800 overflow-x-auto">
              {attachments.map((file, index) => (
                <div
                  key={index}
                  className="relative flex items-center gap-2 bg-[#1a1a1a] rounded-lg px-3 py-2"
                >
                  {file.type.startsWith("image/") ? (
                    <ImageIcon className="w-4 h-4 text-neutral-400" />
                  ) : (
                    <File className="w-4 h-4 text-neutral-400" />
                  )}
                  <span className="text-sm text-neutral-300 truncate max-w-[100px]">
                    {file.name}
                  </span>
                  <button
                    onClick={() => removeAttachment(index)}
                    className="text-neutral-500 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Internal Note Toggle */}
          <div className="px-4 py-2 border-t border-neutral-800">
            <label className="flex items-center gap-2 text-sm text-neutral-400 cursor-pointer">
              <input
                type="checkbox"
                checked={isInternal}
                onChange={(e) => setIsInternal(e.target.checked)}
                className="rounded border-neutral-600 bg-[#111] text-orange-600 focus:ring-orange-600"
              />
              <Lock className="w-4 h-4" />
              <span>Interne Notiz (nur für BROjekt sichtbar)</span>
            </label>
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 p-4 border-t border-neutral-800">
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
              <Paperclip className="w-5 h-5 text-neutral-400" />
            </button>
            <input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nachricht schreiben..."
              className="flex-1 bg-[#111] border border-neutral-700 rounded-lg px-4 py-2 text-white placeholder:text-neutral-500 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={sendMessage}
              disabled={
                sending || (!newMessage.trim() && attachments.length === 0)
              }
              className="btn-primary p-2"
            >
              {sending ? (
                <Spinner className="w-5 h-5" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
