"use client";

import Link from "next/link";
import {
  AlertCircle,
  ArrowDownToLine,
  BarChart3,
  BookOpenText,
  Bot,
  Check,
  CheckCircle2,
  CircleDollarSign,
  FileBarChart,
  HelpCircle,
  Landmark,
  Lightbulb,
  ListChecks,
  LockKeyhole,
  PieChart,
  Receipt,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  Tags,
  Target,
  TrendingUp,
  WalletCards,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import type { BudgetingMode } from "@/types";

const modeLabels: Record<BudgetingMode, string> = {
  tracking: "Tracking",
  envelope: "Envelope budgeting",
  hybrid: "Hybrid",
};

const quickStartSteps = [
  {
    title: "Choose how you want to budget",
    description:
      "Open Settings and choose Tracking, Envelope, or Hybrid. You can change modes later without deleting your financial history.",
    href: "/settings",
    action: "Open Settings",
    icon: Settings,
  },
  {
    title: "Set up your accounts",
    description:
      "Make your everyday checking account the Main operating account, then add savings, cash, credit cards, and any accounts that will back envelopes.",
    href: "/accounts",
    action: "Review Accounts",
    icon: Landmark,
  },
  {
    title: "Create useful categories",
    description:
      "Create income and expense categories such as Paycheck, Groceries, Utilities, Travel, and Dining. Categories explain what happened; accounts explain where it happened.",
    href: "/categories",
    action: "Set Up Categories",
    icon: Tags,
  },
  {
    title: "Add or import transactions",
    description:
      "Use New for one transaction or Import for a statement file. Always select the account where the activity actually occurred.",
    href: "/transactions",
    action: "View Transactions",
    icon: ArrowDownToLine,
  },
  {
    title: "Create your spending plan",
    description:
      "Use category budgets for spending limits, envelopes for assigned cash, or both. Start with only the categories or envelopes that drive real decisions.",
    href: "/budgets",
    action: "Build a Plan",
    icon: Target,
  },
  {
    title: "Check your results",
    description:
      "Use Dashboard for today, Reports for a selected period, and Compare to place two matching periods side by side.",
    href: "/reports",
    action: "Open Reports",
    icon: BarChart3,
  },
] as const;

const monthlyRoutine = [
  "Import or enter all recent activity.",
  "Review possible transfer matches so transfers are not counted as income or expenses.",
  "Assign categories and envelopes to uncategorized expenses.",
  "Reconcile each account against its bank or card statement.",
  "Fund underfunded envelopes without dropping Main below your chosen cushion.",
  "Review budgets, goals, and recurring items for anything that changed.",
  "Open Reports and Compare before deciding what to adjust next month.",
];

const pageGuides = [
  {
    value: "dashboard",
    title: "Dashboard — your current financial picture",
    icon: PieChart,
    body: [
      "Use the year and account selectors at the top before interpreting any number.",
      "Income, expenses, and net cash flow include financial transactions—not internal transfers.",
      "In Envelope or Hybrid mode, the envelope snapshot shows available, reserved, underfunded, and overspent money.",
      "Treat the dashboard as a summary. Open the source page whenever a number needs investigation.",
    ],
  },
  {
    value: "accounts",
    title: "Accounts — where your money lives",
    icon: WalletCards,
    body: [
      "The Main operating account is the checking account used for paychecks, bills, and most everyday spending.",
      "Account roles describe how an account is used: Main, envelope, debt, or standard.",
      "An opening balance represents the account balance immediately before Ledgerly begins tracking activity.",
      "Reconcile an account against a statement to identify missing, duplicated, or incorrectly assigned transactions.",
      "Archive accounts you no longer use. Their history stays in reports and can be restored later.",
    ],
  },
  {
    value: "transactions",
    title: "Transactions — what happened",
    icon: Receipt,
    body: [
      "Income adds money; expenses remove money; transfers move money between two of your accounts.",
      "The category answers why money was received or spent. The account answers where it was received or spent.",
      "When one bank deposit contains several kinds of giving, edit it and turn on Split transaction. Assign every dollar to a category; Ledgerly will not save the split until its lines equal the bank amount.",
      "Save a completed split as a template when deposits commonly use the same percentage breakdown. Templates follow your account across devices and can be adjusted before saving each transaction.",
      "When using envelopes, assign an expense to the envelope that should pay for it. Refunds can restore the same envelope.",
      "Review matched withdrawal/deposit pairs and choose the correct transfer purpose. Never mark unrelated entries as one transfer.",
      "Use account and date filters to investigate a balance without changing the underlying data.",
    ],
  },
  {
    value: "budgets",
    title: "Budgets and envelopes — what your money should do",
    icon: Target,
    body: [
      "A category spending limit compares expenses with a planned limit for a month or year.",
      "An envelope assigns actual available cash to a purpose such as bills, travel, gifts, or emergency savings.",
      "The envelope detail page shows available money, funding progress, released money, spending, and its complete event history.",
      "A negative envelope is overspent. Cover it from another envelope, add a valid adjustment, or correct the expense assignment.",
      "Funding suggestions are advisory. Ledgerly never moves bank money automatically.",
    ],
  },
  {
    value: "reports",
    title: "Reports and Compare — understand results",
    icon: FileBarChart,
    body: [
      "Monthly and Yearly Reports use one shared filter for every card, chart, category table, insight, transaction row, PDF, and CSV export.",
      "Use Filters and comparison to choose exact dates, accounts, income or expenses, included or excluded categories, posted or pending entries, transfers, and a comparison period.",
      "Use Customize sections and cards to show, hide, and reorder the report. Save a named view when you want the same configuration on another device.",
      "Choose PDF Summary for a concise, print-ready report. Choose PDF Detailed to include the visible charts, supporting tables, and every filtered transaction. CSV remains available for spreadsheet work.",
      "Report comparison cards and category movement use the same calculation engine as Compare. Open the selected report dates in Compare when you need a deeper side-by-side investigation.",
      "Envelope reports are intentionally separate from cash-flow reports. Funding and releasing an envelope are transfers, not income or expenses.",
      "Use Advanced reports when you need a frozen quarterly record. Use the live Monthly and Yearly workspaces for customizable analysis.",
      "Use the Designated tab for missionary, building, benevolence, or similar funds. Pair received and sent categories once, confirm the opening amount held, and Ledgerly will show church operations separately from designated activity.",
      "Account filters change which account activity is included. Select all accounts for the complete household picture.",
    ],
  },
  {
    value: "planning",
    title: "Goals, recurring items, and projections — plan ahead",
    icon: TrendingUp,
    body: [
      "Goals can be tracked manually, linked to category activity, or linked to an envelope balance.",
      "Recurring items create expected transactions on their schedule. Review their account, category, amount, and optional envelope whenever a bill changes.",
      "Projections estimate what may happen from your recorded history and settings; they are planning aids, not guarantees.",
      "Past-year planning data remains protected. Historical income and expense transactions can be corrected from Transactions; Ledgerly asks for confirmation and recalculates every affected report.",
    ],
  },
  {
    value: "ai",
    title: "AI tools — assistance with human review",
    icon: Bot,
    body: [
      "Chat can explain patterns and help you think through options based on the data available to it.",
      "Receipt Scanner can extract transaction details, but you should verify the merchant, amount, date, account, category, and envelope before saving.",
      "AI output can be incomplete or incorrect. Use it for assistance, never as a replacement for statements, receipts, professional advice, or your own judgment.",
      "Local AI features require the Firebase Admin credential described in README local setup; the hosted app uses its configured backend environment.",
    ],
  },
] as const;

function GuideLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="font-medium text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
    >
      {children}
    </Link>
  );
}

