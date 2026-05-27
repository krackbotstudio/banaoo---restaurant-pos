import { useState } from "react";
import { useCustomer } from "@/context/customer-context";
import { UtensilsCrossed, ArrowRight, Loader2, Phone } from "lucide-react";

interface Outlet {
  id: string;
  name: string;
  address: string | null;
}

interface PhoneEntryPageProps {
  outlet: Outlet;
  onCustomerReady: () => void;
  onNeedSetup: (phone: string) => void;
}

export default function PhoneEntryPage({ outlet, onCustomerReady, onNeedSetup }: PhoneEntryPageProps) {
  const { lookupByPhone, loading } = useCustomer();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const cleaned = phone.replace(/[\s\-\(\)]/g, "");
    if (cleaned.length < 10) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }
    try {
      const existing = await lookupByPhone(cleaned);
      if (existing) {
        onCustomerReady();
      } else {
        onNeedSetup(cleaned);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">
      {/* Top branding */}
      <div className="bg-white border-b border-gray-100 px-6 pt-10 pb-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary mx-auto mb-4">
          <UtensilsCrossed className="h-7 w-7 text-primary-foreground" />
        </div>
        <h1 className="font-bold text-xl text-gray-900">{outlet.name}</h1>
        {outlet.address && <p className="text-sm text-gray-500 mt-1">{outlet.address}</p>}
      </div>

      {/* Form */}
      <div className="flex-1 px-6 py-8 flex flex-col">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Welcome!</h2>
          <p className="text-gray-500 mt-1 text-sm">Enter your mobile number to start ordering</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
              Mobile Number
            </label>
            <div className="flex items-center gap-3 bg-white border-2 border-gray-200 rounded-2xl px-4 py-3 focus-within:border-primary transition-colors">
              <Phone className="h-5 w-5 text-gray-400 flex-shrink-0" />
              <div className="flex items-center gap-2 flex-1">
                <span className="text-gray-500 font-medium text-sm">+91</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="98765 43210"
                  value={phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9\s]/g, "");
                    setPhone(val);
                    setError("");
                  }}
                  maxLength={12}
                  autoFocus
                  className="flex-1 outline-none text-base text-gray-900 bg-transparent placeholder-gray-300"
                />
              </div>
            </div>
            {error && <p className="text-red-500 text-xs mt-1.5">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={loading || phone.replace(/\s/g, "").length < 10}
            className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-2xl text-base flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity mt-2"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                Continue
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-6">
          Your details are saved for faster ordering next time
        </p>
      </div>
    </div>
  );
}
