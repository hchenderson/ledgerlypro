
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LedgerlyProLogo } from "@/components/icons";
import { signInWithGoogle, signUpWithEmail, isNewUser } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getAdditionalUserInfo } from "firebase/auth";

const GoogleIcon = () => (
    <svg className="size-4" viewBox="0 0 48 48">
        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
        <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.222,0-9.657-3.356-11.303-8H6.306C9.656,39.663,16.318,44,24,44z" />
        <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C42.02,35.579,44,30.038,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
    </svg>
);


export default function SignInPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleGoogleSignIn = async () => {
        try {
            const result = await signInWithGoogle();
            const additionalInfo = getAdditionalUserInfo(result);
            if(additionalInfo?.isNewUser) {
                router.push("/welcome");
            } else {
                localStorage.setItem('onboardingComplete', 'true'); // For existing users
                router.push("/dashboard");
            }
        } catch (error) {
            console.error("Google Sign-In failed:", error);
            toast({
                variant: "destructive",
                title: "Sign-in Failed",
                description: "Could not sign in with Google. Please try again."
            })
        }
    };
    
    const handleEmailSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await signInWithEmail(email, password);
            localStorage.setItem('onboardingComplete', 'true'); // For existing users
            router.push('/dashboard');
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
            localStorage.removeItem('onboardingComplete'); // Ensure it's cleared for new users
            toast({
                title: "Account Created",
                description: "You have successfully signed up! Let's set up your profile.",
            });
            router.push('/welcome');
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
        <div className="flex min-h-screen items-center justify-center bg-secondary/50">
            <Card className="w-full max-w-sm">
                <CardHeader className="text-center">
                    <LedgerlyProLogo className="mx-auto h-10 w-10 mb-2" />
                    <CardTitle>Welcome to Ledgerly Pro</CardTitle>
                    <CardDescription>Sign in or create an account to continue.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <form onSubmit={handleEmailSignIn} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" placeholder="m@example.com" required value={email} onChange={e => setEmail(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input id="password" type="password" required  value={password} onChange={e => setPassword(e.target.value)} />
                        </div>
                        <div className="flex gap-2">
                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                                {isSubmitting ? 'Signing In...' : 'Sign In'}
                            </Button>
                            <Button type="button" variant="secondary" className="w-full" onClick={handleEmailSignUp} disabled={isSubmitting}>
                                {isSubmitting ? 'Signing Up...' : 'Sign Up'}
                            </Button>
                        </div>
                    </form>

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

                    <Button className="w-full gap-2" variant="outline" onClick={handleGoogleSignIn}>
                       <GoogleIcon />
                        Sign in with Google
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
