import type { HTMLAttributes, SVGProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Ledgerly Pro's ascending-bars mark. It is deliberately code-native so the
 * logo stays crisp in navigation, app icons, exports, and high-density screens.
 */
export function LedgerlyLogo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn("text-primary", className)}
      {...props}
    >
      <rect x="9" y="68" width="11" height="19" rx="2.5" fill="currentColor" />
      <rect x="26" y="51" width="11" height="36" rx="2.5" fill="currentColor" />
      <path
        d="M48 31V87H73"
        stroke="currentColor"
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M66 75V61C66 49 72 43 80 39C89 35 92 24 93 11"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M82 15L93 11L92 23"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface LedgerlyBrandProps extends HTMLAttributes<HTMLDivElement> {
  inverse?: boolean;
  stacked?: boolean;
  markClassName?: string;
}

export function LedgerlyBrand({
  className,
  inverse = false,
  stacked = false,
  markClassName,
  ...props
}: LedgerlyBrandProps) {
  return (
    <div
      className={cn("inline-flex items-center gap-3", className)}
      aria-label="Ledgerly Pro"
      {...props}
    >
      <LedgerlyLogo
        className={cn(
          "h-10 w-10 shrink-0",
          inverse ? "text-white" : "text-primary",
          markClassName
        )}
      />
      <span
        className={cn(
          "font-headline text-xl font-bold tracking-[-0.035em]",
          stacked ? "flex flex-col leading-[0.9]" : "leading-none",
          inverse ? "text-white" : "text-[#293A5E] dark:text-white"
        )}
      >
        <span>Ledgerly</span>{" "}
        <span className={cn(!inverse && "text-primary")}>Pro</span>
      </span>
    </div>
  );
}
