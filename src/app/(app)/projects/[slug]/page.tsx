"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { WorkfolderDetail } from "@/components/workfolder-detail";
import { WorkfolderList } from "@/components/workfolder-list";
import { Spinner } from "@/components/ui/spinner";

export default function ProjectPage() {
  const { slug } = useParams<{ slug: string }>();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("projects")
      .select("*")
      .eq("slug", slug)
      .single()
      .then(({ data }) => {
        if (!data) {
          setNotFound(true);
        } else {
          setProject(data);
        }
        setLoading(false);
      });
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Spinner />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-neutral-500">
        Projekt nicht gefunden
      </div>
    );
  }

  if (project.parent_id) {
    return <WorkfolderDetail project={project} />;
  }

  return <WorkfolderList brand={project} />;
}
