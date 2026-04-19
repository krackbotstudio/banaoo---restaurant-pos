import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useOutlet } from "../context/OutletContext";
import {
  deriveOrderStatus,
  fetchOrderItems,
  fetchOrdersForOutlet,
  ItemStatus,
  NEXT_ITEM_STATUS,
  OrderItemRow,
  OrderRow,
  updateOrderItemStatus,
  updateOrderStatus,
} from "../services/orders";
import { printKitchenSlip } from "../printer/printer-service";
import { usePrinterSettings } from "../printer/usePrinterSettings";

export function KitchenScreen() {
  const { currentOutlet } = useOutlet();
  const { settings: printerSettings } = usePrinterSettings(currentOutlet?.id);
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) ?? null,
    [orders, selectedOrderId]
  );

  const loadKitchenOrders = async () => {
    if (!currentOutlet?.id) return;
    setLoading(true);
    try {
      const [pending, preparing, ready] = await Promise.all([
        fetchOrdersForOutlet(currentOutlet.id, "pending"),
        fetchOrdersForOutlet(currentOutlet.id, "preparing"),
        fetchOrdersForOutlet(currentOutlet.id, "ready"),
      ]);
      const merged = [...pending, ...preparing, ...ready].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      setOrders(merged);
      if (merged.length === 0) {
        setSelectedOrderId(null);
        setItems([]);
      } else if (!merged.find((order) => order.id === selectedOrderId)) {
        setSelectedOrderId(merged[0].id);
      }
    } catch (err) {
      Alert.alert("Could not load kitchen queue", err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const loadItems = async (orderId: string) => {
    setItemsLoading(true);
    try {
      const rows = await fetchOrderItems(orderId);
      setItems(rows);
    } catch (err) {
      Alert.alert("Could not load order items", err instanceof Error ? err.message : String(err));
    } finally {
      setItemsLoading(false);
    }
  };

  useEffect(() => {
    void loadKitchenOrders();
  }, [currentOutlet?.id]);

  useEffect(() => {
    if (selectedOrderId) void loadItems(selectedOrderId);
  }, [selectedOrderId]);

  const advanceItem = async (itemId: string, nextStatus: ItemStatus) => {
    if (!selectedOrder) return;
    setUpdatingItemId(itemId);
    try {
      await updateOrderItemStatus(itemId, nextStatus);
      const refreshedItems = await fetchOrderItems(selectedOrder.id);
      setItems(refreshedItems);
      const derived = deriveOrderStatus(refreshedItems);
      if (selectedOrder.status !== derived) {
        await updateOrderStatus(selectedOrder.id, derived);
      }
      await loadKitchenOrders();
    } catch (err) {
      Alert.alert("Could not update item status", err instanceof Error ? err.message : String(err));
    } finally {
      setUpdatingItemId(null);
    }
  };

  const printKitchen = async () => {
    if (!selectedOrder) return;
    const result = await printKitchenSlip(printerSettings, {
      orderNumber: selectedOrder.order_number,
      orderType: selectedOrder.order_type === "dine_in" ? "dine_in" : "takeaway",
      tableNumber: selectedOrder.table_number || undefined,
      items: items.map((item) => ({ name: item.item_name, quantity: item.quantity })),
      createdAt: new Date(selectedOrder.created_at),
    });
    Alert.alert(result.ok ? "Print" : "Print error", result.message);
  };

  if (!currentOutlet) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.title}>Kitchen</Text>
        <Text style={styles.text}>No outlet selected for this user.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Kitchen Queue</Text>
          <Text style={styles.subtitle}>{currentOutlet.name}</Text>
        </View>
        <Pressable style={styles.refreshBtn} onPress={() => loadKitchenOrders()} disabled={loading}>
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Active Orders ({orders.length})</Text>
            {orders.map((order) => {
              const selected = order.id === selectedOrder?.id;
              return (
                <Pressable
                  key={order.id}
                  style={[styles.orderRow, selected && styles.orderRowSelected]}
                  onPress={() => setSelectedOrderId(order.id)}
                >
                  <Text style={styles.orderNo}>#{order.order_number}</Text>
                  <Text style={styles.status}>{order.status}</Text>
                </Pressable>
              );
            })}
            {orders.length === 0 && <Text style={styles.text}>No active kitchen orders.</Text>}
          </View>

          {selectedOrder && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Order #{selectedOrder.order_number}</Text>
              <Text style={styles.orderMeta}>
                {selectedOrder.order_type} {selectedOrder.table_number ? `• T${selectedOrder.table_number}` : ""}
              </Text>
              <Pressable style={styles.printBtn} onPress={() => void printKitchen()}>
                <Text style={styles.printText}>Print Kitchen Slip</Text>
              </Pressable>

              {itemsLoading ? (
                <ActivityIndicator style={{ marginVertical: 10 }} />
              ) : (
                items.map((item) => {
                  const next = NEXT_ITEM_STATUS[item.status];
                  return (
                    <View key={item.id} style={styles.itemCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemName}>
                          {item.quantity} x {item.item_name}
                        </Text>
                        <Text style={styles.itemStatus}>Status: {item.status}</Text>
                      </View>
                      <Pressable
                        style={[styles.itemAction, (!next || updatingItemId === item.id) && styles.disabled]}
                        disabled={!next || updatingItemId === item.id}
                        onPress={() => next && advanceItem(item.id, next)}
                      >
                        <Text style={styles.itemActionText}>{next ? `Mark ${next}` : "Done"}</Text>
                      </Pressable>
                    </View>
                  );
                })
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
    justifyContent: "space-between",
    alignItems: "center",
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
  loadingBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { gap: 12, paddingTop: 12, paddingBottom: 20 },
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
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  orderRowSelected: {
    borderColor: "#f97316",
    backgroundColor: "#fff7ed",
  },
  orderNo: { fontWeight: "700", color: "#1e293b" },
  status: { textTransform: "capitalize", fontWeight: "700", color: "#334155" },
  orderMeta: { color: "#64748b", fontSize: 12 },
  itemCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  itemName: { color: "#0f172a", fontWeight: "600" },
  itemStatus: { color: "#64748b", fontSize: 12, textTransform: "capitalize", marginTop: 2 },
  itemAction: {
    borderRadius: 8,
    backgroundColor: "#f97316",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  itemActionText: { color: "#fff", fontWeight: "700", textTransform: "capitalize", fontSize: 12 },
  disabled: { opacity: 0.5 },
  printBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#0f172a",
    paddingVertical: 9,
    alignItems: "center",
    backgroundColor: "#fff",
    marginTop: 2,
  },
  printText: { color: "#0f172a", fontWeight: "700" },
});
