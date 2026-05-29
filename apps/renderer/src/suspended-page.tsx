/**
 * The page we serve when a workspace is suspended, past-due, or closed.
 *
 * Status-code policy: 503 Service Unavailable with a long `Retry-After`. We
 * do NOT return 404 — leads should not be captured, but search engines
 * shouldn't drop the page from their index entirely (the workspace may pay
 * their invoice tomorrow).
 *
 * No CTA, no form, no analytics. This is a true placeholder.
 */

import * as React from "react";

export interface SuspendedPageProps {
  /** What status drove this — surfaced to support but not to visitors. */
  status: "suspended" | "past_due" | "closed" | "blocked";
  contactEmail: string;
}

export function SuspendedPage(props: SuspendedPageProps): React.ReactElement {
  const headline =
    props.status === "closed"
      ? "This page is no longer available"
      : "This page is temporarily unavailable";
  const body =
    props.status === "closed"
      ? "The site owner has closed this account. If you reached this page from a link or ad, please contact them directly."
      : "The site owner needs to take an action on their account before this page can be shown again. Please check back later.";

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex,follow" />
        <title>Page temporarily unavailable</title>
        <style>{globalStyles}</style>
      </head>
      <body>
        <main className="wrap">
          <div className="card">
            <div className="brand">gofunnelai.com</div>
            <h1>{headline}</h1>
            <p>{body}</p>
            <p className="muted">
              If you're the site owner,{" "}
              <a href={`mailto:${props.contactEmail}`}>contact support</a> for help.
            </p>
          </div>
        </main>
      </body>
    </html>
  );
}

const globalStyles = `
*,*:before,*:after{box-sizing:border-box}
html,body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;background:#fafafa}
.wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.card{max-width:520px;width:100%;background:#fff;border-radius:16px;padding:48px 32px;box-shadow:0 1px 2px rgba(0,0,0,0.04),0 8px 24px rgba(0,0,0,0.06);text-align:center}
.brand{font-weight:700;font-size:14px;letter-spacing:0.06em;text-transform:uppercase;color:#666;margin-bottom:24px}
h1{font-size:24px;font-weight:700;margin:0 0 12px}
p{font-size:16px;line-height:1.6;margin:8px 0;color:#444}
.muted{font-size:14px;color:#888}
a{color:#1a1a1a;text-decoration:underline}
`;
