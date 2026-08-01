
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LedgerlyBrand, LedgerlyLogo } from "@/components/icons";
import { signInWithGoogle, signUpWithEmail, signInWithEmail, sendPasswordResetEmail } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getAdditionalUserInfo } from "firebase/auth";
import { useAuth } from "@/hooks/use-auth";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { Check, ShieldCheck, TrendingUp } from "lucide-react";

const GoogleIcon = () => (
    <svg className="size-4" viewBox="0 0 48 48">
        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
        <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.222,0-9.657-3.356-11.303-8H6.306C9.656,39.663,16.318,44,24,44z" />
        <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C42.02,35.579,44,30.038,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
    </svg>
);

function ForgotPasswordDialog() {
    const [email, setEmail] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const { toast } = useToast();

    const handlePasswordReset = async () => {
        if (!email) {
            toast({ variant: 'destructive', title: 'Email required', description: 'Please enter your email address.' });
            return;
        }
        try {
            await sendPasswordResetEmail(email);
            toast({ title: 'Password Reset Email Sent', description: 'Check your inbox for a link to reset your password.' });
            setIsOpen(false);
        } catch {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not send password reset email. Please try again.' });
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="link" size="sm" className="w-full px-0 font-normal">Forgot password?</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Reset Your Password</DialogTitle>
                    <DialogDescription>Enter your email address and we'll send you a link to reset your password.</DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                    <Label htmlFor="reset-email">Email</Label>
                    <Input
                        id="reset-email"
                        type="email"
                        autoComplete="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        inputMode="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="m@example.com"
                    />
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                    <Button onClick={handlePasswordReset}>Send Reset Link</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}


export default function SignInPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { onboardingComplete } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleGoogleSignIn = async () => {
        setIsSubmitting(true);
        try {
            const result = await signInWithGoogle();
            const additionalInfo = getAdditionalUserInfo(result);
            // Instead of just checking isNewUser, we rely on our onboardingComplete state from the hook,
            // which is the single source of truth.
            if(additionalInfo?.isNewUser || !onboardingComplete) {
                router.push("/welcome");
            } else {
                router.push("/dashboard");
            }
        } catch (error) {
            console.error("Google Sign-In failed:", error);
            toast({
                variant: "destructive",
                title: "Sign-in Failed",
                description: "Could not sign in with Google. Please try again."
            })
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleEmailSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await signInWithEmail(email, password);
            // The AuthLayout will handle redirection based on the onboardingComplete state.
            // We just need to trigger a state update.
        } catch (error: any) {
            console.error("Email Sign-in failed:", error)
            let description = "An unexpected error occurred. Please try again.";
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                description = "Invalid credentials. Please check your email and password.";
            }
            toast({
                variant: "destructive",
                title: "Sign-in Failed",
                description: description,
            })
        } finally {
            setIsSubmitting(false);
        }
    }

    const handleEmailSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await signUpWithEmail(email, password);
            toast({
                title: "Account Created",
                description: "You have successfully signed up! Let's set up your profile.",
            });
            router.push("/welcome");
        } catch (error: any) {
            console.error("Email Sign-up failed:", error)
            let description = "An unexpected error occurred. Please try again.";
            if (error.code === 'auth/email-already-in-use') {
                description = "This email is already in use. Please sign in instead.";
            } else if (error.code === 'auth/weak-password') {
                description = "Password is too weak. It should be at least 6 characters long.";
            }
            toast({
                variant: "destructive",
                title: "Sign-up Failed",
                description: description,
            })
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <main className="brand-grid flex min-h-dvh items-start justify-center overflow-y-auto bg-brand-mint px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:items-center lg:p-8">
            <div className="my-auto grid w-full max-w-5xl overflow-hidden rounded-3xl border border-primary/10 bg-card shadow-[0_35px_90px_-45px_rgba(41,58,94,0.5)] lg:grid-cols-[0.9fr_1.1fr] lg:rounded-[2rem]">
                <aside className="brand-surface relative hidden min-h-[680px] flex-col justify-between overflow-hidden p-10 text-white lg:flex">
                    <LedgerlyLogo className="absolute -bottom-16 -right-16 h-80 w-80 text-white opacity-[0.055]" />
                    <LedgerlyBrand inverse stacked markClassName="h-12 w-12" />
                    <div className="relative max-w-sm">
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-tint">Clarity starts here</p>
                        <h1 className="mt-4 font-headline text-4xl font-bold leading-tight tracking-[-0.04em]">Your finances.<br />Under control.</h1>
                        <p className="mt-5 leading-7 text-white/[0.72]">Understand today, plan what comes next, and keep every decision connected to your goals.</p>
                        <div className="mt-8 space-y-3 text-sm text-white/85">
                            {['Simple financial overview', 'Focused budgets and goals', 'Secure access to your data'].map((item) => (
                                <div key={item} className="flex items-center gap-3">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.12]"><Check className="h-3.5 w-3.5" /></span>
                                    {item}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="relative flex items-center gap-5 border-t border-white/15 pt-6 text-xs text-brand-tint">
                        <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> Reliable</span>
                        <span className="inline-flex items-center gap-1.5"><TrendingUp className="h-4 w-4" /> Empowering</span>
                    </div>
                </aside>

                <section className="flex items-center p-5 sm:p-10 lg:p-14">
                  <div className="mx-auto w-full max-w-md">
                    <LedgerlyBrand className="mb-7 lg:hidden" />
                    <Card className="w-full border-0 bg-transparent shadow-none">
                      <CardHeader className="px-0 pb-6 text-left">
                        <div className="mb-5 hidden h-12 w-12 items-center justify-center rounded-xl bg-secondary/70 lg:flex">
                            <LedgerlyLogo className="h-8 w-8" />
                        </div>
                        <CardTitle className="text-2xl text-brand-navy dark:text-white sm:text-3xl">Welcome back</CardTitle>
                        <CardDescription className="mt-2 text-base">Sign in to continue, or create your Ledgerly Pro account.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-5 px-0">
                     <form onSubmit={handleEmailSignIn} className="space-y-4" aria-busy={isSubmitting}>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                inputMode="email"
                                autoComplete="email"
                                autoCapitalize="none"
                                spellCheck={false}
                                placeholder="you@example.com"
                                required
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password">Password</Label>
                            </div>
                            <Input
                                id="password"
                                type="password"
                                autoComplete="current-password"
                                placeholder="Enter your password"
                                required
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                            <ForgotPasswordDialog />
                        </div>
                        <div className="grid grid-cols-1 gap-3 pt-1 min-[380px]:grid-cols-2">
                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                                {isSubmitting ? 'Signing In...' : 'Sign In'}
                            </Button>
                            <Button type="button" variant="outline" className="w-full" onClick={handleEmailSignUp} disabled={isSubmitting}>
                                {isSubmitting ? 'Signing Up...' : 'Sign Up'}
                            </Button>
                        </div>
                    </form>
                    <p className="sr-only" role="status" aria-live="polite">
                        {isSubmitting ? "Authentication in progress" : ""}
                    </p>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-card px-2 text-muted-foreground">
                                Or continue with
                            </span>
                        </div>
                    </div>

                    <Button className="w-full gap-2" variant="secondary" onClick={handleGoogleSignIn} disabled={isSubmitting}>
                       <GoogleIcon />
                        Sign in with Google
                    </Button>
                      </CardContent>
                    </Card>
                    <p className="mt-7 text-center text-xs leading-5 text-muted-foreground">
                        By continuing, you agree to Ledgerly Pro&apos;s{" "}
                        <Link className="font-medium text-primary underline-offset-4 hover:underline" href="/terms">
                            terms
                        </Link>{" "}
                        and acknowledge the{" "}
                        <Link className="font-medium text-primary underline-offset-4 hover:underline" href="/privacy">
                            privacy policy
                        </Link>
                        .
                    </p>
                  </div>
                </section>
            </div>
        </main>
    );
}
