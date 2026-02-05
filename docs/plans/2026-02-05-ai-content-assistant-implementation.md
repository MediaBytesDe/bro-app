# AI Content Assistant - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wiederverwendbare AI-Assistent-Komponente für Content-Generierung an beliebigen Stellen in der App

**Architecture:** Button-Komponente + zentrales Modal + Custom Hook + Admin-Verwaltung. Nutzt neuen `content:main` OpenClaw-Agent mit konfigurierbaren Prompt-Templates aus Datenbank.

**Tech Stack:** Next.js 14, React, TypeScript, Supabase, OpenClaw, Tailwind CSS

**Design Doc:** [docs/plans/2026-02-05-ai-content-assistant-design.md](./2026-02-05-ai-content-assistant-design.md)

---

## Task 1: Database Migration - AI Content Prompts Table

**Files:**
- Create: `supabase/migrations/20260205230000_ai_content_prompts.sql`

**Step 1: Create migration file**

```sql
-- AI Content Prompts Table
CREATE TABLE IF NOT EXISTS ai_content_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain VARCHAR(100) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL,
  placeholder_fields JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for domain lookups
CREATE INDEX idx_ai_prompts_domain ON ai_content_prompts(domain, is_active);

-- RLS Policies
ALTER TABLE ai_content_prompts ENABLE ROW LEVEL SECURITY;

-- Everyone can view active prompts
CREATE POLICY "Users can view active prompts"
  ON ai_content_prompts
  FOR SELECT
  USING (
    is_active = true
    OR
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Only admins can insert
CREATE POLICY "Admins can insert prompts"
  ON ai_content_prompts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Only admins can update
CREATE POLICY "Admins can update prompts"
  ON ai_content_prompts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Only admins can delete
CREATE POLICY "Admins can delete prompts"
  ON ai_content_prompts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Grant permissions
GRANT ALL ON ai_content_prompts TO authenticated;

-- Add comments
COMMENT ON TABLE ai_content_prompts IS 'AI content generation prompt templates for different domains';
COMMENT ON COLUMN ai_content_prompts.domain IS 'Domain identifier (e.g., product_description, email_customer)';
COMMENT ON COLUMN ai_content_prompts.system_prompt IS 'System prompt for AI agent role';
COMMENT ON COLUMN ai_content_prompts.user_prompt_template IS 'User prompt template with {{placeholder}} variables';
COMMENT ON COLUMN ai_content_prompts.placeholder_fields IS 'Array of placeholder field names expected in context';

-- Insert default prompts
INSERT INTO ai_content_prompts (domain, name, description, system_prompt, user_prompt_template, placeholder_fields, sort_order) VALUES
(
  'product_description',
  'Produktbeschreibung (Marketing)',
  'Verkaufsfördernde Produktbeschreibung für Marketing-Zwecke',
  'Du bist ein Marketing-Experte für Solar-Produkte. Schreibe verkaufsfördernde, präzise Produktbeschreibungen. Halte dich an diese Regeln:
- Maximal 200 Wörter
- Fokus auf Nutzen, nicht nur Features
- Technische Daten einbeziehen wenn vorhanden
- Verkaufsfördernde aber ehrliche Sprache
- Deutsche Sprache',
  'Erstelle eine Produktbeschreibung für:

Name: {{productName}}
Kategorie: {{category}}
{{#manufacturer}}Hersteller: {{manufacturer}}{{/manufacturer}}

{{#currentValue}}Aktueller Text: {{currentValue}}{{/currentValue}}

{{#userInstructions}}Zusätzliche Anweisungen: {{userInstructions}}{{/userInstructions}}',
  '["productName", "category", "manufacturer", "currentValue", "userInstructions"]'::jsonb,
  0
),
(
  'product_description',
  'Produktbeschreibung (Technisch)',
  'Technische Produktbeschreibung mit Details',
  'Du bist ein technischer Redakteur für Solar-Produkte. Schreibe präzise technische Beschreibungen. Halte dich an diese Regeln:
- Maximal 300 Wörter
- Fokus auf technische Spezifikationen
- Objektive, sachliche Sprache
- Keine Marketing-Floskeln
- Deutsche Sprache',
  'Erstelle eine technische Produktbeschreibung für:

Name: {{productName}}
Kategorie: {{category}}
{{#manufacturer}}Hersteller: {{manufacturer}}{{/manufacturer}}

{{#currentValue}}Aktueller Text: {{currentValue}}{{/currentValue}}

{{#userInstructions}}Zusätzliche Anweisungen: {{userInstructions}}{{/userInstructions}}',
  '["productName", "category", "manufacturer", "currentValue", "userInstructions"]'::jsonb,
  1
);
```

