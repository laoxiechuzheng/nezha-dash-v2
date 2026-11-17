import { hasFlag } from "country-flag-icons";
import getUnicodeFlagIcon from "country-flag-icons/unicode";
import { cn } from "@/lib/utils";

let emojiSupport: boolean | undefined;
function detectEmojiSupport() {
	if (emojiSupport !== undefined) return emojiSupport;
	emojiSupport = false;
	try {
		const ctx = document.createElement("canvas").getContext("2d");
		if (!ctx) return false;
		ctx.fillStyle = "#000";
		ctx.textBaseline = "top";
		ctx.font = "32px Arial";
		ctx.fillText("🇺🇸", 0, 0);
		emojiSupport = ctx.getImageData(16, 16, 1, 1).data[3] !== 0;
	} catch {
		/* 无 canvas 的环境使用 SVG。 */
	}
	return emojiSupport;
}

export default function ServerFlag({
	country_code,
	className,
}: {
	country_code: string;
	className?: string;
}) {
	const normalizedCountryCode = (country_code || "")
		.trim()
		.replace(/_/g, "-")
		.toUpperCase();
	if (!hasFlag(normalizedCountryCode)) return null;
	// @ts-expect-error ForceUseSvgFlag is a global variable
	const forceUseSvgFlag = window.ForceUseSvgFlag as boolean;
	const useEmoji =
		!forceUseSvgFlag &&
		/^[A-Z]{2}$/.test(normalizedCountryCode) &&
		detectEmojiSupport();
	return (
		<span className={cn("text-[12px] text-muted-foreground", className)}>
			{useEmoji ? (
				getUnicodeFlagIcon(normalizedCountryCode)
			) : (
				<span className={`fi fi-${normalizedCountryCode.toLowerCase()}`} />
			)}
		</span>
	);
}
