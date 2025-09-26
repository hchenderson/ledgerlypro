import type { SVGProps } from "react";

export function LedgerlyLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
        <g>
            <rect 
                width="120"
                height="120"
                rx="20"
                className="fill-primary"
            />
            <path d="M30 30h60v12H30z" className="fill-primary-foreground" />
            <path d="M30 50h60v12H30z" className="fill-primary-foreground" />
            <text 
                x="60" 
                y="95" 
                textAnchor="middle" 
                className="font-bold text-5xl fill-primary-foreground"
            >
                $
            </text>
        </g>
    </svg>
  );
}
