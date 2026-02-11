"use client";

import { AuthProvider } from "@/contexts/auth-context";
import { QueryProvider } from "@/providers/query-provider";
import { AIAssistantProvider } from "@/contexts/ai-assistant-provider";
import { AIAssistantModal } from "@/components/ai-assistant-modal";
import { Toaster } from "sonner";
import type { ReactNode } from "react";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryProvider>
      <AuthProvider>
        <AIAssistantProvider>
          {children}
          <AIAssistantModal />
          <Toaster position="top-right" richColors />
        </AIAssistantProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
