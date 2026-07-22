import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useOutlet } from "../context/OutletContext";
import {
  fetchOrderItems,
  fetchOrdersForOutlet,
  markOrderPaid,
  NEXT_ORDER_STATUS,
  OrderItemRow,
  OrderRow,
  OrderStatus,
  updateOrderStatus,
} from "../services/orders";
import { printBillingReceipt } from "../printer/printer-service";
import { usePrinterSettings } from "../printer/usePrinterSettings";
import { tokens } from "../theme/tokens";

const ORDER_FILTERS: Array<OrderStatus | "all"> = [
  "all",
  "pending",
  "preparing",
  "ready",
  "completed",
  "paid",
  "cancelled",
];

export function OrdersScreen() {
  const { currentOutlet } = useOutlet();
  const { settings: printerSettings } = usePrinterSettings(currentOutlet?.id);
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<OrderItemRow[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [updating, setUpdating] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [discountInput, setDiscountInput] = useState("0");
  const [serviceTaxInput, setServiceTaxInput] = useState("0");

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) ?? null,
    [orders, selectedOrderId]
  );

  const loadOrders = async () => {
    if (!currentOutlet?.id) return;
    setLoading(true);
    try {
      const rows = await fetchOrdersForOutlet(currentOutlet.id, filter);
      setOrders(rows);
      if (rows.length === 0) {
        setSelectedOrderId(null);
        setSelectedItems([]);
      } else if (!rows.find((row) => row.id === selectedOrderId)) {
        setSelectedOrderId(rows[0].id);
      }
    } catch (err) {
      Alert.alert("Could not load orders", err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const loadItems = async (orderId: string) => {
    setItemsLoading(true);
    try {
      const items = await fetchOrderItems(orderId);
      setSelectedItems(items);
    } catch (err) {
      Alert.alert("Could not load order items", err instanceof Error ? err.message : String(err));
    } finally {
      setItemsLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, [currentOutlet?.id, filter]);

  useEffect(() => {
    if (selectedOrderId) void loadItems(selectedOrderId);
  }, [selectedOrderId]);

  useEffect(() => {
    setDiscountInput("0");
    setServiceTaxInput("0");
    setDiscountType("percent");
  }, [selectedOrderId]);

  const advanceOrder = async () => {
    if (!selectedOrder) return;
    const next = NEXT_ORDER_STATUS[selectedOrder.status];
    if (!next) return;
    setUpdating(true);
    try {
      await updateOrderStatus(selectedOrder.id, next);
      await loadOrders();
    } catch (err) {
      Alert.alert("Could not update status", err instanceof Error ? err.message : String(err));
    } finally {
      setUpdating(false);
    }
  };

  const cancelOrder = async () => {
    if (!selectedOrder) return;
    setUpdating(true);
    try {
      await updateOrderStatus(selectedOrder.id, "cancelled");
      await loadOrders();
    } catch (err) {
      Alert.alert("Could not cancel order", err instanceof Error ? err.message : String(err));
    } finally {
      setUpdating(false);
    }
  };

  const selectedSubtotal = selectedItems.reduce((sum, item) => sum + item.total_price, 0);
  const discountValue = Number(discountInput) || 0;
  const serviceTaxPercent = Number(serviceTaxInput) || 0;
  const discountAmount =
    discountType === "percent"
      ? Math.round((selectedSubtotal * discountValue) * 100) / 10000
      : discountValue;
  const taxable = Math.max(0, selectedSubtotal - discountAmount);
  const discountRatio = selectedSubtotal > 0 ? taxable / selectedSubtotal : 1;
  const itemGstTotal = Math.round(
    selectedItems.reduce((sum, item) => {
      const rate = item.gst_rate || 0;
      if (!rate) return sum;
      return sum + (item.total_price * discountRatio * rate) / 100;
    }, 0) * 100
  ) / 100;
  const serviceTaxAmount = Math.round((taxable * serviceTaxPercent) * 100) / 10000;
  const payable = Math.round(Math.max(0, taxable + itemGstTotal + serviceTaxAmount) * 100) / 100;

  const markPaid = async () => {
    if (!selectedOrder) return;
    setUpdating(true);
    try {
      await markOrderPaid(selectedOrder.id, {
        discount: Math.round(discountAmount * 100) / 100,
        tax: Math.round((itemGstTotal + serviceTaxAmount) * 100) / 100,
        total: payable,
      });
      await loadOrders();
      Alert.alert("Payment saved", "Order marked as paid.");
    } catch (err) {
      Alert.alert("Could not mark paid", err instanceof Error ? err.message : String(err));
    } finally {
      setUpdating(false);
    }
  };

  const printBill = async () => {
    if (!selectedOrder || printing) return;
    setPrinting(true);
    try {
      const result = await printBillingReceipt(printerSettings, {
        orderNumber: selectedOrder.order_number,
        outletName: currentOutlet?.name || "Outlet",
        orderType: selectedOrder.order_type === "dine_in" ? "dine_in" : "takeaway",
        tableNumber: selectedOrder.table_number || undefined,
        items: selectedItems.map((item) => ({
          name: item.item_name,
          quantity: item.quantity,
          totalPrice: item.total_price,
          gstRate: item.gst_rate || undefined,
        })),
        subtotal: selectedSubtotal,
        discountAmt: discountAmount,
        serviceTax: serviceTaxAmount,
        serviceTaxPercent,
        gstTotal: itemGstTotal,
        grandTotal: payable,
        createdAt: new Date(selectedOrder.created_at),
      });
      Alert.alert(result.ok ? "Print" : "Print error", result.message);
    } finally {
      setPrinting(false);
    }
  };

  if (!currentOutlet) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.title}>Orders</Text>
        <Text style={styles.text}>No outlet selected for this user.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Orders</Text>
          <Text style={styles.subtitle}>{currentOutlet.name}</Text>
        </View>
        <Pressable style={styles.refreshBtn} onPress={() => loadOrders()} disabled={loading}>
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {ORDER_FILTERS.map((candidate) => {
          const active = filter === candidate;
          return (
            <Pressable
              key={candidate}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setFilter(candidate)}
            >
              <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>{candidate}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Order List ({orders.length})</Text>
            {orders.map((order) => {
              const selected = order.id === selectedOrder?.id;
              return (
                <Pressable
                  key={order.id}
                  onPress={() => setSelectedOrderId(order.id)}
                  style={[styles.orderRow, selected && styles.orderRowSelected]}
                >
                  <View>
                    <Text style={styles.orderNo}>#{order.order_number}</Text>
                    <Text style={styles.orderMeta}>
                      {order.order_type} {order.table_number ? `• T${order.table_number}` : ""}
                    </Text>
                  </View>
                  <View style={styles.orderRight}>
                    <Text style={styles.status}>{order.status}</Text>
                    <Text style={styles.amount}>Rs.{order.total}</Text>
                  </View>
                </Pressable>
              );
            })}
            {orders.length === 0 && <Text style={styles.text}>No orders for selected filter.</Text>}
          </View>

          {selectedOrder && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Order Detail #{selectedOrder.order_number}</Text>
              <Text style={styles.orderMeta}>Status: {selectedOrder.status}</Text>
              <Text style={styles.orderMeta}>Customer: {selectedOrder.customer_name || "-"}</Text>
              <Text style={styles.orderMeta}>Items Total: Rs.{selectedSubtotal.toFixed(2)}</Text>

              {itemsLoading ? (
                <ActivityIndicator style={{ marginVertical: 10 }} />
              ) : (
                selectedItems.map((item) => (
                  <View key={item.id} style={styles.itemRow}>
                    <Text style={styles.itemName}>
                      {item.quantity} x {item.item_name}
                    </Text>
                    <Text style={styles.itemAmt}>Rs.{item.total_price}</Text>
                  </View>
                ))
              )}

              <View style={styles.actionRow}>
                <Pressable
                  style={[styles.actionBtn, updating && styles.actionDisabled]}
                  onPress={advanceOrder}
                  disabled={updating || !NEXT_ORDER_STATUS[selectedOrder.status]}
                >
                  <Text style={styles.actionText}>
                    {NEXT_ORDER_STATUS[selectedOrder.status]
                      ? `Mark ${NEXT_ORDER_STATUS[selectedOrder.status]}`
                      : "No next state"}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.cancelBtn, updating && styles.actionDisabled]}
                  onPress={cancelOrder}
                  disabled={updating || selectedOrder.status === "paid" || selectedOrder.status === "cancelled"}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
              </View>

              {selectedOrder.status !== "cancelled" && selectedOrder.status !== "paid" && (
                <View style={styles.billingCard}>
                  <Text style={styles.sectionTitle}>Billing</Text>

                  <View style={styles.inputRow}>
                    <Text style={styles.inputLabel}>Discount</Text>
                    <View style={styles.discountModeRow}>
                      <Pressable
                        style={[styles.modeBtn, discountType === "percent" && styles.modeBtnActive]}
                        onPress={() => setDiscountType("percent")}
                      >
                        <Text style={[styles.modeText, discountType === "percent" && styles.modeTextActive]}>%</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.modeBtn, discountType === "amount" && styles.modeBtnActive]}
                        onPress={() => setDiscountType("amount")}
                      >
                        <Text style={[styles.modeText, discountType === "amount" && styles.modeTextActive]}>Rs</Text>
                      </Pressable>
                    </View>
                    <TextInput
                      style={styles.input}
                      value={discountInput}
                      onChangeText={setDiscountInput}
                      keyboardType="decimal-pad"
                    />
                  </View>

                  <View style={styles.inputRow}>
                    <Text style={styles.inputLabel}>Service Tax %</Text>
                    <TextInput
                      style={styles.input}
                      value={serviceTaxInput}
                      onChangeText={setServiceTaxInput}
                      keyboardType="decimal-pad"
                    />
                  </View>

                  <Text style={styles.billLine}>Subtotal: Rs.{selectedSubtotal.toFixed(2)}</Text>
                  <Text style={styles.billLine}>Discount: - Rs.{discountAmount.toFixed(2)}</Text>
                  <Text style={styles.billLine}>GST: + Rs.{itemGstTotal.toFixed(2)}</Text>
                  <Text style={styles.billLine}>Service Tax: + Rs.{serviceTaxAmount.toFixed(2)}</Text>
                  <Text style={styles.billTotal}>Total Payable: Rs.{payable.toFixed(2)}</Text>

                  <Pressable
                    style={[styles.payBtn, updating && styles.actionDisabled]}
                    onPress={markPaid}
                    disabled={updating || selectedOrder.status !== "completed"}
                  >
                    <Text style={styles.payText}>
                      {selectedOrder.status === "completed"
                        ? "Mark as Paid"
                        : "Complete order before payment"}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[styles.printBtn, printing && styles.actionDisabled]}
                    onPress={() => void printBill()}
                    disabled={printing}
                  >
                    <Text style={styles.printText}>{printing ? "Printing..." : "Print Bill"}</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#f8fafc",
  },
  title: { fontSize: 24, fontWeight: "700", color: "#0f172a" },
  subtitle: { color: "#64748b", marginTop: 2 },
  text: { color: "#64748b", lineHeight: 20 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  refreshBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
  refreshText: { color: "#334155", fontWeight: "600" },
  filterRow: { gap: 8, paddingVertical: 12 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
  },
  filterChipActive: {
    borderColor: tokens.colors.primary,
    backgroundColor: "#FFF1E6",
  },
  filterLabel: { color: "#334155", textTransform: "capitalize" },
  filterLabelActive: { color: "#c2410c", fontWeight: "700" },
  loadingBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { gap: 12, paddingBottom: 20 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    gap: 8,
  },
  sectionTitle: { fontWeight: "700", fontSize: 15, color: "#0f172a" },
  orderRow: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  orderRowSelected: {
    borderColor: tokens.colors.primary,
    backgroundColor: "#FFF1E6",
  },
  orderNo: { fontWeight: "700", color: "#1e293b" },
  orderMeta: { color: "#64748b", fontSize: 12 },
  orderRight: { alignItems: "flex-end", gap: 2 },
  status: { textTransform: "capitalize", color: "#334155", fontWeight: "600" },
  amount: { color: "#0f172a", fontWeight: "700" },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 6,
  },
  itemName: { color: "#334155", flex: 1, marginRight: 8 },
  itemAmt: { color: "#0f172a", fontWeight: "600" },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  actionBtn: {
    flex: 1,
    backgroundColor: tokens.colors.primary,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  actionText: { color: "#fff", fontWeight: "700", textTransform: "capitalize" },
  cancelBtn: {
    width: 90,
    borderWidth: 1,
    borderColor: "#ef4444",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  cancelText: { color: "#b91c1c", fontWeight: "700" },
  actionDisabled: { opacity: 0.5 },
  billingCard: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 10,
    gap: 8,
    backgroundColor: "#fafafa",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inputLabel: {
    width: 90,
    color: "#334155",
    fontWeight: "600",
    fontSize: 12,
  },
  input: {
    minWidth: 70,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: "#fff",
    color: "#0f172a",
  },
  discountModeRow: { flexDirection: "row", gap: 6 },
  modeBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: "#fff",
  },
  modeBtnActive: {
    borderColor: tokens.colors.primary,
    backgroundColor: "#FFF1E6",
  },
  modeText: { color: "#334155", fontWeight: "700", fontSize: 12 },
  modeTextActive: { color: "#c2410c" },
  billLine: { color: "#475569", fontSize: 12 },
  billTotal: { color: "#0f172a", fontWeight: "800", marginTop: 2 },
  payBtn: {
    marginTop: 4,
    borderRadius: 8,
    backgroundColor: "#16a34a",
    paddingVertical: 10,
    alignItems: "center",
  },
  payText: { color: "#fff", fontWeight: "800" },
  printBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#0f172a",
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  printText: { color: "#0f172a", fontWeight: "700" },
});
