"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import {
  CreditCard,
  CheckCircle,
  Clock,
  AlertCircle,
  FileText,
  Download,
  Euro,
  CalendarClock,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Payment {
  id: string;
  amount: number;
  description: string;
  due_date: string;
  paid_at: string | null;
  status: string;
  payment_method: string | null;
  invoice_url: string | null;
  project?: {
    name: string;
  };
}

interface PaymentSummary {
  total: number;
  paid: number;
  pending: number;
  overdue: number;
}

const statusConfig: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
  paid: { label: "Bezahlt", icon: CheckCircle, color: "text-green-400", bgColor: "bg-green-500/10" },
  pending: { label: "Offen", icon: Clock, color: "text-yellow-400", bgColor: "bg-yellow-500/10" },
  overdue: { label: "Überfällig", icon: AlertCircle, color: "text-red-400", bgColor: "bg-red-500/10" },
  partial: { label: "Teilzahlung", icon: Clock, color: "text-blue-400", bgColor: "bg-blue-500/10" },
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export default function ZahlungenPage() {
  const { profile } = useAuth();
  const searchParams = useSearchParams();
  const impersonateId = searchParams.get("impersonate");
  const isAdmin = profile?.role === "admin" || profile?.role === "superadmin";
  const isImpersonating = isAdmin && !!impersonateId;
  
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<PaymentSummary>({
    total: 0,
    paid: 0,
    pending: 0,
    overdue: 0,
  });

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, [profile, impersonateId]);

  async function loadData() {
    if (!profile?.auth_id) { setLoading(false); return; }

    try {
      let customerId: string | null = null;
      
      if (isImpersonating && impersonateId) {
        customerId = impersonateId;
      } else {
        const { data: customer } = await supabase
          .from("customers")
          .select("id")
          .eq("auth_user_id", profile.auth_id)
          .single();

        if (!customer) {
          setLoading(false);
          return;
        }
        customerId = customer.id;
      }

      // Load payments
      const { data: paymentsData } = await supabase
        .from("payments")
        .select(`
          id, amount, description, due_date, paid_at, status, payment_method, invoice_url,
          project:projects(name)
        `)
        .eq("customer_id", customerId)
        .order("due_date", { ascending: false });

      const paymentsList = paymentsData || [];
      setPayments(paymentsList);

      // Calculate summary
      const total = paymentsList.reduce((sum, p) => sum + p.amount, 0);
      const paid = paymentsList
        .filter((p) => p.status === "paid")
        .reduce((sum, p) => sum + p.amount, 0);
      const overdue = paymentsList
        .filter((p) => p.status === "overdue")
        .reduce((sum, p) => sum + p.amount, 0);
      const pending = total - paid;

      setSummary({ total, paid, pending, overdue });
    } catch (err) {
      console.error("Error loading payments:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  const pendingPayments = payments.filter((p) => p.status !== "paid");
  const paidPayments = payments.filter((p) => p.status === "paid");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Zahlungen</h1>
        <p className="text-neutral-400 mt-1">
          Übersicht Ihrer Zahlungen und Rechnungen
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Euro className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-neutral-500 uppercase">Gesamt</p>
              <p className="text-lg font-bold text-white">
                {formatCurrency(summary.total)}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-xs text-neutral-500 uppercase">Bezahlt</p>
              <p className="text-lg font-bold text-green-400">
                {formatCurrency(summary.paid)}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/10 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-xs text-neutral-500 uppercase">Offen</p>
              <p className="text-lg font-bold text-yellow-400">
                {formatCurrency(summary.pending)}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-xs text-neutral-500 uppercase">Überfällig</p>
              <p className="text-lg font-bold text-red-400">
                {formatCurrency(summary.overdue)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Payments */}
      {pendingPayments.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-neutral-800">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-yellow-400" />
              Offene Zahlungen
            </h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-xs text-neutral-500 uppercase tracking-wide border-b border-neutral-800 bg-[#0a0a0a]">
                <th className="text-left py-3 px-4">Beschreibung</th>
                <th className="text-left py-3 px-4 w-28">Fällig</th>
                <th className="text-right py-3 px-4 w-32">Betrag</th>
                <th className="text-left py-3 px-4 w-28">Status</th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody>
              {pendingPayments.map((payment) => {
                const status = statusConfig[payment.status] || statusConfig.pending;
                const StatusIcon = status.icon;
                const isOverdue =
                  payment.status === "overdue" ||
                  new Date(payment.due_date) < new Date();

                return (
                  <tr
                    key={payment.id}
                    className={cn(
                      "border-b border-neutral-800/50 last:border-0",
                      isOverdue ? "bg-red-500/5" : "hover:bg-[#111]"
                    )}
                  >
                    <td className="py-3 px-4">
                      <p className="text-white font-medium">{payment.description}</p>
                      {payment.project && (
                        <p className="text-xs text-neutral-500">{payment.project.name}</p>
                      )}
                    </td>
                    <td className={cn("py-3 px-4 text-sm", isOverdue ? "text-red-400" : "text-neutral-400")}>
                      {new Date(payment.due_date).toLocaleDateString("de-DE")}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-white font-bold">{formatCurrency(payment.amount)}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn("flex items-center gap-1 text-xs whitespace-nowrap", status.color)}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {payment.invoice_url && (
                        <a
                          href={payment.invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                        >
                          <Download className="w-3 h-3" />
                          PDF
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Payment Info */}
          <div className="mt-6 p-4 bg-[#111] rounded-lg border border-neutral-700">
            <h3 className="font-medium text-white mb-2 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-400" />
              Bankverbindung
            </h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-neutral-500">Empfänger</p>
                <p className="text-white">BROjekt GmbH</p>
              </div>
              <div>
                <p className="text-neutral-500">IBAN</p>
                <p className="text-white font-mono">DE89 3704 0044 0532 0130 00</p>
              </div>
              <div>
                <p className="text-neutral-500">BIC</p>
                <p className="text-white font-mono">COBADEFFXXX</p>
              </div>
              <div>
                <p className="text-neutral-500">Verwendungszweck</p>
                <p className="text-white">Rechnungsnummer angeben</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment History */}
      {paidPayments.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-neutral-800">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-green-400" />
              Zahlungsverlauf
            </h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-xs text-neutral-500 uppercase tracking-wide border-b border-neutral-800 bg-[#0a0a0a]">
                <th className="text-left py-3 px-4">Beschreibung</th>
                <th className="text-left py-3 px-4 w-28">Bezahlt am</th>
                <th className="text-right py-3 px-4 w-32">Betrag</th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody>
              {paidPayments.map((payment) => (
                <tr
                  key={payment.id}
                  className="border-b border-neutral-800/50 last:border-0 hover:bg-[#111]"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <div>
                        <p className="text-white">{payment.description}</p>
                        {payment.project && (
                          <p className="text-xs text-neutral-500">{payment.project.name}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-neutral-400">
                    {payment.paid_at && new Date(payment.paid_at).toLocaleDateString("de-DE")}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-white font-medium">{formatCurrency(payment.amount)}</span>
                  </td>
                  <td className="py-3 px-4">
                    {payment.invoice_url && (
                      <a
                        href={payment.invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 hover:bg-[#1a1a1a] rounded transition-colors"
                      >
                        <FileText className="w-4 h-4 text-neutral-400" />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* No Payments */}
      {payments.length === 0 && (
        <div className="card p-12 text-center">
          <CreditCard className="w-12 h-12 mx-auto text-neutral-600 mb-4" />
          <p className="text-neutral-400">Keine Zahlungen vorhanden</p>
          <p className="text-sm text-neutral-500 mt-2">
            Hier sehen Sie Ihre Rechnungen und den Zahlungsstatus
          </p>
        </div>
      )}
    </div>
  );
}
