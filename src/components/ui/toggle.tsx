import * as TogglePrimitive from "@radix-ui/react-toggle";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const Toggle = forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root>
>(({ className, ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(
      "border-input bg-card text-muted-foreground inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-[13px] font-medium whitespace-nowrap shadow-xs transition-[color,background-color,border-color,box-shadow] duration-150 outline-none",
      "hover:bg-accent/50 hover:text-foreground",
      "focus-visible:border-ring/60 focus-visible:ring-ring/25 focus-visible:ring-[3px]",
      "data-[state=on]:border-sun/30 data-[state=on]:bg-sun/15 data-[state=on]:text-sun",
      "disabled:pointer-events-none disabled:opacity-50",
      "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      className,
    )}
    {...props}
  />
));
Toggle.displayName = "Toggle";

export { Toggle };
