import { useEffect, useRef, useState } from "react";
import { Bot, Send, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/lib/i18n";

type Msg = { role: "ai" | "user"; text: string };

export function AiChat() {
  const { t, lang } = useApp();
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "ai", text: t.ai.greeting }]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => { setMsgs([{ role: "ai", text: t.ai.greeting }]); }, [lang, t.ai.greeting]);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" }); }, [msgs, typing]);

  const makeDemoReply = (question: string) => {
    const q = question.toLowerCase();
    if (lang === "sw") {
      if (q.includes("akiba") || q.includes("save")) return "Kwa demo hii, jaribu kuweka lengo la akiba na kiasi unachoweza kutenga kila wiki. Mfano huu hautumii miamala yako halisi; unganisha backend ili Pesa AI ichambue data zako kwa ruhusa yako.";
      if (q.includes("chakula") || q.includes("food")) return "Ninaweza kukusaidia kupanga bajeti ya chakula. Kwa sasa huu ni mfano tu—sijaunganishwa na miamala yako halisi. Rekodi matumizi kwenye demo ili ujaribu mtiririko wa kazi.";
      if (q.includes("bajeti") || q.includes("budget")) return "Anza kwa kuandika mapato yako, gharama za lazima, kisha weka kikomo cha matumizi kwa kila kundi. Haya ni mapendekezo ya jumla; data halisi itahitaji backend iliyounganishwa.";
      if (q.includes("salio") || q.includes("balance")) return "Salio la mfano linaweza kuonekana kwenye workspace ukifungua demo. Chat hii bado haitoi taarifa kutoka benki au mobile money.";
      return "Karibu! Naweza kukupa mwongozo wa jumla kuhusu bajeti, akiba na matumizi. Kumbuka: hii ni Pesa AI demo, haichambui taarifa zako halisi za kifedha bado.";
    }
    if (q.includes("save") || q.includes("saving")) return "Try setting a clear savings target and an amount you can set aside each week. This demo does not use your real transactions; a connected backend is needed for personal insights.";
    if (q.includes("food") || q.includes("spend")) return "I can help you plan a food budget. This is a demo response, not an analysis of your actual spending. Record sample transactions in the workspace to try the flow.";
    if (q.includes("budget")) return "Start with your income, essential bills, then set a realistic cap for each spending category. These are general tips; personalized analysis requires a connected backend.";
    if (q.includes("balance") || q.includes("account")) return "You can explore sample balances in the demo workspace. This chat is not connected to a bank or mobile-money provider.";
    return "Hi! I can share general guidance about budgeting, saving and spending. This is a Pesa AI demo and does not analyze real financial data yet.";
  };

  const send = (text: string) => {
    if (!text.trim() || typing) return;
    setMsgs((m) => [...m, { role: "user", text }]);
    setInput("");
    setTyping(true);
    window.setTimeout(() => { setMsgs((m) => [...m, { role: "ai", text: makeDemoReply(text) }]); setTyping(false); }, 650);
  };

  return (
    <div className="flex h-[480px] flex-col overflow-hidden rounded-3xl border bg-card shadow-soft">
      <div className="flex items-center gap-3 border-b bg-brand px-5 py-4 text-primary-foreground">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-gold text-gold-foreground"><Bot className="h-5 w-5" /></span>
        <div><p className="font-semibold">Pesa AI</p><p className="text-xs opacity-80">● {lang === "sw" ? "Demo · Kiswahili / English" : "Demo · EN / SW"}</p></div>
      </div>
      <div ref={box} className="flex-1 space-y-3 overflow-y-auto p-4">
        {msgs.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${m.role === "ai" ? "bg-accent text-primary" : "bg-muted"}`}>
              {m.role === "ai" ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
            </span>
            <p className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${m.role === "ai" ? "rounded-tl-sm bg-muted" : "rounded-tr-sm bg-primary text-primary-foreground"}`}>{m.text}</p>
          </div>
        ))}
        {typing && <p className="pl-9 text-sm text-muted-foreground animate-pulse">Pesa AI…</p>}
      </div>
      <div className="flex flex-wrap gap-2 px-4 pb-2">
        {t.ai.suggestions.map((s) => (
          <button key={s} onClick={() => send(s)} className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary">{s}</button>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2 border-t p-3">
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t.ai.placeholder} aria-label={t.ai.placeholder} />
        <Button type="submit" size="icon" aria-label={t.ai.send}><Send className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}
