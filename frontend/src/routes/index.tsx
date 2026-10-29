import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BarChart3, Bell, Check, PiggyBank, Quote, ShieldCheck, Smartphone, Sparkles, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Toaster } from "@/components/ui/sonner";
import { AppProvider, useApp } from "@/lib/i18n";
import { Header, Logo } from "@/components/landing/Header";
import { Section } from "@/components/landing/Section";
import { DashboardPreview } from "@/components/landing/DashboardPreview";
import { AiChat } from "@/components/landing/AiChat";
import { WorkspaceDialog } from "@/components/landing/WorkspaceDialog";
import hero from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PesaTrack — Smart Personal Finance with a Bilingual AI Agent" },
      { name: "description", content: "Track income, expenses and savings goals. Get advice from Pesa AI in Swahili and English." },
      { property: "og:title", content: "PesaTrack — Smart Personal Finance" },
      { property: "og:description", content: "Manage your money with a bilingual Swahili & English AI financial agent." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppProvider>
      <Landing />
      <Toaster />
    </AppProvider>
  ),
});

const featureIcons = [Smartphone, BarChart3, Target, PiggyBank, ShieldCheck, Bell];

function Landing() {
  const { t, lang } = useApp();
  const welcomeLines = lang === "sw"
    ? ["Karibu PesaTrack", "Dhibiti pesa zako kwa busara", "Panga. Okoa. Fanikiwa."]
    : ["Welcome to PesaTrack", "Make your money make sense", "Plan. Save. Thrive."];
  const [welcomeIndex, setWelcomeIndex] = useState(0);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("Free");

  useEffect(() => {
    setWelcomeIndex(0);
    const timer = window.setInterval(() => {
      setWelcomeIndex((current) => (current + 1) % 3);
    }, 3200);
    return () => window.clearInterval(timer);
  }, [lang]);

  const start = (plan = "Free") => { setSelectedPlan(plan); setWorkspaceOpen(true); };

  return (
    <div id="top" className="min-h-screen">
      <Header onStart={() => start("Free")} />
      <WorkspaceDialog open={workspaceOpen} onClose={() => setWorkspaceOpen(false)} selectedPlan={selectedPlan} />

      {/* Hero */}
      <section className="bg-hero px-4 pb-20 pt-12 sm:px-6 md:pt-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div className="hero-copy animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="welcome-line mb-5 flex min-h-11 items-center gap-2 text-sm font-semibold sm:text-base" aria-live="polite">
              <span className="welcome-sparkle grid h-9 w-9 shrink-0 place-items-center rounded-full bg-orange-500/10 text-orange-500"><Sparkles className="h-4 w-4" /></span>
              <span key={`${lang}-${welcomeIndex}`} className="welcome-text">{welcomeLines[welcomeIndex]}</span>
              <span className="welcome-caret" aria-hidden="true" />
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-gold" />{t.hero.badge}
            </span>
            <h1 className="mt-6 text-4xl font-semibold leading-[1.05] sm:text-5xl lg:text-6xl">{t.hero.title}</h1>
            <p className="mt-6 max-w-lg text-lg text-muted-foreground">{t.hero.sub}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => start("Free")}>{t.hero.cta}</Button>
              <Button size="lg" variant="outline" asChild><a href="#dashboard">{t.hero.demo}</a></Button>
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-4">
              {[["2", t.hero.stat1], ["TSh", t.hero.stat2], ["24/7", t.hero.stat3]].map(([v, l]) => (
                <div key={l}><dt className="font-display text-2xl font-semibold text-primary">{v}</dt><dd className="text-xs text-muted-foreground">{l}</dd></div>
              ))}
            </dl>
          </div>
          <div className="relative mx-auto w-full max-w-md">
            <img src={hero} alt="Woman using PesaTrack on her phone" width={1024} height={1152} className="aspect-[8/9] w-full rounded-[2rem] object-cover shadow-soft" />
            <div className="floating-orb floating-orb-one" aria-hidden="true" />
            <div className="absolute -left-4 bottom-10 rounded-2xl border bg-card p-4 shadow-soft sm:-left-10 animate-float-card">
              <p className="text-xs text-muted-foreground">{t.dash.savings}</p>
              <p className="font-display text-xl font-semibold">TSh 4,850,000</p>
              <p className="text-xs font-semibold text-success">+12%</p>
            </div>
            <div className="absolute -right-3 top-8 flex max-w-[200px] gap-2 rounded-2xl border bg-card p-3 text-xs shadow-soft sm:-right-8 animate-float-card-delayed">
              <Sparkles className="h-4 w-4 shrink-0 text-gold" /><span>{t.ai.points[2]}</span>
            </div>
          </div>
        </div>
      </section>

      <Section id="dashboard" eyebrow={t.dash.eyebrow} title={t.dash.title} sub={t.dash.sub}>
        <DashboardPreview />
      </Section>

      <Section id="ai" className="bg-muted/50">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">{t.ai.eyebrow}</p>
            <h2 className="text-3xl font-semibold sm:text-4xl md:text-5xl">{t.ai.title}</h2>
            <p className="mt-4 text-lg text-muted-foreground">{t.ai.sub}</p>
            <ul className="mt-8 space-y-3">
              {t.ai.points.map((p) => (
                <li key={p} className="flex items-center gap-3"><span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="h-3.5 w-3.5" /></span>{p}</li>
              ))}
            </ul>
          </div>
          <AiChat />
        </div>
      </Section>

      <Section id="features" eyebrow={t.features.eyebrow} title={t.features.title}>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {t.features.items.map(([title, desc], i) => {
            const Icon = featureIcons[i % featureIcons.length]!;
            return (
              <div key={title} className="group rounded-2xl border bg-card p-6 transition-all hover:-translate-y-1 hover:shadow-soft">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground"><Icon className="h-6 w-6" /></span>
                <h3 className="mt-5 text-xl font-semibold">{title}</h3>
                <p className="mt-2 text-muted-foreground">{desc}</p>
              </div>
            );
          })}
        </div>
      </Section>

      <Section id="how" eyebrow={t.how.eyebrow} title={t.how.title} className="bg-muted/50">
        <div className="grid gap-6 md:grid-cols-3">
          {t.how.steps.map(([title, desc], i) => (
            <div key={title} className="relative rounded-2xl border bg-card p-8">
              <span className="font-display text-6xl font-semibold text-gold">0{i + 1}</span>
              <h3 className="mt-4 text-xl font-semibold">{title}</h3>
              <p className="mt-2 text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="pricing" eyebrow={t.pricing.eyebrow} title={t.pricing.title}>
        <div className="grid gap-6 md:grid-cols-3">
          {t.pricing.plans.map(([name, price, desc, feats], i) => {
            const pop = i === 1;
            return (
              <div key={name} className={`relative flex flex-col rounded-3xl border p-8 ${pop ? "bg-brand text-primary-foreground shadow-soft md:scale-105" : "bg-card"}`}>
                {pop && <span className="absolute -top-3 left-8 rounded-full bg-gold px-3 py-1 text-xs font-bold text-gold-foreground">{t.pricing.popular}</span>}
                <h3 className="text-2xl font-semibold">{name}</h3>
                <p className={`text-sm ${pop ? "opacity-80" : "text-muted-foreground"}`}>{desc}</p>
                <p className="mt-6 font-display text-4xl font-semibold">{price}<span className="text-base font-normal opacity-70">{t.pricing.month}</span></p>
                <ul className="mt-6 flex-1 space-y-3 text-sm">
                  {feats.map((f) => <li key={f} className="flex gap-2"><Check className={`h-4 w-4 shrink-0 ${pop ? "text-gold" : "text-primary"}`} />{f}</li>)}
                </ul>
                <Button className="mt-8" variant={pop ? "secondary" : "outline"} onClick={() => start(name)}>{t.pricing.choose}</Button>
              </div>
            );
          })}
        </div>
      </Section>

      <Section id="testimonials" eyebrow={t.testi.eyebrow} title={t.testi.title} className="bg-muted/50">
        <div className="grid gap-6 md:grid-cols-3">
          {t.testi.items.map(([name, role, quote]) => (
            <figure key={name} className="rounded-2xl border bg-card p-6">
              <Quote className="h-8 w-8 text-gold" />
              
              <blockquote className="mt-4">{quote}</blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-accent font-semibold text-primary">{name?.[0]}</span>
                <span><span className="block font-semibold">{name}</span><span className="text-sm text-muted-foreground">{role}</span></span>
              </figcaption>
            </figure>
          ))}
        </div>
      </Section>

      <Section id="faq" eyebrow={t.faq.eyebrow} title={t.faq.title}>
        <Accordion type="single" collapsible className="mx-auto max-w-3xl">
          {t.faq.items.map(([q, a], i) => (
            <AccordionItem key={i} value={`q${i}`}>
              <AccordionTrigger className="text-left text-base font-semibold">{q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Section>

      <section className="px-4 pb-20 sm:px-6">
        <div className="mx-auto max-w-6xl rounded-3xl bg-brand px-6 py-16 text-center text-primary-foreground shadow-soft">
          <h2 className="text-3xl font-semibold sm:text-4xl">{t.cta.title}</h2>
          <p className="mx-auto mt-4 max-w-xl opacity-85">{t.cta.sub}</p>
          <Button size="lg" variant="secondary" className="mt-8" onClick={() => start("Free")}>{t.cta.btn}</Button>
        </div>
      </section>

      <section id="privacy" className="px-4 pb-8 sm:px-6"><div className="mx-auto max-w-6xl rounded-2xl border bg-card p-5 text-sm text-muted-foreground"><h2 className="font-semibold text-foreground">{lang === "sw" ? "Faragha na hali ya demo" : "Privacy and demo status"}</h2><p className="mt-2">{lang === "sw" ? "Tovuti hii kwa sasa ni frontend demo. Usajili, miamala na akaunti za mfano hazijaunganishwa na backend au benki halisi. Usiweke PIN, OTP au taarifa nyeti za kifedha." : "This website is currently a frontend demo. Signup, sample transactions and accounts are not connected to a backend or real banks. Do not enter PINs, OTPs or sensitive financial details."}</p></div></section>

      <footer className="border-t px-4 py-12 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-4">
          <div className="md:col-span-2"><Logo /><p className="mt-3 max-w-xs text-sm text-muted-foreground">{t.footer.tag}</p></div>
          <div>
            <p className="mb-3 font-semibold">{t.footer.product}</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#features" className="hover:text-foreground">{t.nav.features}</a></li>
              <li><a href="#ai" className="hover:text-foreground">{t.nav.ai}</a></li>
              <li><a href="#pricing" className="hover:text-foreground">{t.nav.pricing}</a></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 font-semibold">{t.footer.company}</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#how" className="hover:text-foreground">{t.footer.about}</a></li>
              <li><a href="mailto:hello@pesatrack.app" className="hover:text-foreground">{t.footer.contact}</a></li>
              <li><a href="#privacy" className="hover:text-foreground">{t.footer.privacy}</a></li>
            </ul>
          </div>
        </div>
        <p className="mx-auto mt-10 max-w-6xl text-sm text-muted-foreground">© {new Date().getFullYear()} PesaTrack. {t.footer.rights}</p>
      </footer>
    </div>
  );
}
