import { FormEvent, useEffect, useState } from "react";
import { bridge, type AppError, type AppStatus } from "./bridge";

type Screen = "loading" | "setup" | "unlock" | "recovery" | "ready";
const readable = (error: unknown) => (typeof error === "string" ? error : (error as AppError)?.message ?? "تعذر إتمام العملية. حاول مرة أخرى.");

export function App() {
  const [screen, setScreen] = useState<Screen>("loading"); const [password, setPassword] = useState("");
  const [recoveryKey, setRecoveryKey] = useState(""); const [newPassword, setNewPassword] = useState("");
  const [issuedKey, setIssuedKey] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { bridge.status().then((s: AppStatus) => setScreen(s.initialized ? (s.unlocked ? "ready" : "unlock") : "setup")).catch((e) => setError(readable(e))); }, []);
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(""); setBusy(true); try {
    if (screen === "setup") { const result = await bridge.initialize(password); setIssuedKey(result.recoveryKey); }
    else if (screen === "unlock") { await bridge.unlock(password); setScreen("ready"); }
    else if (screen === "recovery") { await bridge.recover(recoveryKey, newPassword); setScreen("ready"); }
  } catch (e) { setError(readable(e)); } finally { setBusy(false); } };
  if (screen === "loading") return <main className="loading">جارٍ تحضير خزنتك الخاصة…</main>;
  if (screen === "ready") return <main className="ready"><img src="/logo.png" alt="" /><p>الخزنة المحلية مؤمّنة وجاهزة.</p><button onClick={() => bridge.lock().then(() => setScreen("unlock"))}>قفل التطبيق</button></main>;
  if (issuedKey) return <RecoveryKey recoveryKey={issuedKey} onContinue={() => setScreen("ready")} />;
  return <main className="shell"><section className="brand"><img src="/logo.png" alt="شعار ليجال ماستر" /><div><span>ليجال ماستر</span><small>مساحتك القانونية الخاصة، على جهازك فقط</small></div></section><section className="card"><p className="eyebrow">{screen === "setup" ? "إعداد أول مرة" : screen === "recovery" ? "استعادة الوصول" : "مرحبًا بعودتك"}</p><h1>{screen === "setup" ? "أنشئ مفتاح خزنتك" : screen === "recovery" ? "استخدم مفتاح الاسترداد" : "افتح خزنتك"}</h1><p className="copy">{screen === "setup" ? "لن تُرسل بياناتك إلى أي خادم. اختر كلمة مرور قوية لا تشاركها مع أحد." : "كلمة المرور ومفتاح الاسترداد لا يغادران جهازك."}</p><form onSubmit={submit}>{screen === "recovery" ? <><label>مفتاح الاسترداد<input value={recoveryKey} onChange={e => setRecoveryKey(e.target.value)} autoComplete="off" required /></label><label>كلمة مرور جديدة<input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={12} required /></label></> : <label>كلمة المرور<input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={12} autoFocus required /></label>}<button disabled={busy}>{busy ? "جارٍ المعالجة…" : screen === "setup" ? "إنشاء الخزنة" : screen === "recovery" ? "استعادة الوصول" : "فتح الخزنة"}</button></form>{error && <p className="error" role="alert">{error}</p>}{screen === "unlock" && <button className="text" onClick={() => setScreen("recovery")}>لدي مفتاح الاسترداد</button>}</section></main>;
}

function RecoveryKey({ recoveryKey, onContinue }: { recoveryKey: string; onContinue: () => void }) { return <main className="shell"><section className="brand"><img src="/logo.png" alt="شعار ليجال ماستر" /></section><section className="card"><p className="eyebrow">خطوة مهمة جدًا</p><h1>احتفظ بمفتاح الاسترداد</h1><p className="copy">اعرضه مرة واحدة فقط. خزّنه خارج جهازك؛ لا يمكن لفريق ليجال ماستر استعادته.</p><code>{recoveryKey}</code><button onClick={onContinue}>حفظته في مكان آمن</button></section></main>; }
