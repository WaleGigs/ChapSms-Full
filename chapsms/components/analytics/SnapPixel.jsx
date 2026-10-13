"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";

const PIXEL_ID = process.env.NEXT_PUBLIC_SNAP_PIXEL_ID;

export default function SnapPixel() {
  const pathname = usePathname();

  useEffect(() => {
    if (!PIXEL_ID || typeof window.snaptr !== "function") {
      return;
    }

    window.snaptr("track", "PAGE_VIEW");
  }, [pathname]);

  if (!PIXEL_ID) return null;

  return (
    <Script
      id="snap-pixel-base"
      strategy="afterInteractive"
      onReady={() => {
        if (typeof window.snaptr !== "function") return;

        if (!window.__chapSmsSnapInitialized) {
          window.snaptr("init", PIXEL_ID, {});
          window.__chapSmsSnapInitialized = true;
        }
      }}
    >
      {`
        (function(e,t,n){
          if(e.snaptr)return;
          var a=e.snaptr=function(){
            a.handleRequest
              ? a.handleRequest.apply(a,arguments)
              : a.queue.push(arguments);
          };
          a.queue=[];
          var s=t.createElement("script");
          s.async=true;
          s.src=n;
          var u=t.getElementsByTagName("script")[0];
          u.parentNode.insertBefore(s,u);
        })(window,document,"https://sc-static.net/scevent.min.js");
      `}
    </Script>
  );
}