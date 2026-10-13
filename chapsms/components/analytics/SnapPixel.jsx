"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";

const PIXEL_ID = "fbbe3840-f909-45e4-8fcd-be741f6e255f";

export default function SnapPixel() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window.snaptr !== "function") return;

    window.snaptr("track", "PAGE_VIEW");
  }, [pathname]);

  return (
    <Script
      id="snapchat-pixel"
      strategy="afterInteractive"
      onReady={() => {
        if (typeof window.snaptr === "function") {
          window.snaptr("init", PIXEL_ID, {});
          window.snaptr("track", "PAGE_VIEW");
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

          var r=t.createElement('script');
          r.async=true;
          r.src=n;

          var u=t.getElementsByTagName('script')[0];
          u.parentNode.insertBefore(r,u);

        })(window,document,'https://sc-static.net/scevent.min.js');
      `}
    </Script>
  );
}