**Step 2: Apply migration**

Run: `npx supabase db push`
Expected: Migration applied successfully

**Step 3: Verify table**

Run: `npx supabase db diff`
Expected: No diff (all changes applied)

**Step 4: Commit**

```bash
git add supabase/migrations/20260205230000_ai_content_prompts.sql
git commit -m "feat(db): add ai_content_prompts table with RLS policies

- Add table for AI content generation prompts
- Domain-based organization
- Admin-only write access
- Include 2 default product description prompts

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Update OpenClaw Types - Add content:main Agent

**Files:**
- Modify: `src/hooks/useOpenClaw.ts:8`
- Modify: `src/app/(app)/openclaw/page.tsx:16,30-39`
- Modify: `src/app/actions/openclaw-messages.ts` (if type is exported there)

**Step 1: Update OpenClawAgent type**

In `src/hooks/useOpenClaw.ts`:

```typescript
/**
 * Type for the agent names available in OpenClaw
 */
export type OpenClawAgent =
  | "main"
  | "einkauf"
  | "kundenservice"
  | "content:main";  // NEW: Content generation agent
```

**Step 2: Update OpenClaw page AGENTS array**

In `src/app/(app)/openclaw/page.tsx`:

```typescript
const AGENTS = [
  { id: "main" as const, name: "Bro (Main)", color: "blue" },
  { id: "einkauf" as const, name: "Einkauf", color: "green" },
  { id: "kundenservice" as const, name: "Kundenservice", color: "purple" },
  { id: "content:main" as const, name: "Content", color: "orange" }, // NEW
];
```

**Step 3: Update message state to include content:main**

In `src/app/(app)/openclaw/page.tsx`:

```typescript
const [messagesByAgent, setMessagesByAgent] = useState<{
  main: Message[];
  einkauf: Message[];
  kundenservice: Message[];
  "content:main": Message[]; // NEW
}>({
  main: [],
  einkauf: [],
  kundenservice: [],
  "content:main": [], // NEW
});
```

**Step 4: Verify types compile**

Run: `npm run build`
Expected: No TypeScript errors

**Step 5: Commit**

```bash
git add src/hooks/useOpenClaw.ts src/app/(app)/openclaw/page.tsx
git commit -m "feat(openclaw): add content:main agent type

- Add content:main to OpenClawAgent union type
- Add Content agent to UI
- Update message state for new agent

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: TypeScript Types for AI Content Prompts

**Files:**
- Create: `src/types/ai-content.ts`

**Step 1: Create types file**

```typescript
/**
 * AI Content Prompt from database
 */
export interface AIContentPrompt {
  id: string;
  domain: string;
  name: string;
  description: string | null;
  system_prompt: string;
  user_prompt_template: string;
  placeholder_fields: string[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Request to generate content
 */
export interface GenerateContentRequest {
  promptId: string;
  currentValue?: string;
  context: Record<string, any>;
  userInstructions?: string;
}

/**
 * Response from content generation
 */
export interface GenerateContentResponse {
  success: boolean;
  generated?: string;
  error?: string;
  tokensUsed?: number;
}

/**
 * Props for AIAssistantButton component
 */
export interface AIAssistantButtonProps {
  currentValue?: string;
  domain: string;
  context?: Record<string, any>;
  onGenerated: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Context for AI Assistant global state
 */
export interface AIAssistantContext {
  isOpen: boolean;
  domain: string | null;
  currentValue: string | null;
  context: Record<string, any> | null;
  onGenerated: ((text: string) => void) | null;
}
```

**Step 2: Verify types**

Run: `npm run build`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/types/ai-content.ts
git commit -m "feat(types): add AI content generation types

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Server Actions - Load AI Content Prompts

**Files:**
- Create: `src/app/actions/ai-content-prompts.ts`

**Step 1: Create server actions file**

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import type { AIContentPrompt } from "@/types/ai-content";

