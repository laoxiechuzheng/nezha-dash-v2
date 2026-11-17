import { ArrowDown, ArrowUp } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import TraceTooltip from "@/components/home/TraceTooltip";
import {
	type FleetSample,
	niceTraceMax,
	tracePaths,
	traceTiming,
} from "@/lib/fleet-trace";
import { formatBytes } from "@/lib/format";
import { bytesPerSecondToMbps, formatMbps } from "@/lib/utils";

const WIDTH = 600;
const HEIGHT = 160;

export default function FleetStage({
	samples,
	connected,
	up,
	down,
	upSpeed,
	downSpeed,
}: {
	samples: FleetSample[];
	connected: boolean;
	up: number;
	down: number;
	upSpeed: number;
	downSpeed: number;
}) {
	const { t } = useTranslation();
	const [hover, setHover] = useState<number | null>(null);
	const chartRef = useRef<HTMLDivElement>(null);
	const timing = useMemo(() => traceTiming(samples), [samples]);
	const spanLabel =
		timing.span < 90_000
			? t("v2Home.trace.spanSeconds", { n: Math.round(timing.span / 1000) })
			: t("v2Home.trace.spanMinutes", { n: (timing.span / 60_000).toFixed(1) });
	const intervalLabel = t("v2Home.trace.intervalSeconds", {
		n: (timing.interval / 1000).toFixed(1),
	});
	const last = samples[samples.length - 1];
	const first = samples[0];
	const domain: [number, number] = [
		samples.length < 5 ? (last?.t ?? 0) - 15_000 : (first?.t ?? 0),
		last?.t ?? 0,
	];
	const peak = Math.max(
		0,
		...samples.map((sample) => Math.max(sample.down, sample.up)),
	);
	const max = niceTraceMax(peak);
	const unit =
		max * 8 >= 1_000_000_000
			? { divisor: 125_000_000, name: "Gbps" }
			: max * 8 >= 1_000_000
				? { divisor: 125_000, name: "Mbps" }
				: { divisor: 125, name: "Kbps" };
	const paths = (["down", "up"] as const).map((key) => ({
		key,
		...tracePaths(
			samples
				.filter((sample) => sample.t >= domain[0])
				.map((sample) => ({ t: sample.t, value: sample[key] })),
			domain,
			max,
			WIDTH,
			HEIGHT,
			timing.gap,
		),
	}));
	const selected =
		hover === null ? null : samples[Math.min(hover, samples.length - 1)];
	const selectNearest = (clientX: number) => {
		const bounds = chartRef.current?.getBoundingClientRect();
		if (!bounds || !samples.length) return;
		const fraction = Math.max(
			0,
			Math.min(1, (clientX - bounds.left) / bounds.width),
		);
		const target = domain[0] + fraction * (domain[1] - domain[0]);
		let nearest = samples.findIndex((sample) => sample.t >= domain[0]);
		if (nearest < 0) return;
		for (let i = nearest + 1; i < samples.length; i++)
			if (
				Math.abs(samples[i].t - target) < Math.abs(samples[nearest].t - target)
			)
				nearest = i;
		setHover(nearest);
	};
	// @ts-expect-error CustomIllustration is a global variable
	const illustration = window.CustomIllustration as string | undefined;
	// @ts-expect-error DisableAnimatedMan is a global variable
	const disableIllustration = window.DisableAnimatedMan as boolean;
	return (
		<div className="surface-stage hm-stage">
			<div className="hm-stage-head">
				<h1 className="eyebrow">{t("overview")}</h1>
				<time className="num hm-clock">
					{last ? new Date(last.t).toLocaleTimeString() : "—"}
				</time>
			</div>
			<div className="hm-stage-body">
				<div className="hm-stage-values">
					{(
						[
							{
								key: "down",
								Icon: ArrowDown,
								label: "serverOverview.downloadSpeed",
								value: downSpeed,
							},
							{
								key: "up",
								Icon: ArrowUp,
								label: "serverOverview.uploadSpeed",
								value: upSpeed,
							},
						] as const
					).map(({ key, Icon, label, value }) => {
						const [number, unit] = formatMbps(
							bytesPerSecondToMbps(value),
						).split(" ");
						return (
							<div className="hm-rate" data-series={key} key={key}>
								<span className="hm-rate-icon">
									<Icon size={16} aria-hidden="true" />
								</span>
								<div className="hm-rate-data">
									<span className="hm-rate-label">{t(label)}</span>
									<div className="hm-rate-value num">
										<span>{number}</span>
										<small>{unit}</small>
									</div>
								</div>
							</div>
						);
					})}
					<div className="hm-totals">
						<span className="sr-only">{t("serverOverview.totalTraffic")}</span>
						<span className="num">
							<ArrowUp size={13} aria-hidden="true" />
							{formatBytes(up)}
						</span>
						<span className="num">
							<ArrowDown size={13} aria-hidden="true" />
							{formatBytes(down)}
						</span>
						{illustration && !disableIllustration && (
							<img
								className="hm-custom-illustration"
								alt="animated-man"
								src={illustration}
							/>
						)}
					</div>
				</div>
				<div className="hm-trace" data-connected={connected}>
					<div className="hm-trace-head">
						<span className="num">
							{samples.length
								? t("v2Home.trace.peak", {
										value: formatMbps(bytesPerSecondToMbps(peak)),
									})
								: ""}
						</span>
						{!connected && samples.length > 0 && (
							<span className="chip" data-tone="danger">
								{t("v2Home.trace.stale")}
							</span>
						)}
					</div>
					<div className="hm-trace-plot">
						<div className="hm-trace-y num">
							<span>
								{(max / unit.divisor).toFixed(1)} {unit.name}
							</span>
							<span>{(max / unit.divisor / 2).toFixed(1)}</span>
							<span>0</span>
						</div>
						<div
							className="hm-trace-drawing"
							ref={chartRef}
							onPointerMove={(event) => selectNearest(event.clientX)}
							onPointerLeave={() => setHover(null)}
							onPointerDown={(event) => {
								if (event.pointerType === "touch") {
									event.currentTarget.setPointerCapture?.(event.pointerId);
									selectNearest(event.clientX);
								}
							}}
							onPointerCancel={() => setHover(null)}
							onPointerUp={(event) => {
								if (event.pointerType === "touch") setHover(null);
							}}
						>
							<svg
								className="hm-trace-svg"
								viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
								preserveAspectRatio="none"
								role="img"
								aria-label={t("v2Home.trace.chartLabel")}
							>
								{(samples.length ? [0, 0.5, 1] : [0.5]).map((fraction) => (
									<line
										key={fraction}
										x1="0"
										x2={WIDTH}
										y1={fraction * HEIGHT}
										y2={fraction * HEIGHT}
										className="hm-chart-grid"
									/>
								))}
								{paths.map(({ key, line, area }) => (
									<g key={key} data-series={key}>
										<path d={area} fill={`url(#lumen-area-${key})`} />
										<path d={line} className="hm-trace-line" />
									</g>
								))}
								{last &&
									(["down", "up"] as const).map((key) => (
										<g
											className={connected ? "hm-trace-end" : ""}
											key={key}
											data-series={key}
											transform={`translate(${WIDTH},${HEIGHT - (last[key] / max) * HEIGHT})`}
										>
											<circle className="hm-end-halo" r="8" />
											<circle r="2.5" />
										</g>
									))}
								{selected && (
									<line
										className="hm-crosshair"
										x1={
											((selected.t - domain[0]) /
												Math.max(1, domain[1] - domain[0])) *
											WIDTH
										}
										x2={
											((selected.t - domain[0]) /
												Math.max(1, domain[1] - domain[0])) *
											WIDTH
										}
										y1="0"
										y2={HEIGHT}
									/>
								)}
							</svg>
							{samples.length === 0 && (
								<div className="hm-trace-wait">{t("v2Home.trace.waiting")}</div>
							)}
							{selected && (
								<TraceTooltip
									drawingRef={chartRef}
									sample={selected}
									fraction={
										(selected.t - domain[0]) /
										Math.max(1, domain[1] - domain[0])
									}
								/>
							)}
						</div>
					</div>
					<div className="hm-trace-x num">
						<span>{samples.length >= 5 ? `−${spanLabel}` : ""}</span>
						<span>{t("v2Home.trace.now")}</span>
					</div>
					<p className="hm-trace-caption">
						{samples.length === 0
							? t("v2Home.trace.waiting")
							: samples.length < 5
								? t("v2Home.trace.sampling", { count: samples.length })
								: t("v2Home.trace.caption", {
										span: spanLabel,
										count: samples.length,
										interval: intervalLabel,
									})}
					</p>
				</div>
			</div>
		</div>
	);
}
