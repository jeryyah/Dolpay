import React, { useEffect, useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { generateCaptcha, type Captcha } from "@/lib/captcha";

interface CaptchaProps {
  onValid: (ok: boolean) => void;
  label?: string;
}
export function CaptchaInput({ onValid, label = "Verifikasi Manusia" }: CaptchaProps) {
  const [c, setC] = useState<Captcha>(() => generateCaptcha());
  const [val, setVal] = useState("");
  const [touched, setTouched] = useState(false);

  const ok = parseInt(val, 10) === c.answer;
  useEffect(() => { onValid(ok); }, [ok]);

  const refresh = () => { setC(generateCaptcha()); setVal(""); setTouched(false); onValid(false); };

  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
        <ShieldCheck className="w-3.5 h-3.5" /> {label}
      </label>
      <div className={`flex items-stretch gap-2 rounded-xl border p-1
        ${touched ? (ok ? "border-emerald-500/50 bg-emerald-500/5" : "border-rose-500/50 bg-rose-500/5") : "border-border bg-background"}`}>
        <div className="flex-1 px-3 py-2 font-mono text-base font-extrabold tracking-widest select-none bg-muted/40 rounded-lg flex items-center justify-center">
          {c.question} = ?
        </div>
        <input
          inputMode="numeric"
          value={val}
          onChange={(e) => { setVal(e.target.value.replace(/[^\-0-9]/g, "").slice(0, 4)); setTouched(true); }}
          placeholder="?"
          className="w-16 px-2 py-2 text-center font-bold text-base bg-transparent focus:outline-none"
        />
        <button
          type="button"
          onClick={refresh}
          className="px-2 text-muted-foreground hover:text-foreground"
          title="Ganti soal"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      {touched && !ok && val.length > 0 && (
        <p className="text-[11px] text-rose-400 mt-1">Jawaban salah, coba lagi.</p>
      )}
    </div>
  );
}
