"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTrades } from "@/hooks/use-trades";
import { URGENCY_MAP } from "@/lib/inquiries/constants";
import { uploadMultiplePhotos } from "@/lib/inquiries/upload";
import type { InquiryTemplate, InquiryTemplateField } from "@/lib/inquiries/types";
import { Spinner } from "@/components/ui/spinner";
import {
  FileText,
  Camera,
  X,
  Plus,
  Send,
  Save,
  ChevronRight,
  AlertCircle,
  ImagePlus,
  Users,
  User,
  MapPin,
  ClipboardList,
} from "lucide-react";

interface Project {
  id: string;
  name: string;
}

interface Partner {
  id: string;
  company_name: string;
  trade: string;
  trades: string[] | null;
}

function CreateInquiryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProjectId = searchParams.get("project_id") || "";

  const supabase = createClient();
  const { trades, loading: tradesLoading } = useTrades();

  // Form state
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState(preselectedProjectId);
  const [selectedTrade, setSelectedTrade] = useState("");
  const [description, setDescription] = useState("");
  const [locationNotes, setLocationNotes] = useState("");
  const [urgency, setUrgency] = useState("normal");
  const [mode, setMode] = useState<"direct" | "tender">("direct");
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<string[]>([]);

  // Template / checklist state
  const [templates, setTemplates] = useState<InquiryTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [checklistData, setChecklistData] = useState<Record<string, unknown>>({});
  const [checklistPhotoFiles, setChecklistPhotoFiles] = useState<Record<string, File | null>>({});
  const [checklistPhotoPreviews, setChecklistPhotoPreviews] = useState<Record<string, string>>({});

  // Photo state
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Data loading state
  const [projects, setProjects] = useState<Project[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingPartners, setLoadingPartners] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Submit state
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  // Load projects on mount
  useEffect(() => {
    async function loadProjects() {
      try {
        const { data } = await supabase
          .from("projects")
          .select("id, name")
          .order("name");
        if (data) setProjects(data);
      } catch (err) {
        console.error("Error loading projects:", err);
      } finally {
        setLoadingProjects(false);
      }
    }
    loadProjects();
  }, []);

  // Load templates when trade changes
  const loadTemplates = useCallback(async (trade: string) => {
    if (!trade) {
      setTemplates([]);
      setSelectedTemplateId("");
      setChecklistData({});
      setChecklistPhotoFiles({});
      setChecklistPhotoPreviews({});
      return;
    }
    setLoadingTemplates(true);
    try {
      const res = await fetch("/api/inquiries/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list", trade }),
      });
      const json = await res.json();
      if (json.data) {
        setTemplates(json.data.filter((t: InquiryTemplate) => t.is_active));
      }
    } catch (err) {
      console.error("Error loading templates:", err);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  // Load partners when trade changes
  const loadPartners = useCallback(async (trade: string) => {
    if (!trade) {
      setPartners([]);
      setSelectedPartnerIds([]);
      return;
    }
    setLoadingPartners(true);
    try {
      const { data } = await supabase
        .from("partners")
        .select("id, company_name, trade, trades")
        .eq("active", true);

      if (data) {
        const filtered = data.filter(
          (p) => p.trade === trade || (p.trades && p.trades.includes(trade))
        );
        setPartners(filtered);
      }
    } catch (err) {
      console.error("Error loading partners:", err);
    } finally {
      setLoadingPartners(false);
    }
  }, []);

  function handleTradeChange(trade: string) {
    setSelectedTrade(trade);
    setSelectedTemplateId("");
    setChecklistData({});
    setChecklistPhotoFiles({});
    setChecklistPhotoPreviews({});
    setSelectedPartnerIds([]);
    loadTemplates(trade);
    loadPartners(trade);
  }

  // Template selection -> populate checklist fields
  function handleTemplateChange(templateId: string) {
    setSelectedTemplateId(templateId);
    setChecklistData({});
    setChecklistPhotoFiles({});
    setChecklistPhotoPreviews({});
  }

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  // Group fields by group
  function getGroupedFields(fields: InquiryTemplateField[]) {
    const groups: { name: string; fields: InquiryTemplateField[] }[] = [];
    let currentGroup = "";

    for (const field of fields) {
      const groupName = field.group || "";
      if (groupName !== currentGroup) {
        currentGroup = groupName;
        groups.push({ name: groupName, fields: [field] });
      } else {
        const last = groups[groups.length - 1];
        if (last) {
          last.fields.push(field);
        } else {
          groups.push({ name: groupName, fields: [field] });
        }
      }
    }
    return groups;
  }

  // Photo handling
  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    const newFiles = Array.from(files);
    const newPreviews = newFiles.map((file) => URL.createObjectURL(file));
    setPhotoFiles((prev) => [...prev, ...newFiles]);
    setPhotoPreviews((prev) => [...prev, ...newPreviews]);
    // Reset input so same file can be re-selected
    e.target.value = "";
  }

  function removePhoto(index: number) {
    URL.revokeObjectURL(photoPreviews[index]);
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  // Checklist photo handling
  function handleChecklistPhotoSelect(
    key: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Revoke old preview if exists
    if (checklistPhotoPreviews[key]) {
      URL.revokeObjectURL(checklistPhotoPreviews[key]);
    }
    setChecklistPhotoFiles((prev) => ({ ...prev, [key]: file }));
    setChecklistPhotoPreviews((prev) => ({
      ...prev,
      [key]: URL.createObjectURL(file),
    }));
    e.target.value = "";
  }

  function removeChecklistPhoto(key: string) {
    if (checklistPhotoPreviews[key]) {
      URL.revokeObjectURL(checklistPhotoPreviews[key]);
    }
    setChecklistPhotoFiles((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setChecklistPhotoPreviews((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setChecklistData((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  // Validation
  function validate(): string | null {
    if (!title.trim()) return "Bitte geben Sie einen Titel ein.";
    if (!selectedTrade) return "Bitte wahlen Sie ein Gewerk aus.";

    // Check required checklist fields
    if (selectedTemplate) {
      for (const field of selectedTemplate.fields) {
        if (field.required) {
          if (field.type === "photo") {
            if (!checklistPhotoFiles[field.key]) {
              return `Pflichtfeld "${field.label}" ist nicht ausgefullt.`;
            }
          } else if (field.type === "checkbox") {
            // checkboxes: required means must be checked
            if (!checklistData[field.key]) {
              return `Pflichtfeld "${field.label}" muss aktiviert werden.`;
            }
          } else {
            const val = checklistData[field.key];
            if (val === undefined || val === null || val === "") {
              return `Pflichtfeld "${field.label}" ist nicht ausgefullt.`;
            }
          }
        }
      }
    }

    return null;
  }

  async function handleSubmit(sendAfterSave: boolean) {
    setError("");

    // Validate
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    // Validate recipients for sending
    if (sendAfterSave && selectedPartnerIds.length === 0) {
      setError("Bitte wahlen Sie mindestens einen Empfanger aus.");
      return;
    }

    sendAfterSave ? setSending(true) : setSaving(true);

    try {
      let photoUrls: string[] = [];
      const totalPhotos =
        photoFiles.length +
        Object.values(checklistPhotoFiles).filter(Boolean).length;
      let uploadedCount = 0;

      // We need a temporary ID for uploads - create the inquiry as draft first
      // Then upload photos, then update with photo URLs

      // Step 1: Create inquiry as draft (without photos)
      const finalChecklistData = { ...checklistData };

      const createPayload: Record<string, unknown> = {
        action: "create",
        title: title.trim(),
        trade: selectedTrade,
        urgency,
        mode,
      };

      if (description.trim()) createPayload.description = description.trim();
      if (locationNotes.trim()) createPayload.location_notes = locationNotes.trim();
      if (projectId) createPayload.project_id = projectId;
      if (selectedTemplateId) createPayload.template_id = selectedTemplateId;
      if (Object.keys(finalChecklistData).length > 0) {
        createPayload.checklist_data = finalChecklistData;
      }

      const createRes = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createPayload),
      });
      const createJson = await createRes.json();

      if (createJson.error) {
        setError(createJson.error);
        return;
      }

      const inquiryId = createJson.data.id;

      // Step 2: Upload photos if any
      if (totalPhotos > 0) {
        setUploadProgress(0);

        // Upload main photos
        if (photoFiles.length > 0) {
          for (const file of photoFiles) {
            const urls = await uploadMultiplePhotos([file], inquiryId);
            photoUrls.push(...urls);
            uploadedCount++;
            setUploadProgress(Math.round((uploadedCount / totalPhotos) * 100));
          }
        }

        // Upload checklist photos
        const checklistPhotoUrls: Record<string, string> = {};
        for (const [key, file] of Object.entries(checklistPhotoFiles)) {
          if (file) {
            const urls = await uploadMultiplePhotos([file], inquiryId);
            checklistPhotoUrls[key] = urls[0];
            uploadedCount++;
            setUploadProgress(Math.round((uploadedCount / totalPhotos) * 100));
          }
        }

        // Step 3: Update inquiry with photo URLs
        const updatePayload: Record<string, unknown> = {
          action: "update",
          id: inquiryId,
        };

        if (photoUrls.length > 0) {
          updatePayload.photos = photoUrls;
        }

        if (Object.keys(checklistPhotoUrls).length > 0) {
          // Merge checklist photo URLs into checklist_data
          const updatedChecklist = { ...finalChecklistData, ...checklistPhotoUrls };
          updatePayload.checklist_data = updatedChecklist;
        }

        if (Object.keys(updatePayload).length > 2) {
          const updateRes = await fetch("/api/inquiries", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatePayload),
          });
          const updateJson = await updateRes.json();
          if (updateJson.error) {
            console.error("Error updating photos:", updateJson.error);
          }
        }
      }

      // Step 4: Send if requested
      if (sendAfterSave) {
        const sendRes = await fetch("/api/inquiries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "send",
            id: inquiryId,
            recipient_ids: selectedPartnerIds,
          }),
        });
        const sendJson = await sendRes.json();
        if (sendJson.error) {
          setError("Anfrage erstellt, aber Versand fehlgeschlagen: " + sendJson.error);
          router.push(`/anfragen/${inquiryId}`);
          return;
        }
      }

      // Step 5: Redirect to detail page
      router.push(`/anfragen/${inquiryId}`);
    } catch (err) {
      console.error("Submit error:", err);
      setError("Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.");
    } finally {
      setSaving(false);
      setSending(false);
      setUploadProgress(0);
    }
  }

  const isSubmitting = saving || sending;

  if (tradesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-32 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <ClipboardList className="w-7 h-7 text-[#fa432a]" />
          Neue Anfrage
        </h1>
        <p className="text-neutral-400 mt-1">
          Erstellen Sie eine neue Anfrage an Nachunternehmer.
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
          <button
            onClick={() => setError("")}
            className="ml-auto shrink-0 text-red-400 hover:text-red-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Section 1: Grunddaten */}
      <section className="bg-[#111] border border-[#1a1a1a] rounded-xl p-5 space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#fa432a]" />
          Grunddaten
        </h2>

        {/* Titel */}
        <div>
          <label className="block text-sm text-neutral-400 mb-1">
            Titel <span className="text-[#fa432a]">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="z.B. Elektroinstallation EG"
            className="w-full min-h-[44px] px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded-lg text-white placeholder:text-neutral-500 focus:border-[#fa432a] focus:ring-1 focus:ring-[#fa432a] outline-none transition-colors"
            required
          />
        </div>

        {/* Projekt */}
        <div>
          <label className="block text-sm text-neutral-400 mb-1">Projekt</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full min-h-[44px] px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded-lg text-white focus:border-[#fa432a] focus:ring-1 focus:ring-[#fa432a] outline-none transition-colors"
            disabled={loadingProjects}
          >
            <option value="">Kein Projekt zugeordnet</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Gewerk */}
        <div>
          <label className="block text-sm text-neutral-400 mb-1">
            Gewerk <span className="text-[#fa432a]">*</span>
          </label>
          <select
            value={selectedTrade}
            onChange={(e) => handleTradeChange(e.target.value)}
            className="w-full min-h-[44px] px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded-lg text-white focus:border-[#fa432a] focus:ring-1 focus:ring-[#fa432a] outline-none transition-colors"
            required
          >
            <option value="">Gewerk auswahlen...</option>
            {trades
              .filter((t) => t.is_active !== false)
              .map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.label}
                </option>
              ))}
          </select>
        </div>
      </section>

      {/* Section 2: Checkliste (shown after trade selection) */}
      {selectedTrade && (
        <section className="bg-[#111] border border-[#1a1a1a] rounded-xl p-5 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-[#fa432a]" />
            Checkliste
          </h2>

          {/* Vorlage auswahl */}
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Vorlage</label>
            {loadingTemplates ? (
              <div className="flex items-center gap-2 text-neutral-500 text-sm py-2">
                <Spinner className="w-4 h-4" />
                Vorlagen werden geladen...
              </div>
            ) : (
              <select
                value={selectedTemplateId}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded-lg text-white focus:border-[#fa432a] focus:ring-1 focus:ring-[#fa432a] outline-none transition-colors"
              >
                <option value="">Keine Vorlage</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Template fields */}
          {selectedTemplate && selectedTemplate.fields.length > 0 && (
            <div className="space-y-4 pt-2">
              {getGroupedFields(selectedTemplate.fields).map((group, gi) => (
                <div key={gi} className="space-y-3">
                  {group.name && (
                    <h3 className="text-sm font-medium text-neutral-300 border-b border-[#1a1a1a] pb-1">
                      {group.name}
                    </h3>
                  )}
                  {group.fields.map((field) => (
                    <div key={field.key}>
                      <label className="block text-sm text-neutral-400 mb-1">
                        {field.label}
                        {field.required && (
                          <span className="text-[#fa432a] ml-1">*</span>
                        )}
                      </label>

                      {field.type === "text" && (
                        <input
                          type="text"
                          value={(checklistData[field.key] as string) || ""}
                          onChange={(e) =>
                            setChecklistData((prev) => ({
                              ...prev,
                              [field.key]: e.target.value,
                            }))
                          }
                          className="w-full min-h-[44px] px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded-lg text-white placeholder:text-neutral-500 focus:border-[#fa432a] focus:ring-1 focus:ring-[#fa432a] outline-none transition-colors"
                        />
                      )}

                      {field.type === "number" && (
                        <input
                          type="number"
                          value={(checklistData[field.key] as string) || ""}
                          onChange={(e) =>
                            setChecklistData((prev) => ({
                              ...prev,
                              [field.key]: e.target.value,
                            }))
                          }
                          className="w-full min-h-[44px] px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded-lg text-white placeholder:text-neutral-500 focus:border-[#fa432a] focus:ring-1 focus:ring-[#fa432a] outline-none transition-colors"
                        />
                      )}

                      {field.type === "select" && (
                        <select
                          value={(checklistData[field.key] as string) || ""}
                          onChange={(e) =>
                            setChecklistData((prev) => ({
                              ...prev,
                              [field.key]: e.target.value,
                            }))
                          }
                          className="w-full min-h-[44px] px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded-lg text-white focus:border-[#fa432a] focus:ring-1 focus:ring-[#fa432a] outline-none transition-colors"
                        >
                          <option value="">Bitte wahlen...</option>
                          {(field.options || []).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      )}

                      {field.type === "checkbox" && (
                        <label className="flex items-center gap-3 min-h-[44px] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!checklistData[field.key]}
                            onChange={(e) =>
                              setChecklistData((prev) => ({
                                ...prev,
                                [field.key]: e.target.checked,
                              }))
                            }
                            className="w-5 h-5 rounded border-[#333] bg-[#1a1a1a] text-[#fa432a] focus:ring-[#fa432a]"
                          />
                          <span className="text-sm text-neutral-300">Ja</span>
                        </label>
                      )}

                      {field.type === "photo" && (
                        <div>
                          {checklistPhotoPreviews[field.key] ? (
                            <div className="relative inline-block">
                              <img
                                src={checklistPhotoPreviews[field.key]}
                                alt={field.label}
                                className="w-24 h-24 object-cover rounded-lg border border-[#333]"
                              />
                              <button
                                type="button"
                                onClick={() => removeChecklistPhoto(field.key)}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <label className="flex items-center gap-2 min-h-[44px] px-4 py-2 bg-[#1a1a1a] border border-dashed border-[#333] rounded-lg text-neutral-400 hover:text-white hover:border-[#fa432a] cursor-pointer transition-colors w-fit">
                              <Camera className="w-5 h-5" />
                              <span className="text-sm">Foto aufnehmen</span>
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={(e) =>
                                  handleChecklistPhotoSelect(field.key, e)
                                }
                                className="hidden"
                              />
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* No fields state */}
          {selectedTemplate && selectedTemplate.fields.length === 0 && (
            <p className="text-sm text-neutral-500 py-2">
              Diese Vorlage hat keine Felder.
            </p>
          )}

          {!selectedTemplateId && templates.length > 0 && (
            <p className="text-sm text-neutral-500 py-2">
              Wahlen Sie eine Vorlage, um die Checkliste auszufullen.
            </p>
          )}

          {!selectedTemplateId && templates.length === 0 && !loadingTemplates && (
            <p className="text-sm text-neutral-500 py-2">
              Keine Vorlagen fur dieses Gewerk vorhanden.
            </p>
          )}
        </section>
      )}

      {/* Section 3: Details */}
      <section className="bg-[#111] border border-[#1a1a1a] rounded-xl p-5 space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#fa432a]" />
          Details
        </h2>

        {/* Beschreibung */}
        <div>
          <label className="block text-sm text-neutral-400 mb-1">Beschreibung</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Beschreiben Sie was gemacht werden soll..."
            rows={4}
            className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded-lg text-white placeholder:text-neutral-500 focus:border-[#fa432a] focus:ring-1 focus:ring-[#fa432a] outline-none transition-colors resize-y"
          />
        </div>

        {/* Standort-Notizen */}
        <div>
          <label className="block text-sm text-neutral-400 mb-1 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            Standort-Notizen
          </label>
          <textarea
            value={locationNotes}
            onChange={(e) => setLocationNotes(e.target.value)}
            placeholder="z.B. Erdgeschoss, linke Seite, hinter der Kuche"
            rows={2}
            className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded-lg text-white placeholder:text-neutral-500 focus:border-[#fa432a] focus:ring-1 focus:ring-[#fa432a] outline-none transition-colors resize-y"
          />
        </div>

        {/* Dringlichkeit */}
        <div>
          <label className="block text-sm text-neutral-400 mb-1">Dringlichkeit</label>
          <select
            value={urgency}
            onChange={(e) => setUrgency(e.target.value)}
            className="w-full min-h-[44px] px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded-lg text-white focus:border-[#fa432a] focus:ring-1 focus:ring-[#fa432a] outline-none transition-colors"
          >
            {Object.entries(URGENCY_MAP).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Section 4: Fotos */}
      <section className="bg-[#111] border border-[#1a1a1a] rounded-xl p-5 space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Camera className="w-5 h-5 text-[#fa432a]" />
          Fotos
        </h2>

        {/* Photo previews */}
        {photoPreviews.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {photoPreviews.map((src, i) => (
              <div key={i} className="relative aspect-square">
                <img
                  src={src}
                  alt={`Foto ${i + 1}`}
                  className="w-full h-full object-cover rounded-lg border border-[#333]"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Upload progress */}
        {uploadProgress > 0 && uploadProgress < 100 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span>Fotos werden hochgeladen...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#fa432a] rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Camera / file button */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 min-h-[52px] px-4 py-3 bg-[#1a1a1a] border border-dashed border-[#333] rounded-lg text-neutral-400 hover:text-white hover:border-[#fa432a] transition-colors"
          >
            <ImagePlus className="w-5 h-5" />
            <span className="text-sm font-medium">Fotos hinzufugen</span>
          </button>
        </div>

        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handlePhotoSelect}
          className="hidden"
        />

        {photoPreviews.length > 0 && (
          <p className="text-xs text-neutral-500">
            {photoPreviews.length} Foto{photoPreviews.length !== 1 ? "s" : ""}{" "}
            ausgewahlt. Fotos werden beim Speichern hochgeladen.
          </p>
        )}
      </section>

      {/* Section 5: Empfanger */}
      <section className="bg-[#111] border border-[#1a1a1a] rounded-xl p-5 space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-[#fa432a]" />
          Empfanger
        </h2>

        {/* Modus */}
        <div>
          <label className="block text-sm text-neutral-400 mb-2">Modus</label>
          <div className="flex gap-3">
            <label
              className={`flex-1 flex items-center gap-3 min-h-[44px] px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                mode === "direct"
                  ? "bg-[#fa432a]/10 border-[#fa432a] text-white"
                  : "bg-[#1a1a1a] border-[#333] text-neutral-400 hover:text-white"
              }`}
            >
              <input
                type="radio"
                name="mode"
                value="direct"
                checked={mode === "direct"}
                onChange={() => {
                  setMode("direct");
                  setSelectedPartnerIds([]);
                }}
                className="hidden"
              />
              <User className="w-5 h-5 shrink-0" />
              <div>
                <div className="text-sm font-medium">Einzelanfrage</div>
                <div className="text-xs text-neutral-500">An einen Partner</div>
              </div>
            </label>
            <label
              className={`flex-1 flex items-center gap-3 min-h-[44px] px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                mode === "tender"
                  ? "bg-[#fa432a]/10 border-[#fa432a] text-white"
                  : "bg-[#1a1a1a] border-[#333] text-neutral-400 hover:text-white"
              }`}
            >
              <input
                type="radio"
                name="mode"
                value="tender"
                checked={mode === "tender"}
                onChange={() => {
                  setMode("tender");
                  setSelectedPartnerIds([]);
                }}
                className="hidden"
              />
              <Users className="w-5 h-5 shrink-0" />
              <div>
                <div className="text-sm font-medium">Ausschreibung</div>
                <div className="text-xs text-neutral-500">An mehrere Partner</div>
              </div>
            </label>
          </div>
        </div>

        {/* Partner selection */}
        <div>
          <label className="block text-sm text-neutral-400 mb-1">Empfanger</label>
          {!selectedTrade ? (
            <p className="text-sm text-neutral-500 py-2">
              Wahlen Sie zuerst ein Gewerk aus, um Partner anzuzeigen.
            </p>
          ) : loadingPartners ? (
            <div className="flex items-center gap-2 text-neutral-500 text-sm py-2">
              <Spinner className="w-4 h-4" />
              Partner werden geladen...
            </div>
          ) : partners.length === 0 ? (
            <p className="text-sm text-neutral-500 py-2">
              Keine aktiven Partner fur dieses Gewerk gefunden.
            </p>
          ) : mode === "direct" ? (
            // Single select dropdown
            <select
              value={selectedPartnerIds[0] || ""}
              onChange={(e) =>
                setSelectedPartnerIds(e.target.value ? [e.target.value] : [])
              }
              className="w-full min-h-[44px] px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded-lg text-white focus:border-[#fa432a] focus:ring-1 focus:ring-[#fa432a] outline-none transition-colors"
            >
              <option value="">Partner auswahlen...</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.company_name}
                </option>
              ))}
            </select>
          ) : (
            // Multi-select checkbox list
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {partners.map((p) => (
                <label
                  key={p.id}
                  className={`flex items-center gap-3 min-h-[44px] px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                    selectedPartnerIds.includes(p.id)
                      ? "bg-[#fa432a]/10 border-[#fa432a]/50 text-white"
                      : "bg-[#1a1a1a] border-[#333] text-neutral-300 hover:text-white hover:border-[#444]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedPartnerIds.includes(p.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPartnerIds((prev) => [...prev, p.id]);
                      } else {
                        setSelectedPartnerIds((prev) =>
                          prev.filter((id) => id !== p.id)
                        );
                      }
                    }}
                    className="w-5 h-5 rounded border-[#333] bg-[#1a1a1a] text-[#fa432a] focus:ring-[#fa432a]"
                  />
                  <span className="text-sm">{p.company_name}</span>
                </label>
              ))}
            </div>
          )}

          {selectedPartnerIds.length > 0 && mode === "tender" && (
            <p className="text-xs text-neutral-500 mt-2">
              {selectedPartnerIds.length} Partner ausgewahlt
            </p>
          )}
        </div>
      </section>

      {/* Sticky bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a]/95 backdrop-blur-sm border-t border-[#1a1a1a] px-4 py-3 z-50 sm:relative sm:bg-transparent sm:border-0 sm:px-0 sm:py-0 sm:backdrop-blur-none">
        <div className="max-w-2xl mx-auto flex gap-3">
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 min-h-[48px] px-4 py-3 bg-[#1a1a1a] hover:bg-[#222] text-neutral-300 border border-[#333] rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Spinner className="w-5 h-5" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            <span className="text-sm">Als Entwurf speichern</span>
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 min-h-[48px] px-4 py-3 bg-[#fa432a] hover:bg-[#e03820] text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <Spinner className="w-5 h-5" />
            ) : (
              <Send className="w-5 h-5" />
            )}
            <span className="text-sm">Absenden</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CreateInquiryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Spinner />
        </div>
      }
    >
      <CreateInquiryContent />
    </Suspense>
  );
}
