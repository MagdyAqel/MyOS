import { RoomCore } from "./room-core.js";
const json = (data, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const token = () => crypto.randomUUID().replaceAll("-", "");
const allowed = (request, env) =>
  String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .includes(request.headers.get("Origin"));
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET")
      return json({ ok: true, protocol: 1 });
    if (!allowed(request, env))
      return json({ error: "أصل الاتصال غير مسموح" }, 403);
    const cors = {
      "Access-Control-Allow-Origin": request.headers.get("Origin"),
      "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      Vary: "Origin",
    };
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: cors });
    try {
      let response;
      if (url.pathname === "/rooms" && request.method === "POST") {
        if (Number(request.headers.get("Content-Length") || 0) > 1024)
          return json({ error: "طلب كبير" }, 413);
        const raw = await request.text();
        if (raw.length > 1024) return json({ error: "طلب كبير" }, 413);
        const data = JSON.parse(raw),
          ip = request.headers.get("CF-Connecting-IP") || "local";
        const hash = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(ip),
        );
        const bucket = Array.from(new Uint8Array(hash))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        const permit = await env.ROOMS.getByName("_gate").fetch(
          new Request("https://internal/permit", {
            method: "POST",
            headers: { "X-Bucket": bucket },
          }),
        );
        if (!permit.ok)
          response = json({ error: "انتظر قليلًا قبل إنشاء غرفة أخرى" }, 429);
        else {
          const room = token();
          response = await env.ROOMS.getByName(room).fetch(
            new Request("https://internal/init", {
              method: "POST",
              body: JSON.stringify({ ...data, room }),
            }),
          );
        }
      } else {
        const match = url.pathname.match(
          /^\/rooms\/([a-f0-9]{32})\/(join|ws)$/,
        );
        if (!match)
          return new Response(JSON.stringify({ error: "مسار غير موجود" }), {
            status: 404,
            headers: { ...cors, "Content-Type": "application/json" },
          });
        const path = match[2];
        if (
          (path === "join" && request.method !== "POST") ||
          (path === "ws" &&
            request.headers.get("Upgrade")?.toLowerCase() !== "websocket")
        )
          return json({ error: "طلب غير صالح" }, 400);
        response = await env.ROOMS.getByName(match[1]).fetch(
          new Request("https://internal/" + path, request),
        );
      }
      if (response.status === 101) return response;
      const headers = new Headers(response.headers);
      for (const [k, v] of Object.entries(cors)) headers.set(k, v);
      return new Response(response.body, { status: response.status, headers });
    } catch {
      return new Response(
        JSON.stringify({
          error: "تعذّر معالجة طلب الغرفة؛ تحقق من الخريطة والعنوان",
        }),
        {
          status: 400,
          headers: {
            ...cors,
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        },
      );
    }
  },
};
export class ArenaRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.doc = null;
    this.core = null;
    this.sockets = new Map();
    this.timer = null;
    this.lastTick = 0;
    this.lastSave = 0;
    this.seq = 0;
    this.buckets = new Map();
    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get("room");
      if (saved) {
        this.doc = saved;
        this.core = RoomCore.restore(saved.core);
        this.core.battle.paused = true;
        for (const p of Object.values(this.doc.players))
          p.disconnectedAt = Date.now();
      }
    });
  }
  online(team) {
    return [...this.sockets.values()].some((p) => p.team === team);
  }
  phase() {
    if (this.core?.battle.status !== "playing") return "ended";
    if (!this.doc.started) return "waiting";
    return this.online("blue") && this.online("red") ? "playing" : "paused";
  }
  async save() {
    if (this.doc && this.core) {
      this.doc.core = this.core.serialize();
      await this.ctx.storage.put("room", this.doc);
    }
  }
  send(ws, data) {
    try {
      ws.send(JSON.stringify(data));
    } catch {
      this.drop(ws);
    }
  }
  broadcast() {
    if (!this.core) return;
    const phase = this.phase(),
      events = this.core.battle.takeEvents();
    for (const [ws, peer] of this.sockets)
      if (peer.team)
        this.send(ws, {
          type: "state",
          protocol: 1,
          seq: ++this.seq,
          room: this.doc.room,
          side: peer.team,
          phase,
          players: {
            blue: {
              connected: this.online("blue"),
              ready: !!this.doc.players.blue?.ready,
            },
            red: {
              connected: this.online("red"),
              ready: !!this.doc.players.red?.ready,
            },
          },
          battle: this.core.view(peer.team),
          events: events.filter(
            (e) =>
              [
                "shot",
                "explosion",
                "build",
                "train",
                "victory",
                "defeat",
              ].includes(e.kind) &&
              (!Number.isFinite(e.x) ||
                this.core.battle.isVisible(
                  {
                    x: e.x,
                    y: e.y,
                    team: peer.team === "blue" ? "red" : "blue",
                  },
                  peer.team,
                )),
          ),
        });
  }
  sync() {
    if (!this.core) return;
    this.core.battle.paused = this.phase() !== "playing";
    if (this.online("blue") || this.online("red")) {
      if (!this.timer) {
        this.lastTick = Date.now();
        this.timer = setInterval(() => this.tick(), 100);
      }
    } else if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.broadcast();
  }
  tick() {
    const now = Date.now();
    if (now >= this.doc.expiresAt) {
      this.expire();
      return;
    }
    const phase = this.phase();
    if (phase === "playing") {
      const elapsed = Math.min(0.3, (now - this.lastTick) / 1000);
      for (let rest = elapsed; rest > 0.001; rest -= 0.05)
        this.core.tick(Math.min(0.05, rest));
    } else if (this.doc.started && phase === "paused") {
      for (const team of ["blue", "red"])
        if (
          !this.online(team) &&
          this.doc.players[team] &&
          now - this.doc.players[team].disconnectedAt > 60000
        ) {
          this.core.battle.status = team === "blue" ? "lost" : "won";
          this.core.battle.message = "انتهت مهلة عودة الخصم";
        }
    }
    this.lastTick = now;
    if (!this.lastBroadcast || now - this.lastBroadcast >= 200) {
      this.lastBroadcast = now;
      this.broadcast();
    }
    if (now - this.lastSave > 5000) {
      this.lastSave = now;
      this.ctx.waitUntil(this.save());
    }
    if (this.phase() === "ended" && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.ctx.waitUntil(this.save());
    }
  }
  drop(ws) {
    const peer = this.sockets.get(ws);
    if (!peer) return;
    this.sockets.delete(ws);
    if (peer.team && this.doc?.players[peer.team] && !this.online(peer.team))
      this.doc.players[peer.team].disconnectedAt = Date.now();
    this.sync();
    if (this.doc) this.ctx.waitUntil(this.save());
  }
  async expire() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const [ws] of this.sockets) {
      try {
        ws.close(1000, "Room expired");
      } catch {}
    }
    this.sockets.clear();
    this.doc = null;
    this.core = null;
    await this.ctx.storage.deleteAll();
  }
  async alarm() {
    await this.expire();
  }
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/permit") {
      const key = request.headers.get("X-Bucket"),
        now = Date.now(),
        cooldown = Number(this.env.CREATION_COOLDOWN) || 0;
      for (const [k, t] of this.buckets)
        if (now - t > 600000) this.buckets.delete(k);
      if (
        this.buckets.size > 2048 ||
        now - (this.buckets.get(key) || 0) < cooldown * 1000
      )
        return json({ ok: false }, 429);
      this.buckets.set(key, now);
      return json({ ok: true });
    }
    if (path === "/init") {
      if (this.doc) return json({ error: "الغرفة موجودة" }, 409);
      const data = await request.json();
      this.core = new RoomCore(data);
      const secret = token();
      this.doc = {
        room: data.room,
        createdAt: Date.now(),
        expiresAt: Date.now() + 2 * 3600000,
        started: false,
        players: {
          blue: { token: secret, ready: false, disconnectedAt: Date.now() },
        },
      };
      await this.save();
      await this.ctx.storage.setAlarm(this.doc.expiresAt);
      return json({ room: data.room, side: "blue", token: secret });
    }
    if (!this.doc || Date.now() > this.doc.expiresAt)
      return json({ error: "الغرفة غير موجودة أو انتهت مدتها" }, 404);
    if (path === "/join") {
      if (this.doc.players.red)
        return json(
          { error: "الغرفة ممتلئة. استخدم استئناف الاتصال من جهازك السابق" },
          409,
        );
      const secret = token();
      this.doc.players.red = {
        token: secret,
        ready: false,
        disconnectedAt: Date.now(),
      };
      await this.save();
      this.broadcast();
      return json({ room: this.doc.room, side: "red", token: secret });
    }
    if (path === "/ws") {
      if (this.sockets.size >= 6) return json({ error: "اتصالات كثيرة" }, 429);
      const pair = new WebSocketPair(),
        client = pair[0],
        server = pair[1];
      server.accept();
      const peer = { team: null, count: 0, window: Date.now() };
      this.sockets.set(server, peer);
      const timeout = setTimeout(() => {
        if (!peer.team) {
          server.close(1008, "Authentication required");
          this.drop(server);
        }
      }, 5000);
      server.addEventListener("message", (event) => {
        try {
          if (typeof event.data !== "string" || event.data.length > 4096)
            throw Error();
          const now = Date.now();
          if (now - peer.window > 1000) {
            peer.window = now;
            peer.count = 0;
          }
          if (++peer.count > 25) throw Error();
          const message = JSON.parse(event.data);
          if (!peer.team) {
            if (message.type !== "auth" || typeof message.token !== "string")
              throw Error();
            const team = Object.keys(this.doc.players).find(
              (t) => this.doc.players[t].token === message.token,
            );
            if (!team) throw Error();
            for (const [s, p] of this.sockets)
              if (s !== server && p.team === team) {
                this.sockets.delete(s);
                s.close(1000, "Session replaced");
              }
            peer.team = team;
            clearTimeout(timeout);
            this.doc.players[team].disconnectedAt = 0;
            this.sync();
            return;
          }
          if (message.type === "ready") {
            this.doc.players[peer.team].ready = true;
            if (
              this.doc.players.blue?.ready &&
              this.doc.players.red?.ready &&
              this.online("blue") &&
              this.online("red")
            )
              this.doc.started = true;
            this.ctx.waitUntil(this.save());
            this.sync();
          } else if (message.type === "action") {
            try {
              const result = this.core.act(peer.team, message.action);
              this.send(server, { type: "ack", ...result });
              this.broadcast();
            } catch (error) {
              this.send(server, {
                type: "ack",
                ok: false,
                text: error.message,
              });
            }
          } else if (message.type === "ping")
            this.send(server, { type: "pong", at: message.at });
          else throw Error();
        } catch {
          server.close(1008, "Invalid message");
          this.drop(server);
        }
      });
      server.addEventListener("close", () => {
        clearTimeout(timeout);
        this.drop(server);
      });
      server.addEventListener("error", () => this.drop(server));
      return new Response(null, { status: 101, webSocket: client });
    }
    return json({ error: "مسار غير موجود" }, 404);
  }
}