function FlowStep({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="group relative flex gap-4 pb-6 last:pb-0">
      <div className="absolute bottom-0 left-5 top-10 w-px bg-border group-last:hidden" />
      <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
        {number}
      </div>
      <div className="min-w-0 pt-1">
        <h3 className="font-semibold">{title}</h3>
        <div className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function HowToUsePage() {
  const { budgetingMode } = useAuth();

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-8">
      <section className="overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-secondary/40 p-5 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1.5">
                <BookOpenText className="h-3.5 w-3.5" />
                How to use Ledgerly Pro
              </Badge>
              <Badge variant="outline">
                Current mode: {modeLabels[budgetingMode]}
              </Badge>
            </div>
            <h1 className="font-headline text-3xl font-bold tracking-tight sm:text-4xl">
              Make every number lead to a clear decision.
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              This guide walks from first setup through daily use, envelope
              transfers, monthly reviews, reports, and common corrections. Your
              data is not changed by reading or following this page.
            </p>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
            <Button asChild variant="outline" className="bg-card/80">
              <a href="#start">Start here</a>
            </Button>
            <Button asChild variant="outline" className="bg-card/80">
              <a href="#envelopes">Envelope flow</a>
            </Button>
            <Button asChild variant="outline" className="bg-card/80">
              <a href="#pages">Page guide</a>
            </Button>
            <Button asChild className="sm:col-span-3 lg:col-span-1">
              <a href="#help">Get unstuck</a>
            </Button>
          </div>
        </div>
      </section>

      <Alert className="border-primary/20 bg-primary/5">
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>The rule that keeps reports accurate</AlertTitle>
        <AlertDescription>
          Record money earned as income, purchases and bills as expenses, and
          movements between your own accounts as transfers. A transfer changes
          account balances but never income, expenses, or net cash flow.
        </AlertDescription>
      </Alert>

      <section id="start" className="scroll-mt-24 space-y-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            First-time setup
          </p>
          <h2 className="font-headline text-2xl font-bold">Start in this order</h2>
          <p className="mt-1 text-muted-foreground">
            Each step makes the next one more reliable. You can return and refine
            any setting later.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {quickStartSteps.map((step, index) => (
            <Card key={step.title} className="flex h-full flex-col">
              <CardHeader className="pb-3">
                <div className="mb-3 flex items-center justify-between">
                  <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                    <step.icon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-semibold text-muted-foreground">
                    Step {index + 1}
                  </span>
                </div>
                <CardTitle className="text-lg">{step.title}</CardTitle>
                <CardDescription className="leading-relaxed">
                  {step.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Button asChild variant="outline" className="w-full">
                  <Link href={step.href}>{step.action}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Budgeting style
          </p>
          <h2 className="font-headline text-2xl font-bold">Choose the right mode</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {([
            {
              mode: "tracking" as const,
              title: "Tracking",
              icon: BarChart3,
              best: "Best when you mainly want clean bookkeeping and reports.",
              includes: ["Accounts and transactions", "Categories and reports", "Category spending limits"],
            },
            {
              mode: "envelope" as const,
              title: "Envelope",
              icon: CircleDollarSign,
              best: "Best when separate accounts hold money for specific purposes.",
              includes: ["Account-backed envelopes", "Funding and release transfers", "Available and reserved balances"],
            },
            {
              mode: "hybrid" as const,
              title: "Hybrid",
              icon: Sparkles,
              best: "Best when you want envelope cash control plus category limits.",
              includes: ["Every envelope feature", "Traditional category budgets", "One shared transaction ledger"],
            },
          ]).map((option) => (
            <Card
              key={option.mode}
              className={budgetingMode === option.mode ? "border-primary shadow-sm" : ""}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-xl bg-secondary p-2.5 text-primary">
                    <option.icon className="h-5 w-5" />
                  </div>
                  {budgetingMode === option.mode ? <Badge>Current</Badge> : null}
                </div>
                <CardTitle>{option.title}</CardTitle>
                <CardDescription>{option.best}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {option.includes.map((item) => (
                    <li key={item} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          Change this under <GuideLink href="/settings">Settings → Budgeting Method</GuideLink>.
          Switching modes changes which planning tools are shown; it does not
          delete transactions, accounts, reports, or existing envelopes.
        </p>
      </section>

      <section id="envelopes" className="scroll-mt-24 space-y-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Envelope budgeting
          </p>
          <h2 className="font-headline text-2xl font-bold">
            Follow one dollar through the envelope system
          </h2>
          <p className="mt-1 text-muted-foreground">
            Ledgerly maintains the real bank ledger and the envelope planning
            ledger side by side. They answer different questions and remain
            connected through explicit transfer purposes.
          </p>
        </div>
        <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
          <Card>
            <CardContent className="p-5 sm:p-6">
              <FlowStep number={1} title="Income reaches Main">
                Record a paycheck as income in your Main account. This increases
                income, cash flow, and the Main account balance.
              </FlowStep>
              <FlowStep number={2} title="Fund an envelope">
                Transfer money from Main to the envelope&apos;s backing account and
                select <strong>Fund envelope</strong>. The envelope becomes
                available, while income and expenses do not change.
              </FlowStep>
              <FlowStep number={3} title="Release money when you are ready to spend">
                Transfer from the envelope account back to Main and select
                <strong> Release to spend</strong>. The money remains available in
                the envelope but is now shown as reserved in Main.
              </FlowStep>
              <FlowStep number={4} title="Record the real expense">
                Enter or import the purchase in Main and assign the correct
                envelope. Only now does the envelope available balance and your
                expense report decrease.
              </FlowStep>
              <FlowStep number={5} title="Return or redirect anything unused">
                Choose <strong>Return unused</strong> to move unspent reserved money
                back to its envelope account, <strong>Unassign</strong> to return it
                to general cash, or <strong>Move envelope-to-envelope</strong> to
                give it a new job.
              </FlowStep>
            </CardContent>
          </Card>
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Transfer purposes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {[
                  ["Internal transfer", "Moves bank money only."],
                  ["Fund envelope", "Adds assigned envelope money."],
                  ["Release to spend", "Reserves envelope money in Main."],
                  ["Return unused", "Moves reserved money back."],
                  ["Unassign", "Removes the money's envelope job."],
                  ["Move envelope-to-envelope", "Changes the purpose of assigned money."],
                ].map(([name, description]) => (
                  <div key={name}>
                    <p className="font-medium">{name}</p>
                    <p className="text-muted-foreground">{description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Available is not always the bank balance</AlertTitle>
              <AlertDescription>
                After a release, some envelope money physically sits in Main.
                That is why Ledgerly shows both available and reserved in Main.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Repeatable routines
          </p>
          <h2 className="font-headline text-2xl font-bold">What to do and when</h2>
        </div>
        <Tabs defaultValue="weekly">
          <TabsList className="grid w-full grid-cols-3 sm:w-auto">
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="yearly">Yearly</TabsTrigger>
          </TabsList>
          <TabsContent value="weekly">
            <Card>
              <CardContent className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
                {[
                  "Import or add recent transactions.",
                  "Categorize new income and expenses.",
                  "Confirm legitimate transfer matches.",
                  "Assign expenses to the correct envelopes.",
                  "Check Main and envelope balances for surprises.",
                  "Review upcoming recurring bills.",
                ].map((item) => (
                  <div key={item} className="flex gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="monthly">
            <Card>
              <CardContent className="p-5 sm:p-6">
                <ol className="grid gap-3 md:grid-cols-2">
                  {monthlyRoutine.map((item, index) => (
                    <li key={item} className="flex gap-3 rounded-lg border p-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-primary">
                        {index + 1}
                      </span>
                      <span className="text-sm">{item}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="yearly">
            <Card>
              <CardContent className="space-y-4 p-5 sm:p-6">
                <div className="flex gap-3">
                  <FileBarChart className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <p className="text-sm">Generate quarterly and year-end reports after the period is complete.</p>
                </div>
                <div className="flex gap-3">
                  <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <p className="text-sm">Review category names, recurring schedules, goals, envelope targets, and inactive accounts.</p>
                </div>
                <div className="flex gap-3">
                  <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <p className="text-sm">Use the year switcher to inspect prior years. You can correct historical income and expense transactions with a confirmation; adding, importing, deleting, transfers, and planning changes remain protected.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </section>

      <section id="pages" className="scroll-mt-24 space-y-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Page-by-page reference
          </p>
          <h2 className="font-headline text-2xl font-bold">Know what every area does</h2>
        </div>
        <Card>
          <CardContent className="px-5 py-2 sm:px-6">
            <Accordion type="multiple" defaultValue={["dashboard", "transactions"]}>
              {pageGuides.map((guide) => (
                <AccordionItem key={guide.value} value={guide.value}>
                  <AccordionTrigger className="gap-3 text-left hover:no-underline">
                    <span className="flex items-center gap-3">
                      <guide.icon className="h-5 w-5 shrink-0 text-primary" />
                      {guide.title}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-2 pl-8 text-muted-foreground">
                      {guide.body.map((item) => (
                        <li key={item} className="flex gap-2 leading-relaxed">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Numbers you will see
          </p>
          <h2 className="font-headline text-2xl font-bold">A short glossary</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Net cash flow", "Income minus expenses for the selected period. Transfers are excluded."],
            ["Account balance", "Opening balance plus every income, expense, and transfer in that account."],
            ["Ready to assign", "Cash not currently assigned to active envelopes, after your Main cushion."],
            ["Envelope available", "Assigned money remaining after funding, expenses, unassigning, and reallocations."],
            ["Reserved in Main", "Released envelope money currently waiting in Main to be spent or returned."],
            ["Savings rate", "Net cash flow divided by income for the selected period."],
          ].map(([term, meaning]) => (
            <Card key={term}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{term}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed text-muted-foreground">
                {meaning}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="help" className="scroll-mt-24 space-y-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Troubleshooting
          </p>
          <h2 className="font-headline text-2xl font-bold">Get unstuck safely</h2>
        </div>
        <Card>
          <CardContent className="px-5 py-2 sm:px-6">
            <Accordion type="single" collapsible>
              <AccordionItem value="wrong-report">
                <AccordionTrigger className="text-left">Why do two report totals look different?</AccordionTrigger>
                <AccordionContent className="space-y-2 text-muted-foreground">
                  <p>Compare the exact start and end dates, selected accounts, category inclusions or exclusions, pending-entry setting, and cash-flow types. Year to date is not the same as a completed first half or full year.</p>
                  <p>When a comparison is enabled in Reports, its summary and category-movement sections use the same filtered transaction set. The filter badges above the report document what is included.</p>
                  <p>Also review unmatched internal transfers. A withdrawal and deposit recorded as expense and income will inflate both totals until linked as a transfer.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="wrong-balance">
                <AccordionTrigger className="text-left">Why does an account balance look wrong?</AccordionTrigger>
                <AccordionContent className="space-y-2 text-muted-foreground">
                  <p>Confirm the opening balance, transaction account assignments, duplicate imports, and missing transfer partners. Then reconcile the account against a statement.</p>
                  <p>Do not change opening balance to hide a recent discrepancy; that can make historical balances incorrect.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="envelope-bank">
                <AccordionTrigger className="text-left">Why does an envelope differ from its backing account?</AccordionTrigger>
                <AccordionContent className="space-y-2 text-muted-foreground">
                  <p>Released money may be physically in Main while still available to the envelope. Check the reserved-in-Main amount and envelope event history.</p>
                  <p>Ordinary account interest, fees, or unrelated transactions can also make the bank account and envelope differ. Assign or adjust only when you can explain the difference.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="negative-envelope">
                <AccordionTrigger className="text-left">What should I do with an overspent envelope?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  First verify the expense and its envelope assignment. If it is correct, move available money from another envelope or add a documented adjustment. Do not delete a correct purchase merely to remove the warning.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="read-only">
                <AccordionTrigger className="text-left">What can I change in a past year?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Past-year income and expense transactions can be corrected from the Transactions page. Ledgerly confirms the change before recalculating balances, reports, comparisons, budgets, goals, projections, and designated funds. New transactions, imports, deletions, transfers, and historical planning changes remain unavailable to reduce accidental changes to closed years.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="signin-ai">
                <AccordionTrigger className="text-left">What if sign-in or AI tools fail?</AccordionTrigger>
                <AccordionContent className="space-y-2 text-muted-foreground">
                  <p>For sign-in, verify the email, password, Firebase Authentication user, and authorized domain. An invalid-credential message usually means the credentials do not match an enabled account.</p>
                  <p>For local AI, verify the Firebase Admin credential file and environment variables described in the project README. Never commit credential files to Git.</p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </section>

      <Separator />

      <section className="rounded-2xl bg-primary p-6 text-primary-foreground sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ListChecks className="h-5 w-5" />
              <p className="font-semibold">Ready for your next review?</p>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-primary-foreground/80">
              Start with Accounts and Transactions, then let Budgets and Reports
              show what deserves attention. Correct source data before adjusting a
              plan to match an unexpected result.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="secondary">
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
            <Button asChild variant="outline" className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
              <Link href="/chat">
                <HelpCircle className="mr-2 h-4 w-4" />
                Ask Ledgerly AI
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="flex items-start gap-3 rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          Ledgerly is a planning and recordkeeping tool, not financial, tax, or
          legal advice. Verify important decisions against official statements and
          consult a qualified professional when appropriate.
        </p>
      </div>
    </div>
  );
}
