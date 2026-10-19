export function validateCloudConfig(url, key) {
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" ||
    !/^[-a-z0-9]+\.supabase\.co$/.test(parsed.hostname) ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  )
    throw Error("أدخل عنوان مشروع Supabase بصيغة https://project.supabase.co");
  if (
    typeof key !== "string" ||
    key.length < 20 ||
    key.length > 2000 ||
    /\s/.test(key) ||
    key.startsWith("sb_secret_")
  )
    throw Error(
      "استخدم مفتاح publishable أو anon العام فقط، وليس service_role",
    );
  if (key.split(".").length === 3) {
    try {
      const part = key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"),
        payload = JSON.parse(atob(part));
      if (payload.role !== "anon") throw Error();
    } catch {
      throw Error("هذا ليس مفتاح anon عامًا صالحًا");
    }
  } else if (!key.startsWith("sb_publishable_"))
    throw Error("استخدم مفتاح publishable أو anon العام من إعدادات المشروع");
  return { url: parsed.origin, key };
}
export class CloudClient {
  constructor(config, fetcher = globalThis.fetch) {
    this.config = validateCloudConfig(config.url, config.key);
    this.fetcher = fetcher.bind(globalThis);
    this.session = null;
    this.revision = null;
  }
  async request(path, { method = "GET", body, authenticated = true } = {}) {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 12000);
    try {
      const headers = {
        apikey: this.config.key,
        "Content-Type": "application/json",
      };
      if (authenticated) {
        await this.ensureSession();
        headers.Authorization = `Bearer ${this.session.access_token}`;
      }
      const response = await this.fetcher(this.config.url + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) {
        if (response.status === 409)
          throw Error("تعارض: توجد نسخة أحدث في السحابة. افحصها قبل الرفع.");
        if (response.status === 401)
          throw Error(
            "انتهت الجلسة أو بيانات الدخول غير صحيحة. سجّل الدخول مجددًا.",
          );
        if (response.status === 403)
          throw Error(
            "صلاحيات السحابة غير مكتملة. تحقق من سياسات RLS والمفتاح العام.",
          );
        if (response.status === 400 || response.status === 404)
          throw Error(
            "تحقق من إعداد المشروع والبريد وكلمة المرور وتنفيذ ملف SQL الخاص بالمزامنة.",
          );
        throw Error("تعذّر الاتصال بخدمة المزامنة. حاول لاحقًا.");
      }
      if (response.status === 204) return null;
      return await response.json();
    } catch (error) {
      if (error.name === "AbortError")
        throw Error("انتهت مهلة الاتصال. بياناتك المحلية لم تتغير.");
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  acceptSession(data) {
    if (
      !data?.access_token ||
      !data.refresh_token ||
      !data.user?.id ||
      !/^[-a-f0-9]{36}$/i.test(data.user.id)
    )
      throw Error("استجابة جلسة غير صالحة");
    this.session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      user: { id: data.user.id, email: data.user.email || "" },
      expires_at:
        Date.now() + Math.max(30, Number(data.expires_in) || 3600) * 1000,
    };
    this.revision = null;
  }
  async login(email, password) {
    const result = await this.request("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: { email, password },
      authenticated: false,
    });
    this.acceptSession(result);
    return this.session.user;
  }
  async signup(email, password) {
    const result = await this.request("/auth/v1/signup", {
      method: "POST",
      body: { email, password },
      authenticated: false,
    });
    if (result.access_token) {
      this.acceptSession(result);
      return true;
    }
    return false;
  }
  async ensureSession() {
    if (!this.session) throw Error("سجّل الدخول أولًا");
    if (this.session.expires_at - Date.now() < 30000) {
      const data = await this.request(
        "/auth/v1/token?grant_type=refresh_token",
        {
          method: "POST",
          body: { refresh_token: this.session.refresh_token },
          authenticated: false,
        },
      );
      const revision = this.revision;
      this.acceptSession(data);
      this.revision = revision;
    }
  }
  async inspect() {
    await this.ensureSession();
    const rows = await this.request(
      `/rest/v1/myos_snapshots?select=data,revision,updated_at&user_id=eq.${encodeURIComponent(this.session.user.id)}`,
    );
    if (!Array.isArray(rows) || rows.length > 1)
      throw Error("استجابة مزامنة غير صالحة");
    this.revision = rows.length ? rows[0].revision : 0;
    if (!Number.isInteger(this.revision) || this.revision < 0)
      throw Error("إصدار مزامنة غير صالح");
    return rows[0] || null;
  }
  async push(snapshot) {
    if (this.revision === null) throw Error("افحص حالة السحابة قبل الرفع");
    const result = await this.request("/rest/v1/rpc/save_myos_snapshot", {
      method: "POST",
      body: { expected_revision: this.revision, payload: snapshot },
    });
    const row = Array.isArray(result) ? result[0] : result;
    if (
      !Number.isInteger(row?.new_revision) ||
      row.new_revision <= this.revision
    )
      throw Error("لم تؤكّد الخدمة حفظ النسخة");
    this.revision = row.new_revision;
    return row;
  }
  async logout() {
    if (this.session)
      try {
        await this.request("/auth/v1/logout", { method: "POST" });
      } finally {
        this.session = null;
        this.revision = null;
      }
  }
}
