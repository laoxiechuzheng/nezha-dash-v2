type RowLayoutOptions = {
	root: HTMLElement;
	expectedCount: number;
	expectedDensity: "high" | "normal";
	expectedPadding: number;
	expectedHeight?: number;
};

const paint = () =>
	new Promise<void>((resolve) =>
		requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
	);
const requireLayout = (condition: boolean, message: string) => {
	if (!condition) throw new Error(`Home row layout guard: ${message}`);
};

/** 在真实浏览器里运行：检查 computed style、实际几何与全部数据，不以CSS源码字串代替布局。 */
export async function verifyHomeRowLayout({
	root,
	expectedCount,
	expectedDensity,
	expectedPadding,
	expectedHeight,
}: RowLayoutOptions) {
	const home = root.querySelector<HTMLElement>(".hm-home");
	const rows = [...root.querySelectorAll<HTMLAnchorElement>(".hm-node-row")];
	requireLayout(home?.dataset.density === expectedDensity, "density changed");
	requireLayout(
		rows.length === expectedCount,
		`expected ${expectedCount} DOM rows, received ${rows.length}`,
	);
	requireLayout(
		new Set(rows.map((row) => row.getAttribute("href"))).size === expectedCount,
		"duplicate or missing row links",
	);
	const cells = (row: HTMLElement, area: string) =>
		[...row.children].find(
			(child) => getComputedStyle(child).gridArea === area,
		) as HTMLElement | undefined;
	for (const row of rows) {
		for (const area of ["speed", "traffic"]) {
			const cell = cells(row, area);
			requireLayout(
				Boolean(cell),
				`${row.getAttribute("href")} missing ${area}`,
			);
			requireLayout(
				cell?.children.length === 2,
				`${area} must retain both values`,
			);
			for (const value of [...(cell?.children ?? [])])
				requireLayout(
					Boolean(value.textContent?.trim()),
					`${area} value disappeared`,
				);
		}
	}
	const sampled = [];
	const indices = [
		...new Set([0, Math.floor(rows.length / 2), rows.length - 1]),
	];
	for (const index of indices) {
		const row = rows[index];
		row.scrollIntoView({ block: "center", behavior: "instant" });
		await paint();
		const style = getComputedStyle(row);
		const bounds = row.getBoundingClientRect();
		requireLayout(
			Number.parseFloat(style.paddingTop) === expectedPadding &&
				Number.parseFloat(style.paddingBottom) === expectedPadding,
			`${index}: incorrect computed padding`,
		);
		if (expectedHeight !== undefined)
			requireLayout(
				Math.abs(bounds.height - expectedHeight) < 0.1,
				`${index}: height ${bounds.height}, expected ${expectedHeight}`,
			);
		const values = [];
		for (const area of ["speed", "traffic"]) {
			const cell = cells(row, area);
			if (!cell) continue;
			for (const value of [...cell.children]) {
				const rect = value.getBoundingClientRect();
				requireLayout(
					getComputedStyle(value).display !== "none" &&
						rect.width > 0 &&
						rect.height > 0,
					`${index}: hidden ${area} value`,
				);
				requireLayout(
					rect.top >= bounds.top && rect.bottom <= bounds.bottom + 0.1,
					`${index}: ${area} value vertically clipped`,
				);
				requireLayout(
					rect.left >= bounds.left && rect.right <= bounds.right + 0.1,
					`${index}: ${area} value horizontally clipped`,
				);
				values.push(value.textContent?.trim());
			}
		}
		sampled.push({
			index,
			href: row.getAttribute("href"),
			height: bounds.height,
			paddingTop: style.paddingTop,
			paddingBottom: style.paddingBottom,
			values,
		});
	}
	requireLayout(
		document.documentElement.scrollWidth <= window.innerWidth,
		"horizontal page overflow",
	);
	return {
		width: window.innerWidth,
		count: rows.length,
		density: home?.dataset.density,
		scrollWidth: document.documentElement.scrollWidth,
		sampled,
	};
}
