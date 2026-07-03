import http from "node:http";

const origin = new URL(
  process.env.SYNCPOST_ORIGIN || "http://127.0.0.1:3000",
);

const host = process.env.SYNCPOST_GATEWAY_HOST || "127.0.0.1";
const port = Number(process.env.PORT || "3002");

if (origin.protocol !== "http:") {
  throw new Error("SYNCPOST_ORIGIN must use http:// for the local upstream.");
}

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a valid TCP port.");
}

const mediaPath = /^\/api\/media\/[A-Za-z0-9_-]{32,128}$/;

function isAllowed(method, pathname) {
  if (pathname === "/api/auth/instagram/callback") {
    return method === "GET";
  }

  return mediaPath.test(pathname) && (method === "GET" || method === "HEAD");
}

const server = http.createServer((request, response) => {
  const incomingUrl = new URL(
    request.url || "/",
    "http://syncpost-gateway.local",
  );

  if (!isAllowed(request.method || "GET", incomingUrl.pathname)) {
    response.writeHead(404, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end("Not found.\n");
    return;
  }

  const headers = { ...request.headers };

  delete headers.host;
  delete headers.connection;

  headers.host = origin.host;
  headers["x-forwarded-proto"] = "https";
  headers["x-forwarded-host"] = request.headers.host || "";

  const upstreamRequest = http.request(
    {
      protocol: origin.protocol,
      hostname: origin.hostname,
      port: origin.port || 80,
      method: request.method,
      path: `${incomingUrl.pathname}${incomingUrl.search}`,
      headers,
    },
    (upstreamResponse) => {
      const responseHeaders = { ...upstreamResponse.headers };

      delete responseHeaders.connection;

      response.writeHead(upstreamResponse.statusCode || 502, responseHeaders);
      upstreamResponse.pipe(response);
    },
  );

  upstreamRequest.setTimeout(120000, () => {
    upstreamRequest.destroy(new Error("Upstream request timed out."));
  });

  upstreamRequest.on("error", (error) => {
    console.error(`Gateway upstream error: ${error.message}`);

    if (!response.headersSent) {
      response.writeHead(502, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end("SyncPost upstream is unavailable.\n");
    } else {
      response.end();
    }
  });

  request.pipe(upstreamRequest);
});

server.on("clientError", (error, socket) => {
  console.error(`Gateway client error: ${error.message}`);
  socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

server.listen(port, host, () => {
  console.log(
    `SyncPost public gateway listening on http://${host}:${port} → ${origin.origin}`,
  );
});
