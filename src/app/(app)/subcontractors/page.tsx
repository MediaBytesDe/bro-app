"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { getTradeOptions, getTradeLabel, loadTradesFromDB } from "@/lib/trades";
import Image from "next/image";
import {
  Wrench,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  ChevronRight,
  Building2,
  Users,
  CheckCircle,
  XCircle,
} from "lucide-react";

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
  created_at: string;
  logo_url: string | null;
  _count?: {
    users: number;
    jobs: number;
  };
}

export default function SubcontractorsPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tradeFilter, setTradeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company_name: "",
    email: "",
    phone: "",
    address: "",
    postal_code: "",
    city: "",
    trades: [] as string[],
  });

  const router = useRouter();
  const supabase = createClient();
  const [tradeOptions, setTradeOptions] = useState(getTradeOptions());

  useEffect(() => {
    loadPartners();
  }, []);

  async function loadPartners() {
    setLoading(true);
    try {
      // Trades aus DB laden (für Labels)
      await loadTradesFromDB(supabase, true);
      setTradeOptions(getTradeOptions());
      
      // Load partners with user count
      const { data: partnersData } = await supabase
        .from("partners")
        .select("*")
        .order("company_name");

      if (partnersData) {
        // Get user counts for each partner
        const partnersWithCounts = await Promise.all(
          partnersData.map(async (p) => {
            const { count: userCount } = await supabase
              .from("partner_users")
              .select("*", { count: "exact", head: true })
              .eq("partner_id", p.id);
            
            const { count: jobCount } = await supabase
              .from("partner_jobs")
              .select("*", { count: "exact", head: true })
              .eq("accepted_by_partner_id", p.id);

            return {
              ...p,
              trades: p.trades || [],
              _count: {
                users: userCount || 0,
                jobs: jobCount || 0,
              },
            };
          })
        );
        setPartners(partnersWithCounts);
      }
    } catch (err) {
      console.error("Error loading partners:", err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = partners.filter((p) => {
    const matchesSearch =
      !search ||
      p.company_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.city?.toLowerCase().includes(search.toLowerCase()) ||
      p.email?.toLowerCase().includes(search.toLowerCase());
    const matchesTrade = !tradeFilter || p.trades?.includes(tradeFilter);
    const matchesStatus = 
      statusFilter === "all" ||
      (statusFilter === "active" && p.active) ||
      (statusFilter === "inactive" && !p.active);
    return matchesSearch && matchesTrade && matchesStatus;
  });

  function toggleTrade(trade: string) {
    setForm(prev => ({
      ...prev,
      trades: prev.trades.includes(trade)
        ? prev.trades.filter(t => t !== trade)
        : [...prev.trades, trade]
    }));
  }

  async function createPartner(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company_name.trim()) return;

    setSaving(true);

    const { data, error } = await supabase
      .from("partners")
      .insert({
        company_name: form.company_name,
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
        postal_code: form.postal_code || null,
        city: form.city || null,
        trades: form.trades,
        active: true,
      })
      .select()
      .single();

    if (error) {
      console.error("Create error:", error);
      alert("Fehler beim Erstellen");
    } else if (data) {
      setShowForm(false);
      setForm({
        company_name: "",
        email: "",
        phone: "",
        address: "",
        postal_code: "",
        city: "",
        trades: [],
      });
      router.push(`/subcontractors/${data.id}`);
    }

    setSaving(false);
  }

  // Stats
  const activeCount = partners.filter(p => p.active).length;
  const totalJobs = partners.reduce((sum, p) => sum + (p._count?.jobs || 0), 0);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Building2 className="w-7 h-7 text-[#fa432a]" />
            Subunternehmer
          </h1>
          <p className="text-neutral-400 mt-1">
            {partners.length} Partner · {activeCount} aktiv · {totalJobs} Aufträge
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Neuer Partner
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suchen..."
            className="input w-full pl-10"
          />
        </div>
        <select
          value={tradeFilter}
          onChange={(e) => setTradeFilter(e.target.value)}
          className="input"
        >
          <option value="">Alle Gewerke</option>
          {tradeOptions.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="input"
        >
          <option value="all">Alle Status</option>
          <option value="active">Aktiv</option>
          <option value="inactive">Inaktiv</option>
        </select>
      </div>

      {/* Partners Table */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Building2 className="w-16 h-16 mx-auto text-neutral-600 mb-4" />
          <p className="text-neutral-400 text-lg">Keine Partner gefunden</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-800 bg-[#0a0a0a]">
                <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium">Status</th>
                <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium">Firma</th>
                <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium hidden md:table-cell">Gewerke</th>
                <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium hidden lg:table-cell">Ort</th>
                <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium hidden sm:table-cell">Kontakt</th>
                <th className="text-center text-xs text-neutral-500 uppercase py-3 px-4 font-medium hidden xl:table-cell">Team</th>
                <th className="text-center text-xs text-neutral-500 uppercase py-3 px-4 font-medium hidden xl:table-cell">Aufträge</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((partner) => (
                <tr
                  key={partner.id}
                  onClick={() => router.push(`/subcontractors/${partner.id}`)}
                  className="border-b border-neutral-800/50 hover:bg-[#111] transition-colors cursor-pointer"
                >
                  <td className="py-3 px-4">
                    {partner.active ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">
                        <CheckCircle className="w-3 h-3" />
                        Aktiv
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-neutral-500/20 text-neutral-400">
                        <XCircle className="w-3 h-3" />
                        Inaktiv
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      {partner.logo_url ? (
                        <Image
                          src={partner.logo_url}
                          alt={`${partner.company_name} Logo`}
                          width={32}
                          height={32}
                          className="w-8 h-8 rounded object-contain bg-white p-0.5"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-[#1a1a1a] flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-neutral-500" />
                        </div>
                      )}
                      <span className="font-medium text-white">{partner.company_name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {(partner.trades || []).slice(0, 3).map((trade) => {
                        const t = tradeOptions.find(o => o.value === trade);
                        return (
                          <span key={trade} className="text-xs px-2 py-0.5 rounded bg-[#1a1a1a] text-neutral-300">
                            {t?.label || trade}
                          </span>
                        );
                      })}
                      {(partner.trades || []).length > 3 && (
                        <span className="text-xs px-2 py-0.5 rounded bg-[#1a1a1a] text-neutral-500">
                          +{partner.trades.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 hidden lg:table-cell">
                    <span className="text-neutral-400 text-sm">
                      {partner.postal_code} {partner.city || "–"}
                    </span>
                  </td>
                  <td className="py-3 px-4 hidden sm:table-cell">
                    <div className="space-y-1">
                      {partner.email && (
                        <div className="flex items-center gap-2 text-sm text-neutral-400">
                          <Mail className="w-3 h-3" />
                          <span className="truncate max-w-[150px]">{partner.email}</span>
                        </div>
                      )}
                      {partner.phone && (
                        <div className="flex items-center gap-2 text-sm text-neutral-400">
                          <Phone className="w-3 h-3" />
                          {partner.phone}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center hidden xl:table-cell">
                    <span className="inline-flex items-center gap-1 text-sm text-neutral-400">
                      <Users className="w-4 h-4" />
                      {partner._count?.users || 0}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center hidden xl:table-cell">
                    <span className="text-sm text-neutral-400">{partner._count?.jobs || 0}</span>
                  </td>
                  <td className="py-3 px-4">
                    <ChevronRight className="w-4 h-4 text-neutral-600" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Neuen Partner anlegen">
        <form onSubmit={createPartner} className="space-y-4">
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Firmenname *</label>
            <input
              type="text"
              value={form.company_name}
              onChange={(e) => setForm({ ...form, company_name: e.target.value })}
              className="input w-full"
              placeholder="Muster GmbH"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-neutral-400 mb-1">E-Mail</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input w-full"
                placeholder="info@firma.de"
              />
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
          </div>

          <div>
            <label className="block text-sm text-neutral-400 mb-1">Adresse</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="input w-full"
              placeholder="Straße Hausnummer"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-neutral-400 mb-1">PLZ</label>
              <input
                type="text"
                value={form.postal_code}
                onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                className="input w-full"
                placeholder="26427"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-neutral-400 mb-1">Ort</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="input w-full"
                placeholder="Esens"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-neutral-400 mb-2">Gewerke</label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {tradeOptions.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => toggleTrade(t.value)}
                  className={`p-2 rounded text-left text-sm transition-colors ${
                    form.trades.includes(t.value)
                      ? "bg-[#fa432a]/20 border border-[#fa432a] text-white"
                      : "bg-[#111] border border-transparent text-neutral-400 hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">
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
