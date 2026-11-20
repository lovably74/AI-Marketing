"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 아래 대체 방식으로 진행
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function CopyButton({ text, label = "복사" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "done" | "fail">("idle");
  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await copyText(text);
        setState(ok ? "done" : "fail");
        setTimeout(() => setState("idle"), 1800);
      }}
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-line bg-white px-2.5 py-1 text-xs font-medium text-navy-deep hover:border-brand hover:text-brand"
      aria-label={label.includes("복사") ? label : `${label} 복사`}
    >
      {state === "done" ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
      {state === "done" ? "복사됨" : state === "fail" ? "복사 실패" : label}
    </button>
  );
}
