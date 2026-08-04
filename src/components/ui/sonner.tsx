import { Toaster as Sonner } from "sonner";
import { useTheme } from "@/hooks/useTheme";

export function Toaster() {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme}
      position="bottom-center"
      toastOptions={{
        classNames: {
          toast:
            "!bg-popover !text-popover-foreground !border-border !rounded-lg !shadow-lg !font-sans",
          description: "!text-muted-foreground",
        },
      }}
    />
  );
}
