import { clerkMiddleware } from "@clerk/nextjs/server";

// `createRouteMatcher`-based protection here is deprecated: path matching in
// the proxy layer can diverge from actual routing. Real protection lives as
// a resource-based check in each protected page (see app/dashboard/page.tsx).
// This just makes Clerk's auth context available to every request.
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
