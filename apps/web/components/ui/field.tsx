"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

interface FieldProps {
  label?: string
  error?: string
  description?: string
  required?: boolean
  className?: string
  children?: React.ReactNode
}

interface InputFieldProps extends FieldProps, Omit<React.ComponentProps<typeof Input>, "className"> {
  type?: "text" | "email" | "password" | "number" | "tel" | "url"
}

interface TextareaFieldProps extends FieldProps, Omit<React.ComponentProps<typeof Textarea>, "className"> {}

// Base Field wrapper component
export function Field({ label, error, description, required, className, children }: FieldProps) {
  const id = React.useId()

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label
          htmlFor={id}
          className={cn(
            "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
            error && "text-destructive",
          )}
        >
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}

      <div className="relative">
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child, {
              id,
              "aria-describedby": description || error ? `${id}-description` : undefined,
              "aria-invalid": !!error,
              className: cn(child.props.className, error && "border-destructive focus-visible:ring-destructive"),
            } as any)
          }
          return child
        })}
      </div>

      {(description || error) && (
        <div id={`${id}-description`} className="space-y-1">
          {description && !error && <p className="text-sm text-muted-foreground">{description}</p>}
          {error && <p className="text-sm text-destructive font-medium">{error}</p>}
        </div>
      )}
    </div>
  )
}

// Input Field component
export function InputField({
  label,
  error,
  description,
  required,
  className,
  type = "text",
  ...props
}: InputFieldProps) {
  return (
    <Field label={label} error={error} description={description} required={required} className={className}>
      <Input type={type} {...props} />
    </Field>
  )
}

// Textarea Field component
export function TextareaField({ label, error, description, required, className, ...props }: TextareaFieldProps) {
  return (
    <Field label={label} error={error} description={description} required={required} className={className}>
      <Textarea {...props} />
    </Field>
  )
}
