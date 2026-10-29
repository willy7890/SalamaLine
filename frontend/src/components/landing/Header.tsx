import { useState } from "react";
import { Menu, Moon, Sun, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/i18n";

export function Logo() {
  return (
    <a href="#top" className="flex items-center gap-2 font-display text-xl font-semibold">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-primary-foreground"><Wallet className="h-5 w-5" /></span>
      <span>Pesa<span className="text-primary">Track</span></span>
    </a>
  );
}

export function LangSwitch() {
  const { lang, setLang } = useApp();
  return (
    <div className="flex rounded-full border bg-card p-0.5 text-xs font-semibold" role="group" aria-label="Language">
      {(["en", "sw"] as const).map((l) => (
        <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l}
          className={`rounded-full px-3 py-1.5 transition-colors ${lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export function Header({ onStart }: { onStart: () => void }) {
  const { t, theme, toggleTheme } = useApp();
  const [open, setOpen] = useState(false);
  const links = [["#features", t.nav.features], ["#how", t.nav.how], ["#ai", t.nav.ai], ["#pricing", t.nav.pricing], ["#faq", t.nav.faq]];
  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm font-medium lg:flex">
          {links.map(([h, l]) => <a key={h} href={h} className="text-muted-foreground transition-colors hover:text-foreground">{l}</a>)}
        </nav>
        <div className="flex items-center gap-2">
          <LangSwitch />
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          <Button className="hidden sm:inline-flex" onClick={onStart}>{t.nav.start}</Button>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>
      {open && (
        <nav className="border-t bg-background px-4 py-4 lg:hidden">
          {links.map(([h, l]) => <a key={h} href={h} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-3 font-medium hover:bg-muted">{l}</a>)}
          <Button className="mt-2 w-full" onClick={() => { setOpen(false); onStart(); }}>{t.nav.start}</Button>
        </nav>
      )}
    </header>
  );
}