export async function loadPrompts(domain?: string): Promise<{
  success: boolean;
  prompts?: AIContentPrompt[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from("ai_content_prompts")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");

    if (domain) {
      query = query.eq("domain", domain);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error loading prompts:", error);
      return { success: false, error: error.message };
    }

    return { success: true, prompts: data || [] };
  } catch (err) {
    console.error("Error loading prompts:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function loadPromptById(id: string): Promise<{
  success: boolean;
  prompt?: AIContentPrompt;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("ai_content_prompts")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error loading prompt:", error);
      return { success: false, error: error.message };
    }

    return { success: true, prompt: data };
  } catch (err) {
    console.error("Error loading prompt:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function savePrompt(
  prompt: Partial<AIContentPrompt>
): Promise<{
  success: boolean;
  prompt?: AIContentPrompt;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // Check admin permission
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("auth_id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return { success: false, error: "Unauthorized" };
    }

    if (prompt.id) {
      // Update existing
      const { data, error } = await supabase
        .from("ai_content_prompts")
        .update({
          ...prompt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", prompt.id)
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, prompt: data };
    } else {
      // Create new
      const { data, error } = await supabase
        .from("ai_content_prompts")
        .insert(prompt)
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, prompt: data };
    }
  } catch (err) {
    console.error("Error saving prompt:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function deletePrompt(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // Check admin permission
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("auth_id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return { success: false, error: "Unauthorized" };
    }

    const { error } = await supabase
      .from("ai_content_prompts")
      .delete()
      .eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("Error deleting prompt:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
```

**Step 2: Test locally**

Run: `npm run dev`
Navigate to: Browser console
Run: `await fetch('/api/test')` (manual test in app)

**Step 3: Commit**

```bash
git add src/app/actions/ai-content-prompts.ts
git commit -m "feat(actions): add AI content prompts server actions

- Load prompts by domain
- CRUD operations with admin checks
- Type-safe with error handling

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: API Route - Generate Content with OpenClaw

**Files:**
- Create: `src/app/api/openclaw/generate-content/route.ts`

**Step 1: Create API route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { GenerateContentRequest, GenerateContentResponse } from "@/types/ai-content";

/**
 * Mustache-style template renderer
 * Supports {{variable}} and {{#condition}}text{{/condition}}
 */
function renderTemplate(template: string, context: Record<string, any>): string {
  let result = template;

  // Replace {{#variable}}...{{/variable}} conditionals
  result = result.replace(/\{\{#(\w+)\}\}(.*?)\{\{\/\1\}\}/gs, (match, key, content) => {
    const value = context[key];
    return value ? content : "";
  });

  // Replace {{variable}} placeholders
  result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return context[key] !== undefined ? String(context[key]) : "";
  });

  return result;
}

export async function POST(request: NextRequest): Promise<NextResponse<GenerateContentResponse>> {
  try {
    const supabase = await createClient();

    // Auth check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check role (admin or mitarbeiter)
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("auth_id", user.id)
      .single();

    if (!profile || !["admin", "mitarbeiter"].includes(profile.role)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    // Parse request
    const body: GenerateContentRequest = await request.json();
    const { promptId, currentValue, context, userInstructions } = body;

    if (!promptId) {
      return NextResponse.json(
        { success: false, error: "promptId is required" },
        { status: 400 }
      );
    }

    // Load prompt template
    const { data: prompt, error: promptError } = await supabase
      .from("ai_content_prompts")
      .select("*")
      .eq("id", promptId)
      .eq("is_active", true)
      .single();

    if (promptError || !prompt) {
      return NextResponse.json(
        { success: false, error: "Prompt not found" },
        { status: 404 }
      );
    }

    // Build context for template
    const templateContext = {
      ...context,
      currentValue: currentValue || "",
      userInstructions: userInstructions || "",
    };

    // Render user prompt
    const userPrompt = renderTemplate(
      prompt.user_prompt_template,
      templateContext
    );

    // Call OpenClaw content:main agent
    const openclawResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/openclaw/ask`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: request.headers.get("cookie") || "",
        },
        body: JSON.stringify({
          agent: "content:main",
          message: userPrompt,
          systemPrompt: prompt.system_prompt,
        }),
      }
    );

    if (!openclawResponse.ok) {
      const errorData = await openclawResponse.json().catch(() => ({}));
      return NextResponse.json(
        { success: false, error: errorData.error || "OpenClaw request failed" },
        { status: openclawResponse.status }
      );
    }

    const openclawData = await openclawResponse.json();
    const generated = openclawData.response;

    if (!generated) {
      return NextResponse.json(
        { success: false, error: "No response from AI" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      generated,
      tokensUsed: openclawData.tokensUsed,
    });
  } catch (error) {
    console.error("Generate content error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
```

**Step 2: Update OpenClaw ask endpoint to accept systemPrompt**

In `src/app/api/openclaw/ask/route.ts`, modify to accept optional `systemPrompt`:

```typescript
const { message, agent, systemPrompt } = await request.json();

// When calling OpenClaw, include systemPrompt if provided
const payload = {
  message,
  agent,
  ...(systemPrompt && { systemPrompt }),
};
```

**Step 3: Test API route**

Run: `npm run dev`
Test with: `curl -X POST http://localhost:3000/api/openclaw/generate-content -H "Content-Type: application/json" -d '{"promptId":"test-uuid","context":{"productName":"Test"}}'`

**Step 4: Commit**

```bash
git add src/app/api/openclaw/generate-content/route.ts
git commit -m "feat(api): add content generation endpoint

- Mustache-style template rendering
- Calls content:main agent via OpenClaw
- Auth and role checks
- Error handling with proper status codes

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: AI Assistant Context Provider & Hook

**Files:**
- Create: `src/components/ai-assistant-provider.tsx`
- Create: `src/hooks/use-ai-assistant.ts`

**Step 1: Create context provider**

```typescript
"use client";

import React, { createContext, useContext, useState } from "react";
import type { AIAssistantContext } from "@/types/ai-content";

const AIAssistantCtx = createContext<{
  state: AIAssistantContext;
  open: (config: Omit<AIAssistantContext, "isOpen">) => void;
  close: () => void;
} | null>(null);

export function AIAssistantProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AIAssistantContext>({
    isOpen: false,
    domain: null,
    currentValue: null,
    context: null,
    onGenerated: null,
  });

  const open = (config: Omit<AIAssistantContext, "isOpen">) => {
    setState({ ...config, isOpen: true });
  };

  const close = () => {
    setState({
      isOpen: false,
      domain: null,
      currentValue: null,
      context: null,
      onGenerated: null,
    });
  };

  return (
    <AIAssistantCtx.Provider value={{ state, open, close }}>
      {children}
    </AIAssistantCtx.Provider>
  );
}

export function useAIAssistantContext() {
  const ctx = useContext(AIAssistantCtx);
  if (!ctx) {
    throw new Error("useAIAssistantContext must be used within AIAssistantProvider");
  }
  return ctx;
}
```

**Step 2: Create custom hook**

```typescript
"use client";

import { useAIAssistantContext } from "@/components/ai-assistant-provider";

export function useAIAssistant() {
  const { open, close, state } = useAIAssistantContext();

  const openAssistant = (config: {
    domain: string;
    currentValue?: string;
    context?: Record<string, any>;
    onGenerated: (text: string) => void;
  }) => {
    open({
      domain: config.domain,
      currentValue: config.currentValue || null,
      context: config.context || null,
      onGenerated: config.onGenerated,
    });
  };

  return {
    openAssistant,
    closeAssistant: close,
    isOpen: state.isOpen,
  };
}
```

**Step 3: Add provider to app layout**

In `src/app/layout.tsx`, wrap children with provider:

```typescript
import { AIAssistantProvider } from "@/components/ai-assistant-provider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <AIAssistantProvider>
          {children}
        </AIAssistantProvider>
      </body>
    </html>
  );
}
```

**Step 4: Commit**

```bash
git add src/components/ai-assistant-provider.tsx src/hooks/use-ai-assistant.ts src/app/layout.tsx
git commit -m "feat(hooks): add AI assistant context and hook

- Global state management for modal
- Custom hook for easy usage
- Provider added to app layout

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 7: AIAssistantButton Component

**Files:**
- Create: `src/components/ai-assistant-button.tsx`

**Step 1: Create button component**

```typescript
"use client";

import { Sparkles } from "lucide-react";
import { useAIAssistant } from "@/hooks/use-ai-assistant";
import type { AIAssistantButtonProps } from "@/types/ai-content";

export function AIAssistantButton({
  currentValue,
  domain,
  context,
  onGenerated,
  disabled,
  className = "",
}: AIAssistantButtonProps) {
  const { openAssistant } = useAIAssistant();

  const handleClick = () => {
    openAssistant({
      domain,
      currentValue,
      context,
      onGenerated,
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center
        w-8 h-8 rounded-lg
        bg-purple-500/10 hover:bg-purple-500/20
        text-purple-400 hover:text-purple-300
        transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      title="AI-Assistent"
    >
      <Sparkles className="w-4 h-4" />
    </button>
  );
}
```

**Step 2: Verify component renders**

Run: `npm run build`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/ai-assistant-button.tsx
git commit -m "feat(components): add AIAssistantButton component

- Sparkles icon button
- Opens AI assistant modal
- Disabled state support

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 8: AIAssistantModal Component

**Files:**
- Create: `src/components/ai-assistant-modal.tsx`

**Step 1: Create modal component** (Large file, showing structure)

```typescript
"use client";

import { useState, useEffect } from "react";
import { useAIAssistantContext } from "@/components/ai-assistant-provider";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { loadPrompts } from "@/app/actions/ai-content-prompts";
import type { AIContentPrompt } from "@/types/ai-content";
import { Bot, Sparkles, X, RotateCw, Check } from "lucide-react";
import { toast } from "sonner";

export function AIAssistantModal() {
  const { state, close } = useAIAssistantContext();

  const [prompts, setPrompts] = useState<AIContentPrompt[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [userInstructions, setUserInstructions] = useState("");
  const [generatedText, setGeneratedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingPrompts, setLoadingPrompts] = useState(false);

  // Load prompts when domain changes
  useEffect(() => {
    if (state.isOpen && state.domain) {
      loadPromptsForDomain(state.domain);
    }
  }, [state.isOpen, state.domain]);

  // Reset state when modal closes
  useEffect(() => {
    if (!state.isOpen) {
      setSelectedPromptId(null);
      setUserInstructions("");
      setGeneratedText("");
    }
  }, [state.isOpen]);

  async function loadPromptsForDomain(domain: string) {
    setLoadingPrompts(true);
    try {
      const result = await loadPrompts(domain);
      if (result.success && result.prompts) {
        setPrompts(result.prompts);
        if (result.prompts.length > 0) {
          setSelectedPromptId(result.prompts[0].id);
        }
      } else {
        toast.error(result.error || "Fehler beim Laden der Prompts");
      }
    } catch (err) {
      toast.error("Fehler beim Laden der Prompts");
    } finally {
      setLoadingPrompts(false);
    }
  }

  async function handleGenerate() {
    if (!selectedPromptId) {
      toast.error("Bitte wähle einen Prompt aus");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/openclaw/generate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptId: selectedPromptId,
          currentValue: state.currentValue,
          context: state.context,
          userInstructions,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Generierung fehlgeschlagen");
      }

      setGeneratedText(data.generated);
      toast.success("Text erfolgreich generiert!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      setLoading(false);
    }
  }

  function handleAccept() {
    if (generatedText && state.onGenerated) {
      state.onGenerated(generatedText);
      close();
      toast.success("Text übernommen!");
    }
  }

  const selectedPrompt = prompts.find((p) => p.id === selectedPromptId);

  return (
    <Modal
      open={state.isOpen}
      onClose={close}
      title="AI-Assistent"
      size="lg"
    >
      <div className="space-y-4">
        {/* Prompt Selection */}
        <div>
          <label className="label">Prompt auswählen</label>
          {loadingPrompts ? (
            <div className="flex items-center justify-center py-4">
              <Spinner className="w-5 h-5" />
            </div>
          ) : prompts.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Keine Prompts für diesen Bereich verfügbar
            </p>
          ) : (
            <select
              value={selectedPromptId || ""}
              onChange={(e) => setSelectedPromptId(e.target.value)}
              className="input"
            >
              {prompts.map((prompt) => (
                <option key={prompt.id} value={prompt.id}>
                  {prompt.name}
                </option>
              ))}
            </select>
          )}
          {selectedPrompt?.description && (
            <p className="text-xs text-neutral-500 mt-1">
              {selectedPrompt.description}
            </p>
          )}
        </div>

        {/* Current Value */}
        {state.currentValue && (
          <div>
            <label className="label">Aktueller Text</label>
            <div className="p-3 bg-[#111] border border-[#262626] rounded-lg text-sm text-neutral-400">
              {state.currentValue.slice(0, 200)}
              {state.currentValue.length > 200 && "..."}
            </div>
          </div>
        )}

        {/* User Instructions */}
        <div>
          <label className="label">Zusätzliche Anweisungen (optional)</label>
          <textarea
            value={userInstructions}
            onChange={(e) => setUserInstructions(e.target.value)}
            className="input"
            rows={3}
            placeholder="z.B. 'Mache es kürzer' oder 'Füge technische Details hinzu'"
          />
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={loading || !selectedPromptId}
          className="btn btn-primary w-full"
        >
          {loading ? (
            <>
              <Spinner className="w-4 h-4" />
              Generiere...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Text generieren
            </>
          )}
        </button>

        {/* Generated Text */}
        {generatedText && (
          <div className="space-y-3 pt-4 border-t border-[#262626]">
            <div className="flex items-center justify-between">
              <label className="label">Generierter Text</label>
              <span className="text-xs text-neutral-500">
                {generatedText.length} Zeichen
              </span>
            </div>
            <textarea
              value={generatedText}
              onChange={(e) => setGeneratedText(e.target.value)}
              className="input"
              rows={8}
            />
            <div className="flex gap-3">
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="btn btn-secondary flex-1"
              >
                <RotateCw className="w-4 h-4" />
                Neu generieren
              </button>
              <button
                onClick={handleAccept}
                className="btn btn-primary flex-1"
              >
                <Check className="w-4 h-4" />
                Übernehmen
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
```

**Step 2: Add modal to app layout**

In `src/app/layout.tsx`:

```typescript
import { AIAssistantModal } from "@/components/ai-assistant-modal";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <AIAssistantProvider>
          {children}
          <AIAssistantModal />
        </AIAssistantProvider>
      </body>
    </html>
  );
}
```

**Step 3: Test modal**

Run: `npm run dev`
Navigate to any page
Expected: Modal component loads without errors

**Step 4: Commit**

```bash
git add src/components/ai-assistant-modal.tsx src/app/layout.tsx
git commit -m "feat(components): add AIAssistantModal component

- Prompt selection dropdown
- Current value display
- User instructions input
- Generate and accept workflow
- Editable generated text
- Character count

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Integrate AI Assistant in Article Detail Page

**Files:**
- Modify: `src/app/(app)/articles/[id]/page.tsx:277-282`

**Step 1: Import AIAssistantButton**

At top of file:

```typescript
import { AIAssistantButton } from "@/components/ai-assistant-button";
```

**Step 2: Add button next to description textarea**

Find the description Textarea section and modify:

```typescript
<div className="form-group">
  <div className="flex items-center justify-between">
    <label className="form-label">Beschreibung</label>
    <AIAssistantButton
      currentValue={product.description || ""}
      domain="product_description"
      context={{
        productName: product.name,
        category: product.category,
        manufacturer: product.manufacturer,
      }}
      onGenerated={(text) => updateField("description", text)}
    />
  </div>
  <Textarea
    value={product.description || ""}
    onChange={(v) => updateField("description", v)}
  />
</div>
```

**Step 3: Test integration**

Run: `npm run dev`
Navigate to: `/articles/new` or `/articles/[id]`
Expected: Sparkles button appears next to "Beschreibung" label
Click button: Modal opens
Expected: Product description prompts available

**Step 4: Commit**

```bash
git add src/app/(app)/articles/[id]/page.tsx
git commit -m "feat(articles): integrate AI assistant for descriptions

- Add AI button next to description field
- Pass product context to assistant
- Auto-fill description on accept

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 10: Admin Page - AI Content Prompts Management

**Files:**
- Create: `src/app/(app)/openclaw/content-prompts/page.tsx`

**Step 1: Create admin page** (Large file, showing structure)

```typescript
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { loadPrompts, savePrompt, deletePrompt } from "@/app/actions/ai-content-prompts";
import type { AIContentPrompt } from "@/types/ai-content";
import {
  Settings,
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  FileText,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

export default function ContentPromptsPage() {
  const router = useRouter();
  const [prompts, setPrompts] = useState<AIContentPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<AIContentPrompt | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    domain: "",
    name: "",
    description: "",
    system_prompt: "",
    user_prompt_template: "",
    placeholder_fields: [] as string[],
  });

  useEffect(() => {
    loadAllPrompts();
  }, []);

  async function loadAllPrompts() {
    setLoading(true);
    try {
      const result = await loadPrompts();
      if (result.success && result.prompts) {
        setPrompts(result.prompts);
      } else {
        toast.error(result.error || "Fehler beim Laden");
      }
    } catch (err) {
      toast.error("Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }

  function openNew() {
    setEditingPrompt(null);
    setForm({
      domain: "",
      name: "",
      description: "",
      system_prompt: "",
      user_prompt_template: "",
      placeholder_fields: [],
    });
    setShowForm(true);
  }

  function openEdit(prompt: AIContentPrompt) {
    setEditingPrompt(prompt);
    setForm({
      domain: prompt.domain,
      name: prompt.name,
      description: prompt.description || "",
      system_prompt: prompt.system_prompt,
      user_prompt_template: prompt.user_prompt_template,
      placeholder_fields: prompt.placeholder_fields,
    });
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const payload = {
      ...(editingPrompt ? { id: editingPrompt.id } : {}),
      domain: form.domain,
      name: form.name,
      description: form.description || null,
      system_prompt: form.system_prompt,
      user_prompt_template: form.user_prompt_template,
      placeholder_fields: form.placeholder_fields,
      is_active: true,
    };

    const result = await savePrompt(payload);

    setSaving(false);

    if (result.success) {
      toast.success(editingPrompt ? "Gespeichert!" : "Erstellt!");
      setShowForm(false);
      loadAllPrompts();
    } else {
      toast.error(result.error || "Fehler beim Speichern");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Prompt wirklich löschen?")) return;

    const result = await deletePrompt(id);

    if (result.success) {
      toast.success("Gelöscht!");
      loadAllPrompts();
    } else {
      toast.error(result.error || "Fehler beim Löschen");
    }
  }

  // Group by domain
  const groupedPrompts = prompts.reduce((acc, prompt) => {
    if (!acc[prompt.domain]) acc[prompt.domain] = [];
    acc[prompt.domain].push(prompt);
    return acc;
  }, {} as Record<string, AIContentPrompt[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/openclaw")}
          className="w-10 h-10 rounded-xl bg-[#111] border border-[#1a1a1a] flex items-center justify-center text-neutral-400 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-purple-400" />
            AI Content Prompts
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            {prompts.length} Prompts in {Object.keys(groupedPrompts).length} Domains
          </p>
        </div>
        <button onClick={openNew} className="btn btn-primary">
          <Plus className="w-4 h-4" />
          Neuer Prompt
        </button>
      </div>

      {/* Prompts List by Domain */}
      {Object.keys(groupedPrompts).length === 0 ? (
        <div className="card p-12 text-center">
          <Sparkles className="w-12 h-12 mx-auto text-neutral-600 mb-4" />
          <p className="text-neutral-400">Keine Prompts vorhanden</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedPrompts).map(([domain, domainPrompts]) => (
            <div key={domain} className="space-y-3">
              <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wider">
                {domain.replace(/_/g, " ")}
              </h2>
              <div className="card divide-y divide-[#1f1f1f]">
                {domainPrompts.map((prompt) => (
                  <div
                    key={prompt.id}
                    className="p-4 flex items-start justify-between hover:bg-[#111] transition-colors"
                  >
                    <div className="flex-1">
                      <h3 className="font-medium text-white">{prompt.name}</h3>
                      {prompt.description && (
                        <p className="text-sm text-neutral-500 mt-1">
                          {prompt.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-neutral-600">
                          {prompt.placeholder_fields.length} Platzhalter
                        </span>
                        <span className="text-xs text-neutral-600">
                          Sort: {prompt.sort_order}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(prompt)}
                        className="btn btn-ghost btn-icon"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(prompt.id)}
                        className="btn btn-ghost btn-icon text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editingPrompt ? "Prompt bearbeiten" : "Neuer Prompt"}
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Domain *</label>
              <input
                value={form.domain}
                onChange={(e) => setForm({ ...form, domain: e.target.value })}
                className="input"
                placeholder="z.B. product_description"
                required
              />
            </div>
            <div>
              <label className="label">Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input"
                placeholder="z.B. Marketing-Text"
                required
              />
            </div>
          </div>

          <div>
            <label className="label">Beschreibung</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input"
              placeholder="Kurze Erklärung für Admins"
            />
          </div>

          <div>
            <label className="label">System Prompt *</label>
            <textarea
              value={form.system_prompt}
              onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
              className="input"
              rows={6}
              placeholder="Du bist ein Experte für..."
              required
            />
          </div>

          <div>
            <label className="label">User Prompt Template *</label>
            <textarea
              value={form.user_prompt_template}
              onChange={(e) => setForm({ ...form, user_prompt_template: e.target.value })}
              className="input"
              rows={8}
              placeholder="Verwende {{variable}} für Platzhalter"
              required
            />
            <p className="text-xs text-neutral-500 mt-1">
              Syntax: {`{{variable}}`} für Platzhalter, {`{{#variable}}text{{/variable}}`} für Conditionals
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="btn btn-secondary flex-1"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary flex-1"
            >
              {saving ? <Spinner className="w-4 h-4" /> : "Speichern"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
```

**Step 2: Add navigation link**

In `src/components/app-shell.tsx`, add to OpenClaw section:

```typescript
{
  id: "openclaw-content-prompts",
  path: "/openclaw/content-prompts",
  label: "Content Prompts",
  icon: Settings,
  description: "AI-Vorlagen",
}
```

**Step 3: Test admin page**

Run: `npm run dev`
Navigate to: `/openclaw/content-prompts`
Expected: Prompts list shows default prompts
Try: Create, edit, delete prompts

**Step 4: Commit**

```bash
git add src/app/(app)/openclaw/content-prompts/page.tsx src/components/app-shell.tsx
git commit -m "feat(admin): add AI content prompts management page

- CRUD for prompt templates
- Grouped by domain
- Test function (TODO)
- Navigation link added

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Verification Plan

### End-to-End Test

1. **Database Setup**
   ```bash
   npx supabase db push
   ```
   Expected: Migration applied, 2 default prompts inserted

2. **Test AI Assistant in Article Editor**
   - Navigate to `/articles/new`
   - Fill in: Name, Category, Manufacturer
   - Click Sparkles button next to "Beschreibung"
   - Expected: Modal opens with 2 prompt options
   - Select: "Produktbeschreibung (Marketing)"
   - Add instruction: "Mache es kurz und prägnant"
   - Click "Text generieren"
   - Expected: AI generates description
   - Edit generated text if needed
   - Click "Übernehmen"
   - Expected: Text appears in description field, modal closes

3. **Test Admin Page**
   - Navigate to `/openclaw/content-prompts`
   - Expected: 2 prompts listed under "product description"
   - Click "Neuer Prompt"
   - Create: email_customer domain prompt
   - Expected: Saved successfully
   - Try editing and deleting

4. **Test Error Handling**
   - Try generating without selecting prompt
   - Expected: Error toast
   - Disconnect internet, try generating
   - Expected: Network error shown
   - Test with invalid prompt ID
   - Expected: 404 error handled

### Build Verification

```bash
npm run build
```
Expected: No TypeScript errors, successful build

---

## Success Criteria

✅ Database migration creates ai_content_prompts table with RLS
✅ 2 default product description prompts seeded
✅ content:main agent added to OpenClaw types
✅ AIAssistantButton component renders with Sparkles icon
✅ AIAssistantModal opens from button click
✅ Modal loads prompts for specific domain
✅ Content generation calls OpenClaw API successfully
✅ Generated text is editable before accepting
✅ Accepting text closes modal and updates field
✅ Admin page shows all prompts grouped by domain
✅ Admin can create/edit/delete prompts (admin role only)
✅ Non-admin users can use AI assistant but not edit prompts
✅ All TypeScript types compile without errors
✅ No console errors in browser

---

## Future Enhancements (Not in this plan)

- Test function in admin page to preview prompts
- Usage analytics (how often each prompt is used)
- Prompt versioning and history
- Multi-language support for prompts
- Rate limiting per user
- Cost tracking (tokens used)
- Prompt templates marketplace
- A/B testing for prompts
