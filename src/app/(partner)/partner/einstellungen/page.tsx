"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import { getTradeLabel, loadTradesFromDB } from "@/lib/trades";
import { 
  Settings, 
  Building2,
  Mail,
  Phone,
  MapPin,
  Upload,
  Save,
  Wrench
} from "lucide-react";
import { toast } from "sonner";

export default function EinstellungenPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [partnerUser, setPartnerUser] = useState<any>(null);
  const [partner, setPartner] = useState<any>(null);
  
  const [form, setForm] = useState({
    company_name: "",
    email: "",
    phone: "",
    address: "",
    postal_code: "",
    city: "",
    trades: [] as string[],
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      // Trades aus DB laden (für Labels)
      await loadTradesFromDB(supabase, true);
      
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
      setPartner(pu.partner);

      // Fill form with current data
      if (pu.partner) {
        setForm({
          company_name: pu.partner.company_name || "",
          email: pu.partner.email || "",
          phone: pu.partner.phone || "",
          address: pu.partner.address || "",
          postal_code: pu.partner.postal_code || "",
          city: pu.partner.city || "",
          trades: pu.partner.trades || [],
        });
        if (pu.partner.logo_url) {
          setLogoPreview(pu.partner.logo_url);
        }
      }
    } catch (err) {
      console.error("Error loading settings:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      // Preview
      const reader = new FileReader();
      reader.onload = (e) => setLogoPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  }

  async function saveSettings() {
    if (!form.company_name.trim()) {
      toast.error("Firmenname ist erforderlich");
      return;
    }

    setSaving(true);

    let logoUrl = partner?.logo_url;

    // Upload new logo if selected
    if (logoFile) {
      const sanitizedName = logoFile.name
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `logos/${partner.id}/${Date.now()}_${sanitizedName}`;
      
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileName, logoFile, { contentType: logoFile.type });

      if (uploadError) {
        toast.error("Fehler beim Logo-Upload");
      } else {
        const { data: urlData } = supabase.storage
          .from("documents")
          .getPublicUrl(fileName);
        logoUrl = urlData.publicUrl;
      }
    }

    // Update partner data (trades are managed by BROjekt admin)
    const { error } = await supabase
      .from("partners")
      .update({
        company_name: form.company_name,
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
        postal_code: form.postal_code || null,
        city: form.city || null,
        logo_url: logoUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", partner.id);

    if (error) {
      console.error("Save error:", error);
      toast.error("Fehler beim Speichern");
    } else {
      toast.success("Einstellungen gespeichert");
      setLogoFile(null);
      loadData();
    }

    setSaving(false);
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
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Settings className="w-7 h-7 text-[#fa432a]" />
          Einstellungen
        </h1>
        <p className="text-neutral-400 mt-1">
          Firmendaten und Einstellungen verwalten
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Company Info */}
        <div className="card p-5">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#fa432a]" />
            Firmendaten
          </h2>
          
          <div className="space-y-4">
            {/* Logo */}
            <div>
              <label className="block text-sm text-neutral-400 mb-2">Firmenlogo</label>
              <div className="flex items-center gap-4">
                {logoPreview ? (
                  <div className="w-20 h-20 rounded-lg bg-white p-2 flex items-center justify-center">
                    <img src={logoPreview} alt="Logo" className="max-w-full max-h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-[#111] flex items-center justify-center">
                    <Building2 className="w-8 h-8 text-neutral-600" />
                  </div>
                )}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-secondary text-sm flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Logo hochladen
                  </button>
                  <p className="text-xs text-neutral-500 mt-1">PNG, JPG oder SVG</p>
                </div>
              </div>
            </div>

            {/* Company Name */}
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Firmenname *</label>
              <input
                type="text"
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                className="input w-full"
                placeholder="Muster GmbH"
              />
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Straße & Hausnummer</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="input w-full"
                placeholder="Musterstraße 123"
              />
            </div>

            {/* PLZ / City */}
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
          </div>
        </div>

        {/* Contact */}
        <div className="card p-5 h-fit">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#fa432a]" />
            Kontakt
          </h2>
          
          <div className="space-y-4">
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
        </div>
      </div>

      {/* Assigned Trades (read-only) */}
      {form.trades.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-[#fa432a]" />
            Zugewiesene Gewerke
          </h2>
          <p className="text-sm text-neutral-500 mb-4">
            Diese Gewerke wurden Ihnen von BROjekt zugewiesen. Bei Änderungswünschen kontaktieren Sie uns.
          </p>
          
          <div className="flex flex-wrap gap-2">
            {form.trades.map((trade) => (
              <span
                key={trade}
                className="px-3 py-1.5 rounded-lg bg-[#fa432a]/20 text-[#fa432a] text-sm font-medium"
              >
                {getTradeLabel(trade)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="btn-primary flex items-center gap-2"
        >
          {saving ? <Spinner className="w-5 h-5" /> : <Save className="w-5 h-5" />}
          Speichern
        </button>
      </div>
    </div>
  );
}
