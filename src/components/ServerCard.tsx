import { ArrowDownIcon, ArrowUpIcon } from "@heroicons/react/20/solid";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import ServerFlag from "@/components/ServerFlag";
import ServerUsageBar from "@/components/ServerUsageBar";
import { formatBytes } from "@/lib/format";
import {
	GetFontLogoClass,
	GetOsName,
	MageMicrosoftWindows,
} from "@/lib/logo-class";
import { saveMainPageScrollPosition } from "@/lib/navigation";
import { cn, formatMbps, formatNezhaInfo, parsePublicNote } from "@/lib/utils";
import type { NezhaServer } from "@/types/nezha-api";
import BillingInfo from "./billingInfo";
import PlanInfo from "./PlanInfo";
import { Card } from "./ui/card";

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

	const cardClick = () => {
		saveMainPageScrollPosition();
		navigate(`/server/${serverInfo.id}`);
	};

	const showFlag = true;

	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;

	// @ts-expect-error FixedTopServerName is a global variable
	const fixedTopServerName = window.FixedTopServerName as boolean;

	const parsedData = parsePublicNote(public_note);

	return online ? (
		<Card
			className={cn(
				"group relative flex cursor-pointer flex-col items-stretch justify-start gap-3 overflow-hidden border-white/75 bg-gradient-to-br from-white/78 via-white/62 to-sky-500/5 p-3.5 transition-all hover:-translate-y-1 hover:border-sky-400/45 hover:shadow-[0_28px_70px_-36px_rgba(14,165,233,0.68)] sm:p-4 md:px-5 dark:border-white/10 dark:from-slate-950/70 dark:via-slate-950/58 dark:to-sky-500/8",
				{
					"flex-col": fixedTopServerName,
					"lg:flex-row": !fixedTopServerName,
				},
				{
					"bg-card/70": customBackgroundImage,
				},
			)}
			onClick={cardClick}
		>
			<section
				className={cn("grid items-center gap-2", {
					"lg:w-40": !fixedTopServerName,
				})}
				style={{ gridTemplateColumns: "auto auto 1fr" }}
			>
				<span className="h-2 w-2 shrink-0 rounded-full bg-green-500 self-center"></span>
				<div
					className={cn(
						"flex items-center justify-center",
						showFlag ? "min-w-[17px]" : "min-w-0",
					)}
				>
					{showFlag ? <ServerFlag country_code={country_code} /> : null}
				</div>
				<div className="relative flex flex-col">
					<p
						className={cn(
							"break-normal font-bold tracking-tight",
							showFlag ? "text-xs " : "text-sm",
						)}
					>
						{name}
					</p>
					<div
						className={cn("hidden lg:block", {
							"lg:hidden": fixedTopServerName,
						})}
					>
						{parsedData?.billingDataMod && (
							<BillingInfo parsedData={parsedData} />
						)}
					</div>
				</div>
			</section>
			<div
				className={cn("flex items-center gap-2 -mt-2 lg:hidden", {
					"lg:flex": fixedTopServerName,
				})}
			>
				{parsedData?.billingDataMod && <BillingInfo parsedData={parsedData} />}
			</div>
			<div className="flex min-w-0 flex-col items-stretch gap-3 lg:items-start">
				<section
					data-testid="server-card-resource-metrics"
					className={cn(
						"grid w-full grid-cols-3 items-center gap-2 rounded-2xl border border-slate-200/70 bg-white/45 px-3 py-2.5 shadow-[0_12px_28px_-25px_rgba(15,23,42,0.7)] dark:border-white/8 dark:bg-white/[0.035]",
						{
							"lg:grid-cols-4 lg:gap-4": fixedTopServerName,
						},
					)}
				>
					{fixedTopServerName && (
						<div
							className={
								"hidden col-span-1 items-center lg:flex lg:flex-row gap-2"
							}
						>
							<div className="text-xs font-semibold">
								{platform.includes("Windows") ? (
									<MageMicrosoftWindows className="size-[10px]" />
								) : (
									<p className={`fl-${GetFontLogoClass(platform)}`} />
								)}
							</div>
							<div className={"flex w-14 flex-col"}>
								<p className="text-xs text-muted-foreground">
									{t("serverCard.system")}
								</p>
								<div className="flex items-center text-[10.5px] font-semibold">
									{platform.includes("Windows")
										? "Windows"
										: GetOsName(platform)}
								</div>
							</div>
						</div>
					)}
					<div className={"flex min-w-0 flex-col"}>
						<p className="text-xs text-muted-foreground">{"CPU"}</p>
						<div className="flex items-center text-xs font-semibold">
							{cpu.toFixed(2)}%
						</div>
						<ServerUsageBar value={cpu} />
					</div>
					<div className={"flex min-w-0 flex-col"}>
						<p className="text-xs text-muted-foreground">
							{t("serverCard.mem")}
						</p>
						<div className="flex items-center text-xs font-semibold">
							{mem.toFixed(2)}%
						</div>
						<ServerUsageBar value={mem} />
					</div>
					<div className={"flex min-w-0 flex-col"}>
						<p className="text-xs text-muted-foreground">
							{t("serverCard.stg")}
						</p>
						<div className="flex items-center text-xs font-semibold">
							{stg.toFixed(2)}%
						</div>
						<ServerUsageBar value={stg} />
					</div>
				</section>
				<section
					data-testid="server-card-network-metrics"
					className="grid w-full grid-cols-2 overflow-hidden rounded-2xl border border-sky-500/15 bg-gradient-to-r from-sky-500/10 via-white/40 to-violet-500/10 shadow-[0_14px_32px_-25px_rgba(14,165,233,0.72)] dark:via-white/[0.025]"
				>
					<fieldset
						aria-label={t("serverCard.upload")}
						className="min-w-0 border-r border-sky-500/15 px-3 py-2.5 sm:px-4"
					>
						<div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-sky-700 dark:text-sky-300">
							<ArrowUpIcon className="size-3" />
							实时上传
						</div>
						<p className="mt-1 truncate text-[15px] font-black tracking-tight tabular-nums text-slate-950 sm:text-base dark:text-white">
							{formatMbps(up)}
						</p>
						<p className="mt-0.5 truncate text-[10px] font-medium text-muted-foreground">
							已用 {formatBytes(net_out_transfer)}
						</p>
					</fieldset>
					<fieldset
						aria-label={t("serverCard.download")}
						className="min-w-0 px-3 py-2.5 sm:px-4"
					>
						<div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-violet-700 dark:text-violet-300">
							<ArrowDownIcon className="size-3" />
							实时下载
						</div>
						<p className="mt-1 truncate text-[15px] font-black tracking-tight tabular-nums text-slate-950 sm:text-base dark:text-white">
							{formatMbps(down)}
						</p>
						<p className="mt-0.5 truncate text-[10px] font-medium text-muted-foreground">
							已用 {formatBytes(net_in_transfer)}
						</p>
					</fieldset>
				</section>
				{parsedData?.planDataMod && <PlanInfo parsedData={parsedData} />}
			</div>
		</Card>
	) : (
		<Card
			className={cn(
				"group relative flex cursor-pointer flex-col items-stretch justify-start gap-3 overflow-hidden border-rose-500/12 bg-gradient-to-br from-white/72 via-white/60 to-rose-500/6 p-4 transition-all hover:-translate-y-0.5 hover:border-rose-400/35 hover:shadow-[0_24px_60px_-38px_rgba(244,63,94,0.55)] sm:gap-0 md:px-5 dark:from-slate-950/66 dark:via-slate-950/58 dark:to-rose-500/7",
				"lg:min-h-[91px] min-h-[123px]",
				{
					"flex-col": fixedTopServerName,
					"lg:flex-row": !fixedTopServerName,
				},
				{
					"bg-card/70": customBackgroundImage,
				},
			)}
			onClick={cardClick}
		>
			<section
				className={cn("grid items-center gap-2", {
					"lg:w-40": !fixedTopServerName,
				})}
				style={{ gridTemplateColumns: "auto auto 1fr" }}
			>
				<span className="h-2 w-2 shrink-0 rounded-full bg-red-500 self-center"></span>
				<div
					className={cn(
						"flex items-center justify-center",
						showFlag ? "min-w-[17px]" : "min-w-0",
					)}
				>
					{showFlag ? <ServerFlag country_code={country_code} /> : null}
				</div>
				<div className="relative flex flex-col">
					<p
						className={cn(
							"break-normal font-bold tracking-tight max-w-[108px]",
							showFlag ? "text-xs" : "text-sm",
						)}
					>
						{name}
					</p>
					<div
						className={cn("hidden lg:block", {
							"lg:hidden": fixedTopServerName,
						})}
					>
						{parsedData?.billingDataMod && (
							<BillingInfo parsedData={parsedData} />
						)}
					</div>
				</div>
			</section>
			<div
				className={cn("flex items-center gap-2 lg:hidden", {
					"lg:flex": fixedTopServerName,
				})}
			>
				{parsedData?.billingDataMod && <BillingInfo parsedData={parsedData} />}
			</div>
			{parsedData?.planDataMod && <PlanInfo parsedData={parsedData} />}
		</Card>
	);
}

export default memo(ServerCard);
