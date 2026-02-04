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
  MoreVertical,
  Check,
  X,
  Trash2,
  Send
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
  invited_at: string | null;
}

export default function TeamPage() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [partnerUser, setPartnerUser] = useState<any>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", phone: "", role: "worker" });
  const [submitting, setSubmitting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: pu } = await supabase
      .from("partner_users")
      .select("*, partner:partners(*)")
      .eq("auth_user_id", user.id)
      .single();

    if (!pu || pu.role !== "admin") {
      // Redirect non-admins
      window.location.href = "/partner";
      return;
    }

    setPartnerUser(pu);

    // Get team members
    const { data: team } = await supabase
      .from("partner_users")
      .select("*")
      .eq("partner_id", pu.partner_id)
      .order("created_at");

    setMembers(team || []);
    setLoading(false);
  }

  async function inviteMember() {
    if (!inviteForm.name || !inviteForm.email) {
      toast.error("Name und E-Mail sind erforderlich");
      return;
    }

    setSubmitting(true);

    // Generate invite token
    const inviteToken = crypto.randomUUID();

    const { error } = await supabase
      .from("partner_users")
      .insert({
        partner_id: partnerUser.partner_id,
        display_name: inviteForm.name,
        email: inviteForm.email,
        phone: inviteForm.phone || null,
        role: inviteForm.role,
        invite_token: inviteToken,
        invited_at: new Date().toISOString(),
        active: false, // Inactive until they accept
      });

    if (error) {
      if (error.code === "23505") {
        toast.error("Diese E-Mail ist bereits eingeladen");
      } else {
        toast.error("Fehler beim Einladen");
      }
    } else {
      toast.success("Einladung erstellt! (E-Mail-Versand muss noch implementiert werden)");
      setShowInvite(false);
      setInviteForm({ name: "", email: "", phone: "", role: "worker" });
      loadData();
    }

    setSubmitting(false);
  }

  async function toggleActive(member: TeamMember) {
    // Can't deactivate yourself
    if (member.id === partnerUser.id) {
      toast.error("Sie können sich nicht selbst deaktivieren");
      return;
    }

    const { error } = await supabase
      .from("partner_users")
      .update({ active: !member.active })
      .eq("id", member.id);

    if (error) {
      toast.error("Fehler");
    } else {
      toast.success(member.active ? "Deaktiviert" : "Aktiviert");
      loadData();
    }
  }

  async function removeMember(member: TeamMember) {
    if (member.id === partnerUser.id) {
      toast.error("Sie können sich nicht selbst entfernen");
      return;
    }

    if (!confirm(`${member.display_name} wirklich entfernen?`)) return;

    const { error } = await supabase
      .from("partner_users")
      .delete()
      .eq("id", member.id);

    if (error) {
      toast.error("Fehler beim Entfernen");
    } else {
      toast.success("Mitarbeiter entfernt");
      loadData();
    }
  }

  async function resendInvite(member: TeamMember) {
    // Just update invited_at for now
    const { error } = await supabase
      .from("partner_users")
      .update({ 
        invited_at: new Date().toISOString(),
        invite_token: crypto.randomUUID(),
      })
      .eq("id", member.id);

    if (error) {
      toast.error("Fehler");
    } else {
      toast.success("Einladung erneut gesendet (E-Mail noch nicht implementiert)");
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
            <Users className="w-7 h-7 text-blue-400" />
            Team
          </h1>
          <p className="text-neutral-400 mt-1">
            {members.length} Mitarbeiter
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Einladen
        </button>
      </div>

      {/* Team List */}
      <div className="space-y-3">
        {members.map((member) => (
          <div
            key={member.id}
            className={`card p-4 flex items-center justify-between ${
              !member.active ? "opacity-50" : ""
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                member.role === "admin" 
                  ? "bg-blue-500/20 text-blue-400" 
                  : "bg-neutral-800 text-neutral-400"
              }`}>
                {member.role === "admin" ? (
                  <Shield className="w-6 h-6" />
                ) : (
                  <User className="w-6 h-6" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-white">{member.display_name}</p>
                  {member.id === partnerUser.id && (
                    <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                      Sie
                    </span>
                  )}
                  {!member.joined_at && member.invited_at && (
                    <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">
                      Eingeladen
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-sm text-neutral-500">
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {member.email}
                  </span>
                  {member.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {member.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {member.id !== partnerUser.id && (
              <div className="flex items-center gap-2">
                {!member.joined_at && (
                  <button
                    onClick={() => resendInvite(member)}
                    className="p-2 text-neutral-400 hover:text-blue-400 transition-colors"
                    title="Erneut einladen"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={() => toggleActive(member)}
                  className={`p-2 transition-colors ${
                    member.active 
                      ? "text-neutral-400 hover:text-red-400" 
                      : "text-neutral-400 hover:text-green-400"
                  }`}
                  title={member.active ? "Deaktivieren" : "Aktivieren"}
                >
                  {member.active ? (
                    <X className="w-5 h-5" />
                  ) : (
                    <Check className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={() => removeMember(member)}
                  className="p-2 text-neutral-400 hover:text-red-400 transition-colors"
                  title="Entfernen"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="card p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Mitarbeiter einladen</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Name *</label>
                <input
                  type="text"
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                  className="input w-full"
                  placeholder="Max Mustermann"
                />
              </div>
              
              <div>
                <label className="block text-sm text-neutral-400 mb-1">E-Mail *</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="input w-full"
                  placeholder="max@beispiel.de"
                />
              </div>
              
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Telefon</label>
                <input
                  type="tel"
                  value={inviteForm.phone}
                  onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })}
                  className="input w-full"
                  placeholder="+49 ..."
                />
              </div>
              
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Rolle</label>
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                  className="input w-full"
                >
                  <option value="worker">Mitarbeiter</option>
                  <option value="admin">Administrator</option>
                </select>
                <p className="text-xs text-neutral-500 mt-1">
                  Administratoren können das Team verwalten und alle Aufträge sehen.
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowInvite(false)}
                className="btn-secondary flex-1"
              >
                Abbrechen
              </button>
              <button
                onClick={inviteMember}
                disabled={submitting}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {submitting ? <Spinner className="w-5 h-5" /> : <Send className="w-5 h-5" />}
                Einladen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
