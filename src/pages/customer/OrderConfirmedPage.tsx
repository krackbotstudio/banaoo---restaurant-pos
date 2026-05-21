import { useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, Clock, UtensilsCrossed } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Outlet {
  id: string;
  name: string;
}

interface LocationState {
  order_number: string;
  order_id: string;
  total: number;
  payment_method: "cod" | "upi";
  awaiting_confirmation?: boolean;
}

export default function OrderConfirmedPage({ outlet, basePath }: { outlet: Outlet; basePath?: string }) {
  const resolvedBase = basePath ?? `/r/${outlet.id}`;
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | null;
  const [status, setStatus] = useState<string>("pending");

  useEffect(() => {
    if (!state?.order_id) return;

    // Poll order status every 10 seconds
    const poll = async () => {
      const { data } = await supabase
        .from("orders")
        .select("status, payment_status")
        .eq("id", state.order_id)
        .single();
      if (data?.status) setStatus(data.status);
    };

    poll();
    const interval = setInterval(poll, 10000);
    return () => clearInterval(interval);
  }, [state?.order_id]);

  if (!state?.order_number) {
    navigate(resolvedBase, { replace: true });
    return null;
  }

  const statusLabels: Record<string, { label: string; color: string }> = {
    pending: { label: "Waiting for confirmation", color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
    preparing: { label: "Being prepared", color: "text-blue-600 bg-blue-50 border-blue-200" },
    ready: { label: "Ready for pickup / service", color: "text-green-600 bg-green-50 border-green-200" },
    completed: { label: "Completed", color: "text-gray-600 bg-gray-50 border-gray-200" },
    cancelled: { label: "Cancelled", color: "text-red-600 bg-red-50 border-red-200" },
  };

  const currentStatus = statusLabels[status] ?? statusLabels["pending"];

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 py-10 text-center gap-6">
      <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
        <CheckCircle2 className="h-10 w-10 text-green-500" />
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-900">
          {state.awaiting_confirmation ? "Payment submitted" : "Order Placed!"}
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          {state.awaiting_confirmation
            ? `${outlet.name} will confirm your UPI payment shortly. Kitchen starts after confirmation.`
            : `Your order has been sent to ${outlet.name}`}
        </p>
      </div>

      <div className="bg-white w-full rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3 text-left">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500 font-medium">Order Number</span>
          <span className="font-bold text-gray-900 text-sm">{state.order_number}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500 font-medium">Total</span>
          <span className="font-bold text-gray-900 text-sm">₹{state.total?.toFixed(0)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500 font-medium">Payment</span>
          <span className="font-semibold text-gray-700 text-sm">
            {state.payment_method === "cod"
              ? "Pay at counter"
              : state.awaiting_confirmation
                ? "UPI — awaiting confirmation"
                : "UPI"}
          </span>
        </div>
        <div className="border-t border-gray-100 pt-3">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-gray-400" />
            <span className="text-xs text-gray-500 font-medium">Current Status</span>
          </div>
          <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-full border ${currentStatus.color}`}>
            {currentStatus.label}
          </span>
          <p className="text-xs text-gray-400 mt-1">Auto-refreshes every 10 seconds</p>
        </div>
      </div>

      <button
        onClick={() => navigate(resolvedBase)}
        className="w-full flex items-center justify-center gap-2 bg-primary text-white font-semibold py-3 rounded-xl text-sm"
      >
        <UtensilsCrossed className="h-4 w-4" />
        Order More Items
      </button>
    </div>
  );
}
