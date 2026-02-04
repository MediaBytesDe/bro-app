"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { getTradeOptions, getTradeLabel, loadTradesFromDB } from "@/lib/trades";
import {
  ChevronLeft,
  Mail,
  Phone,
  MapPin,
  Pencil,
  Trash2,
  Building2,
  Users,
  Briefcase,
  Plus,
  CheckCircle,
  XCircle,
  Wrench,
  UserPlus,
  Clock,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface Partner {
  id: string;
  company_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  trades: string[];
  active: boolean;
  notes: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

interface PartnerUser {
  id: string;
  display_name: string;
  email: string;
  phone: string | null;
  role: string;
  active: boolean;
  joined_at: string | null;
  created_at: string;
}

interface PartnerJob {
  id: string;
  title: string;
  status: string;
  trade: string | null;
  scheduled_date: string | null;
  project: {
    name: string;
    slug: string;
  } | null;
}

interface Props {
  params: Promise<{ id: string }>;
}

export default function PartnerDetailPage({ params }: Props) {
  const { id } = use(params);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [users, setUsers] = useState<PartnerUser[]>([]);
  const [jobs, setJobs] = useState<PartnerJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  
  const [editForm, setEditForm] = useState({
    company_name: "",
    email: "",
    phone: "",
    address: "",
    postal_code: "",
    city: "",
    trades: [] as string[],
    notes: "",
    active: true,
  });

  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "worker",
    password: "",
  });

  const router = useRouter();
  const supabase = createClient();
  const [tradeOptions, setTradeOptions] = useState(getTradeOptions());

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      // Trades aus DB laden (für Labels)
      await loadTradesFromDB(supabase, true);
      setTradeOptions(getTradeOptions());
      
      // Load partner
      const { data: partnerData } = await supabase
        .from("partners")
        .select("*")
        .eq("id", id)
        .single();

      if (partnerData) {
        setPartner({ ...partnerData, trades: partnerData.trades || [] });
        setEditForm({
          company_name: partnerData.company_name || "",
          email: partnerData.email || "",
          phone: partnerData.phone || "",
          address: partnerData.address || "",
          postal_code: partnerData.postal_code || "",
          city: partnerData.city || "",
          trades: partnerData.trades || [],
          notes: partnerData.notes || "",
          active: partnerData.active ?? true,
        });
      }

      // Load users
      const { data: usersData } = await supabase
        .from("partner_users")
        .select("*")
        .eq("partner_id", id)
        .order("created_at");

      setUsers(usersData || []);

      // Load jobs
      const { data: jobsData } = await supabase
        .from("partner_jobs")
        .select(`
          id, title, status, trade, scheduled_date,
          project:projects (name, slug)
        `)
        .eq("accepted_by_partner_id", id)
        .order("created_at", { ascending: false })
        .limit(10);

      setJobs(jobsData || []);
    } catch (err) {
      console.error("Error loading partner:", err);
    } finally {
      setLoading(false);
    }
  }

  function toggleTrade(trade: string) {
    setEditForm(prev => ({
      ...prev,
      trades: prev.trades.includes(trade)
        ? prev.trades.filter(t => t !== trade)
        : [...prev.trades, trade]
    }));
  }

  async function savePartner(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { error } = await supabase
      .from("partners")
      .update({
        company_name: editForm.company_name,
        email: editForm.email || null,
        phone: editForm.phone || null,
        address: editForm.address || null,
        postal_code: editForm.postal_code || null,
        city: editForm.city || null,
        trades: editForm.trades,
        notes: editForm.notes || null,
        active: editForm.active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      toast.error("Fehler beim Speichern");
    } else {
      toast.success("Gespeichert");
      setShowEdit(false);
      loadData();
    }

    setSaving(false);
  }

  async function deletePartner() {
    if (!confirm("Partner wirklich löschen? Alle Benutzer und Daten werden gelöscht.")) return;

    const { error } = await supabase.from("partners").delete().eq("id", id);

    if (error) {
      toast.error("Fehler beim Löschen");
    } else {
      toast.success("Partner gelöscht");
      router.push("/subcontractors");
    }
  }

  async function toggleActive() {
    const newStatus = !partner?.active;
    
    const { error } = await supabase
      .from("partners")
      .update({ active: newStatus })
      .eq("id", id);

    if (error) {
      toast.error("Fehler");
    } else {
      toast.success(newStatus ? "Aktiviert" : "Deaktiviert");
      loadData();
    }
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    if (!userForm.name || !userForm.email || !userForm.password) {
      toast.error("Name, E-Mail und Passwort erforderlich");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/partner/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          partnerId: id,
          name: userForm.name,
          email: userForm.email,
          phone: userForm.phone,
          role: userForm.role,
          password: userForm.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Fehler beim Erstellen");
      } else {
        toast.success("Benutzer erstellt");
        setShowAddUser(false);
        setUserForm({ name: "", email: "", phone: "", role: "worker", password: "" });
        loadData();
      }
    } catch {
      toast.error("Netzwerk-Fehler");
    }

    setSaving(false);
  }

  async function deleteUser(userId: string, userName: string) {
    if (!confirm(`${userName} wirklich löschen?`)) return;

    try {
      const res = await fetch("/api/partner/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          userId,
          partnerId: id,
        }),
      });

      if (!res.ok) {
        toast.error("Fehler beim Löschen");
      } else {
        toast.success("Benutzer gelöscht");
        loadData();
      }
    } catch {
      toast.error("Netzwerk-Fehler");
    }
  }

  const jobStatusColors: Record<string, string> = {
    open: "bg-yellow-500/20 text-yellow-400",
    accepted: "bg-blue-500/20 text-blue-400",
    in_progress: "bg-orange-500/20 text-orange-400",
    completed: "bg-green-500/20 text-green-400",
    declined: "bg-red-500/20 text-red-400",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="p-12 text-center text-neutral-500">
        <Building2 className="w-16 h-16 mx-auto mb-4 text-neutral-600" />
        Partner nicht gefunden
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={() => router.push("/subcontractors")}
          className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          Zurück zur Liste
        </button>
        <div className="flex items-center gap-2">
          <button onClick={toggleActive} className={`btn-secondary text-sm ${partner.active ? '' : 'text-green-400'}`}>
            {partner.active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
            {partner.active ? "Deaktivieren" : "Aktivieren"}
          </button>
          <button onClick={() => setShowEdit(true)} className="btn-secondary text-sm">
            <Pencil className="w-4 h-4" />
            Bearbeiten
          </button>
          <button onClick={deletePartner} className="btn-secondary text-sm text-red-400 hover:text-red-300">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Info */}
      <div className="card p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            {partner.logo_url ? (
              <img src={partner.logo_url} alt="" className="w-16 h-16 rounded-lg object-contain bg-white p-2" />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-[#111] flex items-center justify-center">
                <Building2 className="w-8 h-8 text-neutral-500" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-white">{partner.company_name}</h1>
              <span className={`inline-flex items-center gap-1 text-sm mt-1 ${partner.active ? 'text-green-400' : 'text-neutral-500'}`}>
                {partner.active ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                {partner.active ? "Aktiv" : "Inaktiv"}
              </span>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Contact */}
          <div className="space-y-3">
            <h3 className="font-medium text-neutral-400 text-sm uppercase">Kontakt</h3>
            {partner.email && (
              <a href={`mailto:${partner.email}`} className="flex items-center gap-3 text-white hover:text-[#fa432a]">
                <Mail className="w-5 h-5 text-neutral-500" />
                {partner.email}
              </a>
            )}
            {partner.phone && (
              <a href={`tel:${partner.phone}`} className="flex items-center gap-3 text-white hover:text-[#fa432a]">
                <Phone className="w-5 h-5 text-neutral-500" />
                {partner.phone}
              </a>
            )}
            {(partner.address || partner.city) && (
              <div className="flex items-start gap-3 text-white">
                <MapPin className="w-5 h-5 text-neutral-500 mt-0.5" />
                <div>
                  {partner.address && <div>{partner.address}</div>}
                  <div>{partner.postal_code} {partner.city}</div>
                </div>
              </div>
            )}
          </div>

          {/* Trades */}
          <div className="space-y-3">
            <h3 className="font-medium text-neutral-400 text-sm uppercase flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              Gewerke
            </h3>
            <div className="flex flex-wrap gap-2">
              {(partner.trades || []).length > 0 ? (
                partner.trades.map((trade) => {
                  const t = tradeOptions.find(o => o.value === trade);
                  return (
                    <span key={trade} className="px-3 py-1.5 rounded-lg bg-[#fa432a]/20 text-[#fa432a] text-sm">
                      {t?.label || trade}
                    </span>
                  );
                })
              ) : (
                <span className="text-neutral-500 text-sm">Keine Gewerke zugewiesen</span>
              )}
            </div>
          </div>
        </div>

        {partner.notes && (
          <div className="mt-6 pt-6 border-t border-neutral-800">
            <h3 className="font-medium text-neutral-400 text-sm uppercase mb-2">Notizen</h3>
            <p className="text-neutral-300 whitespace-pre-wrap">{partner.notes}</p>
          </div>
        )}
      </div>

      {/* Team */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-[#fa432a]" />
            Team ({users.length})
          </h3>
          <button onClick={() => setShowAddUser(true)} className="btn-primary btn-sm flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Benutzer anlegen
          </button>
        </div>

        {users.length === 0 ? (
          <p className="text-neutral-500 text-center py-8">Noch keine Benutzer</p>
        ) : (
          <div className="overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-800">
                  <th className="text-left text-xs text-neutral-500 uppercase py-2 font-medium">Name</th>
                  <th className="text-left text-xs text-neutral-500 uppercase py-2 font-medium hidden sm:table-cell">E-Mail</th>
                  <th className="text-left text-xs text-neutral-500 uppercase py-2 font-medium hidden md:table-cell">Rolle</th>
                  <th className="text-left text-xs text-neutral-500 uppercase py-2 font-medium">Status</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-neutral-800/50">
                    <td className="py-3">
                      <span className="font-medium text-white">{user.display_name}</span>
                    </td>
                    <td className="py-3 hidden sm:table-cell">
                      <span className="text-neutral-400 text-sm">{user.email}</span>
                    </td>
                    <td className="py-3 hidden md:table-cell">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        user.role === 'admin' ? 'bg-[#fa432a]/20 text-[#fa432a]' : 'bg-neutral-800 text-neutral-400'
                      }`}>
                        {user.role === 'admin' ? 'Admin' : 'Mitarbeiter'}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        user.active ? 'bg-green-500/20 text-green-400' : 'bg-neutral-500/20 text-neutral-400'
                      }`}>
                        {user.active ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </td>
                    <td className="py-3">
                      <button
                        onClick={() => deleteUser(user.id, user.display_name)}
                        className="p-1 text-neutral-500 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Jobs */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-[#fa432a]" />
            Aufträge ({jobs.length})
          </h3>
        </div>

        {jobs.length === 0 ? (
          <p className="text-neutral-500 text-center py-8">Noch keine Aufträge</p>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between p-3 rounded-lg bg-[#111]">
                <div>
                  <span className="font-medium text-white">{job.title}</span>
                  {job.project && (
                    <p className="text-sm text-neutral-500">{job.project.name}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {job.scheduled_date && (
                    <span className="text-xs text-neutral-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(job.scheduled_date)}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded ${jobStatusColors[job.status] || 'bg-neutral-800 text-neutral-400'}`}>
                    {job.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="card p-4 bg-[#111] text-sm text-neutral-500">
        <div className="flex flex-wrap gap-4">
          <span>Erstellt: {formatDate(partner.created_at)}</span>
          <span>Aktualisiert: {formatDate(partner.updated_at)}</span>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Partner bearbeiten">
        <form onSubmit={savePartner} className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Firmenname *</label>
            <input
              type="text"
              value={editForm.company_name}
              onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })}
              className="input w-full"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-neutral-400 mb-1">E-Mail</label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Telefon</label>
              <input
                type="tel"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                className="input w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-neutral-400 mb-1">Adresse</label>
            <input
              type="text"
              value={editForm.address}
              onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
              className="input w-full"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-neutral-400 mb-1">PLZ</label>
              <input
                type="text"
                value={editForm.postal_code}
                onChange={(e) => setEditForm({ ...editForm, postal_code: e.target.value })}
                className="input w-full"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-neutral-400 mb-1">Ort</label>
              <input
                type="text"
                value={editForm.city}
                onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                className="input w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-neutral-400 mb-2">Gewerke</label>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
              {tradeOptions.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => toggleTrade(t.value)}
                  className={`p-2 rounded text-left text-sm transition-colors ${
                    editForm.trades.includes(t.value)
                      ? "bg-[#fa432a]/20 border border-[#fa432a] text-white"
                      : "bg-[#111] border border-transparent text-neutral-400 hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-neutral-400 mb-1">Notizen</label>
            <textarea
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              rows={3}
              className="input w-full"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setShowEdit(false)} className="btn-secondary flex-1">
              Abbrechen
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {saving && <Spinner className="w-5 h-5" />}
              Speichern
            </button>
          </div>
        </form>
      </Modal>

      {/* Add User Modal */}
      <Modal open={showAddUser} onClose={() => setShowAddUser(false)} title="Benutzer anlegen">
        <form onSubmit={createUser} className="space-y-4">
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Name *</label>
            <input
              type="text"
              value={userForm.name}
              onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
              className="input w-full"
              placeholder="Max Mustermann"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-neutral-400 mb-1">E-Mail *</label>
            <input
              type="email"
              value={userForm.email}
              onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
              className="input w-full"
              placeholder="max@firma.de"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-neutral-400 mb-1">Telefon</label>
            <input
              type="tel"
              value={userForm.phone}
              onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
              className="input w-full"
              placeholder="+49 ..."
            />
          </div>

          <div>
            <label className="block text-sm text-neutral-400 mb-1">Rolle</label>
            <select
              value={userForm.role}
              onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
              className="input w-full"
            >
              <option value="worker">Mitarbeiter</option>
              <option value="admin">Administrator</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-neutral-400 mb-1">Passwort *</label>
            <input
              type="password"
              value={userForm.password}
              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
              className="input w-full"
              placeholder="Mindestens 6 Zeichen"
              required
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setShowAddUser(false)} className="btn-secondary flex-1">
              Abbrechen
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {saving && <Spinner className="w-5 h-5" />}
              Anlegen
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
