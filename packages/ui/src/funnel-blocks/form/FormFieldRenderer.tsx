import * as React from "react";
import { Input } from "../../primitives/input";
import { Label } from "../../primitives/label";
import { Textarea } from "../../primitives/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../primitives/select";
import { Checkbox } from "../../primitives/checkbox";
import { RadioGroup, RadioGroupItem } from "../../primitives/radio";
import type { ResolvedFormField } from "../types";

/**
 * Internal: maps a ResolvedFormField to its concrete input. Used by every
 * form block so we don't duplicate field-type switches.
 */
export interface FormFieldRendererProps {
  field: ResolvedFormField;
  value?: string;
  onChange?: (value: string) => void;
  errorMessage?: string;
}

export function FormFieldRenderer({ field, value, onChange, errorMessage }: FormFieldRendererProps): JSX.Element | null {
  if (field.type === "hidden") {
    return <input type="hidden" name={field.name} value={value ?? field.default_value ?? ""} />;
  }
  const inputId = `field-${field.id}`;
  const descId = field.help_text ? `${inputId}-help` : undefined;
  const errId = errorMessage ? `${inputId}-err` : undefined;
  const described = [descId, errId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-2">
      {field.type !== "checkbox" && field.type !== "consent" && (
        <Label htmlFor={inputId} required={field.required}>
          {field.label}
        </Label>
      )}
      {renderControl(field, { value, onChange, inputId, described, errorMessage })}
      {field.help_text && (
        <p id={descId} className="text-body-sm text-slate-500">
          {field.help_text}
        </p>
      )}
      {errorMessage && (
        <p id={errId} className="text-body-sm font-medium text-error-600" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

function renderControl(
  field: ResolvedFormField,
  ctx: { value?: string; onChange?: (v: string) => void; inputId: string; described?: string; errorMessage?: string },
): JSX.Element {
  const common = {
    id: ctx.inputId,
    name: field.name,
    "aria-describedby": ctx.described,
    "aria-invalid": ctx.errorMessage ? true : undefined,
    "aria-required": field.required || undefined,
    required: field.required,
    placeholder: field.placeholder,
  };
  switch (field.type) {
    case "textarea":
      return (
        <Textarea
          {...common}
          value={ctx.value ?? ""}
          onChange={(e) => ctx.onChange?.(e.target.value)}
          minLength={field.validation?.min_length}
          maxLength={field.validation?.max_length}
        />
      );
    case "select":
      return (
        <Select value={ctx.value ?? ""} onValueChange={(v) => ctx.onChange?.(v)}>
          <SelectTrigger id={ctx.inputId} aria-describedby={ctx.described} aria-invalid={ctx.errorMessage ? true : undefined}>
            <SelectValue placeholder={field.placeholder ?? "Select…"} />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "radio":
      return (
        <RadioGroup value={ctx.value} onValueChange={(v) => ctx.onChange?.(v)}>
          {field.options?.map((o) => (
            <label key={o.value} className="flex items-center gap-2 text-body-sm">
              <RadioGroupItem value={o.value} id={`${ctx.inputId}-${o.value}`} />
              <span>{o.label}</span>
            </label>
          ))}
        </RadioGroup>
      );
    case "checkbox":
    case "consent":
      return (
        <div className="flex items-start gap-2">
          <Checkbox
            id={ctx.inputId}
            name={field.name}
            checked={ctx.value === "true"}
            onCheckedChange={(c) => ctx.onChange?.(c === true ? "true" : "false")}
            required={field.required}
          />
          <Label htmlFor={ctx.inputId} className="text-body-sm leading-tight">
            {field.label}
            {field.required && (
              <>
                <span aria-hidden="true" className="ml-1 text-error-500">*</span>
                <span className="sr-only"> required</span>
              </>
            )}
          </Label>
        </div>
      );
    case "tel":
      return (
        <Input
          {...common}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={ctx.value ?? ""}
          onChange={(e) => ctx.onChange?.(e.target.value)}
        />
      );
    case "email":
      return (
        <Input
          {...common}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={ctx.value ?? ""}
          onChange={(e) => ctx.onChange?.(e.target.value)}
        />
      );
    case "number":
      return (
        <Input
          {...common}
          type="number"
          inputMode="decimal"
          min={field.validation?.min}
          max={field.validation?.max}
          value={ctx.value ?? ""}
          onChange={(e) => ctx.onChange?.(e.target.value)}
        />
      );
    case "date":
      return <Input {...common} type="date" value={ctx.value ?? ""} onChange={(e) => ctx.onChange?.(e.target.value)} />;
    case "time":
      return <Input {...common} type="time" value={ctx.value ?? ""} onChange={(e) => ctx.onChange?.(e.target.value)} />;
    case "file":
      return <Input {...common} type="file" />;
    default:
      return <Input {...common} type="text" value={ctx.value ?? ""} onChange={(e) => ctx.onChange?.(e.target.value)} />;
  }
}
