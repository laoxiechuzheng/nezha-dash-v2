import { useEffect, useState } from "react";
import { Toaster } from "sonner";

const mobileQuery = "(max-width: 767px)";

/** 单一实例随视口改位置，不重挂 Toast 或改变既有持续时间。 */
export function ResponsiveToaster() {
	const [mobile, setMobile] = useState(
		() => window.matchMedia(mobileQuery).matches,
	);
	useEffect(() => {
		const media = window.matchMedia(mobileQuery);
		const onChange = () => setMobile(media.matches);
		onChange();
		media.addEventListener("change", onChange);
		return () => media.removeEventListener("change", onChange);
	}, []);

	return (
		<Toaster
			duration={1000}
			position={mobile ? "top-center" : "bottom-right"}
			toastOptions={{ classNames: { default: "sh-toast" } }}
		/>
	);
}
