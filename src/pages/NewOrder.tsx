import { useSearchParams } from "react-router-dom";
import { PosOrderWorkspace } from "@/components/order/PosOrderWorkspace";

export default function NewOrder() {
  const [searchParams] = useSearchParams();
  const addToOrderId = searchParams.get("addTo");
  const presetType = searchParams.get("type") as "dine_in" | "takeaway" | null;
  const presetTable = searchParams.get("table") || "";

  return (
    <PosOrderWorkspace
      addToOrderId={addToOrderId}
      addToTable={presetTable}
      addToType={(presetType || "dine_in") as "dine_in" | "takeaway"}
      initialOrderType={presetType ?? undefined}
      initialTableNumber={presetTable}
      forceMenuStep={
        !!addToOrderId ||
        presetType === "takeaway" ||
        !!presetTable.trim()
      }
    />
  );
}
