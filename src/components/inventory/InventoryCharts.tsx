import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { InventoryItem } from "@/lib/inventory";

const STATUS_COLORS = ["#22c55e", "#f59e0b", "#ef4444"];

export function InventoryCharts({ items }: { items: InventoryItem[] }) {
  const statusData = [
    {
      name: "Healthy",
      value: items.filter(
        (i) => i.quantity > 0 && i.quantity > i.low_stock_threshold
      ).length,
    },
    {
      name: "Low",
      value: items.filter(
        (i) => i.quantity > 0 && i.quantity <= i.low_stock_threshold
      ).length,
    },
    { name: "Out", value: items.filter((i) => i.quantity <= 0).length },
  ].filter((d) => d.value > 0);

  const topStock = [...items]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 8)
    .map((i) => ({ name: i.name.slice(0, 14), qty: i.quantity }));

  if (items.length === 0) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Stock status</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                {statusData.map((_, i) => (
                  <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Top quantities</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topStock} layout="vertical" margin={{ left: 8, right: 8 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="qty" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
