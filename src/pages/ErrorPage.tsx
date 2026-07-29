import { useTranslation } from "react-i18next";

interface ErrorPageProps {
	code?: string | number;
	message?: string;
}

export default function ErrorPage({ code = "500", message }: ErrorPageProps) {
	const { t } = useTranslation();

	return (
		<div className="flex min-h-[55vh] flex-col items-center justify-center">
			<div className="glass-panel relative flex w-full max-w-lg flex-col items-center gap-3 overflow-hidden rounded-3xl px-6 py-14 text-center">
				<div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_50%_0%,rgba(14,165,233,0.2),transparent_65%)]" />
				<h1 className="text-6xl font-black tracking-tight text-sky-600 dark:text-sky-300">
					{code}
				</h1>
				<p className="text-lg font-medium text-muted-foreground">
					{message || t("error.somethingWentWrong")}
				</p>
			</div>
		</div>
	);
}
