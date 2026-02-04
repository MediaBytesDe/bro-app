"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, Loader2, CheckCircle, AlertCircle, Box, FileUp, Cog, CloudUpload, Check } from "lucide-react";

interface Upload3DModelProps {
  projectId: string;
  onSuccess?: (document: any) => void;
}

type UploadStep = "idle" | "uploading" | "converting" | "saving" | "done" | "error";

const steps = [
  { key: "uploading", label: "Datei wird hochgeladen", icon: FileUp },
  { key: "converting", label: "OBJ → GLB konvertieren", icon: Cog },
  { key: "saving", label: "In Cloud speichern", icon: CloudUpload },
  { key: "done", label: "Fertig!", icon: Check },
];

export function Upload3DModel({ projectId, onSuccess }: Upload3DModelProps) {
  const [currentStep, setCurrentStep] = useState<UploadStep>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mtlInputRef = useRef<HTMLInputElement>(null);
  const textureInputRef = useRef<HTMLInputElement>(null);

  const [objFile, setObjFile] = useState<File | null>(null);
  const [mtlFile, setMtlFile] = useState<File | null>(null);
  const [textureFiles, setTextureFiles] = useState<File[]>([]);

  // Simuliere Fortschritt während Konvertierung
  useEffect(() => {
    if (currentStep === "converting") {
      const interval = setInterval(() => {
        setProgress(p => Math.min(p + Math.random() * 15, 90));
      }, 500);
      return () => clearInterval(interval);
    }
  }, [currentStep]);

  const handleUpload = async () => {
    if (!objFile) return;

    setCurrentStep("uploading");
    setErrorMessage("");
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", objFile);
      formData.append("project_id", projectId);
      
      if (mtlFile) {
        formData.append("mtl", mtlFile);
      }
      
      textureFiles.forEach((tex) => {
        formData.append("textures", tex);
      });

      // Step 1: Upload started
      setProgress(10);
      console.log("[3D Upload] Starting upload...", { 
        fileName: objFile.name, 
        fileSize: objFile.size,
        projectId 
      });
      
      // Step 2: Converting
      setTimeout(() => setCurrentStep("converting"), 300);

      console.log("[3D Upload] Calling API with XMLHttpRequest for progress...");
      
      // Use XMLHttpRequest for upload progress
      const xhr = new XMLHttpRequest();
      const response = await new Promise<Response>((resolve, reject) => {
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const uploadProgress = Math.round((e.loaded / e.total) * 50); // 0-50% for upload
            setProgress(uploadProgress);
            console.log(`[3D Upload] Upload progress: ${uploadProgress}% (${(e.loaded/1024/1024).toFixed(1)}MB / ${(e.total/1024/1024).toFixed(1)}MB)`);
          }
        });
        
        xhr.addEventListener("load", () => {
          console.log("[3D Upload] Upload complete, status:", xhr.status);
          resolve(new Response(xhr.responseText, { status: xhr.status }));
        });
        
        xhr.addEventListener("error", () => {
          console.error("[3D Upload] XHR error");
          reject(new Error("Netzwerkfehler beim Upload"));
        });
        
        xhr.addEventListener("timeout", () => {
          console.error("[3D Upload] XHR timeout");
          reject(new Error("Upload Timeout - Datei zu groß?"));
        });
        
        xhr.open("POST", "/api/convert/obj-to-glb");
        xhr.timeout = 300000; // 5 minutes
        xhr.send(formData);
      });
      
      console.log("[3D Upload] API response status:", response.status);

      // Step 3: Saving
      setCurrentStep("saving");
      setProgress(95);

      const data = await response.json();
      console.log("[3D Upload] API response data:", data);

      if (!response.ok) {
        throw new Error(data.error || "Upload fehlgeschlagen");
      }

      // Step 4: Done
      setProgress(100);
      setCurrentStep("done");
      
      // Reset after 3 seconds
      setTimeout(() => {
        setObjFile(null);
        setMtlFile(null);
        setTextureFiles([]);
        setCurrentStep("idle");
        setProgress(0);
        if (onSuccess) {
          onSuccess(data.document);
        }
      }, 2000);
      
    } catch (error: any) {
      console.error("[3D Upload] Error:", error);
      setCurrentStep("error");
      setErrorMessage(error.message || "Fehler beim Upload");
    }
  };

  const isProcessing = ["uploading", "converting", "saving"].includes(currentStep);

  return (
    <div className="border border-dashed border-neutral-700 rounded-xl p-6 bg-[#0a0a0a]">
      <div className="text-center mb-4">
        <Box className="w-10 h-10 mx-auto text-cyan-400 mb-2" />
        <h3 className="font-medium text-white">3D-Modell hochladen</h3>
        <p className="text-sm text-neutral-500">OBJ-Datei wird automatisch zu GLB konvertiert</p>
      </div>

      <div className="space-y-3">
        {/* OBJ File */}
        <div>
          <label className="block text-xs text-neutral-400 mb-1">OBJ-Datei *</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".obj"
            onChange={(e) => setObjFile(e.target.files?.[0] || null)}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`w-full p-3 rounded-lg border text-left text-sm transition-colors ${
              objFile 
                ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-400" 
                : "border-neutral-700 bg-[#111] text-neutral-400 hover:border-neutral-600"
            }`}
          >
            {objFile ? objFile.name : "OBJ-Datei auswählen..."}
          </button>
        </div>

        {/* MTL File (optional) */}
        <div>
          <label className="block text-xs text-neutral-400 mb-1">MTL-Datei (optional)</label>
          <input
            ref={mtlInputRef}
            type="file"
            accept=".mtl"
            onChange={(e) => setMtlFile(e.target.files?.[0] || null)}
            className="hidden"
          />
          <button
            onClick={() => mtlInputRef.current?.click()}
            className={`w-full p-3 rounded-lg border text-left text-sm transition-colors ${
              mtlFile 
                ? "border-green-500/50 bg-green-500/10 text-green-400" 
                : "border-neutral-700 bg-[#111] text-neutral-400 hover:border-neutral-600"
            }`}
          >
            {mtlFile ? mtlFile.name : "MTL-Datei auswählen (Materialien)..."}
          </button>
        </div>

        {/* Textures (optional) */}
        <div>
          <label className="block text-xs text-neutral-400 mb-1">Texturen (optional)</label>
          <input
            ref={textureInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setTextureFiles(Array.from(e.target.files || []))}
            className="hidden"
          />
          <button
            onClick={() => textureInputRef.current?.click()}
            className={`w-full p-3 rounded-lg border text-left text-sm transition-colors ${
              textureFiles.length > 0 
                ? "border-purple-500/50 bg-purple-500/10 text-purple-400" 
                : "border-neutral-700 bg-[#111] text-neutral-400 hover:border-neutral-600"
            }`}
          >
            {textureFiles.length > 0 
              ? `${textureFiles.length} Textur${textureFiles.length > 1 ? "en" : ""} ausgewählt` 
              : "Texturen auswählen (Bilder)..."}
          </button>
        </div>
      </div>

      {/* Progress Steps */}
      {isProcessing && (
        <div className="mt-4 space-y-3">
          {/* Progress Bar */}
          <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Steps */}
          <div className="grid grid-cols-4 gap-2">
            {steps.map((step, idx) => {
              const stepIndex = steps.findIndex(s => s.key === currentStep);
              const isActive = step.key === currentStep;
              const isDone = idx < stepIndex || currentStep === "done";
              const Icon = step.icon;
              
              return (
                <div 
                  key={step.key}
                  className={`flex flex-col items-center text-center p-2 rounded-lg transition-all ${
                    isActive ? "bg-cyan-500/20" : isDone ? "bg-green-500/10" : "opacity-40"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${
                    isActive ? "bg-cyan-500 text-white" : isDone ? "bg-green-500 text-white" : "bg-neutral-700 text-neutral-400"
                  }`}>
                    {isActive ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isDone ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>
                  <span className={`text-xs ${isActive ? "text-cyan-400" : isDone ? "text-green-400" : "text-neutral-500"}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Success Message */}
      {currentStep === "done" && (
        <div className="mt-4 p-4 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center gap-3">
          <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0" />
          <div>
            <p className="text-green-400 font-medium">3D-Modell erfolgreich hochgeladen!</p>
            <p className="text-green-400/70 text-sm">Das Modell ist jetzt im Kundenportal sichtbar.</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {currentStep === "error" && (
        <div className="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
          <div>
            <p className="text-red-400 font-medium">Fehler beim Upload</p>
            <p className="text-red-400/70 text-sm">{errorMessage}</p>
          </div>
          <button
            onClick={() => { setCurrentStep("idle"); setErrorMessage(""); }}
            className="ml-auto text-sm text-red-400 hover:text-red-300"
          >
            Erneut versuchen
          </button>
        </div>
      )}

      {/* Upload Button */}
      {currentStep === "idle" && (
        <button
          onClick={handleUpload}
          disabled={!objFile}
          className="w-full mt-4 py-3 px-4 bg-cyan-600 hover:bg-cyan-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          <Upload className="w-4 h-4" />
          3D-Modell hochladen
        </button>
      )}
    </div>
  );
}
