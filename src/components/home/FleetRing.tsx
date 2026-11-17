import NumericText from "@/components/NumericText";

export default function FleetRing({
	online,
	total,
	label,
}: {
	online: number;
	total: number;
	label: string;
}) {
	const fraction = total > 0 ? online / total : 0;
	const digits = Math.min(8, String(total).length);
	return (
		<div className="hm-fleet-ring" data-digits={digits} aria-hidden="true">
			<svg viewBox="0 0 120 120" focusable="false">
				<circle
					className="hm-ring-track"
					cx="60"
					cy="60"
					r="50"
					strokeWidth="10"
					fill="none"
				/>
				{total > 0 && (
					<g transform="rotate(-90 60 60)" fill="none" strokeWidth="10">
						{online > 0 && (
							<circle
								cx="60"
								cy="60"
								r="50"
								pathLength="100"
								stroke="hsl(var(--success))"
								strokeDasharray={`${fraction === 1 ? 100 : Math.max(0, fraction * 100 - 1.1)} 100`}
							/>
						)}
						{total > online && (
							<circle
								cx="60"
								cy="60"
								r="50"
								pathLength="100"
								stroke="hsl(var(--danger))"
								strokeDasharray={`${fraction === 0 ? 100 : Math.max(0, (1 - fraction) * 100 - 1.1)} 100`}
								strokeDashoffset={-fraction * 100}
							/>
						)}
					</g>
				)}
			</svg>
			<div className="hm-fleet-ring-center">
				<NumericText value={online} className="num" />
				<small className="num">/ {total}</small>
				<span>{label}</span>
			</div>
		</div>
	);
}
