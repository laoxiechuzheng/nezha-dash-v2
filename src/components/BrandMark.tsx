import { cn } from "@/lib/utils";

interface BrandMarkProps {
	className?: string;
	customLogo?: string;
	size?: number;
}

export function BrandMark({
	className,
	customLogo,
	size = 32,
}: BrandMarkProps) {
	if (customLogo) {
		return (
			<img
				alt="apple-touch-icon"
				src={customLogo}
				width={size}
				height={size}
				className={cn(
					"shrink-0 rounded-[9px] object-cover object-top",
					className,
				)}
			/>
		);
	}

	return (
		<span
			aria-hidden="true"
			className={cn(
				"relative inline-flex shrink-0 overflow-hidden rounded-[9px]",
				className,
			)}
			style={{ width: size, height: size, background: "var(--grad-accent)" }}
		>
			<span className="absolute inset-x-0 top-0 h-2/5 bg-white/18" />
			<svg
				viewBox="0 0 32 32"
				width={size}
				height={size}
				fill="none"
				className="relative"
				focusable="false"
			>
				<path
					d="M10 22V10l12 12V10"
					stroke="hsl(var(--primary-foreground))"
					strokeWidth="2.6"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		</span>
	);
}
