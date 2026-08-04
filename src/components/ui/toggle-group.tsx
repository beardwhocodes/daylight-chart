import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Segmented control. The group owns the frame and the items sit inside it, so
 * the selected pill can never touch the outer border.
 */
const ToggleGroup = forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    className={cn(
      "bg-muted/60 flex h-9 w-fit items-center gap-0.5 rounded-md border p-0.5",
      className,
    )}
    {...props}
  >
    {children}
  </ToggleGroupPrimitive.Root>
));
ToggleGroup.displayName = "ToggleGroup";

const ToggleGroupItem = forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <ToggleGroupPrimitive.Item
    ref={ref}
    className={cn(
      "text-muted-foreground inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-[5px] px-2.5 text-[13px] font-medium whitespace-nowrap transition-[color,background-color,box-shadow] duration-150 outline-none",
      "hover:text-foreground disabled:pointer-events-none disabled:opacity-50",
      "data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm",
      "focus-visible:ring-ring/40 focus-visible:ring-2",
      "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
      className,
    )}
    {...props}
  >
    {children}
  </ToggleGroupPrimitive.Item>
));
ToggleGroupItem.displayName = "ToggleGroupItem";

export { ToggleGroup, ToggleGroupItem };
