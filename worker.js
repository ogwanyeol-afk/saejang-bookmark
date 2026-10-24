// Cloudflare Worker 입구: 화면·API는 Next.js(OpenNext)가 처리하고,
// 정해진 시각(Cron Triggers)에는 아래 크론 주소를 대신 불러 줍니다.
// @ts-ignore 빌드 때 생성되는 파일
import { default as handler } from './.open-next/worker.js';

// wrangler.jsonc 의 triggers.crons 와 같은 문자열(UTC 기준)
const CRONS = {
  '0 11 * * SUN': '/api/cron/weekly', // 일요일 20:00 한국시간 · 주간 리포트 알림
  '0 6 * * WED': '/api/cron/read',    // 수요일 15:00 한국시간 · 10분 읽기 알림
};

export default {
  fetch: handler.fetch,

  async scheduled(event, env, ctx) {
    // 크론 문자열이 표기만 다르게 들어와도 요일(UTC)로 찾음: 일=주간 리포트, 수=10분 읽기
    const day = new Date(event.scheduledTime).getUTCDay();
    const path = CRONS[event.cron] || (day === 0 ? '/api/cron/weekly' : day === 3 ? '/api/cron/read' : null);
    if (!path) { console.warn('알 수 없는 크론', event.cron); return; }
    const req = new Request(`https://cron.internal${path}`, {
      headers: env.CRON_SECRET ? { authorization: `Bearer ${env.CRON_SECRET}` } : {},
    });
    const res = await handler.fetch(req, env, ctx);
    console.log('cron', event.cron, path, res.status, (await res.text()).slice(0, 300));
  },
};
