import {
	GetFontLogoClass,
	GetOsName,
	MageMicrosoftWindows,
} from "@/lib/logo-class";
import { cn } from "@/lib/utils";

/** OS glyph plus a short OS name, e.g. "Windows" or "Debian". */
export default function ServerPlatform({
	platform,
	className,
}: {
	platform: string;
	className?: string;
}) {
	if (!platform) return null;
	const isWindows = platform.includes("Windows");

	return (
		<span
			className={cn(
				"inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground",
				className,
			)}
		>
			{isWindows ? (
				<MageMicrosoftWindows className="size-3 shrink-0" />
			) : (
				<i
					aria-hidden="true"
					className={`fl-${GetFontLogoClass(platform)} shrink-0 text-[12px] not-italic leading-none`}
				/>
			)}
			<span className="truncate">
				{isWindows ? "Windows" : GetOsName(platform)}
			</span>
		</span>
	);
}
