import { NextRequest, NextResponse } from "next/server";

// Increase timeout for large file conversions
export const maxDuration = 300; // 5 minutes
export const dynamic = "force-dynamic";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { writeFile, readFile, unlink, mkdir, rmdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { spawn } from "child_process";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const tempDir = join(tmpdir(), `obj-convert-${randomUUID()}`);
  
  try {
    // Auth check - only authenticated users with admin/mitarbeiter role
    const authSupabase = await createServerClient();
    const { data: { user } } = await authSupabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await authSupabase
      .from("users")
      .select("role")
      .eq("auth_id", user.id)
      .single();

    if (!profile || !["admin", "mitarbeiter", "superadmin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const projectId = formData.get("project_id") as string;
    const mtlFile = formData.get("mtl") as File | null;
    const textureFiles = formData.getAll("textures") as File[];

    if (!file || !projectId) {
      return NextResponse.json(
        { error: "file and project_id required" },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith(".obj")) {
      return NextResponse.json(
        { error: "File must be .obj" },
        { status: 400 }
      );
    }

    // Create temp directory for this conversion
    await mkdir(tempDir, { recursive: true });

    // SECURITY: Use safe, generated filenames - never trust user input
    const safeObjName = `model-${randomUUID()}.obj`;
    const safeGlbName = `model-${randomUUID()}.glb`;
    const objPath = join(tempDir, safeObjName);
    const glbPath = join(tempDir, safeGlbName);
    
    // Store original filename for later (sanitized)
    const originalBaseName = file.name.replace(/\.obj$/i, "").replace(/[^a-zA-Z0-9_-]/g, "_");
    const glbFileName = `${originalBaseName}.glb`;

    const objBuffer = Buffer.from(await file.arrayBuffer());
    await writeFile(objPath, objBuffer);

    // Write MTL file if provided (with safe name)
    if (mtlFile) {
      // MTL files must keep relative reference - use expected name
      const safeMtlName = safeObjName.replace(".obj", ".mtl");
      const mtlPath = join(tempDir, safeMtlName);
      const mtlBuffer = Buffer.from(await mtlFile.arrayBuffer());
      await writeFile(mtlPath, mtlBuffer);
    }

    // Write texture files if provided (sanitize names)
    for (const tex of textureFiles) {
      // Keep original texture names as they're referenced in MTL
      const safeName = tex.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const texPath = join(tempDir, safeName);
      const texBuffer = Buffer.from(await tex.arrayBuffer());
      await writeFile(texPath, texBuffer);
    }

    // SECURITY: Use spawn instead of exec - no shell injection possible
    const obj2gltfBin = join(process.cwd(), "node_modules", ".bin", "obj2gltf");
    
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(obj2gltfBin, ["-i", objPath, "-o", glbPath, "--binary"], {
        cwd: process.cwd(),
        timeout: 180000, // 3 minute timeout
      });

      let stderr = "";
      proc.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      const timeout = setTimeout(() => {
        proc.kill("SIGKILL");
        reject(new Error("Konvertierung Timeout (3 Minuten)"));
      }, 180000);

      proc.on("close", (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Konvertierung fehlgeschlagen (Exit ${code}): ${stderr}`));
        }
      });

      proc.on("error", (err) => {
        clearTimeout(timeout);
        reject(new Error(`Prozess-Fehler: ${err.message}`));
      });
    });

    // Check if GLB file exists
    const { stat } = await import("fs/promises");
    try {
      await stat(glbPath);
    } catch {
      throw new Error("GLB-Datei wurde nicht erstellt. Konvertierung möglicherweise fehlgeschlagen.");
    }

    // Read the converted GLB file
    const glbBuffer = await readFile(glbPath);

    // Generate storage path
    const timestamp = Date.now();
    const storagePath = `projects/${projectId}/3d-models/${timestamp}-${glbFileName}`;

    // Upload GLB to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, glbBuffer, {
        contentType: "model/gltf-binary",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("documents")
      .getPublicUrl(storagePath);

    // Create document record
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .insert({
        project_id: projectId,
        name: glbFileName,
        file_name: glbFileName,
        storage_path: storagePath,
        storage_url: urlData.publicUrl,
        mime_type: "model/gltf-binary",
        file_size: glbBuffer.length,
        document_type: "sonstiges", // TODO: Add '3d_model' to enum
        visible_to_customer: true, // Show in customer portal
      })
      .select()
      .single();

    if (docError) {
      throw new Error(`Document record failed: ${docError.message}`);
    }

    return NextResponse.json({
      success: true,
      document: doc,
      url: urlData.publicUrl,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Conversion failed";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  } finally {
    // Cleanup temp directory
    try {
      const { readdir } = await import("fs/promises");
      const files = await readdir(tempDir);
      await Promise.all(files.map(f => unlink(join(tempDir, f)).catch(() => {})));
      await rmdir(tempDir).catch(() => {});
    } catch {}
  }
}
