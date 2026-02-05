import { createClient } from "@/lib/supabase/server";
import { ProjectsListClient } from "@/components/projects-list-client";

// Partial customer type for dropdown selections
type CustomerOption = Pick<Customer, "id" | "company_name" | "first_name" | "last_name">;
import type { Customer } from "@/types/database";

export default async function ProjectsPage() {
  const supabase = await createClient();

  const { data: brands } = await supabase
    .from("projects")
    .select("*")
    .is("parent_id", null)
    .order("sort_order", { ascending: true });

  const { data: customers } = await supabase
    .from("customers")
    .select("id, company_name, first_name, last_name")
    .eq("status", "active")
    .order("company_name");

  return (
    <ProjectsListClient
      initialBrands={brands || []}
      initialCustomers={(customers as CustomerOption[]) || []}
    />
  );
}
