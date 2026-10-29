import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "sw";
export type Theme = "light" | "dark";

const dict = {
  en: {
    nav: { features: "Features", how: "How it works", ai: "AI Agent", pricing: "Pricing", faq: "FAQ", start: "Get started" },
    hero: {
      badge: "Bilingual AI · Swahili & English",
      title: "Your money, finally making sense.",
      sub: "Explore a bilingual personal-finance workspace for recording income, tracking spending and planning savings. This version runs as a frontend demo.",
      cta: "Start free", demo: "See the dashboard",
      stat1: "Languages", stat2: "Tanzanian shillings", stat3: "Plan anytime",
    },
    dash: {
      eyebrow: "Dashboard preview", title: "Everything at a glance",
      sub: "A sample view of income, expenses and savings in TSh. Replace sample values with real entries in the demo workspace.",
      income: "Income", expenses: "Expenses", balance: "Balance", savings: "Savings",
      flow: "Cash flow", flowSub: "Last 6 months", byCat: "Spending by category",
      goals: "Savings goals", recent: "Recent transactions",
      cats: { food: "Food", transport: "Transport", rent: "Rent", bills: "Bills", fun: "Leisure" },
      goalNames: ["Emergency fund", "New laptop", "Zanzibar trip"],
      tx: ["Salary — Azam Ltd", "Shoprite groceries", "LUKU electricity", "Bolt ride", "M-Pesa from Juma"],
    },
    ai: {
      eyebrow: "Meet Pesa AI", title: "A financial agent that speaks your language",
      sub: "Ask general questions about budgeting, spending and saving in Swahili or English. Personalized insights will require a connected backend and your authorized financial data.",
      points: ["Explains spending in plain words", "Builds budgets you can stick to", "Warns you before you overspend", "Switches language mid-chat"],
      placeholder: "Ask Pesa AI…", send: "Send",
      suggestions: ["How much did I spend on food?", "Can I afford a trip in December?", "Help me save 500,000 TSh"],
      greeting: "Hi! I'm Pesa AI demo. Ask general questions about budgeting, saving or spending.",
      reply: "This month you spent TSh 420,000 on food — 18% more than last month. Cooking at home 3 more days a week could save about TSh 90,000. Want me to set a food budget?",
    },
    features: {
      eyebrow: "Features", title: "Built for how East Africa handles money",
      items: [
        ["Mobile money tracking", "Record or import supported mobile money transactions; live sync requires provider API access."],
        ["Smart budgets", "Plan spending by category and compare it with transactions you record."],
        ["Savings goals", "Set goals, track progress and celebrate every milestone."],
        ["Insightful reports", "Preview charts based on sample data and transactions you enter."],
        ["Privacy-first design", "Keep your financial details private and never enter bank PINs or OTPs into the demo."],
        ["Bill planning", "Keep upcoming LUKU, rent or school-fee dates visible in your plan."],
      ],
    },
    how: {
      eyebrow: "How it works", title: "Three steps to clarity",
      steps: [
        ["Open the demo", "Enter basic details to explore the frontend workspace."],
        ["Connect your money", "Add accounts or log transactions manually."],
        ["Talk to Pesa AI", "Get insights and a plan in Swahili or English."],
      ],
    },
    pricing: {
      eyebrow: "Pricing", title: "Simple, honest pricing", month: "/month", popular: "Most popular", choose: "Choose plan",
      plans: [
        ["Free", "TSh 0", "For getting started", ["Manual tracking", "3 savings goals", "20 AI questions / month"]],
        ["Pro", "TSh 9,900", "For serious savers", ["Manual mobile money tracking", "Unlimited goals", "Pesa AI demo", "Advanced report preview"]],
        ["Family", "TSh 19,900", "For households", ["Up to 5 members", "Shared budgets", "Everything in Pro"]],
      ] as [string, string, string, string[]][],
    },
    testi: {
      eyebrow: "What you can do", title: "Make clearer money decisions",
      items: [
        ["Budgeting", "Plan spending", "Set practical category budgets and compare your planned spending with the transactions you record."],
        ["Saving", "Build habits", "Create a savings goal, choose a target amount and keep track of your progress."],
        ["Clarity", "Understand cash flow", "Review income, expenses and your transaction balance in one simple view."],
      ],
    },
    faq: {
      eyebrow: "FAQ", title: "Questions, answered",
      items: [
        ["Is PesaTrack free?", "Yes — the Free plan is free forever. Upgrade only when you need more."],
        ["Does Pesa AI use my real financial data?", "Not in this frontend demo. It responds with general guidance; personalized answers require a secure backend and authorized data access."],
        ["Is this ready for real financial data?", "Not yet. This is a frontend demo and is not connected to secure account storage. Do not enter sensitive financial information."],
        ["Can I connect a mobile money or bank account?", "You can track accounts manually in this frontend demo. Live connections depend on official provider APIs and a secure backend."],
      ],
    },
    cta: { title: "Take control of your money today", sub: "Explore a clearer way to track income, spending and savings with PesaTrack.", btn: "Create free account" },
    footer: { tag: "Smart personal finance with a bilingual AI agent.", product: "Product", company: "Company", about: "About", contact: "Contact", privacy: "Privacy", rights: "All rights reserved." },
    toast: "Demo workspace is ready to explore.",
  },
  sw: {
    nav: { features: "Vipengele", how: "Inavyofanya kazi", ai: "Wakala AI", pricing: "Bei", faq: "Maswali", start: "Anza sasa" },
    hero: {
      badge: "AI ya lugha mbili · Kiswahili & Kiingereza",
      title: "Pesa zako, sasa zinaeleweka.",
      sub: "Jaribu workspace ya fedha binafsi ya lugha mbili kwa kurekodi mapato, kufuatilia matumizi na kupanga akiba. Toleo hili ni frontend demo.",
      cta: "Anza bure", demo: "Tazama dashibodi",
      stat1: "Lugha", stat2: "Shilingi za Tanzania", stat3: "Panga muda wowote",
    },
    dash: {
      eyebrow: "Muonekano wa dashibodi", title: "Kila kitu kwa mtazamo mmoja",
      sub: "Muonekano wa mfano wa mapato, matumizi na akiba kwa TSh. Ingiza miamala yako ya majaribio kwenye workspace.",
      income: "Mapato", expenses: "Matumizi", balance: "Salio", savings: "Akiba",
      flow: "Mtiririko wa pesa", flowSub: "Miezi 6 iliyopita", byCat: "Matumizi kwa kundi",
      goals: "Malengo ya akiba", recent: "Miamala ya karibuni",
      cats: { food: "Chakula", transport: "Usafiri", rent: "Kodi", bills: "Bili", fun: "Burudani" },
      goalNames: ["Mfuko wa dharura", "Kompyuta mpya", "Safari ya Zanzibar"],
      tx: ["Mshahara — Azam Ltd", "Manunuzi Shoprite", "Umeme LUKU", "Safari ya Bolt", "M-Pesa kutoka Juma"],
    },
    ai: {
      eyebrow: "Mfahamu Pesa AI", title: "Wakala wa fedha anayezungumza lugha yako",
      sub: "Uliza maswali ya jumla kuhusu bajeti, matumizi na akiba kwa Kiswahili au Kiingereza. Ushauri unaotegemea data zako utahitaji backend na ruhusa yako.",
      points: ["Hueleza matumizi kwa maneno rahisi", "Huunda bajeti unazoweza kufuata", "Hukuonya kabla ya kutumia kupita kiasi", "Hubadilisha lugha katikati ya mazungumzo"],
      placeholder: "Muulize Pesa AI…", send: "Tuma",
      suggestions: ["Nimetumia kiasi gani kwa chakula?", "Naweza kumudu safari Desemba?", "Nisaidie kuweka akiba TSh 500,000"],
      greeting: "Habari! Mimi ni Pesa AI demo. Uliza kuhusu bajeti, akiba au matumizi kwa ujumla.",
      reply: "Mwezi huu umetumia TSh 420,000 kwa chakula — 18% zaidi ya mwezi uliopita. Kupika nyumbani siku 3 zaidi kwa wiki kunaweza kuokoa takriban TSh 90,000. Nikuwekee bajeti ya chakula?",
    },
    features: {
      eyebrow: "Vipengele", title: "Imeundwa kwa jinsi Afrika Mashariki inavyotumia pesa",
      items: [
        ["Ufuatiliaji wa pesa za simu", "Rekodi au ingiza miamala; usawazishaji wa moja kwa moja unahitaji API ya mtoa huduma."],
        ["Bajeti janja", "Panga matumizi kwa makundi na linganisha na miamala unayoingiza."],
        ["Malengo ya akiba", "Weka malengo, fuatilia maendeleo na sherehekea kila hatua."],
        ["Ripoti za kina", "Angalia chati za mfano na miamala unayoingiza mwenyewe."],
        ["Muundo unaojali faragha", "Linda taarifa zako na usiweke PIN au OTP za benki kwenye demo."],
        ["Mipango ya bili", "Weka tarehe za LUKU, kodi au ada za shule kwenye mpango wako."],
      ],
    },
    how: {
      eyebrow: "Inavyofanya kazi", title: "Hatua tatu kuelekea uwazi",
      steps: [
        ["Fungua demo", "Weka taarifa za msingi ili kujaribu workspace ya frontend."],
        ["Unganisha pesa zako", "Ongeza akaunti au andika miamala mwenyewe."],
        ["Zungumza na Pesa AI", "Pata maarifa na mpango kwa Kiswahili au Kiingereza."],
      ],
    },
    pricing: {
      eyebrow: "Bei", title: "Bei rahisi na za uwazi", month: "/mwezi", popular: "Maarufu zaidi", choose: "Chagua mpango",
      plans: [
        ["Bure", "TSh 0", "Kwa kuanza", ["Ufuatiliaji wa mkono", "Malengo 3 ya akiba", "Maswali 20 ya AI / mwezi"]],
        ["Pro", "TSh 9,900", "Kwa wawekaji akiba makini", ["Ufuatiliaji wa pesa za simu kwa mkono", "Malengo bila kikomo", "Pesa AI demo", "Muonekano wa ripoti za kina"]],
        ["Familia", "TSh 19,900", "Kwa kaya", ["Hadi wanachama 5", "Bajeti za pamoja", "Kila kitu cha Pro"]],
      ] as [string, string, string, string[]][],
    },
    testi: {
      eyebrow: "Unachoweza kufanya", title: "Fanya maamuzi bora ya fedha",
      items: [
        ["Bajeti", "Panga matumizi", "Weka bajeti za makundi na linganisha mpango wako na miamala unayoingiza."],
        ["Akiba", "Jenga mazoea", "Tengeneza lengo la akiba, chagua kiasi unacholenga na fuatilia maendeleo."],
        ["Uwazi", "Elewa mtiririko wa pesa", "Angalia mapato, matumizi na salio la miamala sehemu moja."],
      ],
    },
    faq: {
      eyebrow: "Maswali", title: "Maswali yamejibiwa",
      items: [
        ["Je, PesaTrack ni bure?", "Ndiyo — mpango wa Bure ni bure milele. Panda daraja unapohitaji zaidi."],
        ["Je, Pesa AI inatumia taarifa zangu halisi za fedha?", "Hapana kwenye frontend demo hii. Inatoa mwongozo wa jumla; majibu binafsi yanahitaji backend salama na ruhusa ya kutumia data."],
        ["Je, iko tayari kwa taarifa halisi za fedha?", "Bado. Hii ni frontend demo na haijaunganishwa na hifadhi salama ya akaunti. Usiweke taarifa nyeti za kifedha."],
        ["Naweza kuunganisha akaunti ya benki au pesa ya simu?", "Unaweza kufuatilia akaunti kwa kuingiza taarifa mwenyewe kwenye demo hii. Muunganisho wa moja kwa moja unahitaji API rasmi na backend salama."],
      ],
    },
    cta: { title: "Dhibiti pesa zako leo", sub: "Jaribu njia rahisi ya kufuatilia mapato, matumizi na akiba kwa PesaTrack.", btn: "Fungua akaunti bure" },
    footer: { tag: "Fedha binafsi janja na wakala wa AI wa lugha mbili.", product: "Bidhaa", company: "Kampuni", about: "Kuhusu", contact: "Wasiliana", privacy: "Faragha", rights: "Haki zote zimehifadhiwa." },
    toast: "Demo workspace iko tayari kujaribiwa.",
  },
};

export type Dict = (typeof dict)["en"];

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: Dict; theme: Theme; toggleTheme: () => void };
const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const l = localStorage.getItem("pt-lang") as Lang | null;
    const th = localStorage.getItem("pt-theme") as Theme | null;
    if (l === "en" || l === "sw") setLangState(l);
    if (th === "light" || th === "dark") setTheme(th);
    else if (window.matchMedia("(prefers-color-scheme: dark)").matches) setTheme("dark");
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("pt-theme", theme);
  }, [theme]);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("pt-lang", l);
    document.documentElement.lang = l;
  };

  return (
    <AppCtx.Provider value={{ lang, setLang, t: dict[lang] as Dict, theme, toggleTheme: () => setTheme((p) => (p === "dark" ? "light" : "dark")) }}>
      {children}
    </AppCtx.Provider>
  );
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp must be inside AppProvider");
  return c;
}
