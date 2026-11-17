import {
	type CSSProperties,
	createContext,
	type MouseEvent,
	memo,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
} from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import BillingInfo from "@/components/billingInfo";
import PlanInfo from "@/components/PlanInfo";
import ServerFlag from "@/components/ServerFlag";
import ServerPlatform from "@/components/ServerPlatform";
import { getUsageLevel } from "@/components/ServerUsageBar";
import { isFleetOnline } from "@/lib/fleet-trace";
import { formatBytes } from "@/lib/format";
import { saveMainPageScrollPosition } from "@/lib/navigation";
import {
	bytesPerSecondToMbps,
	formatMbps,
	formatNezhaInfo,
	handlePublicNote,
	parsePublicNote,
} from "@/lib/utils";
import type { NezhaServer } from "@/types/nezha-api";

type DenseLabels = {
	mem: string;
	disk: string;
	upload: string;
	download: string;
	totalUpload: string;
	totalDownload: string;
	uptime: string;
	days: string;
	hours: string;
	system: string;
	offline: string;
	lastActive: string;
};
const DenseContext = createContext<{
	labels: DenseLabels;
	navigate: (path: string) => void;
} | null>(null);
export const useDenseRowContext = () => useContext(DenseContext);

/** 同页只解析一次固定翻译与导航；节点更新不重复触发i18next解析。 */
export function DenseRowProvider({
	enabled,
	children,
}: {
	enabled: boolean;
	children: ReactNode;
}) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const open = useCallback(
		(path: string) => {
			saveMainPageScrollPosition();
			navigate(path);
		},
		[navigate],
	);
	const labels = useMemo<DenseLabels>(
		() => ({
			mem: t("serverCard.mem"),
			disk: t("serverCard.stg"),
			upload: t("serverCard.upload"),
			download: t("serverCard.download"),
			totalUpload: t("serverCard.totalUpload"),
			totalDownload: t("serverCard.totalDownload"),
			uptime: t("serverCard.uptime"),
			days: t("serverCard.days"),
			hours: t("serverCard.hours"),
			system: t("serverCard.system"),
			offline: t("serverList.offline"),
			lastActive: t("serverDetail.lastActive"),
		}),
		[t],
	);
	const value = useMemo(
		() => (enabled ? { labels, navigate: open } : null),
		[enabled, labels, open],
	);
	return (
		<DenseContext.Provider value={value}>{children}</DenseContext.Provider>
	);
}

const Identity = memo(function Identity({
	name,
	country,
	platform,
	note,
	online,
	system,
	billingClock,
}: {
	name: string;
	country: string;
	platform: string;
	note: string;
	online: boolean;
	system: string;
	billingClock: number;
}) {
	// 有账单的节点仍随每次上报重新渲染，不能缓存过期的剩余天数。
	void billingClock;
	const parsed = useMemo(() => parsePublicNote(note), [note]);
	return (
		<div className="hm-row-name flex min-w-0 flex-col gap-1 [grid-area:name]">
			<div className="flex min-w-0 items-center gap-2">
				<span
					className="status-dot"
					data-status={online ? "online" : "offline"}
				/>
				<ServerFlag country_code={country} className="shrink-0 leading-none" />
				<span
					title={name}
					className={
						online
							? "truncate text-[13px] font-medium"
							: "truncate text-[13px] font-medium text-muted-foreground"
					}
				>
					{name}
				</span>
			</div>
			{(online || parsed?.billingDataMod) && (
				<div className="hm-row-sub flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 pl-4 text-[11px] text-muted-foreground [&_p]:text-[11px] [&>div]:text-[11px]">
					{online && (
						<span className="flex min-w-0 items-center">
							<span className="sr-only">{system}</span>
							<ServerPlatform platform={platform} />
						</span>
					)}
					{parsed?.billingDataMod && <BillingInfo parsedData={parsed} />}
				</div>
			)}
			{parsed?.planDataMod && (
				<div className="hm-row-plan pl-4">
					<PlanInfo parsedData={parsed} />
				</div>
			)}
		</div>
	);
});

const Meter = memo(function Meter({
	label,
	value,
	area,
}: {
	label: string;
	value: number;
	area: string;
}) {
	const known = Number.isFinite(value),
		level = getUsageLevel(value);
	const quantized = known ? Math.round(value * 2) / 2 : 0;
	return (
		<div className="hm-dense-usage" style={{ gridArea: area }}>
			<span className="hm-dense-label">{label}</span>
			<span
				className={`hm-dense-reading num${level === "warn" ? " text-warning" : level === "bad" ? " text-danger" : ""}`}
				data-level={level}
			>
				{known ? `${value.toFixed(2)}%` : "—"}
			</span>
			<div
				role="progressbar"
				aria-label="Server Usage Bar"
				aria-labelledby="Server Usage Bar"
				data-level={level}
				data-unknown={!known || undefined}
				className="hm-dense-meter"
				style={{ "--hm-offset": `${100 - quantized}%` } as CSSProperties}
			/>
		</div>
	);
});

