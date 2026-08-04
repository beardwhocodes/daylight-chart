import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      data-slot="input"
      className={cn(
        "border-input bg-card flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-sm shadow-xs transition-[color,box-shadow,border-color] outline-none",
        "placeholder:text-muted-foreground/70 selection:bg-primary selection:text-primary-foreground",
        "focus-visible:border-ring/60 focus-visible:ring-ring/25 focus-visible:ring-[3px] focus-visible:outline-none",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "[&::-webkit-calendar-picker-indicator]:opacity-55 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 dark:[&::-webkit-calendar-picker-indicator]:invert",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
