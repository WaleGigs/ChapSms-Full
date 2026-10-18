"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const PIXEL_ID = "fbbe3840-f909-45e4-8fcd-be741f6e255f";

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

snaptr('init', ${JSON.stringify(PIXEL_ID)}, {});
snaptr('track', 'PAGE_VIEW');
`;

// Rendered in the root layout's <head> so it ships in the server HTML and runs on page load.
// Keep it out of any Suspense boundary: React inserts client-rendered inline scripts inert.
export default function SnapPixel() {
  return (
    <script
      id="snap-pixel-base-code"
      dangerouslySetInnerHTML={{ __html: SNAP_BASE_CODE }}
    />
  );
}

// The base code reports the first page view; this reports client-side navigations after it.
export function SnapPageViews() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams?.toString() || "";
  const firstRef = useRef(true);

  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      return;
    }
    if (typeof window.snaptr === "function") window.snaptr("track", "PAGE_VIEW");
  }, [pathname, query]);

  return null;
}
