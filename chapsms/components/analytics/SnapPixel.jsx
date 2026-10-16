"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";

const PIXEL_ID = process.env.NEXT_PUBLIC_SNAP_PIXEL_ID;

const SNAP_BASE_CODE = `
(function(e,t,n){
  if(e.snaptr)return;
  var a=e.snaptr=function(){
    a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)
  };
  a.queue=[];
  var s=t.createElement('script');
  s.async=true;
  s.src=n;
  var u=t.getElementsByTagName('script')[0];
  if(u&&u.parentNode){u.parentNode.insertBefore(s,u)}
  else{(t.head||t.documentElement).appendChild(s)}
})(window,document,'https://sc-static.net/scevent.min.js');
`;

export default function SnapPixel() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const query = searchParams?.toString() || "";

  useEffect(() => {
    if (!ready || !PIXEL_ID || typeof window.snaptr !== "function") return;
    window.snaptr("track", "PAGE_VIEW");
  }, [ready, pathname, query]);

  if (!PIXEL_ID) return null;

  return (
    <Script
      id="snap-pixel-base-code"
      strategy="afterInteractive"
      onReady={() => {
        window.snaptr?.("init", PIXEL_ID, {});
        setReady(true);
      }}
    >
      {SNAP_BASE_CODE}
    </Script>
  );
}
