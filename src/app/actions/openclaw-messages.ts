"use server";

import { createClient } from "@/lib/supabase/server";
import type { OpenClawAgent } from "@/hooks/useOpenClaw";

export interface OpenClawMessage {
  id: string;
  agent: OpenClawAgent;
  role: "user" | "assistant";
  content: string;
  user_id: string;
  created_at: string;
}

/**
 * Save a new message to the database
 */
export async function saveMessage(
  agent: OpenClawAgent,
  role: "user" | "assistant",
  content: string
): Promise<{ success: boolean; message?: OpenClawMessage; error?: string }> {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Insert message
    const { data, error } = await supabase
      .from("openclaw_messages")
      .insert({
        agent,
        role,
        content,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error saving message:", error);
      return { success: false, error: error.message };
    }

    return { success: true, message: data as OpenClawMessage };
  } catch (error) {
    console.error("Error in saveMessage:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Load messages for a specific agent
 */
export async function loadMessages(
  agent: OpenClawAgent,
  limit: number = 50,
  offset: number = 0
): Promise<{ success: boolean; messages?: OpenClawMessage[]; error?: string }> {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Load messages for this agent and user
    const { data, error } = await supabase
      .from("openclaw_messages")
      .select("*")
      .eq("agent", agent)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error loading messages:", error);
      return { success: false, error: error.message };
    }

    // Reverse to get chronological order (oldest first)
    const messages = (data as OpenClawMessage[]).reverse();

    return { success: true, messages };
  } catch (error) {
    console.error("Error in loadMessages:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Delete all messages for a specific agent (optional cleanup function)
 */
export async function clearMessages(
  agent: OpenClawAgent
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Delete messages
    const { error } = await supabase
      .from("openclaw_messages")
      .delete()
      .eq("agent", agent)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error clearing messages:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Error in clearMessages:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
