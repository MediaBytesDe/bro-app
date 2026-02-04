"use client";

import { useParams } from "next/navigation";
import { QuoteEditor } from "@/components/quote-editor";

export default function EditQuotePage() {
  const params = useParams();
  const id = params.id as string;
  
  return <QuoteEditor quoteId={id} />;
}
