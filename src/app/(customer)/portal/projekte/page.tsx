import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FolderOpen, Calendar } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default async function CustomerProjectsPage() {
  const supabase = await createClient();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect("/login");
  }

  // Find customer by auth_user_id using service role for admin access
  const adminSupabase = createAdminClient();

  const { data: customer, error: customerError } = await adminSupabase
    .from("customers")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (customerError || !customer) {
    console.error("[CustomerProjects] Customer not found:", customerError);
    return (
      <div className="card p-8 text-center">
        <p className="text-red-400">Kundenprofil nicht gefunden</p>
        <p className="text-neutral-500 text-sm mt-2">
          Bitte kontaktieren Sie uns, falls dieses Problem weiterhin besteht.
        </p>
      </div>
    );
  }

  // Load all projects for this customer
  const { data: projects, error: projectsError } = await adminSupabase
    .from("projects")
    .select(`
      id, name, slug, icon, description, workfolder_status, created_at
    `)
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false });

  if (projectsError) {
    console.error("[CustomerProjects] Error loading projects:", projectsError);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Meine Projekte</h1>
        <p className="text-neutral-400 mt-1">
          Übersicht aller Ihrer Projekte bei BROjekt
        </p>
      </div>

      {!projects || projects.length === 0 ? (
        <div className="card p-12 text-center">
          <FolderOpen className="w-16 h-16 mx-auto text-neutral-600 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Noch keine Projekte</h3>
          <p className="text-neutral-400">
            Sobald wir ein Projekt für Sie anlegen, erscheint es hier.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/portal/projekte/${project.slug}`}
              className="card p-5 hover:bg-[#1a1a1a] transition-colors group"
            >
              <div className="flex items-start gap-4">
                <div className="text-4xl">{project.icon || "📁"}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-lg font-semibold text-white group-hover:text-[#fa432a] transition-colors">
                      {project.name}
                    </h3>
                    <StatusBadge status={project.workfolder_status} />
                  </div>
                  
                  {project.description && (
                    <p className="text-neutral-400 text-sm mt-1 line-clamp-2">
                      {project.description}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-4 mt-3 text-xs text-neutral-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(project.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const statusMap: Record<string, { label: string; class: string }> = {
    "1. Neu": { label: "Neu", class: "bg-blue-500/20 text-blue-400" },
    "2. In Planung": { label: "In Planung", class: "bg-yellow-500/20 text-yellow-400" },
    "3. Material bestellt": { label: "Material bestellt", class: "bg-orange-500/20 text-orange-400" },
    "4. Montage geplant": { label: "Montage geplant", class: "bg-purple-500/20 text-purple-400" },
    "5. In Montage": { label: "In Montage", class: "bg-cyan-500/20 text-cyan-400" },
    "6. Abgeschlossen": { label: "Abgeschlossen", class: "bg-green-500/20 text-green-400" },
  };

  const info = statusMap[status || ""] || { label: status || "Offen", class: "bg-neutral-500/20 text-neutral-400" };

  return (
    <span className={`text-xs px-2 py-1 rounded whitespace-nowrap ${info.class}`}>
      {info.label}
    </span>
  );
}
