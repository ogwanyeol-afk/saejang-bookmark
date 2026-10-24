/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;

// next dev 에서도 Cloudflare 설정(wrangler.jsonc)을 읽도록
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
initOpenNextCloudflareForDev();