const Transfer = memo(function Transfer({
	up,
	down,
	uploadLabel,
	downloadLabel,
	area,
}: {
	up: string;
	down: string;
	uploadLabel: string;
	downloadLabel: string;
	area: "speed" | "traffic";
}) {
	return (
		<div
			className={`hm-dense-transfer num hm-dense-${area}`}
			style={{ gridArea: area }}
		>
			<span>
				<svg
					viewBox="0 0 12 12"
					width="12"
					height="12"
					aria-hidden="true"
					className={area === "speed" ? "hm-dense-up" : ""}
				>
					<path
						d="M6 10V2M2.5 5.5 6 2l3.5 3.5"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
					/>
				</svg>
				<span className="sr-only">{uploadLabel}</span>
				{up}
			</span>
			<span>
				<svg
					viewBox="0 0 12 12"
					width="12"
					height="12"
					aria-hidden="true"
					className={area === "speed" ? "hm-dense-down" : ""}
				>
					<path
						d="M6 2v8M2.5 6.5 6 10l3.5-3.5"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
					/>
				</svg>
				<span className="sr-only">{downloadLabel}</span>
				{down}
			</span>
		</div>
	);
});

/** high密度的等价DOM，不挂每行listener/effect，不使用逐格Radix上下文。 */
export function renderDenseRow(
	{ now, serverInfo }: { now: number; serverInfo: NezhaServer },
	context: NonNullable<ReturnType<typeof useDenseRowContext>>,
) {
	const { labels, navigate } = context;
	const state = serverInfo.state,
		host = serverInfo.host;
	const online = isFleetOnline(now, serverInfo);
	const href = `/server/${serverInfo.id}`;
	const click = (event: MouseEvent<HTMLAnchorElement>) => {
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.button)
			return;
		event.preventDefault();
		navigate(href);
	};
	const note = handlePublicNote(serverInfo.id, serverInfo.public_note || "");
	const cpu = Number.isFinite(state?.cpu) ? state.cpu : Number.NaN;
	const mem =
		Number.isFinite(state?.mem_used) && host?.mem_total > 0
			? (state.mem_used / host.mem_total) * 100
			: Number.NaN;
	const disk =
		Number.isFinite(state?.disk_used) && host?.disk_total > 0
			? (state.disk_used / host.disk_total) * 100
			: Number.NaN;
	const uptime = state?.uptime || 0;
	// 日期只在离线分支显示时计算；保留原dayjs格式，不修改共享utils。
	const lastSeen = online
		? ""
		: formatNezhaInfo(now, serverInfo).last_active_time_string;
	return (
		<a
			href={href}
			onClick={click}
			data-online={online}
			className={
				online
					? "server-row hm-row-grid hm-node-row surface hm-dense-row group px-4 py-3 md:py-2.5"
					: "server-row hm-row-grid hm-node-row surface hm-dense-row group px-4 py-3 text-muted-foreground"
			}
		>
			<Identity
				name={serverInfo.name}
				country={serverInfo.country_code}
				platform={host?.platform || ""}
				note={note}
				online={online}
				system={labels.system}
				billingClock={note ? now : 0}
			/>
			{online ? (
				<>
					<Meter label="CPU" value={cpu} area="cpu" />
					<Meter label={labels.mem} value={mem} area="mem" />
					<Meter label={labels.disk} value={disk} area="disk" />
					<Transfer
						area="speed"
						up={formatMbps(bytesPerSecondToMbps(state?.net_out_speed))}
						down={formatMbps(bytesPerSecondToMbps(state?.net_in_speed))}
						uploadLabel={labels.upload}
						downloadLabel={labels.download}
					/>
					<Transfer
						area="traffic"
						up={formatBytes(state?.net_out_transfer || 0)}
						down={formatBytes(state?.net_in_transfer || 0)}
						uploadLabel={labels.totalUpload}
						downloadLabel={labels.totalDownload}
					/>
					<span className="hidden text-right text-xs num [grid-area:load] xl:block">
						{state?.load_1?.toFixed(2) || 0}
					</span>
					<span className="hm-dense-uptime self-start text-right text-xs text-muted-foreground num [grid-area:uptime] md:hidden xl:block xl:self-center xl:text-foreground">
						<span className="sr-only">{labels.uptime} </span>
						{uptime / 86400 >= 1
							? `${(uptime / 86400).toFixed(0)} ${labels.days}`
							: `${(uptime / 3600).toFixed(0)} ${labels.hours}`}
					</span>
				</>
			) : (
				<div className="flex min-w-0 flex-wrap items-center gap-2 pl-4 text-xs [grid-area:info] md:pl-0">
					<span className="chip" data-tone="danger">
						{labels.offline}
					</span>
					{lastSeen && (
						<span className="truncate">
							{labels.lastActive}{" "}
							<span className="font-mono num">{lastSeen}</span>
						</span>
					)}
				</div>
			)}
		</a>
	);
}
