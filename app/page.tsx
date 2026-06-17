// app/page.tsx
import Reader from '../components/Reader';

export const metadata = {
  title: 'Apple-like PWA Reader',
  description: 'Premium offline reader with AI',
};

export default function Home() {
  return <Reader />;
}