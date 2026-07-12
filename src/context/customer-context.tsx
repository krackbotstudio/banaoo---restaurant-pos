import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

// Cast to any because customers/customer_addresses tables were added via migration
// and types haven't been regenerated yet
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface CustomerAddress {
  id?: string;
  label: string;
  address_text: string;
  lat?: number | null;
  lng?: number | null;
  is_default: boolean;
}

export interface CustomerProfile {
  id: string;
  phone: string;
  name: string;
  customer_addresses: CustomerAddress[];
}

interface CustomerContextValue {
  customer: CustomerProfile | null;
  loading: boolean;
  lookupByPhone: (phone: string) => Promise<CustomerProfile | null>;
  saveCustomer: (phone: string, name: string, address?: CustomerAddress) => Promise<CustomerProfile | null>;
  updateAddress: (addressId: string, address: CustomerAddress) => Promise<void>;
  clearCustomer: () => void;
}

const CustomerContext = createContext<CustomerContextValue | null>(null);

import { useEffect } from "react";

function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-\(\)]/g, "");
}

export function CustomerProvider({ children, ownerId }: { children: ReactNode; ownerId?: string }) {
  const storageKey = ownerId ? `banaoo_customer_${ownerId}` : "banaoo_customer";

  const [customer, setCustomer] = useState<CustomerProfile | null>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setCustomer(raw ? JSON.parse(raw) : null);
    } catch {
      setCustomer(null);
    }
  }, [storageKey]);

  const saveToStorage = useCallback((profile: CustomerProfile | null) => {
    if (profile) {
      localStorage.setItem(storageKey, JSON.stringify(profile));
    } else {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  const fetchFullProfile = useCallback(async (id: string): Promise<CustomerProfile | null> => {
    const { data, error } = await db
      .from("customers")
      .select("id, phone, name, customer_addresses(id, label, address_text, lat, lng, is_default)")
      .eq("id", id)
      .single();
    if (error || !data) return null;
    return data as CustomerProfile;
  }, []);

  const lookupByPhone = useCallback(async (phone: string): Promise<CustomerProfile | null> => {
    if (!ownerId) return null;
    setLoading(true);
    try {
      const normalized = normalizePhone(phone);
      const { data, error } = await db
        .from("customers")
        .select("id, phone, name, customer_addresses(id, label, address_text, lat, lng, is_default)")
        .eq("phone", normalized)
        .eq("owner_id", ownerId)
        .maybeSingle();

      if (error) {
        console.error("customer lookup error:", error);
        return null;
      }
      const profile = data as CustomerProfile | null;
      if (profile) {
        setCustomer(profile);
        saveToStorage(profile);
      }
      return profile;
    } catch (err) {
      console.error("customer lookup exception:", err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [ownerId, saveToStorage]);

  const saveCustomer = useCallback(async (
    phone: string,
    name: string,
    address?: CustomerAddress
  ): Promise<CustomerProfile | null> => {
    if (!ownerId) return null;
    setLoading(true);
    try {
      const normalized = normalizePhone(phone);

      // Upsert customer record
      const { data: upserted, error: upsertError } = await db
        .from("customers")
        .upsert(
          { phone: normalized, name, owner_id: ownerId, updated_at: new Date().toISOString() },
          { onConflict: "phone,owner_id", ignoreDuplicates: false }
        )
        .select("id, phone, name")
        .single();

      if (upsertError || !upserted) {
        console.error("customer upsert error:", upsertError);
        return null;
      }

      // Handle address
      if (address) {
        if (address.id) {
          // Update existing address
          await db
            .from("customer_addresses")
            .update({
              label: address.label,
              address_text: address.address_text,
              lat: address.lat ?? null,
              lng: address.lng ?? null,
              is_default: address.is_default,
            })
            .eq("id", address.id)
            .eq("customer_id", upserted.id);
        } else {
          // Clear existing defaults if new address is default
          if (address.is_default) {
            await db
              .from("customer_addresses")
              .update({ is_default: false })
              .eq("customer_id", upserted.id);
          }
          // Insert new address
          await db.from("customer_addresses").insert({
            customer_id: upserted.id,
            label: address.label,
            address_text: address.address_text,
            lat: address.lat ?? null,
            lng: address.lng ?? null,
            is_default: address.is_default,
          });
        }
      }

      // Return full profile with addresses
      const profile = await fetchFullProfile(upserted.id);
      if (profile) {
        setCustomer(profile);
        saveToStorage(profile);
      }
      return profile;
    } catch (err) {
      console.error("customer save exception:", err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [ownerId, fetchFullProfile, saveToStorage]);

  const updateAddress = useCallback(async (addressId: string, address: CustomerAddress) => {
    if (!customer) return;
    try {
      if (address.is_default) {
        await db
          .from("customer_addresses")
          .update({ is_default: false })
          .eq("customer_id", customer.id);
      }
      await db
        .from("customer_addresses")
        .update({
          label: address.label,
          address_text: address.address_text,
          lat: address.lat ?? null,
          lng: address.lng ?? null,
          is_default: address.is_default,
         })
        .eq("id", addressId)
        .eq("customer_id", customer.id);

      const profile = await fetchFullProfile(customer.id);
      if (profile) {
        setCustomer(profile);
        saveToStorage(profile);
      }
    } catch (err) {
      console.error("updateAddress exception:", err);
    }
  }, [customer, fetchFullProfile, saveToStorage]);

  const clearCustomer = useCallback(() => {
    setCustomer(null);
    saveToStorage(null);
  }, [saveToStorage]);

  return (
    <CustomerContext.Provider value={{ customer, loading, lookupByPhone, saveCustomer, updateAddress, clearCustomer }}>
      {children}
    </CustomerContext.Provider>
  );
}

export function useCustomer() {
  const ctx = useContext(CustomerContext);
  if (!ctx) throw new Error("useCustomer must be used within CustomerProvider");
  return ctx;
}
