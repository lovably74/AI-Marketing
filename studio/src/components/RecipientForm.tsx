"use client";

import type { RecipientInfo } from "@/lib/deliver-types";
import { isValidEmail } from "@/lib/mail/compose";

const FIELDS: { key: keyof RecipientInfo; label: string; placeholder: string; type?: string; max: number }[] = [
  { key: "name", label: "이름", placeholder: "홍길동", max: 50 },
  { key: "company", label: "회사명", placeholder: "㈜예시상사", max: 100 },
  { key: "title", label: "직함", placeholder: "팀장", max: 50 },
  { key: "department", label: "부서명", placeholder: "영업지원팀", max: 100 },
  { key: "email", label: "이메일", placeholder: "customer@example.com", type: "email", max: 254 },
  { key: "phone", label: "연락처", placeholder: "010-0000-0000", type: "tel", max: 30 },
];

export function RecipientForm({ value, onChange }: { value: RecipientInfo; onChange: (v: RecipientInfo) => void }) {
  const emailTouched = value.email.trim() !== "";
  const emailOk = isValidEmail(value.email);

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold text-navy-deep">수신 고객 정보</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => {
          const required = f.key === "email";
          const invalid = required && emailTouched && !emailOk;
          const id = `recipient-${f.key}`;
          return (
            <label key={f.key} htmlFor={id} className="block text-xs font-medium text-navy-deep">
              {f.label}
              {required ? <span className="ml-0.5 text-red-600">*</span> : <span className="ml-1 text-gray-400">(선택)</span>}
              <input
                id={id}
                type={f.type ?? "text"}
                value={value[f.key]}
                maxLength={f.max}
                required={required}
                placeholder={f.placeholder}
                autoComplete="off"
                aria-invalid={invalid || undefined}
                aria-describedby={invalid ? `${id}-err` : undefined}
                onChange={(e) => onChange({ ...value, [f.key]: e.target.value.replace(/[\r\n]/g, "") })}
                className={`mt-1 block w-full rounded-md border bg-white px-3 py-2 text-sm text-navy-deep outline-none focus:border-brand ${
                  invalid ? "border-red-500" : "border-line"
                }`}
              />
              {invalid && (
                <span id={`${id}-err`} className="mt-1 block text-xs text-red-600">
                  이메일 형식이 올바르지 않습니다.
                </span>
              )}
            </label>
          );
        })}
      </div>
      <p className="text-xs text-gray-500">
        입력한 고객 정보는 메일 발송과 PDF 표지에만 쓰이며 AI에는 보내지 않습니다. 메일 발신자 연락처는 티링크 공식
        연락처(1877-3836, www.tlinkcrm.com)로 표시됩니다.
      </p>
    </fieldset>
  );
}
