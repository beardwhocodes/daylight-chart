import * as LabelPrimitive from "@radix-ui/react-label";
import { Slot } from "@radix-ui/react-slot";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const Label = forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      "flex items-center gap-2 text-sm leading-none font-medium select-none peer-disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Label.displayName = "Label";

/** Uppercase micro-label used above every control in the toolbar. */
const FieldLabel = forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & { asChild?: boolean }
>(({ className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "span";
  return (
    <Comp
      ref={ref}
      className={cn(
        "text-muted-foreground text-[10px] leading-none font-semibold tracking-[0.09em] uppercase",
        className,
      )}
      {...props}
    />
  );
});
FieldLabel.displayName = "FieldLabel";

export { Label, FieldLabel };
