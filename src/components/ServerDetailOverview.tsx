import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { BackIcon } from "@/components/Icon";
import { ServerDetailLoading } from "@/components/loading/ServerDetailLoading";
import ServerFlag from "@/components/ServerFlag";
import { Badge } from "@/components/ui/badge";
import { useWebSocketContext } from "@/hooks/use-websocket-context";
import { formatBytes } from "@/lib/format";
import { cn, formatNezhaInfo } from "@/lib/utils";
import NumericText from "./NumericText";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "./ui/accordion";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "./ui/tooltip";

export default function ServerDetailOverview({
	server_id,
}: {
	server_id: string;
}) {
	const { t } = useTranslation();
	const navigate = useNavigate();

	const [hasHistory, setHasHistory] = useState(false);

	useEffect(() => {
		const previousPath = sessionStorage.getItem("fromMainPage");
		if (previousPath) {
			setHasHistory(true);
		}

		return () => {
			if (previousPath) {
				sessionStorage.removeItem("fromMainPage");
			}
		};
	}, []);

	const { lastData, connected } = useWebSocketContext();

	if (!connected && !lastData) {
		return <ServerDetailLoading />;
	}

	const linkClick = () => {
		if (hasHistory) {
			navigate(-1);
		} else {
			navigate("/");
		}
	};

	const nezhaWsData = lastData;

	if (!nezhaWsData) {
		return <ServerDetailLoading />;
	}

	const server = nezhaWsData.servers.find((s) => s.id === Number(server_id));

	if (!server) {
		return <ServerDetailLoading />;
	}

	const {
		name,
		online,
		uptime,
		version,
		arch,
		mem_total,
		disk_total,
		country_code,
		platform,
		platform_version,
		cpu_info,
		gpu_info,
		load_1,
		load_5,
		load_15,
		net_out_transfer,
		net_in_transfer,
		last_active_time_string,
		boot_time_string,
	} = formatNezhaInfo(nezhaWsData.now, server);

	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;

	countries.registerLocale(enLocale);

	const uptimeLabel =
		uptime / 86400 >= 1
			? `${Math.floor(uptime / 86400)} ${t("serverDetail.days")} ${Math.floor((uptime % 86400) / 3600)} ${t("serverDetail.hours")}`
			: `${Math.floor(uptime / 3600)} ${t("serverDetail.hours")}`;

	return (
		<div className="server-detail-overview flex min-w-0 flex-col gap-4">
			<div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
				<button
					type="button"
					onClick={linkClick}
					title={t("serverDetail.back")}
					className="server-name group flex min-w-0 items-center gap-2.5 text-left"
				>
					<span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card transition-colors group-hover:bg-muted [&_img]:mr-0! [&_img]:size-4">
						<BackIcon />
					</span>
					<span className="min-w-0 break-all text-xl font-semibold leading-tight sm:text-2xl">
						{name}
					</span>
				</button>
				<Badge variant={online ? "success" : "destructive"}>
					<span
						className="status-dot size-1.5"
						data-status={online ? "online" : "offline"}
					/>
					{online ? t("serverDetail.online") : t("serverDetail.offline")}
				</Badge>
				{country_code && (
					<TooltipProvider delayDuration={100}>
						<Tooltip>
							<TooltipTrigger asChild>
								<span className="inline-flex h-5 cursor-default items-center gap-1.5 rounded-[4px] bg-muted px-1.5 text-xs text-muted-foreground dark:bg-foreground/[0.06]">
									<ServerFlag
										className="text-[11px] leading-none"
										country_code={country_code}
									/>
									<span className="font-mono">
										{country_code?.toUpperCase()}
									</span>
								</span>
							</TooltipTrigger>
							<TooltipContent>
								<p>{countries.getName(country_code?.toUpperCase(), "en")}</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				)}
			</div>

			<div
				className={cn(
					"overflow-hidden rounded-lg border border-border bg-card",
					{
						"bg-card/80": customBackgroundImage,
					},
				)}
			>
				<dl className="-mb-px -mr-px grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6">
					{platform && (
						<Fact label={t("serverDetail.system")} wide>
							{platform} {platform_version ? ` - ${platform_version}` : ""}
						</Fact>
					)}
					{cpu_info.length > 0 && (
						<Fact label={t("serverDetail.cpu")} wide>
							{cpu_info.join(", ")}
						</Fact>
					)}
					{gpu_info.length > 0 && (
						<Fact label={t("serverDetail.gpu")} wide>
							{gpu_info.join(", ")}
						</Fact>
					)}
					{arch && (
						<Fact label={t("serverDetail.arch")} mono>
							{arch}
						</Fact>
					)}
					{mem_total ? (
						<Fact label={t("serverDetail.mem")}>{formatBytes(mem_total)}</Fact>
					) : null}
					{disk_total ? (
						<Fact label={t("serverDetail.disk")}>
							{formatBytes(disk_total)}
						</Fact>
					) : null}
					{online && (
						<Fact label={t("serverDetail.uptime")}>
							<NumericText value={uptimeLabel} />
						</Fact>
					)}
					{version && (
						<Fact label={t("serverDetail.version")} mono>
							{version}
						</Fact>
					)}
					<Fact label={t("serverDetail.load")} wide>
						<span className="flex flex-wrap gap-x-3 gap-y-0.5">
							{[
								{ label: "1m", value: load_1 },
								{ label: "5m", value: load_5 },
								{ label: "15m", value: load_15 },
							].map(({ label, value }) => (
								<span key={label} className="inline-flex items-baseline gap-1">
									<span className="text-[11px] text-muted-foreground">
										{label}
									</span>
									<NumericText value={`${value}`} />
								</span>
							))}
						</span>
					</Fact>
					{net_out_transfer ? (
						<Fact label={t("serverDetail.upload")}>
							<NumericText value={formatBytes(net_out_transfer)} />
						</Fact>
					) : null}
					{net_in_transfer ? (
						<Fact label={t("serverDetail.download")}>
							<NumericText value={formatBytes(net_in_transfer)} />
						</Fact>
					) : null}
					<Fact label={t("serverDetail.bootTime")} mono>
						{boot_time_string ? boot_time_string : "N/A"}
					</Fact>
					<Fact label={t("serverDetail.lastActive")} mono>
						<NumericText
							value={last_active_time_string ? last_active_time_string : "N/A"}
						/>
					</Fact>
				</dl>
				{server?.state.temperatures &&
					server?.state.temperatures.length > 0 && (
						<div className="border-t border-border px-4 py-2.5">
							<Accordion type="single" collapsible className="w-full">
								<AccordionItem value="item-1" className="border-none">
									<AccordionTrigger className="justify-start py-0 text-xs font-normal text-muted-foreground">
										{t("serverDetail.temperature")}
									</AccordionTrigger>
									<AccordionContent className="pb-0 pt-2">
										<section className="flex flex-wrap items-start gap-x-4 gap-y-1">
											{server?.state.temperatures.map((item, index) => (
												<div
													className="flex items-center gap-1 text-xs tabular-nums"
													key={index}
												>
													<p className="text-muted-foreground">{item.Name}</p>:{" "}
													{item.Temperature.toFixed(2)} °C
												</div>
											))}
										</section>
									</AccordionContent>
								</AccordionItem>
							</Accordion>
						</div>
					)}
			</div>
		</div>
	);
}

function Fact({
	label,
	children,
	wide = false,
	mono = false,
}: {
	label: string;
	children: React.ReactNode;
	wide?: boolean;
	mono?: boolean;
}) {
	return (
		<div
			className={cn(
				"flex min-w-0 flex-col gap-0.5 border-b border-r border-border px-3 py-2 sm:gap-1 sm:px-4 sm:py-3",
				wide && "col-span-2",
			)}
		>
			<dt className="text-xs text-muted-foreground">{label}</dt>
			<dd
				className={cn(
					"break-words text-[13px] tabular-nums",
					mono && "font-mono text-xs leading-5",
				)}
			>
				{children}
			</dd>
		</div>
	);
}
