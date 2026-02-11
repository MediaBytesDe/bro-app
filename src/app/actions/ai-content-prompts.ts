"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { unstable_noStore as noStore } from "next/cache";
import type { AIContentPrompt } from "@/types/ai-content";

/**
 * Load all active AI content prompts for a specific domain
 * @param domain - The domain to filter prompts by
 * @param _cacheBuster - Optional timestamp to prevent caching (not used in query, just for cache busting)
 */
export async function loadPromptsByDomain(domain: string, _cacheBuster?: number) {
  noStore(); // Disable caching to always get fresh prompts

  console.log(`[loadPromptsByDomain] Loading prompts for domain: ${domain} (cache buster: ${_cacheBuster})`);

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("ai_content_prompts")
      .select("*")
      .eq("domain", domain)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Error loading AI content prompts:", error);
      return { success: false, prompts: null, error: error.message };
    }

    console.log(`[loadPromptsByDomain] Found ${data?.length || 0} prompts:`, data?.map(p => p.name));

    return { success: true, prompts: data as AIContentPrompt[], error: null };
  } catch (err) {
    console.error("Unexpected error loading prompts:", err);
    return {
      success: false,
      prompts: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Load all AI content prompts (admin only)
 */
export async function loadAllPrompts() {
  try {
    const supabase = await createClient();

    // Check if user is admin
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, prompts: null, error: "Unauthorized" };
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("auth_id", user.id)
      .single();

    if (!profile || !["admin", "superadmin"].includes(profile.role)) {
      return { success: false, prompts: null, error: "Forbidden" };
    }

    const { data, error } = await supabase
      .from("ai_content_prompts")
      .select("*")
      .order("domain", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Error loading all AI content prompts:", error);
      return { success: false, prompts: null, error: error.message };
    }

    return { success: true, prompts: data as AIContentPrompt[], error: null };
  } catch (err) {
    console.error("Unexpected error loading all prompts:", err);
    return {
      success: false,
      prompts: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Get a single AI content prompt by ID
 */
export async function getPromptById(id: string) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("ai_content_prompts")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error loading AI content prompt:", error);
      return { success: false, prompt: null, error: error.message };
    }

    return { success: true, prompt: data as AIContentPrompt, error: null };
  } catch (err) {
    console.error("Unexpected error loading prompt:", err);
    return {
      success: false,
      prompt: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Create a new AI content prompt (admin only)
 */
export async function createPrompt(
  prompt: Omit<AIContentPrompt, "id" | "created_at" | "updated_at">
) {
  try {
    const supabase = await createClient();

    // Check if user is admin
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, prompt: null, error: "Unauthorized" };
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("auth_id", user.id)
      .single();

    if (!profile || !["admin", "superadmin"].includes(profile.role)) {
      return { success: false, prompt: null, error: "Forbidden" };
    }

    const { data, error } = await supabase
      .from("ai_content_prompts")
      .insert(prompt)
      .select()
      .single();

    if (error) {
      console.error("Error creating AI content prompt:", error);
      return { success: false, prompt: null, error: error.message };
    }

    // Invalidate cache so new prompt appears immediately
    revalidatePath("/ai-prompts");

    return { success: true, prompt: data as AIContentPrompt, error: null };
  } catch (err) {
    console.error("Unexpected error creating prompt:", err);
    return {
      success: false,
      prompt: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Update an existing AI content prompt (admin only)
 */
export async function updatePrompt(
  id: string,
  prompt: Partial<Omit<AIContentPrompt, "id" | "created_at" | "updated_at">>
) {
  try {
    const supabase = await createClient();

    // Check if user is admin
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, prompt: null, error: "Unauthorized" };
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("auth_id", user.id)
      .single();

    if (!profile || !["admin", "superadmin"].includes(profile.role)) {
      return { success: false, prompt: null, error: "Forbidden" };
    }

    const { data, error } = await supabase
      .from("ai_content_prompts")
      .update({ ...prompt, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating AI content prompt:", error);
      return { success: false, prompt: null, error: error.message };
    }

    // Invalidate cache so updated prompt appears immediately
    revalidatePath("/ai-prompts");

    return { success: true, prompt: data as AIContentPrompt, error: null };
  } catch (err) {
    console.error("Unexpected error updating prompt:", err);
    return {
      success: false,
      prompt: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Delete an AI content prompt (admin only)
 */
export async function deletePrompt(id: string) {
  try {
    const supabase = await createClient();

    // Check if user is admin
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("auth_id", user.id)
      .single();

    if (!profile || !["admin", "superadmin"].includes(profile.role)) {
      return { success: false, error: "Forbidden" };
    }

    const { error } = await supabase
      .from("ai_content_prompts")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting AI content prompt:", error);
      return { success: false, error: error.message };
    }

    // Invalidate cache so deleted prompt disappears immediately
    revalidatePath("/ai-prompts");

    return { success: true, error: null };
  } catch (err) {
    console.error("Unexpected error deleting prompt:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
