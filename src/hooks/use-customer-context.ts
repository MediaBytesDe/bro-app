"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { createClient } from "@/lib/supabase/client";

interface CustomerContext {
  customerId: string | null;
  customerName: string | null;
  isImpersonating: boolean;
  loading: boolean;
}

export function useCustomerContext(): CustomerContext {
  const { profile } = useAuth();
  const searchParams = useSearchParams();
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  const impersonateId = searchParams.get("impersonate");
  const isAdmin = profile?.role === "admin" || profile?.role === "superadmin";
  const isImpersonating = isAdmin && !!impersonateId;

  const supabase = createClient();

  useEffect(() => {
    async function loadCustomer() {
      if (!profile?.auth_id) {
        setLoading(false);
        return;
      }

      try {
        if (isImpersonating && impersonateId) {
          // Admin impersonating a customer - load that customer's info
          const { data: customer } = await supabase
            .from("customers")
            .select("id, first_name, last_name, company_name")
            .eq("id", impersonateId)
            .single();

          if (customer) {
            setCustomerId(customer.id);
            setCustomerName(
              customer.company_name || 
              `${customer.first_name} ${customer.last_name}`
            );
          }
        } else {
          // Normal customer - find their own record
          const { data: customer } = await supabase
            .from("customers")
            .select("id, first_name, last_name, company_name")
            .eq("auth_user_id", profile.auth_id)
            .single();

          if (customer) {
            setCustomerId(customer.id);
            setCustomerName(
              customer.company_name || 
              `${customer.first_name} ${customer.last_name}`
            );
          }
        }
      } catch (err) {
        console.error("Error loading customer context:", err);
      } finally {
        setLoading(false);
      }
    }

    loadCustomer();
  }, [profile?.auth_id, impersonateId, isImpersonating]);

  return {
    customerId,
    customerName,
    isImpersonating,
    loading,
  };
}
