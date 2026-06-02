import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Copy, ExternalLink, Loader2, CheckCircle2 } from "lucide-react";
import { buildUpiPayUrl } from "@/lib/upi";
import { API_URL } from "@/lib/api-url";
import { UpiPaymentQr } from "@/components/customer/UpiPaymentQr";
import { useToast } from "@/hooks/use-toast";

interface Outlet {
  id: string;
  name: string;
}

interface PaymentData {
  order_id: string;
  order_number: string;
  total: number;
  payment_status: string;
  upi_vpa: string | null;
  upi_display_name: string | null;
  upi_qr_url: string | null;
  customer_reference?: string | null;
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
  const [utr, setUtr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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
              payment_method: "upi",
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

  if (!data?.upi_vpa) {
    return (
      <div className="p-6 text-center text-sm text-gray-600">
        {error || "UPI is not configured for this restaurant."}
      </div>
    );
  }

  const payUrl = buildUpiPayUrl({
    vpa: data.upi_vpa,
    payeeName: data.upi_display_name || outlet.name,
    amount: data.total,
    transactionRef: data.order_number,
    note: `Order ${data.order_number}`,
  });

  const copyVpa = () => {
    void navigator.clipboard.writeText(data.upi_vpa!);
    toast({ title: "UPI ID copied" });
  };

  const handleSubmitUtr = async () => {
    setError("");
    if (!utr.trim()) {
      setError("Enter your UTR / transaction reference");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/public/orders/${orderId}/submit-upi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utr: utr.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to submit");
      navigate(`${basePath}/confirmed`, {
        state: {
          order_number: data.order_number,
          order_id: data.order_id,
          total: data.total,
          payment_method: "upi",
          awaiting_confirmation: true,
        },
        replace: true,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const alreadySubmitted = data.payment_status === "awaiting_confirmation";

  return (
    <div className="flex flex-col min-h-full pb-24">
      <div className="flex items-center gap-2 px-4 py-3 bg-white border-b border-gray-100">
        <button type="button" onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-700" />
        </button>
        <h2 className="font-bold text-base text-gray-900">Pay with UPI</h2>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div className="bg-white rounded-xl p-4 border border-gray-100 text-center">
          <p className="text-xs text-gray-500">Amount to pay</p>
          <p className="text-2xl font-bold text-gray-900">₹{data.total.toFixed(0)}</p>
          <p className="text-xs text-gray-500 mt-1">Order {data.order_number}</p>
        </div>

        {data.upi_vpa ? (
          <UpiPaymentQr payUrl={payUrl} uploadedQrUrl={data.upi_qr_url} />
        ) : null}

        <div className="bg-white rounded-xl p-4 border border-gray-100 space-y-3">
          <p className="text-sm font-semibold text-gray-900">Or pay manually</p>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs text-gray-500">UPI ID</p>
              <p className="font-mono text-sm font-medium">{data.upi_vpa}</p>
            </div>
            <button type="button" onClick={copyVpa} className="p-2 rounded-lg bg-gray-100">
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <a
            href={payUrl}
            className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl text-sm"
          >
            <ExternalLink className="h-4 w-4" />
            Open UPI app
          </a>
        </div>

        {alreadySubmitted ? (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 text-sm px-4 py-3 rounded-xl">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            Payment submitted. Waiting for restaurant to confirm.
          </div>
        ) : (
          <div className="bg-white rounded-xl p-4 border border-gray-100 space-y-3">
            <p className="text-sm font-semibold text-gray-900">After paying, enter UTR</p>
            <input
              type="text"
              placeholder="12-digit UTR / Ref no."
              value={utr}
              onChange={(e) => setUtr(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="button"
              onClick={handleSubmitUtr}
              disabled={submitting}
              className="w-full bg-gray-900 text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "I've paid — submit UTR"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
