import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

interface BackButtonProps {
  to?: string;
  label?: string;
  className?: string;
}

export function BackButton({ to, label = "Kembali", className = "" }: BackButtonProps) {
  const [, navigate] = useLocation();

  const handleClick = () => {
    if (to) {
      navigate(to);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      navigate("/");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-[hsl(230_22%_12%)] border border-white/10 text-foreground/90 hover:bg-[hsl(230_22%_15%)] hover:border-primary/40 active:scale-95 transition-all ${className}`}
      aria-label={label}
    >
      <ArrowLeft className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}

export default BackButton;
