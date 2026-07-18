import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LedgerlyBrand, LedgerlyLogo } from '@/components/icons';
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Check,
  PieChart,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import Link from 'next/link';

const features = [
  {
    icon: WalletCards,
    title: 'Accounts in one place',
    description: 'Track income, expenses, and balances without losing the big picture.',
  },
  {
    icon: PieChart,
    title: 'Clarity that clicks',
    description: 'Turn everyday activity into useful budgets, reports, and category insights.',
  },
  {
    icon: Target,
    title: 'Goals with momentum',
    description: 'See what is on track, what needs attention, and the next best move.',
  },
  {
    icon: Sparkles,
    title: 'AI-assisted planning',
    description: 'Explore projections and ask questions while keeping your judgment in control.',
  },
];

export default function LandingPage() {
  return (
    <div className="brand-grid flex min-h-screen flex-col overflow-hidden bg-brand-mint">
      <header className="relative z-20 border-b border-primary/10 bg-white/85 backdrop-blur-xl">
        <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
          <Link href="/" aria-label="Ledgerly Pro home">
            <LedgerlyBrand />
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link href="/signin">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/signin">Get started <ArrowRight /></Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative">
          <div className="absolute -right-56 -top-64 h-[38rem] w-[38rem] rounded-full bg-secondary/60 blur-3xl" />
          <div className="container relative mx-auto grid items-center gap-14 px-4 py-16 md:px-6 md:py-24 lg:grid-cols-[0.92fr_1.08fr] lg:py-28">
            <div className="max-w-2xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white/80 px-3 py-1.5 text-sm font-semibold text-primary shadow-sm">
                <ShieldCheck className="h-4 w-4" /> Clear. Secure. In your control.
              </div>
              <h1 className="font-headline text-4xl font-bold leading-[1.04] tracking-[-0.045em] text-brand-navy sm:text-5xl lg:text-6xl xl:text-7xl">
                Clarity today.
                <span className="block text-primary">Freedom tomorrow.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground md:text-xl">
                A calmer way to understand your money, build better habits, and make confident decisions with every dollar.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/signin">Start building clarity <ArrowRight /></Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="#features">Explore features</Link>
                </Button>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                {['Simple setup', 'Secure by design', 'Your data, your control'].map((item) => (
                  <span key={item} className="inline-flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-primary">
                      <Check className="h-3 w-3" />
                    </span>
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-2xl lg:mx-0">
              <div className="brand-surface absolute inset-6 rotate-2 rounded-[2rem] opacity-20 blur-sm" />
              <div className="relative overflow-hidden rounded-[1.75rem] border border-white/70 bg-white p-4 shadow-[0_30px_80px_-35px_rgba(41,58,94,0.45)] sm:p-6">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Monthly overview</p>
                    <p className="mt-1 font-headline text-xl font-semibold text-brand-navy">Your financial picture</p>
                  </div>
                  <div className="rounded-xl bg-secondary/70 p-2.5 text-primary"><BarChart3 /></div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="brand-surface rounded-2xl p-5 text-white sm:col-span-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-white/70">Monthly balance</p>
                        <p className="mt-2 font-headline text-3xl font-semibold tracking-tight">$4,250.00</p>
                      </div>
                      <span className="rounded-full bg-white/[0.12] px-2.5 py-1 text-xs font-semibold text-brand-tint">↑ 12.5%</span>
                    </div>
                    <div className="mt-7 flex h-16 items-end gap-2">
                      {[35, 48, 42, 62, 55, 74, 68, 88].map((height, index) => (
                        <div key={index} className="flex-1 rounded-t bg-white/80" style={{ height: `${height}%` }} />
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border bg-brand-mint p-4">
                    <div className="flex items-center justify-between text-sm font-medium"><span>Income</span><TrendingUp className="h-4 w-4 text-primary" /></div>
                    <p className="mt-3 font-headline text-xl font-semibold text-brand-navy">$5,320</p>
                    <p className="mt-1 text-xs text-muted-foreground">On pace this month</p>
                  </div>
                  <div className="rounded-2xl border bg-white p-4">
                    <div className="flex items-center justify-between text-sm font-medium"><span>Goals</span><Target className="h-4 w-4 text-primary" /></div>
                    <p className="mt-3 font-headline text-xl font-semibold text-brand-navy">72%</p>
                    <div className="mt-3 h-2 rounded-full bg-secondary"><div className="h-2 w-[72%] rounded-full bg-primary" /></div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-5 -left-3 hidden items-center gap-3 rounded-2xl border bg-white p-3 pr-5 shadow-xl sm:flex">
                <div className="rounded-xl bg-secondary p-2 text-primary"><BriefcaseBusiness className="h-5 w-5" /></div>
                <div><p className="text-xs text-muted-foreground">Spending plan</p><p className="text-sm font-semibold text-brand-navy">Right on track</p></div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="border-y border-primary/10 bg-white py-16 md:py-24">
          <div className="container mx-auto px-4 md:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Built for clear decisions</p>
              <h2 className="mt-3 font-headline text-3xl font-bold tracking-[-0.035em] text-brand-navy sm:text-4xl">
                Smart tools. Less financial noise.
              </h2>
              <p className="mt-4 text-muted-foreground md:text-lg">Everything has a purpose: helping you understand where you are and confidently choose what comes next.</p>
            </div>
            <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {features.map(({ icon: Icon, title, description }) => (
                <Card key={title} className="group border-primary/10 bg-card hover:shadow-[0_20px_45px_-28px_rgba(40,89,67,0.45)]">
                  <CardContent className="p-6">
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/70 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="font-headline text-lg font-semibold text-brand-navy">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-brand-mint py-16 md:py-20">
          <div className="container mx-auto px-4 md:px-6">
            <div className="brand-surface relative overflow-hidden rounded-[2rem] px-6 py-12 text-center text-white shadow-xl md:px-12">
              <LedgerlyLogo className="absolute -right-10 -top-12 h-52 w-52 text-white opacity-[0.06]" />
              <h2 className="relative font-headline text-3xl font-bold tracking-tight md:text-4xl">Put your finances back in focus.</h2>
              <p className="relative mx-auto mt-3 max-w-2xl text-brand-tint">Start with what you have today. Ledgerly Pro will help you turn it into a clearer path forward.</p>
              <Button asChild size="lg" className="relative mt-7 bg-white text-primary hover:bg-brand-mint">
                <Link href="/signin">Get started <ArrowRight /></Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-primary/10 bg-white">
        <div className="container mx-auto flex flex-col items-center justify-between gap-5 px-4 py-8 md:flex-row md:px-6">
          <div className="flex items-center gap-4">
            <LedgerlyBrand markClassName="h-8 w-8" className="[&>span]:text-base" />
            <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Ledgerly Pro.</p>
          </div>
          <nav className="flex gap-5 text-sm text-muted-foreground">
            <Link href="/terms" className="transition-colors hover:text-primary">Terms</Link>
            <Link href="/privacy" className="transition-colors hover:text-primary">Privacy</Link>
            <Link href="/signin" className="transition-colors hover:text-primary">Sign in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
