
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
            Last updated: <time>{new Date().toLocaleDateString()}</time>
          </p>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none break-words px-4 pb-5 dark:prose-invert prose-headings:scroll-mt-4 prose-headings:font-headline prose-headings:text-xl prose-headings:font-bold prose-p:text-muted-foreground sm:px-6 sm:pb-6">
          <article>
          <p>
            Please read these Terms of Service ("Terms", "Terms of Service") carefully before using the Ledgerly Pro application (the "Service") operated by us.
          </p>

          <h2>1. Accounts</h2>
          <p>
            When you create an account with us, you must provide us with information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account on our Service.
          </p>

          <h2>2. Your Data</h2>
          <p>
            You are responsible for safeguarding the data that you use for the Service and for any activities or actions under your account. You agree not to disclose your password to any third party. You must notify us immediately upon becoming aware of any breach of security or unauthorized use of your account.
          </p>
          <p>
            You retain all ownership rights to the content and data you submit to the Service. We do not claim ownership over your data.
          </p>

          <h2>3. AI Features</h2>
          <p>
            The Service may include features that use artificial intelligence ("AI Features"). While we strive to provide accurate information, you acknowledge that the output from AI Features may sometimes be inaccurate or incomplete. You should independently verify any information provided by the AI Features before relying on it. We are not liable for any damages or losses arising from your use of or reliance on the AI Features.
          </p>

          <h2>4. Termination</h2>
          <p>
            We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
          </p>

          <h2>5. Limitation of Liability</h2>
          <p>
            In no event shall Ledgerly Pro, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.
          </p>

          <h2>6. Changes</h2>
          <p>
            We reserve the right, at our sole discretion, to modify or replace these Terms at any time. We will try to provide at least 30 days' notice prior to any new terms taking effect.
          </p>

          <h2>7. Contact Us</h2>
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
