"use client";

import { createContext, useState, useCallback, ReactNode } from "react";
import type { AIAssistantContext } from "@/types/ai-content";

export const AIAssistantContextInstance = createContext<AIAssistantContext | null>(null);

export function AIAssistantProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [currentValue, setCurrentValue] = useState<string | null>(null);
  const [contextData, setContextData] = useState<Record<string, string> | null>(null);
  const [onAcceptCallback, setOnAcceptCallback] = useState<
    ((content: string) => void) | null
  >(null);

  const openModal = useCallback(
    (
      domain: string,
      value: string | null,
      context: Record<string, string> | null,
      onAccept: (content: string) => void
    ) => {
      setSelectedDomain(domain);
      setCurrentValue(value);
      setContextData(context);
      setOnAcceptCallback(() => onAccept);
      setIsOpen(true);
    },
    []
  );

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setSelectedDomain(null);
    setCurrentValue(null);
    setContextData(null);
    setOnAcceptCallback(null);
  }, []);

  return (
    <AIAssistantContextInstance.Provider
      value={{
        isOpen,
        selectedDomain,
        currentValue,
        contextData,
        onAcceptCallback,
        openModal,
        closeModal,
      }}
    >
      {children}
    </AIAssistantContextInstance.Provider>
  );
}
