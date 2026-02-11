"use client";

import { useState, useEffect } from "react";
import { useAIAssistant } from "@/hooks/use-ai-assistant";
import { loadPromptsByDomain } from "@/app/actions/ai-content-prompts";
import type { AIContentPrompt } from "@/types/ai-content";
import {
  X,
  Sparkles,
  Loader2,
  AlertCircle,
  Check,
  ChevronDown,
  ArrowLeft,
} from "lucide-react";

/**
 * AI Assistant Modal - Simplified workflow
 * Select prompt → Generate immediately → Edit result
 */
export function AIAssistantModal() {
  const {
    isOpen,
    selectedDomain,
    currentValue,
    contextData,
    onAcceptCallback,
    closeModal,
  } = useAIAssistant();

  const [prompts, setPrompts] = useState<AIContentPrompt[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<AIContentPrompt | null>(
    null
  );
  const [generatedContent, setGeneratedContent] = useState<string>("");
  const [editedContent, setEditedContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"select" | "result">("select");

  // Load prompts when modal opens - with forced refresh
  useEffect(() => {
    if (isOpen && selectedDomain) {
      // Force reload by clearing old prompts first
      setPrompts([]);
      loadPromptsForDomain();
    }
  }, [isOpen, selectedDomain]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      resetModal();
    }
  }, [isOpen]);

  const loadPromptsForDomain = async () => {
    if (!selectedDomain) return;

    console.log(`[Modal] Loading prompts for domain: ${selectedDomain}`);

    setLoading(true);
    setError(null);

    // Use current timestamp as cache buster to force fresh data
    const result = await loadPromptsByDomain(selectedDomain, Date.now());

    console.log(`[Modal] Received result:`, result);

    if (result.success && result.prompts) {
      console.log(`[Modal] Setting ${result.prompts.length} prompts`);
      setPrompts(result.prompts);

      // Auto-select and generate if only one prompt
      if (result.prompts.length === 1) {
        handlePromptSelect(result.prompts[0]);
      }
    } else {
      setError(result.error || "Fehler beim Laden der Prompts");
    }

    setLoading(false);
  };

  const handlePromptSelect = async (prompt: AIContentPrompt) => {
    setSelectedPrompt(prompt);
    setStep("result");
    await generateContent(prompt);
  };

  const generateContent = async (prompt: AIContentPrompt) => {
    setGenerating(true);
    setError(null);

    try {
      // Build variables from currentValue and contextData
      const variables: Record<string, string> = {
        ...(contextData || {}),
      };

      // Add current_value if exists
      if (currentValue) {
        variables.current_value = currentValue;
        variables.currentValue = currentValue; // Also add camelCase variant
      }

      const response = await fetch("/api/openclaw/generate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptId: prompt.id,
          variables,
        }),
      });

      const data = await response.json();

      if (data.success && data.content) {
        setGeneratedContent(data.content);
        setEditedContent(data.content);
      } else {
        setError(data.error || "Generierung fehlgeschlagen");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten"
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleAccept = () => {
    if (onAcceptCallback && editedContent) {
      onAcceptCallback(editedContent);
      closeModal();
    }
  };

  const handleBack = () => {
    setStep("select");
    setSelectedPrompt(null);
    setGeneratedContent("");
    setEditedContent("");
    setError(null);
  };

  const handleRegenerate = () => {
    if (selectedPrompt) {
      generateContent(selectedPrompt);
    }
  };

  const resetModal = () => {
    setPrompts([]);
    setSelectedPrompt(null);
    setGeneratedContent("");
    setEditedContent("");
    setLoading(false);
    setGenerating(false);
    setError(null);
    setStep("select");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-neutral-900 rounded-xl shadow-2xl border border-neutral-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-gradient-to-r from-purple-900/20 to-blue-900/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">
                KI-Content-Assistent
              </h2>
              <p className="text-sm text-neutral-400">
                {step === "select" && "Vorlage auswählen"}
                {step === "result" && selectedPrompt?.name}
              </p>
            </div>
          </div>
          <button
            onClick={closeModal}
            className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
            aria-label="Schließen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Error Display */}
          {error && (
            <div className="mb-4 p-4 bg-red-900/20 border border-red-900/50 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            </div>
          )}

          {/* Step 1: Select Prompt */}
          {step === "select" && (
            <div className="space-y-4">
              {loading ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-purple-500" />
                  <p className="text-neutral-400">Lade Vorlagen...</p>
                </div>
              ) : prompts.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 text-neutral-600" />
                  <p className="text-neutral-400">
                    Keine Vorlagen für diesen Bereich gefunden.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {prompts.map((prompt) => (
                    <button
                      key={prompt.id}
                      onClick={() => handlePromptSelect(prompt)}
                      disabled={generating}
                      className="w-full text-left p-4 bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-700 rounded-lg transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-white group-hover:text-purple-400 transition-colors">
                            {prompt.name}
                          </h3>
                          {prompt.description && (
                            <p className="mt-1 text-sm text-neutral-400">
                              {prompt.description}
                            </p>
                          )}
                        </div>
                        <ChevronDown className="w-5 h-5 text-neutral-500 -rotate-90 mt-1" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Result (with loading state) */}
          {step === "result" && (
            <div className="space-y-4">
              {generating ? (
                <div className="text-center py-12">
                  <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-purple-500" />
                  <p className="text-lg font-medium text-white mb-2">
                    KI generiert Content...
                  </p>
                  <p className="text-sm text-neutral-400">
                    Dies kann einen Moment dauern
                  </p>
                </div>
              ) : generatedContent ? (
                <>
                  <div className="p-4 bg-green-900/20 border border-green-900/50 rounded-lg flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-300">
                        Content generiert!
                      </p>
                      <p className="text-xs text-green-400 mt-1">
                        Sie können den Text unten noch bearbeiten, bevor Sie ihn
                        übernehmen.
                      </p>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-neutral-300">
                        Generierter Content (editierbar)
                      </label>
                      <button
                        onClick={handleRegenerate}
                        disabled={generating}
                        className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 disabled:opacity-50"
                      >
                        <Sparkles className="w-3 h-3" />
                        Neu generieren
                      </button>
                    </div>
                    <textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      rows={14}
                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                    />
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-800 bg-neutral-900/50">
          <div>
            {step === "result" && !generating && (
              <button
                onClick={handleBack}
                className="px-4 py-2 text-sm text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Andere Vorlage
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={closeModal}
              disabled={generating}
              className="px-4 py-2 text-sm text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-50"
            >
              Abbrechen
            </button>

            {step === "result" && !generating && generatedContent && (
              <button
                onClick={handleAccept}
                disabled={!editedContent.trim()}
                className="px-4 py-2 text-sm bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Übernehmen
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
