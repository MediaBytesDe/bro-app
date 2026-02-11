"use client";

import { useState, useCallback } from "react";

/**
 * Type for the agent names available in OpenClaw
 */
export type OpenClawAgent = "main" | "einkauf" | "kundenservice" | "content:main";

/**
 * Options for configuring the useOpenClaw hook
 */
export interface UseOpenClawOptions {
  defaultAgent?: OpenClawAgent;
}

/**
 * Result from the OpenClaw API
 */
export interface AskResult {
  success: boolean;
  response: string;
  agent: string;
  timestamp: string;
}

/**
 * Return type for the useOpenClaw hook
 */
export interface UseOpenClawReturn {
  loading: boolean;
  error: string | null;
  lastResponse: string | null;
  ask: (message: string, agent?: OpenClawAgent) => Promise<string | null>;
  askMain: (message: string) => Promise<string | null>;
  askEinkauf: (message: string) => Promise<string | null>;
  askKundenservice: (message: string) => Promise<string | null>;
}

/**
 * React hook for interacting with OpenClaw agents
 *
 * @param options - Configuration options for the hook
 * @returns Hook interface with state and functions
 *
 * @example
 * ```tsx
 * const { loading, error, lastResponse, askMain } = useOpenClaw();
 *
 * const handleSubmit = async () => {
 *   const response = await askMain("What projects are active?");
 *   if (response) {
 *     console.log("Agent response:", response);
 *   }
 * };
 * ```
 */
export function useOpenClaw(
  options: UseOpenClawOptions = {}
): UseOpenClawReturn {
  const { defaultAgent = "main" } = options;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<string | null>(null);

  /**
   * Send a message to an OpenClaw agent
   *
   * @param message - The message to send to the agent
   * @param agent - The agent to use (defaults to configured defaultAgent)
   * @returns The agent's response or null if an error occurred
   */
  const ask = useCallback(
    async (
      message: string,
      agent: OpenClawAgent = defaultAgent
    ): Promise<string | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/openclaw/ask", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message, agent }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `HTTP error! status: ${response.status}`
          );
        }

        const data: AskResult = await response.json();

        // Ensure response is a string
        const responseText = typeof data.response === "string"
          ? data.response
          : JSON.stringify(data.response);

        setLastResponse(responseText);
        return responseText;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "An unknown error occurred";
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [defaultAgent]
  );

  /**
   * Send a message to the main agent
   */
  const askMain = useCallback(
    async (message: string): Promise<string | null> => {
      return ask(message, "main");
    },
    [ask]
  );

  /**
   * Send a message to the einkauf (purchasing) agent
   */
  const askEinkauf = useCallback(
    async (message: string): Promise<string | null> => {
      return ask(message, "einkauf");
    },
    [ask]
  );

  /**
   * Send a message to the kundenservice (customer service) agent
   */
  const askKundenservice = useCallback(
    async (message: string): Promise<string | null> => {
      return ask(message, "kundenservice");
    },
    [ask]
  );

  return {
    loading,
    error,
    lastResponse,
    ask,
    askMain,
    askEinkauf,
    askKundenservice,
  };
}
