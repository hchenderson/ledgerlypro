"use client";

import { useEffect, useMemo, useState } from "react";
import { signInWithCustomToken } from "firebase/auth";
import { KeyRound, Mail, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  budgetPortalAuth,
  budgetPortalFetch,
  prepareBudgetPortalAuth,
} from "@/lib/budget-portal-client";

type RequestResponse = {
  challengeId?: string;
  expiresInSeconds?: number;
  resendAfterSeconds?: number;
  message?: string;
  error?: string;
};

export function BudgetPortalPinSignIn({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState(0);
  const [resendAt, setResendAt] = useState(0);
  const [clock, setClock] = useState(Date.now());

  useEffect(() => {
    if (!open || step !== "code") return;
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [open, step]);

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  const secondsRemaining = Math.max(0, Math.ceil((expiresAt - clock) / 1_000));
  const resendRemaining = Math.max(0, Math.ceil((resendAt - clock) / 1_000));
  const expiryLabel = useMemo(() => {
    const minutes = Math.floor(secondsRemaining / 60);
    return `${minutes}:${String(secondsRemaining % 60).padStart(2, "0")}`;
  }, [secondsRemaining]);

  const requestCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await budgetPortalFetch("/api/budget-portal/pin/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json() as RequestResponse;
      if (!response.ok) throw new Error(data.error || "Code delivery is unavailable.");
      if (data.challengeId) setChallengeId(data.challengeId);
      const now = Date.now();
      setExpiresAt(now + (data.expiresInSeconds ?? 600) * 1_000);
      setResendAt(now + (data.resendAfterSeconds ?? 60) * 1_000);
      setClock(now);
      setMessage(data.message || "If budget access is available, a code will be sent shortly.");
      setStep("code");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Code delivery is unavailable.");
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    if (!challengeId) {
      setError("Request a new code before continuing.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await budgetPortalFetch("/api/budget-portal/pin/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeId, code }),
      });
      const data = await response.json() as { customToken?: string; error?: string };
      if (!response.ok || !data.customToken) throw new Error(data.error || "The code could not be verified.");
      await prepareBudgetPortalAuth();
      await signInWithCustomToken(budgetPortalAuth, data.customToken);
      router.push("/budgets/view");
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "The code could not be verified.");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStep("email");
    setCode("");
    setChallengeId(null);
    setMessage(null);
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="h-11 w-full gap-2">
          <KeyRound className="h-4 w-4" />
          View a budget with a code
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{step === "email" ? "View an assigned budget" : "Enter your six-digit code"}</DialogTitle>
          <DialogDescription>
            {step === "email"
              ? "Use the email address your budget owner invited. No Ledgerly password is needed."
              : `We sent a one-time code to ${email}.`}
          </DialogDescription>
        </DialogHeader>
        {step === "email" ? (
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void requestCode(); }}>
            <div className="space-y-2">
              <Label htmlFor="budget-viewer-email">Invited email</Label>
              <Input id="budget-viewer-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
            <Button className="h-11 w-full gap-2" disabled={busy}>
              <Mail className="h-4 w-4" /> {busy ? "Sending…" : "Email my code"}
            </Button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void verifyCode(); }}>
            {message ? <p className="rounded-lg bg-secondary/50 p-3 text-sm text-muted-foreground" role="status">{message}</p> : null}
            <div className="space-y-2">
              <Label htmlFor="budget-viewer-code">One-time code</Label>
              <Input
                id="budget-viewer-code"
                className="h-14 text-center font-mono text-2xl tracking-[0.45em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                autoFocus
                required
              />
              <p className="text-xs text-muted-foreground">{secondsRemaining > 0 ? `Code expires in ${expiryLabel}.` : "This code has expired. Request a new one."}</p>
            </div>
            {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
            <Button className="h-11 w-full" disabled={busy || code.length !== 6 || secondsRemaining === 0}>{busy ? "Checking…" : "Open budget portal"}</Button>
            <div className="flex flex-col gap-2 min-[380px]:flex-row">
              <Button type="button" variant="ghost" className="h-11 flex-1" onClick={reset}>Use another email</Button>
              <Button type="button" variant="outline" className="h-11 flex-1 gap-2" disabled={busy || resendRemaining > 0} onClick={() => void requestCode()}>
                <RotateCcw className="h-4 w-4" /> {resendRemaining > 0 ? `Resend in ${resendRemaining}s` : "Resend code"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
