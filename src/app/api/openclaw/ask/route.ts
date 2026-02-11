import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { OpenClawClient } from "@/lib/openclaw";

/**
 * POST /api/openclaw/ask
 * Send a message to an OpenClaw agent and get the response
 *
 * SECURITY: Authentication required (admin/mitarbeiter/superadmin only)
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Authentication check
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Authorization check - verify user role
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("auth_id", user.id)
    .single();

  if (!profile || !["admin", "mitarbeiter", "superadmin"].includes(profile.role)) {
    return NextResponse.json(
      { error: "Forbidden - Staff access required" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { message, agent = "main" } = body;

    // Validation
    if (!message || typeof message !== "string" || message.trim() === "") {
      return NextResponse.json(
        { error: "Message is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    // Validate agent parameter
    const validAgents = ["main", "einkauf", "kundenservice", "content:main"];
    if (!validAgents.includes(agent)) {
      return NextResponse.json(
        { error: `Invalid agent. Must be one of: ${validAgents.join(", ")}` },
        { status: 400 }
      );
    }

    // Create OpenClaw client and get response
    const client = new OpenClawClient();
    let response: string;

    try {
      await client.connect();

      // Route to appropriate agent
      switch (agent) {
        case "einkauf":
          response = await client.askEinkauf(message);
          break;
        case "kundenservice":
          response = await client.askKundenservice(message);
          break;
        case "content:main":
          response = await client.askContent(message);
          break;
        case "main":
        default:
          response = await client.askMain(message);
          break;
      }

      return NextResponse.json({
        success: true,
        response,
        agent,
        timestamp: new Date().toISOString(),
      });
    } finally {
      // Always disconnect the client
      client.disconnect();
    }
  } catch (error) {
    console.error("OpenClaw API error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to communicate with OpenClaw",
      },
      { status: 500 }
    );
  }
}
