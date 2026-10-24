import './globals.css';

export const metadata = {
  title: '사장님 책갈피',
  description: '대표님이 본 유튜브를 주간 리포트로 돌려드리고, 다음 단계로 가는 책과 꼭 알아야 할 세금을 알려드립니다',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, title: '사장님 책갈피', statusBarStyle: 'default' },
  icons: { icon: '/icon-192.png', apple: '/apple-touch-icon.png' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#EEF0F2' },
    { media: '(prefers-color-scheme: dark)', color: '#10141A' },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@700;800&family=IBM+Plex+Sans+KR:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
