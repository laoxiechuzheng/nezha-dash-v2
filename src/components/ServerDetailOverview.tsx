import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { BackIcon } from "@/components/Icon";
import { ServerDetailLoading } from "@/components/loading/ServerDetailLoading";
import ServerFlag from "@/components/ServerFlag";
import { useWebSocketContext } from "@/hooks/use-websocket-context";
import { formatBytes } from "@/lib/format";
import { GetFontLogoClass, MageMicrosoftWindows } from "@/lib/logo-class";
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
		if (previousPath) setHasHistory(true);
		return () => {
			if (previousPath) sessionStorage.removeItem("fromMainPage");
		};
	}, []);

	const { lastData, connected } = useWebSocketContext();
	if (!connected && !lastData) return <ServerDetailLoading />;
	const nezhaWsData = lastData;
	if (!nezhaWsData) return <ServerDetailLoading />;
	const server = nezhaWsData.servers.find((s) => s.id === Number(server_id));
	if (!server) return <ServerDetailLoading />;

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
	const knownNumber = (value: number) => Number.isFinite(value);
	const lastReport = last_active_time_string || "—";

	return (
		<div className="server-detail-overview dt-overview">
			<div className="dt-title-row">
				<h1 className="dt-heading">
					<button
						type="button"
						onClick={() => (hasHistory ? navigate(-1) : navigate("/"))}
						title={t("serverDetail.back")}
						className="server-name dt-title-link"
					>
						<span className="dt-back">
							<BackIcon />
						</span>
						<span className="dt-hostname" title={name}>
							{name}
						</span>
					</button>
				</h1>
				<span
					className="chip dt-state"
					data-tone={online ? "success" : "danger"}
				>
					<span
						className={cn("status-dot", online && "ping")}
						data-status={online ? "online" : "offline"}
						aria-hidden="true"
					/>
					{online ? t("serverDetail.online") : t("serverDetail.offline")}
				</span>
				{country_code && (
					<TooltipProvider delayDuration={100}>
						<Tooltip>
							<TooltipTrigger asChild>
								<span className="chip dt-country" data-tone="neutral">
									<ServerFlag
										className="text-[11px] leading-none"
										country_code={country_code}
									/>
									<span>{country_code.toUpperCase()}</span>
								</span>
							</TooltipTrigger>
							<TooltipContent>
								<p>{countries.getName(country_code.toUpperCase(), "en")}</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				)}
				<p className="dt-last-report num">
					{t("v2Detail.identity.lastReport", { time: lastReport })}
				</p>
			</div>

			<div
				className={cn(
					"surface-stage dt-identity",
					customBackgroundImage && "dt-custom-background",
				)}
			>
				<div className="dt-identity-main">
					<div className="dt-hardware">
						<div className="dt-platform-row">
							<span className="dt-os-icon" aria-hidden="true">
								{platform.includes("Windows") ? (
									<MageMicrosoftWindows className="size-6" />
								) : (
									<i
										className={`fl-${GetFontLogoClass(platform)} not-italic`}
									/>
								)}
							</span>
							<div className="dt-platform-copy">
								<p className="dt-label">{t("serverDetail.system")}</p>
								<p className="dt-platform-name">
									{platform || "—"}
									{platform_version ? ` - ${platform_version}` : ""}
								</p>
							</div>
						</div>
						<dl className="dt-hardware-facts">
							{cpu_info.length > 0 && (
								<Fact label={t("serverDetail.cpu")} className="dt-cpu-model">
									<span title={cpu_info.join(", ")}>{cpu_info.join(", ")}</span>
								</Fact>
							)}
							{gpu_info.length > 0 && (
								<Fact label={t("serverDetail.gpu")}>{gpu_info.join(", ")}</Fact>
							)}
						</dl>
						<div className="dt-architecture-row">
							{arch && (
								<span
									className="chip dt-architecture"
									data-tone="neutral"
									title={t("serverDetail.arch")}
								>
									{arch}
								</span>
							)}
							{version && (
								<span className="dt-agent-version">
									<span>{t("serverDetail.version")}</span>
									<span>{version}</span>
								</span>
							)}
						</div>
					</div>
					<dl className="dt-spec-grid">
						<Fact label={t("serverDetail.mem")}>
							{mem_total > 0 && knownNumber(mem_total)
								? formatBytes(mem_total)
								: "—"}
						</Fact>
						<Fact label={t("serverDetail.disk")}>
							{disk_total > 0 && knownNumber(disk_total)
								? formatBytes(disk_total)
								: "—"}
						</Fact>
						<Fact label={t("serverDetail.uptime")}>
							<NumericText
								value={
									online && knownNumber(server.state.uptime) ? uptimeLabel : "—"
								}
							/>
						</Fact>
						<Fact label={t("serverDetail.load")}>
							<span className="dt-load-values">
								{[
									{ label: "1m", value: load_1, raw: server.state.load_1 },
									{ label: "5m", value: load_5, raw: server.state.load_5 },
									{ label: "15m", value: load_15, raw: server.state.load_15 },
								].map(({ label, value, raw }) => (
									<span key={label}>
										<small>{label}</small>
										<NumericText
											value={online && Number.isFinite(raw) ? `${value}` : "—"}
										/>
									</span>
								))}
							</span>
						</Fact>
						<Fact label={t("serverDetail.upload")}>
							<NumericText
								value={
									knownNumber(server.state.net_out_transfer)
										? formatBytes(net_out_transfer)
										: "—"
								}
							/>
						</Fact>
						<Fact label={t("serverDetail.download")}>
							<NumericText
								value={
									knownNumber(server.state.net_in_transfer)
										? formatBytes(net_in_transfer)
										: "—"
								}
							/>
						</Fact>
					</dl>
				</div>
				<dl className="dt-identity-times num">
					<div>
						<dt>{t("serverDetail.bootTime")}</dt>
						<dd>{boot_time_string || "—"}</dd>
					</div>
					<div>
						<dt>{t("serverDetail.lastActive")}</dt>
						<dd>
							<NumericText value={lastReport} />
						</dd>
					</div>
				</dl>
				{server.state.temperatures && server.state.temperatures.length > 0 && (
					<div className="dt-temperatures">
						<Accordion type="single" collapsible>
							<AccordionItem value="item-1" className="border-none">
								<AccordionTrigger className="dt-temperature-trigger">
									{t("serverDetail.temperature")}
								</AccordionTrigger>
								<AccordionContent className="pb-0 pt-2">
									<section className="dt-temperature-values num">
										{server.state.temperatures.map((item, index) => (
											<div key={index}>
												<p>{item.Name}</p>:{" "}
												{online && Number.isFinite(item.Temperature)
													? `${item.Temperature.toFixed(2)} °C`
													: "—"}
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
	className,
}: {
	label: string;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div className={cn("dt-fact", className)}>
			<dt>{label}</dt>
			<dd className="num">{children}</dd>
		</div>
	);
}
