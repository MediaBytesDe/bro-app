"use server";

import { OpenClawClient } from "@/lib/openclaw";
import { createClient } from "@/lib/supabase/server";

/**
 * Server Action: Ask OpenClaw Agent
 *
 * Alternative to the API route for server-side usage in server components and form handlers.
 *
 * SECURITY: Authentication required (admin/mitarbeiter/superadmin only)
 *
 * @param message - The message/question to send to the agent
 * @param agent - The agent to route to (main, einkauf, kundenservice)
 * @returns Object with success flag and response or error
 */
export async function askBro(
  message: string,
  agent: "main" | "einkauf" | "kundenservice" = "main"
): Promise<{ success: true; response: string } | { success: false; error: string }> {
  // Authentication check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  // Authorization check - verify user role
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("auth_id", user.id)
    .single();

  if (!profile || !["admin", "mitarbeiter", "superadmin"].includes(profile.role)) {
    return { success: false, error: "Forbidden - Staff access required" };
  }

  // Validation
  if (!message || typeof message !== "string" || message.trim() === "") {
    return { success: false, error: "Message is required and must be a non-empty string" };
  }

  // Create OpenClaw client and get response
  const client = new OpenClawClient();

  try {
    await client.connect();

    let response: string;

    // Route to appropriate agent
    switch (agent) {
      case "einkauf":
        response = await client.askEinkauf(message);
        break;
      case "kundenservice":
        response = await client.askKundenservice(message);
        break;
      case "main":
      default:
        response = await client.askMain(message);
        break;
    }

    return { success: true, response };
  } catch (error) {
    console.error("OpenClaw server action error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to communicate with OpenClaw",
    };
  } finally {
    // Always disconnect the client
    client.disconnect();
  }
}

/**
 * Server Action: Ask Main Agent
 * Convenience wrapper for the main agent
 */
export async function askMain(message: string) {
  return askBro(message, "main");
}

/**
 * Server Action: Ask Einkauf Agent
 * Convenience wrapper for the einkauf agent
 */
export async function askEinkauf(message: string) {
  return askBro(message, "einkauf");
}

/**
 * Server Action: Ask Kundenservice Agent
 * Convenience wrapper for the kundenservice agent
 */
export async function askKundenservice(message: string) {
  return askBro(message, "kundenservice");
}
