// components/ui/CountUp.jsx
"use client";

import { useEffect, useState } from "react";

export default function CountUp({ value = 0, prefix = "", suffix = "" }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const target = Number(value) || 0;
    let start = 0;
    const duration = 900;
    const increment = target / (duration / 16);

    const timer = setInterval(() => {
      start += increment;

      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, 16);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <>
      {prefix}
      {count.toLocaleString(undefined, {
        maximumFractionDigits: value % 1 !== 0 ? 2 : 0,
      })}
      {suffix}
    </>
  );
}