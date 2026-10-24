'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/supabase-browser';
import { OtherShelf } from './Report';
import Reading from './Reading';

export default function Shelf({ data, profile, onEditMe, notify }) {
  const [read, setRead] = useState(data?.read || []);
  useEffect(() => setRead(data?.read || []), [data]);
  const undo = async (title) => {
    try { await api('/api/feedback', { method: 'POST', body: { title, action: 'undo' } }); setRead((r) => r.filter((t) => t !== title)); notify('다 읽음을 취소했어요'); }
    catch (e) { notify(e.message); }
  };
  if (!data) return <div className="panel empty">불러오는 중…</div>;
  return (
    <div className="stack">
      <Reading data={data} notify={notify} full />
      {data.shelf?.length > 0 && <OtherShelf title="나를 위한 다른 서가" shelf={data.shelf} profile={profile} onEdit={onEditMe} notify={notify} />}
      <div className="panel">
        <h2 className="p">다 읽은 책 <span className="hint">· {read.length}권</span></h2>
        {read.length ? read.map((t) => (
          <div className="sh" key={t}><span className="tt">{t}</span><button className="sbtn" onClick={() => undo(t)}>취소</button></div>
        )) : <p className="hint" style={{ margin: 0 }}>추천 책에서 "다 읽었어요"를 누르면 여기에 쌓이고, 다음 추천에서 빠집니다.</p>}
      </div>
    </div>
  );
}
