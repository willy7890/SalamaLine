import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowDownLeft, ArrowUpRight, Building2, CheckCircle2, CircleDollarSign, Landmark, LockKeyhole, Plus, Smartphone, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/lib/i18n";

type Account = { id: string; name: string; provider: string; kind: "mobile" | "bank" | "cash"; balance: number };
type Transaction = { id: string; title: string; category: string; amount: number; date: string };

const initialTransactions: Transaction[] = [
  { id: "t1", title: "Mshahara / Salary", category: "Mapato / Income", amount: 1250000, date: "Today" },
  { id: "t2", title: "Manunuzi / Groceries", category: "Chakula / Food", amount: -38500, date: "Today" },
  { id: "t3", title: "Umeme / LUKU", category: "Bili / Bills", amount: -25000, date: "Yesterday" },
];

const money = (amount: number) => `TSh ${Math.abs(amount).toLocaleString("en-TZ")}`;

export function WorkspaceDialog({ open, onClose, selectedPlan }: { open: boolean; onClose: () => void; selectedPlan: string }) {
  const { lang } = useApp();
  const sw = lang === "sw";
  const [step, setStep] = useState<"signup" | "workspace">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [provider, setProvider] = useState("Cash wallet");
  const [balance, setBalance] = useState("0");
  const [transactions, setTransactions] = useState(initialTransactions);
  const [showTransaction, setShowTransaction] = useState(false);
  const [txTitle, setTxTitle] = useState("");
  const [txAmount, setTxAmount] = useState("");
  const [txType, setTxType] = useState<"income" | "expense">("expense");

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) { setStep("signup"); setError(""); setPassword(""); }
  }, [open, selectedPlan]);

  const totals = useMemo(() => {
    const income = transactions.filter((tx) => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0);
    const expenses = transactions.filter((tx) => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    return { income, expenses, balance: income - expenses };
  }, [transactions]);

  if (!open) return null;

  const createDemo = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (name.trim().length < 2) { setError(sw ? "Weka jina lako kamili." : "Enter your name."); return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { setError(sw ? "Weka barua pepe sahihi." : "Enter a valid email address."); return; }
    if (password.length < 8) { setError(sw ? "Nenosiri liwe na angalau herufi/namba 8." : "Password must be at least 8 characters."); return; }
    // Frontend demo only: password is never saved or sent anywhere.
    setError("");
    setStep("workspace");
  };

  const addAccount = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(balance);
    if (!accountName.trim() || !Number.isFinite(amount) || amount < 0) return;
    const kind: Account["kind"] = /bank|benki/i.test(provider) ? "bank" : /cash|taslimu/i.test(provider) ? "cash" : "mobile";
    setAccounts((current) => [...current, { id: crypto.randomUUID(), name: accountName.trim(), provider, kind, balance: amount }]);
    setAccountName(""); setBalance("0"); setShowAdd(false);
  };

  const addTransaction = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(txAmount);
    if (!txTitle.trim() || !Number.isFinite(amount) || amount <= 0) return;
    setTransactions((current) => [{ id: crypto.randomUUID(), title: txTitle.trim(), category: txType === "income" ? (sw ? "Mapato" : "Income") : (sw ? "Matumizi" : "Expense"), amount: txType === "income" ? amount : -amount, date: sw ? "Leo" : "Today" }, ...current]);
    setTxTitle(""); setTxAmount(""); setShowTransaction(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/65 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="workspace-title" className="relative my-auto max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-3xl border bg-background text-foreground shadow-2xl">
        <button onClick={onClose} aria-label={sw ? "Funga" : "Close"} className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full border bg-card hover:bg-muted"><X className="h-4 w-4" /></button>
        {step === "signup" ? (
          <div className="grid md:grid-cols-2">
            <div className="bg-brand p-8 text-primary-foreground sm:p-10">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15"><Wallet className="h-6 w-6" /></span>
              <p className="mt-8 text-sm font-semibold uppercase tracking-widest text-orange-300">PesaTrack</p>
              <h2 id="workspace-title" className="mt-3 text-3xl font-semibold sm:text-4xl">{sw ? "Karibu kwenye demo yako." : "Welcome to your demo."}</h2>
              <p className="mt-4 leading-relaxed opacity-85">{sw ? "Jaribu dashibodi, rekodi miamala na ongeza akaunti za mfano. Hakuna akaunti ya benki itakayounganishwa hapa." : "Explore the dashboard, record transactions and add sample accounts. No real bank account is connected here."}</p>
              <div className="mt-8 space-y-3 text-sm"><p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-orange-300" />{sw ? "Mapato na matumizi" : "Income and expenses"}</p><p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-orange-300" />{sw ? "Akaunti za mfano" : "Sample accounts"}</p><p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-orange-300" />{sw ? "Kiswahili na Kiingereza" : "Swahili and English"}</p></div>
            </div>
            <div className="p-6 sm:p-10">
              <p className="text-sm font-semibold text-primary">{sw ? "ANZA BURE" : "GET STARTED FREE"}</p>
              <h3 className="mt-2 text-2xl font-semibold">{sw ? "Fungua demo workspace" : "Create a demo workspace"}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{sw ? `Mpango uliochagua: ${selectedPlan}. Taarifa zako hazitumwi kwenye server.` : `Selected plan: ${selectedPlan}. Your details are not sent to a server.`}</p>
              <form className="mt-6 space-y-4" onSubmit={createDemo}>
                <label className="block text-sm font-medium">{sw ? "Jina kamili" : "Full name"}<Input className="mt-1.5" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={sw ? "Jina lako" : "Your name"} required /></label>
                <label className="block text-sm font-medium">{sw ? "Barua pepe" : "Email address"}<Input className="mt-1.5" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required /></label>
                <label className="block text-sm font-medium">{sw ? "Nenosiri la demo" : "Demo password"}<Input className="mt-1.5" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={sw ? "Angalau herufi/namba 8" : "At least 8 characters"} required /><span className="mt-1 block text-xs text-muted-foreground">{sw ? "Kwa demo tu; nenosiri halihifadhiwi." : "Demo only; password is not stored."}</span></label>
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                <Button type="submit" size="lg" className="w-full">{sw ? "Fungua demo" : "Open demo workspace"}</Button>
              </form>
              <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />{sw ? "Hii ni frontend demo. Usitumie nenosiri halisi au taarifa nyeti za kifedha." : "This is a frontend demo. Do not use a real password or sensitive financial details."}</p>
            </div>
          </div>
        ) : (
          <div className="p-5 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4 pr-10"><div><p className="text-sm font-semibold text-orange-500">PESATRACK / DEMO</p><h2 id="workspace-title" className="mt-1 text-3xl font-semibold">{sw ? `Habari, ${name.split(" ")[0]}!` : `Welcome, ${name.split(" ")[0]}!`}</h2><p className="mt-1 text-sm text-muted-foreground">{sw ? "Muhtasari wa mfano — unaweza kujaribu vitendo hapa." : "Sample overview — try the interactions here."}</p></div><span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-xs font-semibold text-orange-600">{selectedPlan}</span></div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[{ label: sw ? "Mapato ya demo" : "Demo income", value: totals.income, icon: ArrowDownLeft }, { label: sw ? "Matumizi ya demo" : "Demo expenses", value: totals.expenses, icon: ArrowUpRight }, { label: sw ? "Salio la miamala" : "Transaction balance", value: totals.balance, icon: CircleDollarSign }].map(({ label, value, icon: Icon }) => <div key={label} className="rounded-2xl border bg-card p-4"><div className="flex items-center justify-between text-sm text-muted-foreground">{label}<Icon className="h-4 w-4 text-orange-500" /></div><p className="mt-3 text-xl font-bold">{money(value)}</p></div>)}
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border bg-card p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">{sw ? "Akaunti zangu" : "My accounts"}</h3><p className="text-xs text-muted-foreground">{sw ? "Akaunti za demo/manual tu" : "Demo/manual accounts only"}</p></div><Button size="sm" onClick={() => setShowAdd((v) => !v)}><Plus className="mr-1 h-4 w-4" />{sw ? "Ongeza" : "Add account"}</Button></div>
                {showAdd && <form onSubmit={addAccount} className="mt-4 space-y-3 rounded-xl border bg-background p-3"><label className="block text-sm">{sw ? "Jina la akaunti" : "Account label"}<Input className="mt-1" value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder={sw ? "Mf. Wallet yangu" : "e.g. My wallet"} required /></label><label className="block text-sm">{sw ? "Aina" : "Account type"}<select className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={provider} onChange={(e) => setProvider(e.target.value)}><option>Cash wallet</option><option>M-Pesa (manual)</option><option>Mixx by Yas (manual)</option><option>Airtel Money (manual)</option><option>HaloPesa (manual)</option><option>Bank account (manual)</option></select></label><label className="block text-sm">{sw ? "Salio la kuanzia (TSh)" : "Opening balance (TSh)"}<Input className="mt-1" type="number" min="0" step="1" value={balance} onChange={(e) => setBalance(e.target.value)} required /></label><p className="text-xs text-muted-foreground">{sw ? "Usiweke PIN, OTP au namba kamili ya akaunti. Huu si muunganisho wa moja kwa moja." : "Do not enter a PIN, OTP or full account number. This is not a live connection."}</p><div className="flex gap-2"><Button type="submit" size="sm">{sw ? "Hifadhi akaunti" : "Save account"}</Button><Button type="button" size="sm" variant="outline" onClick={() => setShowAdd(false)}>{sw ? "Ghairi" : "Cancel"}</Button></div></form>}
                <div className="mt-3 space-y-2">{accounts.length === 0 ? <div className="rounded-xl border border-dashed p-5 text-center"><div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-orange-500/10 text-orange-600"><Wallet className="h-5 w-5" /></div><p className="mt-2 text-sm font-medium">{sw ? "Bado hujaongeza akaunti" : "No accounts added yet"}</p><p className="mt-1 text-xs text-muted-foreground">{sw ? "Bonyeza Ongeza kujaribu akaunti ya mfano." : "Choose Add account to try a sample account."}</p></div> : accounts.map((account) => <div key={account.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><span className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-500/10 text-orange-600">{account.kind === "bank" ? <Landmark className="h-5 w-5" /> : account.kind === "mobile" ? <Smartphone className="h-5 w-5" /> : <Wallet className="h-5 w-5" />}</span><span className="min-w-0"><span className="block truncate text-sm font-semibold">{account.name}</span><span className="block text-xs text-muted-foreground">{account.provider}</span></span></span><span className="shrink-0 text-sm font-semibold">{money(account.balance)}</span></div>)}</div>
                <div className="mt-4 flex items-start gap-2 rounded-xl bg-muted p-3 text-xs leading-relaxed text-muted-foreground"><LockKeyhole className="h-4 w-4 shrink-0" />{sw ? "Muunganisho wa moja kwa moja wa benki/mobile money unahitaji backend na API rasmi; hapa ni ufuatiliaji wa manual." : "Live bank/mobile-money sync requires a backend and official provider APIs; this screen is manual tracking only."}</div>
              </div>
              <div className="rounded-2xl border bg-card p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">{sw ? "Miamala ya hivi karibuni" : "Recent transactions"}</h3><p className="text-xs text-muted-foreground">{sw ? "Data za mfano za kujaribia" : "Sample data for testing"}</p></div><Button size="sm" variant="outline" onClick={() => setShowTransaction((v) => !v)}><Plus className="mr-1 h-4 w-4" />{sw ? "Muamala" : "Transaction"}</Button></div>
                {showTransaction && <form onSubmit={addTransaction} className="mt-4 space-y-3 rounded-xl border bg-background p-3"><div className="grid grid-cols-2 gap-2"><Button type="button" size="sm" variant={txType === "expense" ? "default" : "outline"} onClick={() => setTxType("expense")}>{sw ? "Matumizi" : "Expense"}</Button><Button type="button" size="sm" variant={txType === "income" ? "default" : "outline"} onClick={() => setTxType("income")}>{sw ? "Mapato" : "Income"}</Button></div><label className="block text-sm">{sw ? "Maelezo" : "Description"}<Input className="mt-1" value={txTitle} onChange={(e) => setTxTitle(e.target.value)} placeholder={sw ? "Mf. Nauli" : "e.g. Transport"} required /></label><label className="block text-sm">{sw ? "Kiasi (TSh)" : "Amount (TSh)"}<Input className="mt-1" type="number" min="1" step="1" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} required /></label><Button type="submit" size="sm" className="w-full">{sw ? "Ongeza muamala" : "Add transaction"}</Button></form>}
                <div className="mt-3 divide-y">{transactions.map((tx) => <div key={tx.id} className="flex items-center justify-between gap-3 py-3"><span className="flex min-w-0 items-center gap-3"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${tx.amount > 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-orange-500/10 text-orange-600"}`}>{tx.amount > 0 ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</span><span className="min-w-0"><span className="block truncate text-sm font-medium">{tx.title}</span><span className="block text-xs text-muted-foreground">{tx.category} · {tx.date}</span></span></span><span className={`shrink-0 text-sm font-semibold ${tx.amount > 0 ? "text-emerald-600" : ""}`}>{tx.amount > 0 ? "+" : "−"}{money(tx.amount)}</span></div>)}</div>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-500/20 bg-orange-500/5 p-4"><p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><Building2 className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />{sw ? "Demo hii inafanya kazi kwenye browser pekee. Login salama, usawazishaji wa benki na malipo vinahitaji API/backend." : "This demo runs in the browser only. Secure login, bank sync and payments require a real API/backend."}</p><Button variant="outline" onClick={onClose}>{sw ? "Rudi kwenye tovuti" : "Back to website"}</Button></div>
          </div>
        )}
      </section>
    </div>
  );
}
