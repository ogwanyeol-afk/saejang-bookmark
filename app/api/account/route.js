import { userClient, adminClient, json } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// 회원 탈퇴: 계정과 모든 기록을 지웁니다(테이블은 계정 삭제 시 함께 삭제되도록 연결됨)
export async function DELETE(req) {
  const { user, error } = await userClient(req);
  if (error) return json({ error }, 401);
  const { error: e } = await adminClient().auth.admin.deleteUser(user.id);
  if (e) return json({ error: e.message }, 500);
  return json({ ok: true });
}
