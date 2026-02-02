import { LeadDetail } from "@/components/lead-detail";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LeadDetailPage({ params }: Props) {
  const { id } = await params;
  return <LeadDetail leadId={id} />;
}
