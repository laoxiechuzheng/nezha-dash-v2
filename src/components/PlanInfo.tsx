import { cn, type PublicNoteData } from "@/lib/utils";

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
		<section className="mt-1 flex flex-wrap items-center gap-1.5">
			{parsedData.planDataMod.bandwidth !== "" && (
				<p
					className={cn(
						"w-fit rounded-full border border-sky-500/15 bg-sky-500/10 px-2 py-0.5 text-[9px] font-bold text-sky-700 dark:text-sky-300",
					)}
				>
					{parsedData.planDataMod.bandwidth}
				</p>
			)}
			{parsedData.planDataMod.trafficVol !== "" && (
				<p
					className={cn(
						"w-fit rounded-full border border-emerald-500/15 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-300",
					)}
				>
					{parsedData.planDataMod.trafficVol}
				</p>
			)}
			{parsedData.planDataMod.IPv4 === "1" && (
				<p
					className={cn(
						"w-fit rounded-full border border-violet-500/15 bg-violet-500/10 px-2 py-0.5 text-[9px] font-bold text-violet-700 dark:text-violet-300",
					)}
				>
					IPv4
				</p>
			)}
			{parsedData.planDataMod.IPv6 === "1" && (
				<p
					className={cn(
						"w-fit rounded-full border border-pink-500/15 bg-pink-500/10 px-2 py-0.5 text-[9px] font-bold text-pink-700 dark:text-pink-300",
					)}
				>
					IPv6
				</p>
			)}
			{parsedData.planDataMod.networkRoute && (
				<p
					className={cn(
						"w-fit rounded-full border border-blue-500/15 bg-blue-500/10 px-2 py-0.5 text-[9px] font-bold text-blue-700 dark:text-blue-300",
					)}
				>
					{networkRoutes.map((route, index) => {
						return route + (index === networkRoutes.length - 1 ? "" : "｜");
					})}
				</p>
			)}
			{extraList.map((extra, index) => {
				return (
					<p
						key={index}
						className={cn(
							"w-fit rounded-full border border-slate-500/15 bg-slate-500/10 px-2 py-0.5 text-[9px] font-bold text-slate-600 dark:text-slate-300",
						)}
					>
						{extra}
					</p>
				);
			})}
		</section>
	);
}
