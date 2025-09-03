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
            <path 
                d="M25,10 C16.716,10 10,16.716 10,25 L10,85 C10,93.284 16.716,100 25,100 L85,100 C93.284,100 100,93.284 100,85 L100,25 C100,16.716 93.284,10 85,10 L25,10 Z"
                className="fill-primary"
            />
            <path d="M30 30h50v8H30z" className="fill-primary-foreground" />
            <path d="M30 42h50v8H30z" className="fill-primary-foreground" />
            <text 
                x="55" 
                y="82" 
                textAnchor="middle" 
                className="font-bold text-4xl fill-primary-foreground"
            >
                $
            </text>
        </g>
    </svg>
  );
}
