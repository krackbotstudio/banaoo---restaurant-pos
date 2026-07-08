import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { API_URL } from "@/lib/api-url";
import { useToast } from "@/hooks/use-toast";

interface Outlet {
  id: string;
  name: string;
}

interface PaymentData {
  order_id: string;
  order_number: string;
  total: number;
  currency?: string;
  gateway?: string | null;
  gateway_order_id?: string | null;
  payment_method: string;
  payment_status: string;
}

declare global {
  interface Window {
    Razorpay?: new (opts: unknown) => { open: () => void };
  }
}

export default function UpiPaymentPage({
  outlet,
  basePath,
}: {
  outlet: Outlet;
  basePath: string;
}) {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [data, setData] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (window.Razorpay) {
      setSdkReady(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => setSdkReady(true);
    script.onerror = () => setError("Could not load payment SDK. Please retry.");
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (!orderId) return;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/public/orders/${orderId}/payment`);
        if (!res.ok) throw new Error("Could not load payment");
        const json = await res.json();
        setData(json);
        if (json.payment_status === "paid") {
          navigate(`${basePath}/confirmed`, {
            state: {
              order_number: json.order_number,
              order_id: json.order_id,
              total: json.total,
              payment_method: "online",
            },
            replace: true,
          });
        }
      } catch {
        setError("Payment details not found");
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId, basePath, navigate]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center text-sm text-gray-600">
        {error || "Payment details not found."}
      </div>
    );
  }

  const openCheckout = async () => {
    if (!window.Razorpay) {
      setError("Payment SDK is not ready yet. Please retry.");
      return;
    }
    if (!data.gateway_order_id) {
      setError("Payment order is not ready. Please retry in a moment.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const keyRes = await fetch(`${API_URL}/api/public/orders/${orderId}/payment`);
      const latest = await keyRes.json();
      if (!keyRes.ok) throw new Error(latest.error || "Failed to initialize payment");

      const keyId = latest?.razorpay_key_id || latest?.key_id || import.meta.env.VITE_RAZORPAY_KEY_ID;
      if (!keyId) throw new Error("Razorpay key is not configured");

      const rzp = new window.Razorpay({
        key: keyId,
        amount: Math.round(Number(latest.total || data.total) * 100),
        currency: latest.currency || data.currency || "INR",
        name: outlet.name,
        description: `Order ${latest.order_number || data.order_number}`,
        order_id: latest.gateway_order_id || data.gateway_order_id,
        modal: {
          ondismiss: () => {
            toast({ title: "Payment not completed", description: "You can retry payment from this page." });
          },
        },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          const verifyRes = await fetch(`${API_URL}/api/public/orders/${orderId}/verify-online-payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });
          const verifyJson = await verifyRes.json();
          if (!verifyRes.ok) throw new Error(verifyJson.error || "Payment verification failed");
          navigate(`${basePath}/confirmed`, {
            state: {
              order_number: latest.order_number || data.order_number,
              order_id: latest.order_id || data.order_id,
              total: Number(latest.total || data.total),
              payment_method: "online",
            },
            replace: true,
          });
        },
      });
      rzp.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full pb-24">
      <div className="flex items-center gap-2 px-4 py-3 bg-white border-b border-gray-100">
        <button type="button" onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-700" />
        </button>
        <h2 className="font-bold text-base text-gray-900">Complete payment</h2>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div className="bg-white rounded-xl p-4 border border-gray-100 text-center">
          <p className="text-xs text-gray-500">Amount to pay</p>
          <p className="text-2xl font-bold text-gray-900">₹{data.total.toFixed(0)}</p>
          <p className="text-xs text-gray-500 mt-1">Order {data.order_number}</p>
        </div>

        {data.payment_status === "paid" ? (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 text-sm px-4 py-3 rounded-xl">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            Payment completed successfully.
          </div>
        ) : (
          <div className="bg-white rounded-xl p-4 border border-gray-100 space-y-3">
            <p className="text-sm font-semibold text-gray-900">Pay securely with Razorpay</p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="button"
              onClick={openCheckout}
              disabled={submitting || !sdkReady}
              className="w-full bg-gray-900 text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-60"
            >
              {submitting ? "Opening payment..." : "Pay now"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
