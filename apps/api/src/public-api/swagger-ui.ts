/**
 * Serves Swagger UI as an interactive playground at GET /v1/docs.
 * Pulls the spec from the live /v1/openapi.json â€” never bundles it.
 */

import type { Hono } from "hono";
import type { HonoEnv } from "../lib/context.js";

const HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>GoFunnelAI API â€” Playground</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href="https://gofunnelai.com/favicon.ico" />
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui.css"
    />
    <style>
      body { margin: 0; background: #0b0c0e; }
      .swagger-ui .topbar { display: none; }
    </style>
  </head>
  <body>
    <div id="swagger"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-bundle.js" crossorigin></script>
    <script>
      window.onload = () =>
        SwaggerUIBundle({
          url: "/v1/openapi.json",
          dom_id: "#swagger",
          presets: [SwaggerUIBundle.presets.apis],
          layout: "BaseLayout",
          deepLinking: true,
          persistAuthorization: true,
          tryItOutEnabled: true,
        });
    </script>
  </body>
</html>`;

export const mountSwaggerUi = (app: Hono<HonoEnv>) => {
  app.get("/docs", (c) =>
    c.html(HTML, 200, {
      "Cache-Control": "public, max-age=300",
    }),
  );
};
