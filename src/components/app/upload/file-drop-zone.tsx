"use client";

import { useRef, useState, useCallback } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileDropZoneProps {
  onFiles: (files: File[]) => void;
  allowMultiple?: boolean;
  accept?: string;
  label?: string;
  hint?: string;
  className?: string;
  compact?: boolean;
}

export function FileDropZone({
  onFiles,
  allowMultiple = false,
  accept = ".json,application/json",
  label = "Drop file here or click to browse",
  hint,
  className,
  compact = false,
}: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const files = Array.from(fileList);
      onFiles(allowMultiple ? files : [files[0]]);
      if (inputRef.current) inputRef.current.value = "";
    },
    [allowMultiple, onFiles],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "group relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors",
        "border-border-strong bg-card hover:border-primary hover:bg-primary-subtle/50",
        "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--ring)]",
        compact ? "p-3" : "p-5",
        isDragging && "border-primary bg-primary-subtle",
        className,
      )}
      aria-label={label}
    >
      <UploadCloud
        className={cn(
          "mb-1 text-muted-foreground transition-colors group-hover:text-primary",
          compact ? "h-4 w-4" : "h-5 w-5",
        )}
      />
      <p
        className={cn(
          "text-center font-medium text-foreground",
          compact ? "text-xs" : "text-sm",
        )}
      >
        {label}
      </p>
      {hint ? (
        <p className="mt-1 text-center text-xs text-muted-foreground">{hint}</p>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={allowMultiple}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
