import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
	"sh-button inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-[18px] [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default: "sh-button-primary bg-primary text-primary-foreground",
				destructive:
					"bg-destructive text-destructive-foreground hover:bg-destructive/90",
				outline:
					"border border-border bg-card text-foreground hover:border-input hover:bg-muted active:bg-surface-3",
				secondary:
					"border border-border bg-secondary text-secondary-foreground hover:border-input hover:bg-muted active:bg-surface-3",
				ghost:
					"text-muted-foreground hover:bg-foreground/6 hover:text-foreground active:bg-foreground/10",
				link: "text-primary underline-offset-4 hover:underline",
			},
			size: {
				default: "h-10 px-4",
				sm: "h-8 px-3",
				lg: "h-11 px-5",
				icon: "size-10",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : "button";
		return (
			<Comp
				className={cn(buttonVariants({ variant, size, className }))}
				ref={ref}
				{...props}
			/>
		);
	},
);
Button.displayName = "Button";

export { Button, buttonVariants };
