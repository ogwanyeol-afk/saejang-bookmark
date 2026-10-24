import './globals.css';

export const metadata = {
  title: '하루 한 쪽',
  description: '요즘 관심사를 한 단계 깊게 읽을 책으로 바꿔 드리고, 하루 10분 읽는 습관과 내 단계에 맞는 돈·세금 정보를 알려 드립니다',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, title: '하루 한 쪽', statusBarStyle: 'default' },
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
