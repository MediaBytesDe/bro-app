"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import {
  Package,
  Plus,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface MaterialRequest {
  id: string;
  title: string;
  description: string;
  items: { name: string; quantity: string; unit: string }[];
  urgency: string;
  status: string;
  needed_by: string | null;
  notes: string | null;
  admin_notes: string | null;
  delivery_address: string | null;
  created_at: string;
  project?: { name: string } | null;
  job?: { title: string } | null;
  requester?: { display_name: string } | null;
}

const urgencyConfig: Record<string, { label: string; class: string; icon: any }> = {
  low: { label: "Niedrig", class: "text-neutral-400 bg-neutral-500/20", icon: Clock },
  normal: { label: "Normal", class: "text-blue-400 bg-blue-500/20", icon: Clock },
  high: { label: "Hoch", class: "text-orange-400 bg-orange-500/20", icon: AlertTriangle },
  urgent: { label: "Dringend", class: "text-red-400 bg-red-500/20", icon: AlertTriangle },
};

const statusConfig: Record<string, { label: string; class: string; icon: any }> = {
  requested: { label: "Angefragt", class: "text-yellow-400 bg-yellow-500/20", icon: Clock },
  approved: { label: "Genehmigt", class: "text-blue-400 bg-blue-500/20", icon: CheckCircle },
  ordered: { label: "Bestellt", class: "text-orange-400 bg-orange-500/20", icon: Truck },
  delivered: { label: "Geliefert", class: "text-green-400 bg-green-500/20", icon: CheckCircle },
  declined: { label: "Abgelehnt", class: "text-red-400 bg-red-500/20", icon: XCircle },
};

