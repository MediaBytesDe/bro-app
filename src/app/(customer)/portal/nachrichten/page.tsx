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
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  content: string;
  sender_type: "customer" | "brojekt" | "partner";
  sender_name: string;
  created_at: string;
  read_at: string | null;
  attachments: any[];
  project?: {
    id: string;
    name: string;
  };
}

interface Project {
  id: string;
  name: string;
  unread_count: number;
}

export default function NachrichtenPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  useEffect(() => {
    loadProjects();
  }, [profile]);

  useEffect(() => {
    if (selectedProject) {
      loadMessages();
    }
  }, [selectedProject]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadProjects() {
    if (!profile?.auth_id) { setLoading(false); return; }

    try {
      const { data: customer } = await supabase
        .from("customers")
        .select("id")
        .eq("auth_user_id", profile.auth_id)
        .single();

      if (!customer) {
        setLoading(false);
        return;
      }

      setCustomerId(customer.id);

      // Load projects with unread message counts
      const { data: projectsData } = await supabase
        .from("projects")
        .select("id, name")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false });

      if (projectsData && projectsData.length > 0) {
        // Get unread counts for each project
        const projectsWithCounts = await Promise.all(
          projectsData.map(async (p) => {
            const { count } = await supabase
              .from("messages")
              .select("*", { count: "exact", head: true })
              .eq("project_id", p.id)
              .neq("sender_type", "customer")
              .is("read_at", null);

            return { ...p, unread_count: count || 0 };
          })
        );

        setProjects(projectsWithCounts);

        // Auto-select first project
        if (!selectedProject) {
          setSelectedProject(projectsData[0].id);
        }
      }
    } catch (err) {
      console.error("Error loading projects:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages() {
    if (!selectedProject) return;

    const { data: messagesData } = await supabase
      .from("messages")
      .select(`
        id, content, sender_type, sender_name, created_at, read_at, attachments,
        project:projects(id, name)
      `)
      .eq("project_id", selectedProject)
      .order("created_at", { ascending: true });

    setMessages(messagesData || []);

    // Mark messages as read
    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("project_id", selectedProject)
      .neq("sender_type", "customer")
      .is("read_at", null);
  }

  async function sendMessage() {
    if ((!newMessage.trim() && attachments.length === 0) || !selectedProject || !customerId) return;

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
      customer_id: customerId,
      sender_type: "customer",
      sender_name: profile?.display_name || "Kunde",
      content: newMessage.trim(),
      attachments: uploadedAttachments.length > 0 ? uploadedAttachments : null,
    });

    if (error) {
      toast.error("Fehler beim Senden");
    } else {
      setNewMessage("");
      setAttachments([]);
      loadMessages();
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
            Kommunizieren Sie direkt mit BROjekt
          </p>
        </div>
        <div className="card p-12 text-center">
          <MessageSquare className="w-12 h-12 mx-auto text-neutral-600 mb-4" />
          <p className="text-neutral-400">
            Sie haben noch keine aktiven Projekte
          </p>
          <p className="text-sm text-neutral-500 mt-2">
            Sobald Sie ein Projekt haben, können Sie hier mit uns kommunizieren
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Nachrichten</h1>
        <p className="text-neutral-400 mt-1">
          Kommunizieren Sie direkt mit BROjekt
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
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "text-sm truncate",
                      selectedProject === project.id
                        ? "text-white"
                        : "text-neutral-300"
                    )}
                  >
                    {project.name}
                  </span>
                  {project.unread_count > 0 && (
                    <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
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
                    const isOwn = msg.sender_type === "customer";

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
                              {msg.sender_type === "brojekt" && (
                                <span className="ml-1 text-blue-400">
                                  (BROjekt)
                                </span>
                              )}
                            </p>
                          )}
                          <div
                            className={cn(
                              "rounded-2xl px-4 py-2",
                              isOwn
                                ? "bg-blue-600 text-white rounded-br-sm"
                                : "bg-[#1a1a1a] text-neutral-200 rounded-bl-sm"
                            )}
                          >
                            <p className="text-sm whitespace-pre-wrap">
                              {msg.content}
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
                              (msg.read_at ? (
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
              disabled={sending || (!newMessage.trim() && attachments.length === 0)}
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
