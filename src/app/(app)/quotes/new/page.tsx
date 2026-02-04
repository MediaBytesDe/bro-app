"use client";

import { useSearchParams } from "next/navigation";
import { QuoteEditor } from "@/components/quote-editor";

export default function NewQuotePage() {
  const searchParams = useSearchParams();
  const templateId = searchParams.get("template") || undefined;
  const projectId = searchParams.get("project") || undefined;
  const customerId = searchParams.get("customer") || undefined;

  return <QuoteEditor templateId={templateId} initialProjectId={projectId} initialCustomerId={customerId} />;
}
