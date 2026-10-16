"use client";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { captureAcquisition } from "@/lib/acquisition";
export default function AcquisitionCapture() {
  const pathname = usePathname();
  const params = useSearchParams();
  useEffect(() => { captureAcquisition(); }, [pathname, params]);
  return null;
}
