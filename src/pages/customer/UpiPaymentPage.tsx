import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, CheckCircle2, ExternalLink } from "lucide-react";
import { API_URL } from "@/lib/api-url";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  payment_provider?: string | null;
  gateway_order_id?: string | null;
  payment_method: string;
  payment_status: string;
  razorpay_key_id?: string | null;
  google_pay?: {
    transaction_ref: string;
    payment_request: {
      supportedInstruments: unknown[];
      details: unknown;
    };
    upi_intent_url: string;
    merchant_vpa: string;
    payee_name: string | null;
  } | null;
}

declare global {
  interface Window {
    Razorpay?: new (opts: unknown) => { open: () => void };
    PaymentRequest?: new (
      methods: unknown[],
      details: unknown
    ) => {
      canMakePayment: () => Promise<unknown>;
      show: () => Promise<{ complete: (result: string) => Promise<void> }>;
    };
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
  const [utr, setUtr] = useState("");
  const [paidStep, setPaidStep] = useState(false);

  const isGooglePay =
    data?.payment_provider === "google_pay" || data?.gateway === "google_pay";

  useEffect(() => {
    if (isGooglePay) {
      setSdkReady(true);
      return;
    }
    if (window.Razorpay) {
      setSdkReady(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => setSdkReady(true);
    script.onerror = () => setError("Could not load payment SDK. Please retry.");
    document.body.appendChild(script);
  }, [isGooglePay]);

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
        } else if (json.payment_status === "awaiting_confirmation") {
          navigate(`${basePath}/confirmed`, {
            state: {
              order_number: json.order_number,
              order_id: json.order_id,
              total: json.total,
              payment_method: "online",
              awaiting_confirmation: true,
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

  const openGooglePay = async () => {
    if (!data?.google_pay) {
      setError("Google Pay is not ready for this order.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const gp = data.google_pay;
      const canUsePaymentRequest =
        typeof window.PaymentRequest === "function" &&
        Array.isArray(gp.payment_request?.supportedInstruments);

      if (canUsePaymentRequest) {
        try {
          const request = new window.PaymentRequest!(
            gp.payment_request.supportedInstruments as unknown[],
            gp.payment_request.details
          );
          const canPay = await request.canMakePayment();
          if (canPay) {
            const result = await request.show();
            await result.complete("success");
            setPaidStep(true);
            toast({
              title: "Complete in Google Pay",
              description: "After paying, enter the UTR / UPI reference below.",
            });
            return;
          }
        } catch (prErr) {
          console.warn("PaymentRequest failed, falling back to UPI intent:", prErr);
        }
      }

      if (gp.upi_intent_url) {
        window.location.href = gp.upi_intent_url;
        setPaidStep(true);
        return;
      }
      setError("Could not open Google Pay on this device. Use a UPI app and enter the UTR below.");
      setPaidStep(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start Google Pay");
    } finally {
      setSubmitting(false);
    }
  };

  const submitUtr = async () => {
    if (!orderId) return;
    const ref = utr.trim();
    if (ref.length < 6) {
      setError("Enter a valid UTR / UPI reference (min 6 characters).");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/public/orders/${orderId}/submit-upi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utr: ref }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not submit UTR");
      navigate(`${basePath}/confirmed`, {
        state: {
          order_number: json.order_number || data?.order_number,
          order_id: json.order_id || data?.order_id,
          total: Number(data?.total || 0),
          payment_method: "online",
          awaiting_confirmation: true,
        },
        replace: true,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit UTR");
    } finally {
      setSubmitting(false);
    }
  };

  const openCheckout = async () => {
    if (!window.Razorpay) {
      setError("Payment SDK is not ready yet. Please retry.");
      return;
    }
    if (!data?.gateway_order_id) {
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
            toast({
              title: "Payment not completed",
              description: "You can retry payment from this page.",
            });
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
        ) : isGooglePay ? (
          <div className="bg-white rounded-xl p-4 border border-gray-100 space-y-3">
            <p className="text-sm font-semibold text-gray-900">Pay with Google Pay</p>
            <p className="text-xs text-gray-500">
              Pay to {data.google_pay?.payee_name || outlet.name}
              {data.google_pay?.merchant_vpa ? ` (${data.google_pay.merchant_vpa})` : ""}. Then enter
              the UTR from your UPI app.
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="button"
              onClick={() => void openGooglePay()}
              disabled={submitting}
              className="w-full bg-gray-900 text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {submitting ? (
                "Opening Google Pay..."
              ) : (
                <>
                  Open Google Pay
                  <ExternalLink className="h-4 w-4" />
                </>
              )}
            </button>
            {(paidStep || data.google_pay) && (
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <Label htmlFor="gpay-utr" className="text-sm">
                  UTR / UPI reference
                </Label>
                <Input
                  id="gpay-utr"
                  value={utr}
                  onChange={(e) => setUtr(e.target.value)}
                  placeholder="Enter UTR after payment"
                  className="font-mono"
                />
                <button
                  type="button"
                  onClick={() => void submitUtr()}
                  disabled={submitting || utr.trim().length < 6}
                  className="w-full bg-emerald-600 text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-60"
                >
                  {submitting ? "Submitting..." : "I've paid — submit UTR"}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl p-4 border border-gray-100 space-y-3">
            <p className="text-sm font-semibold text-gray-900">Pay securely with Razorpay</p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="button"
              onClick={() => void openCheckout()}
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
