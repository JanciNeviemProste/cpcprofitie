'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Point = { date: Date; price: number };

const NBSP = ' ';

function formatDateSk(d: Date): string {
  return d.toLocaleDateString('sk-SK', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });
}

function formatEur(value: number): string {
  return `${Math.round(value).toLocaleString('sk-SK')}${NBSP}€`;
}

export function PriceHistoryChart({ data }: { data: Point[] }) {
  if (data.length < 2) {
    return (
      <div className="border-border/60 text-muted-foreground rounded-lg border p-4 text-sm">
        Zatiaľ málo dát
      </div>
    );
  }

  const chartData = data.map((p) => ({
    dateLabel: formatDateSk(p.date),
    price: p.price,
  }));

  return (
    <div className="border-border/60 rounded-lg border p-4">
      <h3 className="mb-3 text-sm font-semibold">Vývoj ceny</h3>
      <div className="h-96 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="dateLabel"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickFormatter={(v: number) => formatEur(v)}
              width={80}
            />
            <Tooltip
              formatter={(value) => [formatEur(Number(value)), 'Cena']}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              contentStyle={{
                background: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 6,
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
