import React, { useMemo, useState, useEffect } from "react";
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
import { useAuth } from "../context/AuthContext";
import { useOutlet } from "../context/OutletContext";
import {
  CartLine,
  fetchMenuCategories,
  fetchMenuItems,
  MenuCategoryRow,
  MenuItemRow,
  placeNewOrder,
} from "../services/menu";

export function NewOrderScreen() {
  const { user } = useAuth();
  const { currentOutlet } = useOutlet();
  const [categories, setCategories] = useState<MenuCategoryRow[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemRow[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderType, setOrderType] = useState<"dine_in" | "takeaway">("dine_in");
  const [tableNumber, setTableNumber] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [placing, setPlacing] = useState(false);

  const loadData = async () => {
    if (!currentOutlet?.id) return;
    setLoading(true);
    try {
      const [cats, items] = await Promise.all([
        fetchMenuCategories(currentOutlet.id),
        fetchMenuItems(currentOutlet.id),
      ]);
      setCategories(cats);
      setMenuItems(items);
    } catch (err) {
      Alert.alert("Could not load menu", err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [currentOutlet?.id]);

  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const categoryOk = selectedCategory === "all" || item.category_id === selectedCategory;
      const searchOk =
        !search.trim() ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        (item.description ?? "").toLowerCase().includes(search.toLowerCase());
      return categoryOk && searchOk;
    });
  }, [menuItems, selectedCategory, search]);

  const cartTotal = cart.reduce(
    (sum, line) => sum + line.menuItem.base_price * line.quantity,
    0
  );
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);

  const addToCart = (item: MenuItemRow) => {
    setCart((prev) => {
      const existing = prev.find((line) => line.menuItem.id === item.id);
      if (existing) {
        return prev.map((line) =>
          line.menuItem.id === item.id ? { ...line, quantity: line.quantity + 1 } : line
        );
      }
      return [...prev, { menuItem: item, quantity: 1 }];
    });
  };

  const updateQty = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((line) =>
          line.menuItem.id === itemId ? { ...line, quantity: line.quantity + delta } : line
        )
        .filter((line) => line.quantity > 0)
    );
  };

  const placeOrder = async () => {
    if (!currentOutlet?.id) return;
    if (cart.length === 0) {
      Alert.alert("Cart is empty", "Add at least one item.");
      return;
    }
    if (orderType === "dine_in" && !tableNumber.trim()) {
      Alert.alert("Table required", "Please enter table number.");
      return;
    }
    setPlacing(true);
    try {
      const result = await placeNewOrder({
        outletId: currentOutlet.id,
        createdBy: user?.id ?? null,
        orderType,
        tableNumber,
        cart,
        gstCategories: currentOutlet.gst_categories ?? null,
      });
      setCart([]);
      setTableNumber("");
      Alert.alert("Order placed", `Order #${result.orderNumber} created successfully.`);
    } catch (err) {
      Alert.alert("Could not place order", err instanceof Error ? err.message : String(err));
    } finally {
      setPlacing(false);
    }
  };

  if (!currentOutlet) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.title}>New Order</Text>
        <Text style={styles.text}>No outlet selected.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>New Order</Text>
          <Text style={styles.subtitle}>{currentOutlet.name}</Text>
        </View>
        <Pressable style={styles.refreshBtn} onPress={() => loadData()}>
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      <View style={styles.typeRow}>
        <Pressable
          style={[styles.typeBtn, orderType === "dine_in" && styles.typeBtnActive]}
          onPress={() => setOrderType("dine_in")}
        >
          <Text style={[styles.typeText, orderType === "dine_in" && styles.typeTextActive]}>Dine In</Text>
        </Pressable>
        <Pressable
          style={[styles.typeBtn, orderType === "takeaway" && styles.typeBtnActive]}
          onPress={() => setOrderType("takeaway")}
        >
          <Text style={[styles.typeText, orderType === "takeaway" && styles.typeTextActive]}>Takeaway</Text>
        </Pressable>
        {orderType === "dine_in" && (
          <TextInput
            style={styles.tableInput}
            placeholder="Table"
            value={tableNumber}
            onChangeText={setTableNumber}
          />
        )}
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Search items..."
        value={search}
        onChangeText={setSearch}
      />

      <ScrollView horizontal contentContainerStyle={styles.categoryRow} showsHorizontalScrollIndicator={false}>
        <Pressable
          style={[styles.categoryChip, selectedCategory === "all" && styles.categoryChipActive]}
          onPress={() => setSelectedCategory("all")}
        >
          <Text style={[styles.categoryText, selectedCategory === "all" && styles.categoryTextActive]}>All</Text>
        </Pressable>
        {categories.map((category) => {
          const active = selectedCategory === category.id;
          return (
            <Pressable
              key={category.id}
              style={[styles.categoryChip, active && styles.categoryChipActive]}
              onPress={() => setSelectedCategory(category.id)}
            >
              <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{category.name}</Text>
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
            <Text style={styles.sectionTitle}>Menu ({filteredItems.length})</Text>
            {filteredItems.map((item) => (
              <View key={item.id} style={styles.menuRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuName}>{item.name}</Text>
                  <Text style={styles.menuMeta}>{item.is_veg ? "Veg" : "Non-Veg"} • Rs.{item.base_price}</Text>
                </View>
                <Pressable style={styles.addBtn} onPress={() => addToCart(item)}>
                  <Text style={styles.addText}>Add</Text>
                </Pressable>
              </View>
            ))}
            {filteredItems.length === 0 && <Text style={styles.text}>No menu items.</Text>}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Cart ({cartCount})</Text>
            {cart.map((line) => (
              <View key={line.menuItem.id} style={styles.cartRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cartName}>{line.menuItem.name}</Text>
                  <Text style={styles.menuMeta}>Rs.{line.menuItem.base_price} each</Text>
                </View>
                <View style={styles.qtyBox}>
                  <Pressable style={styles.qtyBtn} onPress={() => updateQty(line.menuItem.id, -1)}>
                    <Text style={styles.qtyBtnText}>-</Text>
                  </Pressable>
                  <Text style={styles.qtyValue}>{line.quantity}</Text>
                  <Pressable style={styles.qtyBtn} onPress={() => updateQty(line.menuItem.id, 1)}>
                    <Text style={styles.qtyBtnText}>+</Text>
                  </Pressable>
                </View>
              </View>
            ))}

            <Text style={styles.total}>Total: Rs.{cartTotal.toFixed(2)}</Text>
            <Pressable
              style={[styles.placeBtn, (placing || cart.length === 0) && styles.disabled]}
              disabled={placing || cart.length === 0}
              onPress={placeOrder}
            >
              <Text style={styles.placeText}>{placing ? "Placing..." : "Place Order"}</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", paddingHorizontal: 14, paddingTop: 14 },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
    gap: 8,
  },
  title: { fontSize: 24, fontWeight: "700", color: "#0f172a" },
  subtitle: { color: "#64748b", marginTop: 2 },
  text: { color: "#64748b" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  refreshBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
  refreshText: { color: "#334155", fontWeight: "600" },
  typeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  typeBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
  typeBtnActive: { borderColor: "#f97316", backgroundColor: "#fff7ed" },
  typeText: { color: "#334155", fontWeight: "700" },
  typeTextActive: { color: "#c2410c" },
  tableInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchInput: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  categoryRow: { gap: 8, paddingTop: 10, paddingBottom: 6 },
  categoryChip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#fff",
  },
  categoryChipActive: { borderColor: "#f97316", backgroundColor: "#fff7ed" },
  categoryText: { color: "#334155" },
  categoryTextActive: { color: "#c2410c", fontWeight: "700" },
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
  sectionTitle: { fontWeight: "700", color: "#0f172a" },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 8,
  },
  menuName: { color: "#0f172a", fontWeight: "600" },
  menuMeta: { color: "#64748b", fontSize: 12 },
  addBtn: {
    borderRadius: 8,
    backgroundColor: "#f97316",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  addText: { color: "#fff", fontWeight: "700" },
  cartRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 8,
  },
  cartName: { color: "#0f172a", fontWeight: "600" },
  qtyBox: { flexDirection: "row", alignItems: "center", gap: 6 },
  qtyBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 6,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  qtyBtnText: { fontWeight: "700", color: "#334155" },
  qtyValue: { minWidth: 20, textAlign: "center", fontWeight: "700", color: "#0f172a" },
  total: { marginTop: 6, fontWeight: "800", color: "#0f172a" },
  placeBtn: {
    marginTop: 6,
    borderRadius: 10,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
  },
  placeText: { color: "#fff", fontWeight: "800" },
  disabled: { opacity: 0.5 },
});
