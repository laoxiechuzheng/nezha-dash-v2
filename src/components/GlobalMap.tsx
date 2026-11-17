import { geoEquirectangular, geoPath } from "d3-geo";
import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import useTooltip from "@/hooks/use-tooltip";
import { geoJsonString } from "@/lib/geo-json-string";
import { countryCoordinates } from "@/lib/geo-limit";
import { cn, formatNezhaInfo } from "@/lib/utils";
import type { NezhaServer } from "@/types/nezha-api";

import MapTooltip from "./MapTooltip";

const geoJson = JSON.parse(geoJsonString) as {
	features: Array<{
		type: "Feature";
		properties: {
			iso_a2_eh: string;
			iso_a3_eh: string;
			[key: string]: string;
		};
		geometry: never;
	}>;
};

const filteredFeatures = geoJson.features.filter(
	(feature) => feature.properties.iso_a3_eh !== "",
);

type TooltipServer = {
	id: number;
	name: string;
	status: boolean;
};

export default function GlobalMap({
	serverList,
	now,
}: {
	serverList: NezhaServer[];
	now: number;
}) {
	const { t } = useTranslation();
	const { countryList, countryServers, serverCounts } = useMemo(() => {
		const countryList: string[] = [];
		const countryServers: Record<string, TooltipServer[]> = {};
		const serverCounts: Record<string, number> = {};

		serverList.forEach((server) => {
			if (!server.country_code) return;

			const countryCode = server.country_code.toUpperCase();
			if (!countryServers[countryCode]) {
				countryList.push(countryCode);
				countryServers[countryCode] = [];
			}

			serverCounts[countryCode] = (serverCounts[countryCode] || 0) + 1;
			countryServers[countryCode].push({
				id: server.id,
				name: server.name,
				status: formatNezhaInfo(now, server).online,
			});
		});

		return { countryList, countryServers, serverCounts };
	}, [now, serverList]);

	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;

	const width = 900;
	const height = 500;

	return (
		<section
			className={cn("hm-map surface-stage flex flex-col", {
				"bg-card/70": customBackgroundImage,
			})}
		>
			<header className="hm-map-heading">
				<h2 className="text-sm font-semibold">{t("map.title")}</h2>
				<p className="text-xs text-muted-foreground tabular-nums">
					{t("map.Distributions")} {countryList.length} {t("map.Regions")}
				</p>
			</header>
			<div className="w-full">
				<InteractiveMap
					countries={countryList}
					serverCounts={serverCounts}
					width={width}
					height={height}
					filteredFeatures={filteredFeatures}
					countryServers={countryServers}
				/>
			</div>
			<footer className="hm-map-footer">
				<div className="hm-map-legend">
					<span className="status-dot" data-status="online" />
					{t("v2Home.map.legendOnline")}
					<span className="status-dot" data-status="offline" />
					{t("v2Home.map.legendIssue")}
					<span className="num">
						{t("v2Home.map.summary", {
							countries: countryList.length,
							servers: serverList.length,
						})}
					</span>
				</div>
				<p>{t("v2Home.map.note")}</p>
			</footer>
		</section>
	);
}

interface InteractiveMapProps {
	countries: string[];
	serverCounts: { [key: string]: number };
	width: number;
	height: number;
	filteredFeatures: {
		type: "Feature";
		properties: {
			iso_a3_eh: string;
			iso_a2_eh: string;
			[key: string]: string;
		};
		geometry: never;
	}[];
	countryServers: Record<string, TooltipServer[]>;
}

