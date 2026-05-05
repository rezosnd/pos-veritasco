import './globals.css';
import { Inter, Outfit } from 'next/font/google';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit', display: 'swap' });

export const metadata = {
  title: { default: 'Veritasco POS', template: '%s | Veritasco POS' },
  description: 'Modern restaurant POS & QR ordering system by Veritasco',
  keywords: ['restaurant', 'pos', 'qr ordering', 'menu', 'veritasco'],
  robots: 'noindex,nofollow',
  icons: {
    icon: '/logo.avif',
    apple: '/logo.avif',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: 'var(--brand-600)',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <head>
        <link rel="icon" href="/logo.avif" type="image/avif" />
        <link rel="apple-touch-icon" href="/logo.avif" />
      </head>
      <body className="bg-[#0a0f0a] text-[#f5f5f5] min-h-screen">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#111811',
              color: '#f5f5f5',
              border: '1px solid #2a3a2a',
              borderRadius: '12px',
              fontSize: '14px',
            },
            success: { iconTheme: { primary: 'var(--brand-500)', secondary: '#111811' } },
            error: { iconTheme: { primary: '#64748b', secondary: '#111811' } },
            duration: 3000,
          }}
        />
      </body>
    </html>
  );
}
