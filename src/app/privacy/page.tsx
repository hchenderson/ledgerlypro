
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-dvh bg-secondary/50 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-4xl">
        <nav className="mb-4" aria-label="Legal page navigation">
            <Button asChild variant="outline">
                <Link href="/">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Home
                </Link>
            </Button>
        </nav>
      <Card className="w-full max-w-4xl">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle>
            <h1 className="font-headline text-2xl sm:text-3xl">Privacy Policy</h1>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Last updated: <time dateTime="2026-08-06">August 6, 2026</time>
          </p>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none break-words px-4 pb-5 dark:prose-invert prose-headings:scroll-mt-4 prose-headings:font-headline prose-headings:text-xl prose-headings:font-bold prose-p:text-muted-foreground sm:px-6 sm:pb-6">
          <article>
          <p>This policy explains what Ledgerly Pro collects, why we use it, when service providers process it, and the choices available to you.</p>

          <h2>1. Information We Collect</h2>
          <p>
            We collect account information such as your name, email address, authentication provider, and profile settings. We store financial information you enter or import, including accounts, balances, transactions, categories, budgets, envelopes, goals, reports, rules, and receipts you choose to scan.
          </p>
          <p>If you connect an institution through Plaid, we receive the account details, balances, and transaction history you authorize. Ledgerly does not receive or store your bank username or password. When you use an AI feature, we process your prompt or uploaded receipt together with the relevant financial context the feature needs to answer. We also process operational information such as timestamps, request identifiers, errors, and security events.</p>

          <h2>2. How We Use Your Information</h2>
          <p>
            We use the information we collect to:
          </p>
          <ul>
            <li>Provide, maintain, and improve our services.</li>
            <li>Personalize your experience.</li>
            <li>Communicate with you about your account and our services.</li>
            <li>Ensure the security of your account and our services.</li>
            <li>Connect institutions, import transactions, apply categorization rules, and maintain reports.</li>
            <li>Diagnose errors, prevent misuse, and meet legal obligations.</li>
          </ul>

          <h2>3. Data Storage and Security</h2>
          <p>
            Ledgerly uses Google Firebase and Google Cloud to host and protect the Service. Plaid processes institution connections. Google&apos;s Gemini services process requests when you use AI features. Authorized service providers and personnel may process data only as needed to operate, secure, support, or comply with law. No internet service can guarantee absolute security.
          </p>

          <h2>4. Sharing of Information</h2>
          <p>
            We disclose information to the service providers described above, when you direct us to do so, during a business transfer, or when reasonably necessary to comply with law or protect users and the Service. We do not sell personal information for money. If advertising is enabled, Google AdSense and consent-management partners may process device or advertising identifiers as described in their own policies; Ledgerly keeps advertising disabled until that setup is completed.
          </p>

          <h2>5. Your Choices</h2>
          <p>
            You may update your profile, disconnect an institution, clear selected financial data, or permanently delete your Ledgerly account in Settings. Account deletion removes Ledgerly&apos;s active account data and sign-in record, subject to limited retention in backups, security records, or records we must keep by law. Plaid webhook jobs and historical balance snapshots have automated retention periods.
          </p>

          <h2>6. Retention</h2>
          <p>We retain active account data while your account is open and for as long as needed to provide the Service. Operational records are retained for limited periods based on security, troubleshooting, backup, and legal needs. De-identified or aggregated information may be retained when it can no longer reasonably identify you.</p>

          <h2>7. Children and Changes</h2>
          <p>Ledgerly is not directed to children under 13. We may update this policy as the Service changes. The date at the top identifies the current version, and material changes may be communicated in the Service or by email.</p>

          <h2>8. Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy, please contact us at{" "}
            <a href="mailto:support@ledgerly.business">support@ledgerly.business</a>.
          </p>
          </article>
        </CardContent>
      </Card>
      </div>
    </main>
  );
}
