"use client";

import { useEffect, useState } from "react";
import { orderStatusService } from "@/services/orderStatusService";

export function useOrderStatus(initialStatus = "Waiting for SMS") {
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    return orderStatusService.subscribe((order) => {
      setStatus(order.status);
    });
  }, []);

  return {
    status,
    setStatus,
  };
}