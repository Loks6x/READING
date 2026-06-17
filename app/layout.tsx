// app/layout.tsx
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="antialiased overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}