/**
 * BizAlign Fleet — Mock Inspection API
 * AR Experts Ltd · take-home task support server
 *
 * Zero dependencies. Requires Node 18+.
 *
 *   node mock-server.js
 *   → http://localhost:4000
 *
 * This server deliberately misbehaves. That is intentional and is part of
 * the exercise — see the failure modes below.
 *
 * Endpoints
 *   GET    /vehicles          List of fleet vehicles.
 *   POST   /inspections       Submit an inspection. Unreliable — see below.
 *   GET    /inspections       Everything the server has actually stored.
 *                             Use this to check what really landed.
 *   DELETE /inspections       Clear stored inspections (handy between runs).
 *   GET    /health            Server status and current failure counters.
 *
 * Failure behaviour on POST /inspections (roughly, per request):
 *   ~30%  500 Internal Server Error — nothing is stored.
 *   ~10%  Timeout — the request hangs and never responds. Nothing is stored.
 *   ~10%  Phantom success — the inspection IS stored, but the connection is
 *         destroyed before the response reaches the client. The client sees a
 *         network error for a request that actually succeeded.
 *   ~50%  201 Created, as documented.
 *
 * Set FAILURE_RATE=0 to disable all failure injection while developing:
 *   FAILURE_RATE=0 node mock-server.js
 */

const http = require("node:http");
const { randomUUID } = require("node:crypto");

const PORT = process.env.PORT || 4000;
const FAILURES_ENABLED = process.env.FAILURE_RATE !== "0";

const VEHICLES = [
  { id: "veh_001", registration: "MA21 XKD", make: "Ford",             model: "Transit Custom" },
  { id: "veh_002", registration: "MJ70 LTV", make: "Mercedes-Benz",    model: "Sprinter" },
  { id: "veh_003", registration: "MF22 RPB", make: "Volkswagen",       model: "Crafter" },
  { id: "veh_004", registration: "MK19 ZNC", make: "Renault",          model: "Master" },
  { id: "veh_005", registration: "MB23 HWG", make: "Ford",             model: "Ranger" },
  { id: "veh_006", registration: "MD20 TQS", make: "Vauxhall",         model: "Vivaro" },
];

const inspections = [];
const counters = { created: 0, error500: 0, timeout: 0, phantom: 0 };

const json = (res, status, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
    "Access-Control-Allow-Origin": "*",
  });
  res.end(payload);
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });

/** Decide what this particular POST is going to do. */
function rollOutcome() {
  if (!FAILURES_ENABLED) return "success";
  const r = Math.random();
  if (r < 0.30) return "error500";
  if (r < 0.40) return "timeout";
  if (r < 0.50) return "phantom";
  return "success";
}

function storeInspection(body) {
  const record = {
    id: randomUUID(),
    vehicleId: body.vehicleId ?? null,
    items: body.items ?? {},
    notes: body.notes ?? "",
    completedAt: body.completedAt ?? null,
    // Client-supplied identifier, if there is one. Echoed back untouched.
    clientId: body.clientId ?? body.id ?? null,
    syncedAt: new Date().toISOString(),
  };
  inspections.push(record);
  return record;
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  const method = req.method.toUpperCase();

  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  if (method === "GET" && pathname === "/health") {
    return json(res, 200, {
      status: "ok",
      failureInjection: FAILURES_ENABLED ? "enabled" : "disabled",
      storedInspections: inspections.length,
      counters,
    });
  }

  if (method === "GET" && pathname === "/vehicles") {
    return json(res, 200, VEHICLES);
  }

  if (method === "GET" && pathname === "/inspections") {
    return json(res, 200, inspections);
  }

  if (method === "DELETE" && pathname === "/inspections") {
    inspections.length = 0;
    Object.keys(counters).forEach((k) => (counters[k] = 0));
    return json(res, 200, { cleared: true });
  }

  if (method === "POST" && pathname === "/inspections") {
    let body;
    try {
      body = await readBody(req);
    } catch (err) {
      return json(res, 400, { error: err.message });
    }

    switch (rollOutcome()) {
      case "error500":
        counters.error500++;
        console.log(`  500  vehicle=${body.vehicleId ?? "?"}  (not stored)`);
        return json(res, 500, { error: "Internal Server Error" });

      case "timeout":
        counters.timeout++;
        console.log(`  ...  vehicle=${body.vehicleId ?? "?"}  (hanging, no response)`);
        return; // deliberately never responds

      case "phantom": {
        // Stored server-side, but the client never learns that.
        const record = storeInspection(body);
        counters.phantom++;
        console.log(`  ???  vehicle=${body.vehicleId ?? "?"}  STORED as ${record.id}, connection dropped`);
        return res.destroy();
      }

      default: {
        const record = storeInspection(body);
        counters.created++;
        console.log(`  201  vehicle=${body.vehicleId ?? "?"}  stored as ${record.id}`);
        return json(res, 201, {
          id: record.id,
          vehicleId: record.vehicleId,
          syncedAt: record.syncedAt,
        });
      }
    }
  }

  return json(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`\nBizAlign Fleet mock API — http://localhost:${PORT}`);
  console.log(`Failure injection: ${FAILURES_ENABLED ? "ENABLED" : "disabled"}`);
  console.log(`\n  GET    /vehicles       list vehicles`);
  console.log(`  POST   /inspections    submit an inspection (unreliable)`);
  console.log(`  GET    /inspections    what the server actually stored`);
  console.log(`  DELETE /inspections    clear stored inspections`);
  console.log(`  GET    /health         status and failure counters\n`);
});
