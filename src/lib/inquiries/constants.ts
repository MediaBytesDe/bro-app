export const INQUIRY_STATUS_MAP: Record<string, { label: string; class: string }> = {
  draft: { label: "Entwurf", class: "bg-neutral-500/20 text-neutral-400" },
  sent: { label: "Gesendet", class: "bg-blue-500/20 text-blue-400" },
  in_review: { label: "In Prüfung", class: "bg-yellow-500/20 text-yellow-400" },
  answered: { label: "Beantwortet", class: "bg-[#fa432a]/20 text-[#fa432a]" },
  accepted: { label: "Akzeptiert", class: "bg-green-500/20 text-green-400" },
  declined: { label: "Abgelehnt", class: "bg-red-500/20 text-red-400" },
  closed: { label: "Abgeschlossen", class: "bg-neutral-500/20 text-neutral-400" },
};

export const URGENCY_MAP: Record<string, { label: string; class: string }> = {
  low: { label: "Niedrig", class: "bg-neutral-500/20 text-neutral-400" },
  normal: { label: "Normal", class: "bg-blue-500/20 text-blue-400" },
  high: { label: "Hoch", class: "bg-orange-500/20 text-orange-400" },
  urgent: { label: "Dringend", class: "bg-red-500/20 text-red-400" },
};

export const RECIPIENT_STATUS_MAP: Record<string, { label: string; class: string }> = {
  pending: { label: "Ausstehend", class: "bg-neutral-500/20 text-neutral-400" },
  viewed: { label: "Gesehen", class: "bg-blue-500/20 text-blue-400" },
  responded: { label: "Beantwortet", class: "bg-green-500/20 text-green-400" },
  accepted: { label: "Ausgewählt", class: "bg-green-500/20 text-green-400" },
  declined: { label: "Abgelehnt", class: "bg-red-500/20 text-red-400" },
};

export const POSITION_CATEGORIES: Record<string, string> = {
  material: "Material",
  labor: "Arbeitszeit",
  travel: "Anfahrt",
  other: "Sonstiges",
};