export function InteractiveMap({
	countries,
	serverCounts,
	width,
	height,
	filteredFeatures,
	countryServers,
}: InteractiveMapProps) {
	const { setTooltipData } = useTooltip();
	const containerRef = useRef<HTMLDivElement>(null);
	const showTooltip = (
		centroid: number[],
		country: string,
		code: string,
		count: number,
	) => {
		const bounds = containerRef.current?.getBoundingClientRect();
		const scale = Math.min(
			(bounds?.width || width) / width,
			(bounds?.height || height) / height,
		);
		const offsetX = ((bounds?.width || width) - width * scale) / 2;
		const offsetY = ((bounds?.height || height) - height * scale) / 2;
		setTooltipData({
			centroid: [offsetX + centroid[0] * scale, offsetY + centroid[1] * scale],
			country,
			count,
			servers: countryServers[code] ?? [],
		});
	};

	const { path, projection } = useMemo(() => {
		const projection = geoEquirectangular()
			.scale(140)
			.translate([width / 2, height / 2])
			.rotate([-12, 0, 0]);

		return {
			path: geoPath().projection(projection),
			projection,
		};
	}, [height, width]);

	const featureCountryCodes = useMemo(
		() =>
			new Set(filteredFeatures.map((feature) => feature.properties.iso_a2_eh)),
		[filteredFeatures],
	);
	const highlightedCountryCodes = useMemo(
		() => new Set(countries),
		[countries],
	);

	return (
		<div
			ref={containerRef}
			className="relative hm-map-canvas"
			onMouseLeave={() => setTooltipData(null)}
		>
			<svg
				width={width}
				height={height}
				viewBox={`0 0 ${width} ${height}`}
				xmlns="http://www.w3.org/2000/svg"
				className="w-full h-auto"
			>
				<g>
					{/* Background rect to handle mouse events in empty areas */}
					<rect
						x="0"
						y="0"
						width={width}
						height={height}
						fill="transparent"
						onMouseEnter={() => setTooltipData(null)}
					/>
					{filteredFeatures.map((feature, index) => {
						const isHighlighted = highlightedCountryCodes.has(
							feature.properties.iso_a2_eh,
						);

						const serverCount = serverCounts[feature.properties.iso_a2_eh] || 0;

						return (
							<path
								key={index}
								d={path(feature) || ""}
								data-highlighted={isHighlighted ? "true" : undefined}
								data-issue={
									(isHighlighted &&
										countryServers[feature.properties.iso_a2_eh]?.some(
											(server) => !server.status,
										)) ||
									undefined
								}
								className="hm-map-land"
								onMouseEnter={() => {
									if (!isHighlighted) {
										setTooltipData(null);
										return;
									}
									if (path.centroid(feature)) {
										const countryCode = feature.properties.iso_a2_eh;
										showTooltip(
											path.centroid(feature),
											feature.properties.name,
											countryCode,
											serverCount,
										);
									}
								}}
							/>
						);
					})}

					{/* 渲染不在 filteredFeatures 中的国家标记点 */}
					{countries.map((countryCode, markerIndex) => {
						// 检查该国家是否已经在 filteredFeatures 中
						const isInFilteredFeatures = featureCountryCodes.has(countryCode);

						// 如果已经在 filteredFeatures 中，跳过
						if (isInFilteredFeatures) return null;

						// 获取国家的经纬度
						const coords = countryCoordinates[countryCode];
						if (!coords) return null;

						// 使用投影函数将经纬度转换为 SVG 坐标
						const [x, y] = projection([coords.lng, coords.lat]) || [0, 0];
						const serverCount = serverCounts[countryCode] || 0;

						return (
							<g
								key={countryCode}
								onMouseEnter={() => {
									showTooltip([x, y], coords.name, countryCode, serverCount);
								}}
								className="cursor-pointer"
							>
								{markerIndex < 12 &&
									!countryServers[countryCode]?.some(
										(server) => !server.status,
									) && (
										<circle
											cx={x}
											cy={y}
											r="6"
											className="hm-map-halo hm-map-ping"
										/>
									)}
								<circle
									cx={x}
									cy={y}
									r={4}
									data-marker="true"
									className="hm-map-marker"
									data-issue={
										countryServers[countryCode]?.some(
											(server) => !server.status,
										) || undefined
									}
								/>
							</g>
						);
					})}
					{countries
						.filter((code) => (serverCounts[code] || 0) >= 2)
						.map((code) => {
							const feature = filteredFeatures.find(
								(feature) => feature.properties.iso_a2_eh === code,
							);
							const coords = countryCoordinates[code];
							const centroid = feature
								? path.centroid(feature)
								: coords
									? projection([coords.lng, coords.lat])
									: null;
							if (!centroid) return null;
							return (
								<g
									key={`count-${code}`}
									transform={`translate(${centroid[0]},${centroid[1]})`}
									pointerEvents="none"
								>
									<rect
										className="hm-map-count"
										x="-12"
										y="-9"
										width="24"
										height="18"
										rx="9"
									/>
									<text className="hm-map-count-label">
										{serverCounts[code]}
									</text>
								</g>
							);
						})}
				</g>
			</svg>
			<MapTooltip />
		</div>
	);
}
