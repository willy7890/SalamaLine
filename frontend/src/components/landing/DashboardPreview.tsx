import { ArrowDownRight, ArrowUpRight, PiggyBank, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Progress } from "@/components/ui/progress";
import { useApp } from "@/lib/i18n";

const flow = [
  { m: "May", i: 2.4, e: 1.8 }, { m: "Jun", i: 2.6, e: 2.0 }, { m: "Jul", i: 2.5, e: 1.7 },
  { m: "Aug", i: 2.9, e: 2.1 }, { m: "Sep", i: 3.1, e: 2.0 }, { m: "Oct", i: 3.2, e: 1.9 },
];
const fmt = (n: number) => "TSh " + n.toLocaleString("en-US");

export function DashboardPreview() {
  const { t } = useApp();
  const d = t.dash;
  const stats = [
    { label: d.income, value: 3200000, delta: "+8.2%", up: true, Icon: TrendingUp },
    { label: d.expenses, value: 1940000, delta: "-4.1%", up: false, Icon: TrendingDown },
    { label: d.balance, value: 1260000, delta: "+21%", up: true, Icon: Wallet },
    { label: d.savings, value: 4850000, delta: "+12%", up: true, Icon: PiggyBank },
  ];
  const cats = [
    { name: d.cats.rent, v: 650 }, { name: d.cats.food, v: 420 }, { name: d.cats.transport, v: 310 },
    { name: d.cats.bills, v: 280 }, { name: d.cats.fun, v: 280 },
  ];
  const goals = [[d.goalNames[0], 2000000, 2400000], [d.goalNames[1], 1450000, 2500000], [d.goalNames[2], 600000, 1800000]] as const;
  const tx = [[d.tx[0], 3200000], [d.tx[1], -86500], [d.tx[2], -50000], [d.tx[3], -12000], [d.tx[4], 150000]] as const;

  return (
    <div className="rounded-3xl border bg-card p-4 shadow-soft sm:p-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value, delta, up, Icon }) => (
          <div key={label} className="rounded-2xl border bg-background p-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              {label}<Icon className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 text-lg font-bold sm:text-2xl">{fmt(value)}</p>
            <p className={`mt-1 text-xs font-semibold ${up ? "text-success" : "text-destructive"}`}>{delta}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border bg-background p-4 lg:col-span-2">
          <p className="font-semibold">{d.flow}</p>
          <p className="text-xs text-muted-foreground">{d.flowSub} · M TSh</p>
          <div className="mt-4 h-56">
            <ResponsiveContainer>
              <AreaChart data={flow}>
                <defs>
                  <linearGradient id="gi" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} /><stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} /></linearGradient>
                  <linearGradient id="ge" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.4} /><stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="m" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} width={30} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--foreground)" }} />
                <Area type="monotone" dataKey="i" name={d.income} stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#gi)" />
                <Area type="monotone" dataKey="e" name={d.expenses} stroke="var(--chart-2)" strokeWidth={2.5} fill="url(#ge)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl border bg-background p-4">
          <p className="font-semibold">{d.byCat}</p>
          <div className="h-40">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={cats} dataKey="v" innerRadius={42} outerRadius={68} paddingAngle={3} stroke="none">
                  {cats.map((_, i) => <Cell key={i} fill={`var(--chart-${i + 1})`} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-1.5 text-sm">
            {cats.map((c, i) => (
              <li key={c.name} className="flex items-center justify-between">
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: `var(--chart-${i + 1})` }} />{c.name}</span>
                <span className="text-muted-foreground">{c.v}k</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-background p-4">
          <p className="mb-4 font-semibold">{d.goals}</p>
          <div className="space-y-4">
            {goals.map(([n, s, g]) => (
              <div key={n}>
                <div className="mb-1.5 flex justify-between text-sm"><span className="font-medium">{n}</span><span className="text-muted-foreground">{Math.round((s / g) * 100)}%</span></div>
                <Progress value={(s / g) * 100} className="h-2" />
                <p className="mt-1 text-xs text-muted-foreground">{fmt(s)} / {fmt(g)}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border bg-background p-4">
          <p className="mb-3 font-semibold">{d.recent}</p>
          <ul className="divide-y">
            {tx.map(([n, a]) => (
              <li key={n} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="flex min-w-0 items-center gap-3">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${a > 0 ? "bg-accent text-primary" : "bg-muted text-muted-foreground"}`}>
                    {a > 0 ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </span>
                  <span className="truncate">{n}</span>
                </span>
                <span className={`shrink-0 font-semibold ${a > 0 ? "text-success" : ""}`}>{a > 0 ? "+" : "−"}{fmt(Math.abs(a))}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
