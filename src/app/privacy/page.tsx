
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
            Last updated: <time>{new Date().toLocaleDateString()}</time>
          </p>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none break-words px-4 pb-5 dark:prose-invert prose-headings:scroll-mt-4 prose-headings:font-headline prose-headings:text-xl prose-headings:font-bold prose-p:text-muted-foreground sm:px-6 sm:pb-6">
          <article>
          <p>
            Welcome to Ledgerly Pro. We are committed to protecting your privacy. This Privacy Policy explains how your personal information is collected, used, and disclosed by Ledgerly Pro.
          </p>

          <h2>1. Information We Collect</h2>
          <p>
            We collect information you provide directly to us when you create an account, such as your name and email address. We also store financial data you input into the application, including transactions, categories, and budgets. This information is stored securely and is only accessible by you.
          </p>

          <h2>2. How We Use Your Information</h2>
          <p>
            We use the information we collect to:
          </p>
          <ul>
            <li>Provide, maintain, and improve our services.</li>
            <li>Personalize your experience.</li>
            <li>Communicate with you about your account and our services.</li>
            <li>Ensure the security of your account and our services.</li>
          </ul>

          <h2>3. Data Storage and Security</h2>
          <p>
            All your data is stored securely using Firebase Firestore. We implement security rules to ensure that only you can access your own data. We take reasonable measures to help protect information about you from loss, theft, misuse, and unauthorized access.
          </p>

          <h2>4. Sharing of Information</h2>
          <p>
            We do not share your personal information with third parties except as described in this Privacy Policy or with your consent. We will never sell your data.
          </p>

          <h2>5. Your Choices</h2>
          <p>
            You may update or correct your account information at any time by logging into your account. You can also delete your data from within the application settings.
          </p>
          
          <h2>6. Contact Us</h2>
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
