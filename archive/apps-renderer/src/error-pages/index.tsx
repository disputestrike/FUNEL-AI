/**
 * Branded 404 / 500 / 429 error pages. Pure-static, no funnel context, so
 * they're cheap and safe to render in any failure path.
 */

import * as React from "react";

const globalStyles = `
*,*:before,*:after{box-sizing:border-box}
html,body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#0f172a;background:linear-gradient(180deg,#fafafa 0,#f3f4f6 100%);min-height:100vh}
.wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.card{max-width:560px;width:100%;background:#fff;border-radius:16px;padding:48px 32px;box-shadow:0 1px 2px rgba(0,0,0,0.04),0 12px 32px rgba(0,0,0,0.06);text-align:center}
.code{font-size:14px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6366f1;margin-bottom:16px}
h1{font-size:28px;font-weight:700;margin:0 0 12px;letter-spacing:-0.01em}
p{font-size:16px;line-height:1.6;margin:8px 0;color:#475569}
.muted{font-size:14px;color:#94a3b8;margin-top:24px}
a.btn{display:inline-block;margin-top:16px;padding:10px 18px;border-radius:9999px;background:#0f172a;color:#fff;text-decoration:none;font-weight:600;font-size:15px}
`;

interface ErrorBaseProps {
  code: number;
  title: string;
  body: string;
  homeUrl: string;
  ctaLabel?: string;
}

function ErrorBase(props: ErrorBaseProps): React.ReactElement {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex,follow" />
        <title>{`${props.code} — ${props.title}`}</title>
        <style>{globalStyles}</style>
      </head>
      <body>
        <main className="wrap">
          <div className="card">
            <div className="code">Error {props.code}</div>
            <h1>{props.title}</h1>
            <p>{props.body}</p>
            <a className="btn" href={props.homeUrl}>{props.ctaLabel ?? "Go home"}</a>
            <p className="muted">gofunnelai.com</p>
          </div>
        </main>
      </body>
    </html>
  );
}

export function NotFoundPage(homeUrl: string): React.ReactElement {
  return (
    <ErrorBase
      code={404}
      title="We couldn't find that page"
      body="The link you followed may be broken, or the page may have been moved."
      homeUrl={homeUrl}
    />
  );
}

export function ServerErrorPage(homeUrl: string, requestId: string): React.ReactElement {
  return (
    <ErrorBase
      code={500}
      title="Something went wrong on our end"
      body={`Try refreshing the page. If the problem persists, contact support and reference request id ${requestId}.`}
      homeUrl={homeUrl}
    />
  );
}

export function RateLimitPage(homeUrl: string): React.ReactElement {
  return (
    <ErrorBase
      code={429}
      title="You're going a little too fast"
      body="Please wait a moment and try again."
      homeUrl={homeUrl}
    />
  );
}
