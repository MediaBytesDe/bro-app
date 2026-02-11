"use client";

import { Sparkles } from "lucide-react";
import { useAIAssistant } from "@/hooks/use-ai-assistant";
import type { AIAssistantButtonProps } from "@/types/ai-content";

/**
 * Reusable AI Assistant button component
 * Opens the AI Assistant modal for content generation
 */
export function AIAssistantButton({
  domain,
  currentValue,
  contextData,
  onAccept,
  className = "",
  size = "md",
}: AIAssistantButtonProps) {
  const { openModal } = useAIAssistant();

  const handleClick = () => {
    openModal(domain, currentValue || null, contextData || null, onAccept);
  };

  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-2 text-sm",
    lg: "px-4 py-2 text-base",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`
        inline-flex items-center gap-2
        bg-gradient-to-r from-purple-600 to-blue-600
        hover:from-purple-700 hover:to-blue-700
        text-white font-medium rounded-lg
        transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-neutral-900
        ${sizeClasses[size]}
        ${className}
      `}
      aria-label="AI Assistant öffnen"
    >
      <Sparkles className={iconSizes[size]} />
      <span>KI-Assistent</span>
    </button>
  );
}
