import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FolderOpen, Calendar, Briefcase } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface PageProps {
  searchParams: Promise<{ impersonate?: string }>;
}

export default async function CustomerProjectsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const impersonateId = params.impersonate;
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect("/login");
  }

  // Get user profile to check if admin
  const { data: profile } = await adminSupabase
    .from("users")
    .select("role")
    .eq("auth_id", user.id)
    .single();

  const isAdmin = profile?.role === "admin" || profile?.role === "superadmin";
  const isImpersonating = isAdmin && !!impersonateId;

  let customerId: string | null = null;

  if (isImpersonating) {
    // Admin impersonating - use the impersonate ID
    customerId = impersonateId!;
  } else {
    // Normal customer - find their own record
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
    customerId = customer.id;
  }

  // Load all projects for this customer
  const { data: projects, error: projectsError } = await adminSupabase
    .from("projects")
    .select(`
      id, name, slug, icon, description, workfolder_status, created_at
    `)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (projectsError) {
    console.error("[CustomerProjects] Error loading projects:", projectsError);
  }

  // Build impersonate query string for links
  const impersonateQuery = isImpersonating ? `?impersonate=${customerId}` : "";

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
          <h3 className="text-lg font-medium text-white mb-2">Noch keine Projekte</h3>
          <p className="text-neutral-400">
            Sobald Sie ein Projekt bei uns haben, erscheint es hier.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/portal/projekte/${project.slug}${impersonateQuery}`}
              className="card p-5 flex items-start gap-4 hover:bg-[#151515] transition-colors group"
            >
              <div className="w-12 h-12 rounded-xl bg-[#fa432a]/10 flex items-center justify-center flex-shrink-0">
                <Briefcase className="w-6 h-6 text-[#fa432a]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-semibold text-white group-hover:text-[#fa432a] transition-colors truncate">
                    {project.name}
                  </h3>
                  <StatusBadge status={project.workfolder_status} />
                </div>
                {project.description && (
                  <p className="text-sm text-neutral-400 line-clamp-2 mb-2">
                    {project.description}
                  </p>
                )}
                <div className="flex items-center gap-4 text-xs text-neutral-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Erstellt: {formatDate(project.created_at)}
                  </span>
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
    <span className={`text-xs px-2 py-0.5 rounded ${info.class}`}>
      {info.label}
    </span>
  );
}
