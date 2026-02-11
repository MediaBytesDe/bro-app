"use client";

import { useContext } from "react";
import { AIAssistantContextInstance } from "@/contexts/ai-assistant-provider";

/**
 * Hook to access AI Assistant modal state and actions
 */
export function useAIAssistant() {
  const context = useContext(AIAssistantContextInstance);

  if (!context) {
    throw new Error("useAIAssistant must be used within AIAssistantProvider");
  }

  return context;
}
