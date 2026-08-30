import { NextRequest, NextResponse } from "next/server";
import {
  buildContentSecurityPolicy,
  createCspNonce,
  setBaselineSecurityHeaders,
} from "@/lib/security-headers";
import { PRODUCTION_WEB_ORIGIN } from "@/lib/app-config";

export function proxy(request: NextRequest) {
  const isApiRequest = request.nextUrl.pathname.startsWith("/api/");
  const isDevelopment = process.env.NODE_ENV === "development";
  const isProduction = process.env.NODE_ENV === "production";

  if (isApiRequest && request.method === "OPTIONS") {
    const response = new NextResponse(null, {
      status: 204,
      headers: corsHeaders(),
    });
    setBaselineSecurityHeaders(response.headers, { isProduction });
    return response;
  }

  let response: NextResponse;
  if (isApiRequest) {
    response = NextResponse.next();
    setCorsHeaders(response.headers);
  } else {
    const nonce = createCspNonce();
    const contentSecurityPolicy = buildContentSecurityPolicy(nonce, { isDevelopment });
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

    response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  }

  setBaselineSecurityHeaders(response.headers, { isProduction });
  return response;
}

function setCorsHeaders(headers: Headers) {
  for (const [key, value] of Object.entries(corsHeaders())) {
    headers.set(key, value);
  }
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": PRODUCTION_WEB_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin",
  };
}

export const config = {
  matcher: [
    "/api/:path*",
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
