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
import { Badge } from "./ui/badge";
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

	// @ts-expect-error ShowNetTransfer is a global variable
	const showNetTransfer = window.ShowNetTransfer as boolean;

	// @ts-expect-error FixedTopServerName is a global variable
	const fixedTopServerName = window.FixedTopServerName as boolean;

	const parsedData = parsePublicNote(public_note);

	return online ? (
		<Card
			className={cn(
				"group relative flex cursor-pointer flex-col items-stretch justify-start gap-3 overflow-hidden border-white/75 bg-gradient-to-br from-white/78 via-white/62 to-sky-500/5 p-4 transition-all hover:-translate-y-1 hover:border-sky-400/45 hover:shadow-[0_28px_70px_-36px_rgba(14,165,233,0.68)] md:px-5 dark:border-white/10 dark:from-slate-950/70 dark:via-slate-950/58 dark:to-sky-500/8",
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
			<div className="flex min-w-0 flex-col items-stretch gap-2 lg:items-start">
				<section
					className={cn("grid w-full grid-cols-5 items-center gap-2 sm:gap-3", {
						"lg:grid-cols-6 lg:gap-4": fixedTopServerName,
					})}
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
					<div className={"flex w-14 flex-col"}>
						<p className="text-xs text-muted-foreground">{"CPU"}</p>
						<div className="flex items-center text-xs font-semibold">
							{cpu.toFixed(2)}%
						</div>
						<ServerUsageBar value={cpu} />
					</div>
					<div className={"flex w-14 flex-col"}>
						<p className="text-xs text-muted-foreground">
							{t("serverCard.mem")}
						</p>
						<div className="flex items-center text-xs font-semibold">
							{mem.toFixed(2)}%
						</div>
						<ServerUsageBar value={mem} />
					</div>
					<div className={"flex w-14 flex-col"}>
						<p className="text-xs text-muted-foreground">
							{t("serverCard.stg")}
						</p>
						<div className="flex items-center text-xs font-semibold">
							{stg.toFixed(2)}%
						</div>
						<ServerUsageBar value={stg} />
					</div>
					<div className={"flex w-14 flex-col"}>
						<p className="text-xs text-muted-foreground">
							{t("serverCard.upload")}
						</p>
						<div className="flex items-center text-xs font-semibold">
							{formatMbps(up)}
						</div>
					</div>
					<div className={"flex w-14 flex-col"}>
						<p className="text-xs text-muted-foreground">
							{t("serverCard.download")}
						</p>
						<div className="flex items-center text-xs font-semibold">
							{formatMbps(down)}
						</div>
					</div>
				</section>
				{showNetTransfer && (
					<section className={"flex items-center w-full justify-between gap-1"}>
						<Badge
							variant="secondary"
							className="items-center flex-1 justify-center rounded-[8px] text-nowrap text-[11px] border-muted-50 shadow-md shadow-neutral-200/30 dark:shadow-none"
						>
							{t("serverCard.upload")}:{formatBytes(net_out_transfer)}
						</Badge>
						<Badge
							variant="outline"
							className="items-center flex-1 justify-center rounded-[8px] text-nowrap text-[11px] shadow-md shadow-neutral-200/30 dark:shadow-none"
						>
							{t("serverCard.download")}:{formatBytes(net_in_transfer)}
						</Badge>
					</section>
				)}
				{parsedData?.planDataMod && <PlanInfo parsedData={parsedData} />}
			</div>
		</Card>
	) : (
		<Card
			className={cn(
				"group relative flex cursor-pointer flex-col items-stretch justify-start gap-3 overflow-hidden border-rose-500/12 bg-gradient-to-br from-white/72 via-white/60 to-rose-500/6 p-4 transition-all hover:-translate-y-0.5 hover:border-rose-400/35 hover:shadow-[0_24px_60px_-38px_rgba(244,63,94,0.55)] sm:gap-0 md:px-5 dark:from-slate-950/66 dark:via-slate-950/58 dark:to-rose-500/7",
				showNetTransfer
					? "lg:min-h-[91px] min-h-[123px]"
					: "lg:min-h-[61px] min-h-[93px]",
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
