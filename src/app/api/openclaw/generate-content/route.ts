import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOpenClawClient } from "@/lib/openclaw";
import type { GenerateContentRequest, GenerateContentResponse } from "@/types/ai-content";

/**
 * API route for generating content using OpenClaw content:main agent
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json<GenerateContentResponse>(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body: GenerateContentRequest = await request.json();
    const { promptId, variables } = body;

    if (!promptId) {
      return NextResponse.json<GenerateContentResponse>(
        { success: false, error: "Missing promptId" },
        { status: 400 }
      );
    }

    // Load the prompt from database
    const { data: prompt, error: promptError } = await supabase
      .from("ai_content_prompts")
      .select("*")
      .eq("id", promptId)
      .eq("is_active", true)
      .single();

    if (promptError || !prompt) {
      return NextResponse.json<GenerateContentResponse>(
        { success: false, error: "Prompt not found or inactive" },
        { status: 404 }
      );
    }

    // Render the user prompt template with Mustache-style variables
    const userPrompt = renderTemplate(prompt.user_prompt_template, variables);

    // Combine system prompt and user prompt into a single text block
    // OpenClaw works like a normal chat partner - everything must be in one message
    const combinedMessage = `${prompt.system_prompt}\n\n${userPrompt}`;

    // Call OpenClaw content:main agent
    const openClawClient = getOpenClawClient();

    try {
      const response = await openClawClient.askContent(combinedMessage);

      if (!response) {
        return NextResponse.json<GenerateContentResponse>(
          { success: false, error: "No response from AI agent" },
          { status: 500 }
        );
      }

      return NextResponse.json<GenerateContentResponse>({
        success: true,
        content: response,
      });
    } catch (aiError) {
      console.error("OpenClaw error:", aiError);
      return NextResponse.json<GenerateContentResponse>(
        {
          success: false,
          error:
            aiError instanceof Error
              ? aiError.message
              : "AI generation failed",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Content generation error:", error);
    return NextResponse.json<GenerateContentResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Simple Mustache-style template renderer
 * Supports: {{variable}} and {{#condition}}...{{/condition}}
 */
function renderTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;

  // Replace {{variable}} placeholders
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
    result = result.replace(regex, value);
  });

  // Handle conditional blocks {{#key}}...{{/key}}
  Object.entries(variables).forEach(([key, value]) => {
    const conditionalRegex = new RegExp(
      `\\{\\{#${key}\\}\\}([\\s\\S]*?)\\{\\{\\/${key}\\}\\}`,
      "g"
    );

    if (value && value.trim()) {
      // If value exists, keep the content inside the conditional
      result = result.replace(conditionalRegex, "$1");
    } else {
      // If value doesn't exist, remove the entire conditional block
      result = result.replace(conditionalRegex, "");
    }
  });

  return result;
}
