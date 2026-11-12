import { ArrowDownIcon, ArrowUpIcon } from "@heroicons/react/20/solid";
import type { MouseEvent } from "react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import ServerFlag from "@/components/ServerFlag";
import ServerPlatform from "@/components/ServerPlatform";
import UsageCell from "@/components/UsageCell";
import { formatBytes } from "@/lib/format";
import { saveMainPageScrollPosition } from "@/lib/navigation";
import { cn, formatMbps, formatNezhaInfo, parsePublicNote } from "@/lib/utils";
import type { NezhaServer } from "@/types/nezha-api";
import BillingInfo from "./billingInfo";
import PlanInfo from "./PlanInfo";
import { Badge } from "./ui/badge";

const cardClassName =
	"group flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground transition-colors duration-150 hover:border-foreground/20";

function ServerCard({
	now,
	serverInfo,
}: {
	now: number;
	serverInfo: NezhaServer;
}) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const {
		name,
		country_code,
		online,
		cpu,
		up,
		down,
		mem,
		stg,
		net_in_transfer,
		net_out_transfer,
		public_note,
		platform,
	} = formatNezhaInfo(now, serverInfo);

	const href = `/server/${serverInfo.id}`;
	const cardClick = (event: MouseEvent<HTMLAnchorElement>) => {
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.button) {
			return;
		}
		event.preventDefault();
		saveMainPageScrollPosition();
		navigate(href);
	};

	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;

	const parsedData = parsePublicNote(public_note);

	const header = (
		<section className="flex min-w-0 items-center gap-2">
			<span
				className="status-dot"
				data-status={online ? "online" : "offline"}
			/>
			<ServerFlag
				country_code={country_code}
				className="shrink-0 leading-none"
			/>
			<p
				className={cn(
					"min-w-0 flex-1 truncate text-sm font-medium",
					!online && "text-muted-foreground",
				)}
			>
				{name}
			</p>
			{online ? (
				<ServerPlatform platform={platform} className="shrink-0" />
			) : (
				<Badge variant="destructive">{t("serverList.offline")}</Badge>
			)}
		</section>
	);

	const billing = parsedData?.billingDataMod && (
		<div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-muted-foreground [&_p]:text-[11px] [&>div]:text-[11px]">
			<BillingInfo parsedData={parsedData} />
		</div>
	);

	if (!online) {
		return (
			<a
				href={href}
				onClick={cardClick}
				className={cn(cardClassName, "gap-2", {
					"bg-card/80": customBackgroundImage,
				})}
			>
				{header}
				{billing}
				{parsedData?.planDataMod && <PlanInfo parsedData={parsedData} />}
			</a>
		);
	}

	return (
		<a
			href={href}
			onClick={cardClick}
			className={cn(cardClassName, {
				"bg-card/80": customBackgroundImage,
			})}
		>
			{header}
			{billing}
			<section
				data-testid="server-card-resource-metrics"
				className="grid w-full grid-cols-3 gap-3"
			>
				<UsageCell label={"CPU"} value={cpu} />
				<UsageCell label={t("serverCard.mem")} value={mem} />
				<UsageCell label={t("serverCard.stg")} value={stg} />
			</section>
			{/* Bandwidth cards stack on phones so values never truncate. */}
			<section
				data-testid="server-card-network-metrics"
				className="flex w-full flex-col rounded-md border border-border sm:grid sm:grid-cols-2"
			>
				<fieldset
					aria-label={t("serverCard.upload")}
					className="min-w-0 border-b border-border px-3 py-2 sm:border-b-0 sm:border-r"
				>
					<div className="flex items-center gap-1 text-xs text-muted-foreground">
						<ArrowUpIcon className="size-3 text-chart-1" />
						实时上传
					</div>
					<p className="mt-0.5 whitespace-nowrap text-sm font-semibold tabular-nums sm:text-base">
						{formatMbps(up)}
					</p>
					<p className="whitespace-nowrap text-[11px] text-muted-foreground tabular-nums">
						已用 {formatBytes(net_out_transfer)}
					</p>
				</fieldset>
				<fieldset
					aria-label={t("serverCard.download")}
					className="min-w-0 px-3 py-2"
				>
					<div className="flex items-center gap-1 text-xs text-muted-foreground">
						<ArrowDownIcon className="size-3 text-chart-2" />
						实时下载
					</div>
					<p className="mt-0.5 whitespace-nowrap text-sm font-semibold tabular-nums sm:text-base">
						{formatMbps(down)}
					</p>
					<p className="whitespace-nowrap text-[11px] text-muted-foreground tabular-nums">
						已用 {formatBytes(net_in_transfer)}
					</p>
				</fieldset>
			</section>
			{parsedData?.planDataMod && <PlanInfo parsedData={parsedData} />}
		</a>
	);
}

export default memo(ServerCard);
