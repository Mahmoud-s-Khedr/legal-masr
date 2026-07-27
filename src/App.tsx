import { FormEvent, useEffect, useState } from "react";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { bridge, type AppError, type InitializeInput, type Settings } from "./bridge";

type Gate = "loading" | "setup" | "unlock" | "recovery" | "recovery-key" | "backup" | "ready";
const message = (error: unknown) => (typeof error === "string" ? error : (error as AppError)?.message) || "تعذر إتمام العملية بأمان.";
const nav = [["/", "الرئيسية"], ["/clients", "الموكلون"], ["/cases", "القضايا"], ["/calendar", "الجدول"], ["/tasks", "المهام"], ["/documents", "المستندات"], ["/finances", "المالية"], ["/backups", "النسخ الاحتياطي"], ["/settings", "الإعدادات"]] as const;

export function App() {
  const [gate, setGate] = useState<Gate>("loading"); const [password, setPassword] = useState(""); const [recovery, setRecovery] = useState("");
  const [issuedKey, setIssuedKey] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState<Omit<InitializeInput, "password">>({ fullName: "", language: "ar", managedDocumentsDirectory: "", backupDirectory: "", lockTimeoutMinutes: 15 });
  useEffect(() => { bridge.status().then(s => setGate(!s.initialized ? "setup" : !s.unlocked ? "unlock" : s.onboardingCompleted ? "ready" : "backup")).catch(e => setError(message(e))); }, []);
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(""); try {
    if (gate === "setup") { const r = await bridge.initialize({ ...profile, password }); setIssuedKey(r.recoveryKey); setGate("recovery-key"); }
    if (gate === "unlock") { await bridge.unlock(password); const s = await bridge.status(); setGate(s.onboardingCompleted ? "ready" : "backup"); }
    if (gate === "recovery") { await bridge.recover(recovery, password); setGate("backup"); }
  } catch (e) { setError(message(e)); } finally { setBusy(false); } };
  if (gate === "loading") return <main className="gate loading">جارٍ تحضير الخزنة المحلية…</main>;
  if (gate === "ready") return <Shell onLock={() => bridge.lock().then(() => setGate("unlock"))} />;
  if (gate === "backup") return <BackupStep destination={profile.backupDirectory} onComplete={() => setGate("ready")} />;
  return <main className="gate"><aside className="gate-brand"><img src="/logo.png" alt="شعار ليجال ماستر" /><p>سجلّك القانوني، محفوظ على جهازك.</p></aside><section className="gate-card">
    <p className="kicker">{gate === "setup" ? "إعداد آمن" : gate === "recovery" ? "استعادة الوصول" : gate === "recovery-key" ? "خطوة مهمة" : "مرحبًا بعودتك"}</p>
    <h1>{gate === "setup" ? "أنشئ خزنتك" : gate === "recovery" ? "استخدم مفتاح الاسترداد" : gate === "recovery-key" ? "احتفظ بهذا المفتاح" : "افتح خزنتك"}</h1>
    {gate === "recovery-key" ? <><p>يظهر هذا المفتاح مرة واحدة فقط. لا يمكن استعادته من الدعم.</p><code>{issuedKey}</code><button onClick={() => setGate("backup")}>حفظته في مكان آمن</button></> : <form onSubmit={submit}>
      {gate === "setup" && <><label>اسم المحامي<input value={profile.fullName} onChange={e => setProfile({ ...profile, fullName: e.target.value })} required autoFocus /></label><label>لغة الواجهة<select value={profile.language} onChange={e => setProfile({ ...profile, language: e.target.value as "ar" | "en" })}><option value="ar">العربية</option><option value="en">English</option></select></label><label>مجلد المستندات المُدار<input value={profile.managedDocumentsDirectory} onChange={e => setProfile({ ...profile, managedDocumentsDirectory: e.target.value })} required placeholder="اختر مسارًا محليًا" /></label><label>مجلد النسخ الاحتياطي<input value={profile.backupDirectory} onChange={e => setProfile({ ...profile, backupDirectory: e.target.value })} required placeholder="اختر مسارًا محليًا" /></label></>}
      {gate === "recovery" && <label>مفتاح الاسترداد<input dir="ltr" value={recovery} onChange={e => setRecovery(e.target.value)} required /></label>}
      <label>{gate === "recovery" ? "كلمة مرور جديدة" : "كلمة المرور"}<input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={12} required /></label>
      <button disabled={busy}>{busy ? "جارٍ المعالجة…" : gate === "setup" ? "إنشاء الخزنة" : gate === "recovery" ? "استعادة الوصول" : "فتح الخزنة"}</button>
    </form>}
    {error && <p className="error" role="alert">{error}</p>}{gate === "unlock" && <button className="text-button" onClick={() => setGate("recovery")}>لدي مفتاح الاسترداد</button>}
  </section></main>;
}

