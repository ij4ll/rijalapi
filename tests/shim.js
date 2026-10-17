// Pengganti ringan express/cors/helmet/express-rate-limit.
// Hanya dipakai bila paket aslinya belum terpasang (mis. sandbox tanpa internet).
// Bila `npm install` sudah dijalankan, paket asli yang dipakai dan file ini diabaikan.
const Module = require("module");
const { URL } = require("url");

const express = () => {
  const stack = [];
  const app = (req, res) => {
    const u = new URL(req.url, "http://localhost");
    req.path = u.pathname;
    req.query = Object.fromEntries(u.searchParams);
    req.ip = "127.0.0.1";
    req.params = {};
    res.statusCode = 200;
    res.status = (n) => ((res.statusCode = n), res);
    res.set = (k, v) => { if (typeof k === "object") for (const [a, b] of Object.entries(k)) res.setHeader(a, b); else res.setHeader(k, v); return res; };
    res.type = (t) => res.set("Content-Type", t === "text" ? "text/plain" : t === "json" ? "application/json" : t);
    res.json = (o) => { res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify(o)); return res; };
    res.send = (b) => { res.end(b); return res; };
    res.redirect = (c, url) => { res.statusCode = c; res.setHeader("Location", url); res.end(); };
    let i = 0;
    const next = async (err) => {
      const l = stack[i++];
      if (!l) return err ? res.status(500).json({ error: String(err) }) : res.status(404).end();
      if (l.method && l.method !== "*" && l.method !== req.method && !(l.method === "GET" && req.method === "HEAD")) return next(err);
      let params = {};
      if (l.path) {
        const keys = [];
        const re = new RegExp("^" + l.path.replace(/:([a-z]+)/gi, (_, k) => (keys.push(k), "([^/]+)")) + (l.method ? "$" : "(?:/|$)"));
        const m = re.exec(req.path);
        if (!m) return next(err);
        keys.forEach((k, n) => (params[k] = decodeURIComponent(m[n + 1])));
      }
      req.params = { ...req.params, ...params };
      try {
        if (l.fn.length === 4) return err ? await l.fn(err, req, res, next) : next();
        if (err) return next(err);
        await l.fn(req, res, next);
      } catch (e) { next(e); }
    };
    next();
  };
  app.set = app.disable = () => {};
  app.use = (a, ...fns) => (typeof a === "string" ? fns.forEach((fn) => stack.push({ path: a, fn })) : [a, ...fns].forEach((fn) => stack.push({ fn })));
  app.get = (path, ...fns) => fns.forEach((fn) => stack.push({ method: "GET", path, fn }));
  app.all = (path, ...fns) => fns.forEach((fn) => stack.push({ method: "*", path, fn }));
  app.listen = (p, cb) => require("http").createServer(app).listen(p, cb);
  return app;
};
express.static = () => (req, res, next) => next();
const readBody = (req) => new Promise((r) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => r(Buffer.concat(c).toString())); });
const badBody = () => Object.assign(new Error("bad body"), { type: "entity.parse.failed", status: 400 });
express.json = () => async (req, res, next) => {
  if (req.method !== "POST" || !/json/.test(req.headers["content-type"] || "")) return next();
  const t = await readBody(req);
  try { req.body = t ? JSON.parse(t) : {}; } catch { return next(badBody()); }
  next();
};
express.urlencoded = () => async (req, res, next) => {
  if (req.method !== "POST" || !/urlencoded/.test(req.headers["content-type"] || "")) return next();
  req.body = Object.fromEntries(new URLSearchParams(await readBody(req)));
  next();
};

const shims = {
  express,
  cors: () => (req, res, next) => next(),
  helmet: () => (req, res, next) => next(),
  "express-rate-limit": () => (req, res, next) => (typeof next === "function" ? next() : undefined),
};

const load = Module._load;
Module._load = function (request, ...rest) {
  if (shims[request]) {
    try { return load.call(this, request, ...rest); } catch (e) { if (e.code !== "MODULE_NOT_FOUND") throw e; return shims[request]; }
  }
  return load.call(this, request, ...rest);
};
