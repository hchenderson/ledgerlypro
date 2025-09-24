
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart, Briefcase, FileText, PieChart } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { LedgerlyLogo } from '@/components/icons';
import imageData from '@/lib/placeholder-images.json';

const features = [
  {
    icon: <Briefcase className="h-6 w-6" />,
    title: 'Transaction Management',
    description: 'Effortlessly track income and expenses with our intuitive interface.',
  },
  {
    icon: <PieChart className="h-6 w-6" />,
    title: 'Insightful Reports',
    description: 'Visualize your financial health with detailed charts and summaries.',
  },
  {
    icon: <FileText className="h-6 w-6" />,
    title: 'Data Export',
    description: 'Easily export your data to CSV or PDF for tax season or personal records.',
  },
  {
    icon: <BarChart className="h-6 w-6" />,
    title: 'AI Projections',
    description: 'Leverage AI to get cash flow projections. AI can make mistakes, so please verify all results.',
  },
];

export default function LandingPage() {
  const { landingPage } = imageData;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
        <Link href="#" className="flex items-center gap-2" prefetch={false}>
          <LedgerlyLogo className="h-8 w-8 text-primary" />
          <span className="font-headline text-xl font-bold text-foreground">Ledgerly Pro</span>
        </Link>
        <Button asChild>
          <Link href="/dashboard">Get Started</Link>
        </Button>
      </header>
      <main className="flex-1">
        <section className="container mx-auto px-4 py-12 md:px-6 md:py-24 lg:py-32">
          <div className="grid gap-8 md:grid-cols-2 md:gap-16">
            <div className="flex flex-col justify-center space-y-6">
              <h1 className="font-headline text-4xl font-extrabold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">
                Modern Bookkeeping, <span className="text-primary">Simplified.</span>
              </h1>
              <p className="max-w-[600px] text-lg text-muted-foreground md:text-xl">
                Ledgerly Pro offers a clean, ad-free experience to manage your finances with confidence. Secure, private, and powerful—it's the tool you need to achieve financial clarity.
              </p>
              <div className="flex flex-col gap-4 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/dashboard">Explore Dashboard</Link>
                </Button>
              </div>
            </div>
            <div className="relative">
              <Image
                src={landingPage.dashboard.src}
                alt={landingPage.dashboard.alt}
                width={landingPage.dashboard.width}
                height={landingPage.dashboard.height}
                className="rounded-xl object-cover shadow-2xl"
                data-ai-hint={landingPage.dashboard['data-ai-hint']}
                priority
              />
              <div className="absolute -bottom-4 -left-4 hidden md:block">
                 <Image
                    src={landingPage.chart.src}
                    alt={landingPage.chart.alt}
                    width={landingPage.chart.width}
                    height={landingPage.chart.height}
                    className="rounded-lg object-cover shadow-lg"
                    data-ai-hint={landingPage.chart['data-ai-hint']}
                  />
              </div>
            </div>
          </div>
        </section>
        <section id="features" className="bg-secondary/50 py-12 md:py-24">
          <div className="container mx-auto px-4 md:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="font-headline text-3xl font-bold tracking-tighter sm:text-4xl">
                Features for Financial Mastery
              </h2>
              <p className="mt-4 text-muted-foreground md:text-lg">
                Everything you need to stay on top of your finances, and nothing you don't.
              </p>
            </div>
            <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <Card key={feature.title} className="bg-card/50 backdrop-blur-sm">
                  <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
                    <div className="rounded-full bg-primary p-3 text-primary-foreground">
                      {feature.icon}
                    </div>
                    <h3 className="font-headline text-xl font-semibold">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t bg-secondary/30">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-6 md:flex-row md:px-6">
          <div className="flex items-center gap-2">
            <LedgerlyLogo className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">&copy; 2024 Ledgerly Pro. All rights reserved.</p>
          </div>
          <nav className="flex gap-4 sm:gap-6">
            <Link href="/terms" className="text-sm hover:underline" prefetch={false}>
              Terms of Service
            </Link>
            <Link href="/privacy" className="text-sm hover:underline" prefetch={false}>
              Privacy Policy
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
