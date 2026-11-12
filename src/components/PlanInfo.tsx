import type { PublicNoteData } from "@/lib/utils";

const tagClassName =
	"inline-flex h-5 w-fit items-center rounded-[4px] bg-muted px-1.5 text-[11px] font-medium leading-none text-muted-foreground dark:bg-foreground/[0.06]";

export default function PlanInfo({
	parsedData,
}: {
	parsedData: PublicNoteData;
}) {
	if (!parsedData?.planDataMod) {
		return null;
	}

	const extraList =
		parsedData.planDataMod.extra.split(",").length > 1
			? parsedData.planDataMod.extra.split(",")
			: parsedData.planDataMod.extra.split(",")[0] === ""
				? []
				: [parsedData.planDataMod.extra];
	const networkRoutes = parsedData.planDataMod.networkRoute
		? parsedData.planDataMod.networkRoute.split(",")
		: [];

	return (
		<section className="flex flex-wrap items-center gap-1">
			{parsedData.planDataMod.bandwidth !== "" && (
				<p className={tagClassName}>{parsedData.planDataMod.bandwidth}</p>
			)}
			{parsedData.planDataMod.trafficVol !== "" && (
				<p className={tagClassName}>{parsedData.planDataMod.trafficVol}</p>
			)}
			{parsedData.planDataMod.IPv4 === "1" && (
				<p className={tagClassName}>IPv4</p>
			)}
			{parsedData.planDataMod.IPv6 === "1" && (
				<p className={tagClassName}>IPv6</p>
			)}
			{parsedData.planDataMod.networkRoute && (
				<p className={tagClassName}>
					{networkRoutes.map((route, index) => {
						return route + (index === networkRoutes.length - 1 ? "" : "｜");
					})}
				</p>
			)}
			{extraList.map((extra, index) => {
				return (
					<p key={index} className={tagClassName}>
						{extra}
					</p>
				);
			})}
		</section>
	);
}
