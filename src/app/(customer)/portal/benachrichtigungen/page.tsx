"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import {
  Bell,
  Calendar,
  FileText,
  MessageSquare,
  CreditCard,
  CheckCircle,
  Clock,
  Trash2,
  CheckCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
  data: any;
}

const typeConfig: Record<string, { icon: any; color: string }> = {
  appointment: { icon: Calendar, color: "text-blue-400" },
  appointment_response: { icon: Calendar, color: "text-orange-400" },
  quote: { icon: FileText, color: "text-green-400" },
  message: { icon: MessageSquare, color: "text-purple-400" },
  payment: { icon: CreditCard, color: "text-yellow-400" },
  document: { icon: FileText, color: "text-cyan-400" },
  default: { icon: Bell, color: "text-neutral-400" },
};

export default function BenachrichtigungenPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const supabase = createClient();

  useEffect(() => {
    loadNotifications();
  }, [profile]);

  async function loadNotifications() {
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

      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("recipient_type", "customer")
        .eq("recipient_id", customer.id)
        .order("created_at", { ascending: false })
        .limit(100);

      setNotifications(data || []);
    } catch (err) {
      console.error("Error loading notifications:", err);
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(id: string) {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);

    setNotifications(notifications.map(n => 
      n.id === id ? { ...n, read_at: new Date().toISOString() } : n
    ));
  }

  async function markAllAsRead() {
    if (!customerId) return;

    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_type", "customer")
      .eq("recipient_id", customerId)
      .is("read_at", null);

    setNotifications(notifications.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
  }

  async function deleteNotification(id: string) {
    await supabase.from("notifications").delete().eq("id", id);
    setNotifications(notifications.filter(n => n.id !== id));
  }

  function formatTime(timestamp: string) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Gerade eben";
    if (diffMins < 60) return `vor ${diffMins} Min.`;
    if (diffHours < 24) return `vor ${diffHours} Std.`;
    if (diffDays < 7) return `vor ${diffDays} Tagen`;
    return date.toLocaleDateString("de-DE");
  }

  const filteredNotifications = filter === "unread" 
    ? notifications.filter(n => !n.read_at)
    : notifications;

  const unreadCount = notifications.filter(n => !n.read_at).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Benachrichtigungen</h1>
          <p className="text-neutral-400 mt-1">
            {unreadCount > 0 ? `${unreadCount} ungelesen` : "Keine neuen Benachrichtigungen"}
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="flex items-center gap-2 text-sm text-[#fa432a] hover:text-[#e03d26] transition-colors"
          >
            <CheckCheck className="w-4 h-4" />
            Alle als gelesen markieren
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter("all")}
          className={cn(
            "px-4 py-2 text-sm rounded-lg transition-colors",
            filter === "all"
              ? "bg-[#fa432a] text-white"
              : "bg-[#111] text-neutral-400 hover:text-white"
          )}
        >
          Alle ({notifications.length})
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={cn(
            "px-4 py-2 text-sm rounded-lg transition-colors",
            filter === "unread"
              ? "bg-[#fa432a] text-white"
              : "bg-[#111] text-neutral-400 hover:text-white"
          )}
        >
          Ungelesen ({unreadCount})
        </button>
      </div>

      {/* Notifications List */}
      {filteredNotifications.length === 0 ? (
        <div className="card p-12 text-center">
          <Bell className="w-12 h-12 mx-auto text-neutral-600 mb-4" />
          <p className="text-neutral-400">
            {filter === "unread" ? "Keine ungelesenen Benachrichtigungen" : "Keine Benachrichtigungen"}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden divide-y divide-neutral-800">
          {filteredNotifications.map((notification) => {
            const config = typeConfig[notification.type] || typeConfig.default;
            const Icon = config.icon;
            const isUnread = !notification.read_at;

            return (
              <div
                key={notification.id}
                className={cn(
                  "flex items-start gap-4 p-4 transition-colors",
                  isUnread ? "bg-[#111]" : "hover:bg-[#0d0d0d]"
                )}
              >
                <div className={cn("p-2 rounded-lg bg-[#1a1a1a]", config.color)}>
                  <Icon className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={cn("font-medium", isUnread ? "text-white" : "text-neutral-300")}>
                        {notification.title}
                      </p>
                      {notification.body && (
                        <p className="text-sm text-neutral-500 mt-0.5 line-clamp-2">
                          {notification.body}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-neutral-500 whitespace-nowrap">
                      {formatTime(notification.created_at)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mt-2">
                    {notification.action_url && (
                      <Link
                        href={notification.action_url}
                        onClick={() => !notification.read_at && markAsRead(notification.id)}
                        className="text-xs text-[#fa432a] hover:underline"
                      >
                        Anzeigen →
                      </Link>
                    )}
                    {isUnread && (
                      <button
                        onClick={() => markAsRead(notification.id)}
                        className="text-xs text-neutral-500 hover:text-white flex items-center gap-1"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Gelesen
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(notification.id)}
                      className="text-xs text-neutral-500 hover:text-red-400 flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Löschen
                    </button>
                  </div>
                </div>

                {isUnread && (
                  <span className="w-2 h-2 rounded-full bg-[#fa432a] mt-2 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
