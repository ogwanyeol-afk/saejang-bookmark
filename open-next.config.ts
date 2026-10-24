import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// 이 앱은 화면마다 로그인한 사용자 데이터를 그때그때 불러오므로 별도 캐시 저장소(R2)가 필요 없습니다.
export default defineCloudflareConfig({});
