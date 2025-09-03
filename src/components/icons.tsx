import type { SVGProps } from "react";

export function LedgerlyProLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 3v18h18" />
      <path d="M18.7 8a6 6 0 0 0-6-6" />
      <path d="M12.7 14a6 6 0 0 0 6 6" />
      <path d="M12.7 8a6 6 0 0 1 6 6" />
    </svg>
  );
}