export default function MaterialRequestsPage() {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [partnerUser, setPartnerUser] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    items: [{ name: "", quantity: "", unit: "Stk" }] as { name: string; quantity: string; unit: string }[],
    urgency: "normal",
    projectId: "",
    jobId: "",
    neededBy: "",
    deliveryAddress: "",
    notes: "",
  });

  const supabase = createClient();

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: pu } = await supabase
        .from("partner_users")
        .select("*, partner:partners(*)")
        .eq("auth_user_id", user.id)
        .single();

      if (!pu) { setLoading(false); return; }
      setPartnerUser(pu);

      // Load material requests
      const { data: reqs } = await supabase
        .from("partner_material_requests")
        .select(`
          *,
          project:projects (name),
          job:partner_jobs (title),
          requester:partner_users!requested_by (display_name)
        `)
        .eq("partner_id", pu.partner_id)
        .order("created_at", { ascending: false });

      setRequests(reqs || []);

      // Load projects from accepted jobs
      const { data: jobsData } = await supabase
        .from("partner_jobs")
        .select("id, title, project:projects (id, name)")
        .eq("accepted_by_partner_id", pu.partner_id)
        .in("status", ["accepted", "in_progress"]);

      setJobs(jobsData || []);
      const uniqueProjects = Array.from(
        new Map((jobsData || []).map(j => [j.project?.id, j.project]).filter(p => p[1])).values()
      );
      setProjects(uniqueProjects);
    } catch (err) {
      console.error("Error loading material requests:", err);
    } finally {
      setLoading(false);
    }
  }

  function addItem() {
    setForm({ ...form, items: [...form.items, { name: "", quantity: "", unit: "Stk" }] });
  }

  function removeItem(index: number) {
    if (form.items.length <= 1) return;
    setForm({ ...form, items: form.items.filter((_, i) => i !== index) });
  }

  function updateItem(index: number, field: string, value: string) {
    const items = [...form.items];
    (items[index] as any)[field] = value;
    setForm({ ...form, items });
  }

  async function submitRequest() {
    if (!form.title.trim()) {
      toast.error("Bitte Titel angeben");
      return;
    }
    if (form.items.every(i => !i.name.trim())) {
      toast.error("Mindestens ein Material angeben");
      return;
    }

    setSubmitting(true);

    const { error } = await supabase
      .from("partner_material_requests")
      .insert({
        partner_id: partnerUser.partner_id,
        requested_by: partnerUser.id,
        title: form.title,
        description: form.description || null,
        items: form.items.filter(i => i.name.trim()),
        urgency: form.urgency,
        project_id: form.projectId || null,
        job_id: form.jobId || null,
        needed_by: form.neededBy || null,
        delivery_address: form.deliveryAddress || null,
        notes: form.notes || null,
      });

    if (error) {
      toast.error("Fehler beim Speichern");
      console.error(error);
    } else {
      toast.success("Material-Anforderung erstellt");
      setShowForm(false);
      setForm({
        title: "", description: "",
        items: [{ name: "", quantity: "", unit: "Stk" }],
        urgency: "normal", projectId: "", jobId: "",
        neededBy: "", deliveryAddress: "", notes: "",
      });
      loadData();
    }

    setSubmitting(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Spinner /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Package className="w-7 h-7 text-[#fa432a]" />
            Material-Anforderungen
          </h1>
          <p className="text-neutral-400 mt-1">Material bei BROjekt anfordern</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Neue Anforderung
        </button>
      </div>

      {/* List */}
      {requests.length === 0 ? (
        <div className="card p-12 text-center">
          <Package className="w-16 h-16 mx-auto text-neutral-600 mb-4" />
          <p className="text-neutral-400 text-lg">Keine Material-Anforderungen</p>
          <p className="text-neutral-500 text-sm mt-1">
            Erstellen Sie eine neue Anforderung für benötigtes Material
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const status = statusConfig[req.status] || statusConfig.requested;
            const urgency = urgencyConfig[req.urgency] || urgencyConfig.normal;
            const StatusIcon = status.icon;
            const isExpanded = expandedId === req.id;

            return (
              <div key={req.id} className="card overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : req.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-[#111] transition-colors text-left"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <span className={`text-xs px-2 py-1 rounded inline-flex items-center gap-1 ${status.class}`}>
                      <StatusIcon className="w-3 h-3" />
                      {status.label}
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-medium text-white truncate">{req.title}</h3>
                      <p className="text-xs text-neutral-500">
                        {req.project?.name || "Kein Projekt"} · {formatDate(req.created_at)}
                        {req.needed_by && ` · Benötigt bis ${formatDate(req.needed_by)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className={`text-xs px-2 py-0.5 rounded ${urgency.class}`}>
                      {urgency.label}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-neutral-500" /> : <ChevronDown className="w-4 h-4 text-neutral-500" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-neutral-800 pt-4 space-y-4">
                    {req.description && (
                      <p className="text-neutral-300 text-sm">{req.description}</p>
                    )}

                    {/* Items */}
                    <div>
                      <h4 className="text-xs text-neutral-500 uppercase mb-2">Material-Liste</h4>
                      <div className="bg-[#111] rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-neutral-800">
                              <th className="text-left py-2 px-3 text-neutral-500 font-medium">Material</th>
                              <th className="text-right py-2 px-3 text-neutral-500 font-medium w-24">Menge</th>
                              <th className="text-left py-2 px-3 text-neutral-500 font-medium w-20">Einheit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(req.items || []).map((item: any, i: number) => (
                              <tr key={i} className="border-b border-neutral-800/50">
                                <td className="py-2 px-3 text-white">{item.name}</td>
                                <td className="py-2 px-3 text-neutral-300 text-right">{item.quantity}</td>
                                <td className="py-2 px-3 text-neutral-400">{item.unit}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {req.delivery_address && (
                        <div>
                          <span className="text-neutral-500">Lieferadresse:</span>
                          <p className="text-neutral-300 mt-0.5">{req.delivery_address}</p>
                        </div>
                      )}
                      {req.notes && (
                        <div>
                          <span className="text-neutral-500">Anmerkungen:</span>
                          <p className="text-neutral-300 mt-0.5">{req.notes}</p>
                        </div>
                      )}
                      {req.admin_notes && (
                        <div className="col-span-2 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                          <span className="text-blue-400 text-xs font-medium">Antwort von BROjekt:</span>
                          <p className="text-neutral-300 mt-1">{req.admin_notes}</p>
                        </div>
                      )}
                    </div>

                    <p className="text-xs text-neutral-600">
                      Erstellt von {req.requester?.display_name || "–"} am {formatDate(req.created_at)}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Request Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="card p-6 w-full max-w-lg my-8">
            <h2 className="text-xl font-bold text-white mb-4">Neue Material-Anforderung</h2>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Titel *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="input w-full"
                  placeholder="z.B. Montagematerial Solar-Anlage"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Beschreibung</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="input w-full"
                  rows={2}
                  placeholder="Wofür wird das Material benötigt?"
                />
              </div>

              {/* Items */}
              <div>
                <label className="block text-sm text-neutral-400 mb-2">Material-Liste *</label>
                {form.items.map((item, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItem(i, "name", e.target.value)}
                      className="input flex-1"
                      placeholder="Material"
                    />
                    <input
                      type="text"
                      value={item.quantity}
                      onChange={(e) => updateItem(i, "quantity", e.target.value)}
                      className="input w-20"
                      placeholder="Menge"
                    />
                    <select
                      value={item.unit}
                      onChange={(e) => updateItem(i, "unit", e.target.value)}
                      className="input w-20"
                    >
                      <option value="Stk">Stk</option>
                      <option value="m">m</option>
                      <option value="m²">m²</option>
                      <option value="kg">kg</option>
                      <option value="l">l</option>
                      <option value="Pkt">Pkt</option>
                      <option value="Satz">Satz</option>
                    </select>
                    {form.items.length > 1 && (
                      <button
                        onClick={() => removeItem(i)}
                        className="p-2 text-neutral-500 hover:text-red-400"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addItem}
                  className="text-sm text-[#fa432a] hover:underline"
                >
                  + Weiteres Material
                </button>
              </div>

              {/* Urgency + Needed By */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Dringlichkeit</label>
                  <select
                    value={form.urgency}
                    onChange={(e) => setForm({ ...form, urgency: e.target.value })}
                    className="input w-full"
                  >
                    <option value="low">Niedrig</option>
                    <option value="normal">Normal</option>
                    <option value="high">Hoch</option>
                    <option value="urgent">Dringend</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Benötigt bis</label>
                  <input
                    type="date"
                    value={form.neededBy}
                    onChange={(e) => setForm({ ...form, neededBy: e.target.value })}
                    className="input w-full"
                  />
                </div>
              </div>

              {/* Project + Job */}
              <div className="grid grid-cols-2 gap-4">
                {projects.length > 0 && (
                  <div>
                    <label className="block text-sm text-neutral-400 mb-1">Projekt</label>
                    <select
                      value={form.projectId}
                      onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                      className="input w-full"
                    >
                      <option value="">–</option>
                      {projects.map((p: any) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {jobs.length > 0 && (
                  <div>
                    <label className="block text-sm text-neutral-400 mb-1">Auftrag</label>
                    <select
                      value={form.jobId}
                      onChange={(e) => setForm({ ...form, jobId: e.target.value })}
                      className="input w-full"
                    >
                      <option value="">–</option>
                      {jobs.map((j: any) => (
                        <option key={j.id} value={j.id}>{j.title}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Delivery Address */}
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Lieferadresse (optional)</label>
                <input
                  type="text"
                  value={form.deliveryAddress}
                  onChange={(e) => setForm({ ...form, deliveryAddress: e.target.value })}
                  className="input w-full"
                  placeholder="Falls abweichend von Baustelle"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Anmerkungen</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="input w-full"
                  rows={2}
                  placeholder="Besondere Anforderungen, Alternativen..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">
                Abbrechen
              </button>
              <button
                onClick={submitRequest}
                disabled={submitting}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {submitting ? <Spinner className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                Anfordern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
