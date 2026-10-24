'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase, configured, api } from '@/lib/supabase-browser';
import { Consent, Login, NotConfigured } from '@/components/Gate';
import Onboarding from '@/components/Onboarding';
import Report from '@/components/Report';
import Growth from '@/components/Growth';
import Tax from '@/components/Tax';
import Shelf from '@/components/Shelf';
import Records from '@/components/Records';

const TABS = [['report', '이번 주 리포트'], ['growth', '성장 지도'], ['tax', '세무 상담'], ['shelf', '내 책장'], ['records', '기록·설정']];

export default function Home() {
  const [session, setSession] = useState(undefined);
  const [me, setMe] = useState(null);           // {profile, email, admin}
  const [tab, setTab] = useState('report');
  const [data, setData] = useState(null);       // /api/report
  const [tips, setTips] = useState([]);
  const [tick, setTick] = useState(() => Math.floor(Math.random() * 6));
  const [editMe, setEditMe] = useState(false);
  const [restart, setRestart] = useState(false);
  const [toast, setToast] = useState('');

  const notify = useCallback((m) => { setToast(m); clearTimeout(window.__t); window.__t = setTimeout(() => setToast(''), 2600); }, []);
  const profile = me?.profile;
  const setProfile = (p) => setMe((m) => ({ ...m, profile: p }));

  useEffect(() => {
    if (!configured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    const t = new URLSearchParams(location.search).get('tab');
    if (TABS.some(([k]) => k === t)) setTab(t);
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => { if (session) api('/api/profile').then(setMe).catch((e) => notify(e.message)); }, [session, notify]);

  const reload = useCallback(async () => {
    try { setData(await api('/api/report')); } catch (e) { notify(e.message); }
  }, [notify]);
  const ready = profile?.consent_at && profile?.onboarded_at;
  useEffect(() => {
    if (!ready) return;
    reload();
    api('/api/tips').then((d) => setTips(d.tips)).catch(() => {});
  }, [ready, reload]);

  const go = (k) => { setTab(k); setTick((x) => x + 1); window.scrollTo(0, 0); };
  const saveProfile = async (body, after) => {
    const d = await api('/api/profile', { method: 'PATCH', body });
    setProfile(d.profile);
    after?.();
    setData(null); reload();
  };

  if (!configured) return <NotConfigured />;
  if (session === undefined) return <div className="center"><p className="hint">불러오는 중…</p></div>;
  if (!session) return <Login />;
  if (!profile) return <div className="center"><p className="hint">계정 확인 중…</p></div>;
  if (!profile.consent_at) return <Consent onAgree={() => saveProfile({ consent: true })} />;
  if (!profile.onboarded_at || restart) return <Onboarding profile={profile} notify={notify} onSave={(b) => saveProfile(b, () => { setRestart(false); go('report'); })} />;
  if (editMe) return <Onboarding profile={profile} meOnly notify={notify} onCancel={() => setEditMe(false)} onSave={(b) => saveProfile(b, () => { setEditMe(false); notify('관심사를 반영해 다른 서가 책을 다시 골랐어요'); })} />;

  const common = { data, profile, tips, tick, notify };
  return (
    <div className="wrap">
      <header className="apphead">
        <div className="a-h1">사장님 <em>책갈피</em></div>
        {me.admin && <a className="sbtn" href="/admin">관리자</a>}
      </header>
      <nav className="tabs" role="tablist">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => go(k)}>{l}</button>)}
      </nav>
      {tab === 'report' && <Report {...common} go={go} reload={reload} onEditMe={() => setEditMe(true)} />}
      {tab === 'growth' && <Growth profile={profile} go={go} />}
      {tab === 'tax' && (data ? <Tax {...common} /> : <div className="panel empty">불러오는 중…</div>)}
      {tab === 'shelf' && <Shelf {...common} onEditMe={() => setEditMe(true)} />}
      {tab === 'records' && <Records profile={profile} setProfile={setProfile} email={me.email} notify={notify} reload={reload} onRestart={() => setRestart(true)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
