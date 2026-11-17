import type { PublicNoteData } from "@/lib/utils";

export default function PlanInfo({
	parsedData,
}: {
	parsedData: PublicNoteData;
}) {
	const plan = parsedData?.planDataMod;
	if (!plan) return null;
	const tags = [
		plan.bandwidth,
		plan.trafficVol,
		plan.IPv4 === "1" ? "IPv4" : "",
		plan.IPv6 === "1" ? "IPv6" : "",
		plan.networkRoute?.split(",").join("｜"),
		...plan.extra.split(","),
	].filter(Boolean);
	if (!tags.length) return null;
	return (
		<section className="hm-plan-tags flex flex-wrap items-center gap-1">
			{tags.map((tag, index) => (
				<p
					key={`${index}-${tag}`}
					className="hm-plan-tag chip"
					data-tone="neutral"
					title={tag}
				>
					{tag}
				</p>
			))}
		</section>
	);
}
