
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function TermsOfServicePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/50 p-4">
        <div className="absolute top-4 left-4">
            <Button asChild variant="outline">
                <Link href="/">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Home
                </Link>
            </Button>
        </div>
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <CardTitle className="font-headline text-3xl">Terms of Service</CardTitle>
          <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none dark:prose-invert">
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
            If you have any questions about these Terms, please contact us at support@ledgerlypro.com.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
