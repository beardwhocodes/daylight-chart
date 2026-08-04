import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, children, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "bg-primary text-primary-foreground z-50 w-fit origin-(--radix-tooltip-content-transform-origin) rounded-md px-2.5 py-1.5 text-xs text-balance",
        "data-[state=delayed-open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95",
        className,
      )}
      {...props}
    >
      {children}
      <TooltipPrimitive.Arrow className="bg-primary z-50 size-2 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] fill-primary" />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = "TooltipContent";

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
