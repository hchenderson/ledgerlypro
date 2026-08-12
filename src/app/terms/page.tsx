
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function TermsOfServicePage() {
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
            <h1 className="font-headline text-2xl sm:text-3xl">Terms of Service</h1>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Last updated: <time dateTime="2026-08-06">August 6, 2026</time>
          </p>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none break-words px-4 pb-5 dark:prose-invert prose-headings:scroll-mt-4 prose-headings:font-headline prose-headings:text-xl prose-headings:font-bold prose-p:text-muted-foreground sm:px-6 sm:pb-6">
          <article>
          <p>
            These Terms govern your use of the Ledgerly Pro application and related services (the "Service"). By using the Service, you agree to these Terms and acknowledge the Privacy Policy.
          </p>

          <h2>1. Accounts</h2>
          <p>
            When you create an account with us, you must provide us with information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account on our Service.
          </p>
          <p>You are responsible for protecting your password, devices, and connected accounts and for promptly reporting suspected unauthorized use. You must be at least 13 and legally able to agree to these Terms.</p>

          <h2>2. Your Data</h2>
          <p>
            You are responsible for safeguarding the data that you use for the Service and for any activities or actions under your account. You agree not to disclose your password to any third party. You must notify us immediately upon becoming aware of any breach of security or unauthorized use of your account.
          </p>
          <p>
            You retain all ownership rights to the content and data you submit to the Service. We do not claim ownership over your data.
          </p>

          <h2>3. Financial Information and Connected Services</h2>
          <p>Ledgerly is a budgeting and financial-information tool, not a bank, money transmitter, accountant, investment adviser, or financial adviser. Balances, categorizations, projections, and reports may be delayed, incomplete, or inaccurate. Verify important information with your financial institution and a qualified professional before making decisions.</p>
          <p>Institution connections are provided through Plaid and may be interrupted, require renewed consent, or be unavailable for a particular institution. Your use of third-party services is also governed by their terms and privacy policies.</p>

          <h2>4. AI Features</h2>
          <p>
            The Service may include features that use artificial intelligence ("AI Features"). While we strive to provide accurate information, you acknowledge that the output from AI Features may sometimes be inaccurate or incomplete. You should independently verify any information provided by the AI Features before relying on it. We are not liable for any damages or losses arising from your use of or reliance on the AI Features.
          </p>

          <h2>5. Acceptable Use</h2>
          <p>You may not misuse the Service, access another person&apos;s data, bypass security or usage controls, introduce malicious code, interfere with operation, reverse engineer protected portions of the Service except where law permits, or use the Service unlawfully.</p>

          <h2>6. Availability and Termination</h2>
          <p>
            We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
          </p>

          <p>You may stop using the Service and delete your account at any time. Features may change, be suspended, or be discontinued. We may suspend access to protect the Service or others, comply with law, or address a material breach.</p>

          <h2>7. Disclaimers and Limitation of Liability</h2>
          <p>The Service is provided "as is" and "as available" to the extent permitted by law. We disclaim implied warranties, including merchantability, fitness for a particular purpose, and non-infringement. Some jurisdictions do not allow certain exclusions, so they may not apply to you.</p>
          <p>
            In no event shall Ledgerly Pro, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.
          </p>

          <h2>8. Changes</h2>
          <p>
            We may update these Terms as the Service changes. The date at the top identifies the current version. When required, we will provide notice before material changes take effect. Continued use after the effective date means you accept the updated Terms.
          </p>

          <h2>9. Contact Us</h2>
          <p>
            If you have any questions about these Terms, please contact us at{" "}
            <a href="mailto:support@ledgerly.business">support@ledgerly.business</a>.
          </p>
          </article>
        </CardContent>
      </Card>
      </div>
    </main>
  );
}
