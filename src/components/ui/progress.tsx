import * as ProgressPrimitive from "@radix-ui/react-progress";
import * as React from "react";
import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
	React.ElementRef<typeof ProgressPrimitive.Root>,
	React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
		indicatorClassName?: string;
	}
>(({ className, value, indicatorClassName, ...props }, ref) => (
	<ProgressPrimitive.Root
		ref={ref}
		className={cn(
			"relative h-1 w-full overflow-hidden rounded-[2px] bg-muted dark:bg-foreground/10",
			className,
		)}
		{...props}
	>
		<ProgressPrimitive.Indicator
			className={cn(
				"h-full w-full flex-1 rounded-[2px] bg-primary transition-transform duration-150 ease-out",
				indicatorClassName,
			)}
			style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
		/>
	</ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
