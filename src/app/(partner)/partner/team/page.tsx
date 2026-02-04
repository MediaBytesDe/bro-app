"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import { 
  Users, 
  Plus,
  Mail,
  Phone,
  Shield,
  User,
  Check,
  X,
  Trash2,
  Edit,
  Eye,
  EyeOff
} from "lucide-react";
import { toast } from "sonner";

interface TeamMember {
  id: string;
  display_name: string;
  email: string;
  phone: string;
  role: string;
  active: boolean;
  joined_at: string | null;
  created_at: string;
}

export default function TeamPage() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [partnerUser, setPartnerUser] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [form, setForm] = useState({ 
    name: "", 
    email: "", 
    phone: "", 
    role: "worker",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: pu } = await supabase
        .from("partner_users")
        .select("*, partner:partners(*)")
        .eq("auth_user_id", user.id)
        .single();

      if (!pu || pu.role !== "admin") {
        setLoading(false);
        window.location.href = "/partner";
        return;
      }

      setPartnerUser(pu);

      const { data: team } = await supabase
        .from("partner_users")
        .select("*")
        .eq("partner_id", pu.partner_id)
        .order("created_at");

      setMembers(team || []);
    } catch (err) {
      console.error("Error loading team:", err);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingMember(null);
    setForm({ name: "", email: "", phone: "", role: "worker", password: "" });
    setShowPassword(false);
    setShowModal(true);
  }

  function openEditModal(member: TeamMember) {
    setEditingMember(member);
    setForm({
      name: member.display_name,
      email: member.email,
      phone: member.phone || "",
      role: member.role,
      password: "",
    });
    setShowPassword(false);
    setShowModal(true);
  }

  async function saveMember() {
    if (!form.name) {
      toast.error("Name ist erforderlich");
      return;
    }

    if (!editingMember && (!form.email || !form.password)) {
      toast.error("E-Mail und Passwort sind erforderlich");
      return;
    }

    if (!editingMember && form.password.length < 6) {
      toast.error("Passwort muss mindestens 6 Zeichen haben");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/partner/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingMember
            ? {
                action: "update",
                userId: editingMember.id,
                name: form.name,
                phone: form.phone,
                role: form.role,
                password: form.password || undefined,
              }
            : {
                action: "create",
                name: form.name,
                email: form.email,
                phone: form.phone,
                role: form.role,
                password: form.password,
              }
        ),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Fehler beim Speichern");
      } else {
        toast.success(editingMember ? "Mitarbeiter aktualisiert" : "Mitarbeiter erstellt");
        setShowModal(false);
        loadData();
      }
    } catch (error) {
      toast.error("Netzwerk-Fehler");
    }

    setSubmitting(false);
  }

  async function toggleActive(member: TeamMember) {
    if (member.id === partnerUser.id) {
      toast.error("Sie können sich nicht selbst deaktivieren");
      return;
    }

    try {
      const res = await fetch("/api/partner/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          userId: member.id,
          active: !member.active,
        }),
      });

      if (!res.ok) {
        toast.error("Fehler");
      } else {
        toast.success(member.active ? "Deaktiviert" : "Aktiviert");
        loadData();
      }
    } catch (error) {
      toast.error("Netzwerk-Fehler");
    }
  }

  async function deleteMember(member: TeamMember) {
    if (member.id === partnerUser.id) {
      toast.error("Sie können sich nicht selbst löschen");
      return;
    }

    if (!confirm(`${member.display_name} wirklich löschen?\n\nDer Benutzer kann sich danach nicht mehr einloggen.`)) {
      return;
    }

    try {
      const res = await fetch("/api/partner/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          userId: member.id,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Fehler beim Löschen");
      } else {
        toast.success("Mitarbeiter gelöscht");
        loadData();
      }
    } catch (error) {
      toast.error("Netzwerk-Fehler");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Users className="w-7 h-7 text-[#fa432a]" />
            Team
          </h1>
          <p className="text-neutral-400 mt-1">
            {members.length} Mitarbeiter · {members.filter(m => m.active).length} aktiv
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Mitarbeiter anlegen
        </button>
      </div>

      {/* Team Table */}
      {members.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="w-16 h-16 mx-auto text-neutral-600 mb-4" />
          <p className="text-neutral-400 text-lg">Noch keine Mitarbeiter</p>
          <p className="text-neutral-500 text-sm mt-1">
            Legen Sie Ihren ersten Mitarbeiter an
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-800 bg-[#0a0a0a]">
                <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium">Status</th>
                <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium">Name</th>
                <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium hidden sm:table-cell">E-Mail</th>
                <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium hidden md:table-cell">Telefon</th>
                <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium hidden lg:table-cell">Rolle</th>
                <th className="text-right text-xs text-neutral-500 uppercase py-3 px-4 font-medium w-32">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const isMe = member.id === partnerUser.id;
                
                return (
                  <tr 
                    key={member.id}
                    className={`border-b border-neutral-800/50 hover:bg-[#111] transition-colors ${
                      !member.active ? "opacity-50" : ""
                    }`}
                  >
                    <td className="py-3 px-4">
                      {member.active ? (
                        <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">
                          Aktiv
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded bg-neutral-500/20 text-neutral-400">
                          Inaktiv
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          member.role === "admin" 
                            ? "bg-[#fa432a]/20 text-[#fa432a]" 
                            : "bg-neutral-800 text-neutral-400"
                        }`}>
                          {member.role === "admin" ? (
                            <Shield className="w-4 h-4" />
                          ) : (
                            <User className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <span className="font-medium text-white">{member.display_name}</span>
                          {isMe && (
                            <span className="ml-2 text-xs px-1.5 py-0.5 bg-[#fa432a]/20 text-[#fa432a] rounded">
                              Sie
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 hidden sm:table-cell">
                      <span className="text-neutral-300 text-sm">{member.email}</span>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      <span className="text-neutral-400 text-sm">{member.phone || "–"}</span>
                    </td>
                    <td className="py-3 px-4 hidden lg:table-cell">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        member.role === "admin"
                          ? "bg-[#fa432a]/20 text-[#fa432a]"
                          : "bg-neutral-800 text-neutral-400"
                      }`}>
                        {member.role === "admin" ? "Administrator" : "Mitarbeiter"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(member)}
                          className="p-1.5 text-neutral-500 hover:text-white rounded hover:bg-neutral-800"
                          title="Bearbeiten"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {!isMe && (
                          <>
                            <button
                              onClick={() => toggleActive(member)}
                              className={`p-1.5 rounded hover:bg-neutral-800 ${
                                member.active 
                                  ? "text-neutral-500 hover:text-yellow-400" 
                                  : "text-neutral-500 hover:text-green-400"
                              }`}
                              title={member.active ? "Deaktivieren" : "Aktivieren"}
                            >
                              {member.active ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => deleteMember(member)}
                              className="p-1.5 text-neutral-500 hover:text-red-400 rounded hover:bg-neutral-800"
                              title="Löschen"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="card p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">
              {editingMember ? "Mitarbeiter bearbeiten" : "Mitarbeiter anlegen"}
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input w-full"
                  placeholder="Max Mustermann"
                />
              </div>
              
              <div>
                <label className="block text-sm text-neutral-400 mb-1">
                  E-Mail {!editingMember && "*"}
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="input w-full"
                  placeholder="max@beispiel.de"
                  disabled={!!editingMember}
                />
                {editingMember && (
                  <p className="text-xs text-neutral-500 mt-1">E-Mail kann nicht geändert werden</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Telefon</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="input w-full"
                  placeholder="+49 ..."
                />
              </div>
              
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Rolle</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="input w-full"
                  disabled={editingMember?.id === partnerUser?.id}
                >
                  <option value="worker">Mitarbeiter</option>
                  <option value="admin">Administrator</option>
                </select>
                <p className="text-xs text-neutral-500 mt-1">
                  Administratoren können das Team verwalten und alle Aufträge sehen.
                </p>
              </div>

              <div>
                <label className="block text-sm text-neutral-400 mb-1">
                  Passwort {!editingMember && "*"}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="input w-full pr-10"
                    placeholder={editingMember ? "Neues Passwort (leer lassen = unverändert)" : "Mindestens 6 Zeichen"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {!editingMember && (
                  <p className="text-xs text-neutral-500 mt-1">
                    Der Mitarbeiter kann sich damit sofort einloggen.
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="btn-secondary flex-1"
              >
                Abbrechen
              </button>
              <button
                onClick={saveMember}
                disabled={submitting}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {submitting && <Spinner className="w-5 h-5" />}
                {editingMember ? "Speichern" : "Anlegen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
