export default function DrawingDefs() {
	return (
		<svg
			width="0"
			height="0"
			aria-hidden="true"
			focusable="false"
			className="hm-drawing-defs"
		>
			<defs>
				{(["good", "warn", "bad"] as const).map((level) => (
					<linearGradient
						key={level}
						id={`lumen-${level}`}
						x1="0"
						y1="0"
						x2="1"
						y2="1"
					>
						<stop
							offset="0%"
							stopColor={`hsl(var(--${level === "good" ? "primary" : level === "warn" ? "warning" : "danger"}))`}
							stopOpacity={level === "good" ? 1 : 0.7}
						/>
						<stop
							offset="100%"
							stopColor={`hsl(var(--${level === "good" ? "accent-to" : level === "warn" ? "warning" : "danger"}))`}
						/>
					</linearGradient>
				))}
				{(["down", "up", "spark"] as const).map((series) => (
					<linearGradient
						key={series}
						id={`lumen-area-${series}`}
						x1="0"
						y1="0"
						x2="0"
						y2="1"
					>
						<stop
							offset="0%"
							stopColor={`hsl(var(--chart-${series === "down" ? 2 : 1}))`}
							stopOpacity=".28"
						/>
						<stop
							offset="100%"
							stopColor={`hsl(var(--chart-${series === "down" ? 2 : 1}))`}
							stopOpacity="0"
						/>
					</linearGradient>
				))}
			</defs>
		</svg>
	);
}
