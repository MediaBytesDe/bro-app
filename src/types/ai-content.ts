/**
 * AI Content Generation Types
 */

/**
 * Database schema for AI content prompts
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
 * Request payload for content generation
 */
export interface GenerateContentRequest {
  promptId: string;
  variables: Record<string, string>;
}

/**
 * Response from content generation API
 */
export interface GenerateContentResponse {
  success: boolean;
  content?: string;
  error?: string;
}

/**
 * Props for AIAssistantButton component
 */
export interface AIAssistantButtonProps {
  domain: string;
  currentValue?: string;
  contextData?: Record<string, string>;
  onAccept: (generatedContent: string) => void;
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * Context type for AI Assistant Provider
 */
export interface AIAssistantContext {
  isOpen: boolean;
  selectedDomain: string | null;
  currentValue: string | null;
  contextData: Record<string, string> | null;
  onAcceptCallback: ((content: string) => void) | null;
  openModal: (
    domain: string,
    currentValue: string | null,
    contextData: Record<string, string> | null,
    onAccept: (content: string) => void
  ) => void;
  closeModal: () => void;
}
