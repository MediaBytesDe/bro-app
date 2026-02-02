import { WorkfolderDetail } from "@/components/workfolder-detail";
import { WorkfolderList } from "@/components/workfolder-list";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!project) {
    notFound();
  }

  // Arbeitsmappe (hat parent_id) → WorkfolderDetail (Kunde, Termine, etc.)
  // Top-Level/Marke (kein parent_id) → WorkfolderList (Liste der Arbeitsmappen)
  if (project.parent_id) {
    return <WorkfolderDetail project={project} />;
  }

  return <WorkfolderList brand={project} />;
}
