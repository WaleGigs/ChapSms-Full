"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { MoreVertical, Copy, RotateCcw, XCircle, Eye } from "lucide-react";

export default function RowActions({ otp, onRetry, onCancel, onDetails }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function copyOTP() {
    if (!otp || otp === "Waiting" || otp === "Expired") {
      toast.error("No OTP available to copy");
      setOpen(false);
      return;
    }

    await navigator.clipboard.writeText(otp);
    toast.success("OTP copied successfully");
    setOpen(false);
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="rounded-lg p-2 transition hover:bg-[var(--background)]"
      >
        <MoreVertical size={18} />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-52 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-2xl">
          <button
            onClick={copyOTP}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold hover:bg-[var(--background)]"
          >
            <Copy size={16} />
            Copy OTP
          </button>

          <button
            onClick={() => {
              onRetry?.();
              toast.success("Retry request prepared");
              setOpen(false);
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold hover:bg-[var(--background)]"
          >
            <RotateCcw size={16} />
            Retry Order
          </button>

          <button
            onClick={() => {
              onDetails?.();
              toast.success("Opening order details");
              setOpen(false);
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold hover:bg-[var(--background)]"
          >
            <Eye size={16} />
            View Details
          </button>

          <button
            onClick={() => {
              onCancel?.();
              toast.error("Cancel request prepared");
              setOpen(false);
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            <XCircle size={16} />
            Cancel Order
          </button>
        </div>
      )}
    </div>
  );
}