function BackupStep({ destination, onComplete }: { destination: string; onComplete: () => void }) { const [error, setError] = useState(""); const [busy, setBusy] = useState(false); return <main className="gate"><section className="gate-card standalone"><p className="kicker">النسخة الأولى</p><h1>ثبّت نقطة أمان</h1><p>لن يكتمل الإعداد قبل إنشاء نسخة احتياطية مشفّرة والتحقق منها.</p><button disabled={busy} onClick={async () => { setBusy(true); try { await bridge.createBackup(destination); await bridge.completeOnboarding(); onComplete(); } catch (e) { setError(message(e)); } finally { setBusy(false); } }}>{busy ? "جارٍ إنشاء النسخة…" : "إنشاء نسخة احتياطية"}</button>{error && <p className="error">{error}</p>}</section></main>; }

function Shell({ onLock }: { onLock: () => void }) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reset = async () => { clearTimeout(timer); const settings = await bridge.settings(); timer = setTimeout(onLock, settings.lockTimeoutMinutes * 60_000); };
    void reset(); window.addEventListener("pointerdown", reset); window.addEventListener("keydown", reset);
    return () => { clearTimeout(timer); window.removeEventListener("pointerdown", reset); window.removeEventListener("keydown", reset); };
  }, [onLock]);
  return <BrowserRouter><div className="app-shell"><aside className="sidebar"><img src="/logo.png" alt="" /><strong>ليجال ماستر</strong><nav>{nav.map(([to, label]) => <NavLink key={to} to={to} end={to === "/"}>{label}</NavLink>)}</nav><button className="lock-button" onClick={onLock}>قفل التطبيق</button></aside><main className="workspace"><header><div><p className="kicker">مساحة العمل</p><h1>صباحك منظّم</h1></div><input aria-label="البحث العام" placeholder="ابحث في سجلك قريبًا…" disabled /></header><Routes><Route path="/" element={<Home />} />{nav.slice(1, -1).map(([path, label]) => <Route key={path} path={path} element={<Placeholder label={label} />} />)}<Route path="/settings" element={<SettingsPage />} /></Routes></main></div></BrowserRouter>;
}
function Home() { return <section className="home"><div className="hero"><span>خصوصيتك أولًا</span><h2>كل ما تحتاجه ليومٍ قانوني واضح.</h2><p>تم إعداد أساس آمن للملفات والسجل والنسخ الاحتياطي. ستصل وحدات العمل تباعًا.</p></div><Placeholder label="الرئيسية" /></section>; }
function Placeholder({ label }: { label: string }) { return <section className="placeholder"><span>قريبًا</span><h2>{label}</h2><p>هذه الوحدة قيد الإعداد ضمن المراحل التالية.</p></section>; }
function SettingsPage() { const [settings, setSettings] = useState<Settings | null>(null); const [saved, setSaved] = useState(false); useEffect(() => { bridge.settings().then(setSettings); }, []); if (!settings) return <p>جارٍ تحميل الإعدادات…</p>; return <section className="settings"><p className="kicker">الإعدادات</p><h2>الحماية والواجهة</h2><label>لغة الواجهة<select value={settings.language} onChange={e => setSettings({ ...settings, language: e.target.value as "ar" | "en" })}><option value="ar">العربية</option><option value="en">English</option></select></label><label>مهلة القفل بالدقائق<input type="number" min="1" value={settings.lockTimeoutMinutes} onChange={e => setSettings({ ...settings, lockTimeoutMinutes: Number(e.target.value) })} /></label><button onClick={async () => { const next = await bridge.updateSettings(settings); setSettings(next); setSaved(true); }}>حفظ الإعدادات</button>{saved && <p className="success">تم الحفظ محليًا.</p>}</section>; }
