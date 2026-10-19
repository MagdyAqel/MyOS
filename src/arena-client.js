export const SESSION_KEY = "myos-online-session-v1";
export function validateEndpoint(value) {
  const u = new URL(value);
  if (
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    u.pathname !== "/" ||
    (u.protocol !== "https:" &&
      !(
        u.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(u.hostname)
      ))
  )
    throw Error("أدخل عنوان خادم HTTPS دون مسار إضافي");
  return u.origin;
}
export async function roomRequest(endpoint, path, body) {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(validateEndpoint(endpoint) + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
      signal: controller.signal,
      credentials: "omit",
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || "تعذّر الاتصال بالغرفة");
    if (
      !/^[a-f0-9]{32}$/.test(data.room) ||
      !["blue", "red"].includes(data.side) ||
      !/^[a-f0-9]{32}$/.test(data.token)
    )
      throw Error("استجابة غرفة غير صالحة");
    return { ...data, endpoint: validateEndpoint(endpoint) };
  } catch (e) {
    if (e.name === "AbortError") throw Error("انتهت مهلة اتصال خادم اللعب");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
export class MatchConnection extends EventTarget {
  constructor(session) {
    super();
    this.session = session;
    this.refs = 0;
    this.closed = false;
    this.state = null;
    this.socket = null;
    this.attempt = 0;
    this.controls = { formation: "spread", commandMode: "move", groups: {} };
    this.notice = "";
    this.retry = null;
    this.connect();
  }
  emit(type) {
    this.dispatchEvent(new Event(type));
  }
  retain() {
    this.refs++;
  }
  release() {
    this.refs = Math.max(0, this.refs - 1);
    if (!this.refs) this.close();
  }
  connect() {
    if (this.closed) return;
    const url = new URL(
      "/rooms/" + this.session.room + "/ws",
      this.session.endpoint,
    );
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    this.socket = new WebSocket(url);
    this.status = "جارٍ الاتصال بخادم المواجهة…";
    this.emit("status");
    this.socket.onopen = () =>
      this.socket.send(
        JSON.stringify({ type: "auth", token: this.session.token }),
      );
    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "state") {
          if (
            data.protocol !== 1 ||
            data.room !== this.session.room ||
            data.side !== this.session.side
          )
            throw Error();
          this.state = data;
          this.attempt = 0;
          this.status =
            {
              waiting: "بانتظار اتصال اللاعب الآخر وجاهزية الطرفين",
              playing: "متصل · المواجهة جارية",
              paused:
                "انقطع اتصال الخصم؛ المعركة متوقفة حتى عودته (مهلة 60 ثانية)",
              ended: "انتهت المواجهة",
            }[data.phase] || "حالة غير معروفة";
          this.emit("state");
          this.emit("status");
        } else if (data.type === "ack") {
          this.notice = data.text;
          this.noticeUntil = Date.now() + 4000;
          this.emit("ack");
        }
      } catch {
        this.status = "تعذّر قراءة حالة الخادم";
        this.emit("status");
      }
    };
    this.socket.onclose = (event) => {
      if (this.closed) return;
      if (event.code === 1008) {
        this.status =
          "رفض الخادم الجلسة. أعد إنشاء الغرفة أو استعد جلستك الصحيحة.";
        this.emit("status");
        return;
      }
      if (++this.attempt > 6) {
        this.status = "تعذّر إعادة الاتصال. استخدم زر استئناف الاتصال.";
        this.emit("status");
        return;
      }
      this.status = "انقطع الاتصال؛ نحاول العودة إلى الغرفة…";
      this.emit("status");
      this.retry = setTimeout(
        () => this.connect(),
        Math.min(8000, 700 * 2 ** this.attempt),
      );
    };
    this.socket.onerror = () => {
      this.status = "تعذّر الاتصال بخادم اللعب؛ تحقق من العنوان والإنترنت";
      this.emit("status");
    };
  }
  ready() {
    this.send({ type: "ready" });
  }
  send(message) {
    if (this.closed || this.socket?.readyState !== WebSocket.OPEN) {
      this.notice = "الخادم غير متصل؛ لم يُرسل الأمر";
      this.noticeUntil = Date.now() + 4000;
      this.emit("ack");
      return false;
    }
    this.socket.send(JSON.stringify(message));
    return true;
  }
  action(action) {
    if (this.state?.phase !== "playing") {
      this.notice = "انتظر اتصال اللاعب الآخر وجاهزية الطرفين";
      this.noticeUntil = Date.now() + 4000;
      this.emit("ack");
      return false;
    }
    return this.send({
      type: "action",
      action: {
        ...action,
        formation: this.controls.formation,
        commandMode: this.controls.commandMode,
      },
    });
  }
  close() {
    this.closed = true;
    clearTimeout(this.retry);
    this.socket?.close(1000, "Left room");
    this.status = "أُغلق الاتصال";
    this.emit("status");
  }
}
