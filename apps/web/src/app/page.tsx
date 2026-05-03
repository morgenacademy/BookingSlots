import Link from 'next/link';
import { Nav } from '@/components/nav';

export default function HomePage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-24 text-center space-y-8">
        <h1 className="font-display text-6xl tracking-tight">House of Eve</h1>
        <p className="text-hoe-muted text-lg">
          Reformer, Barre en Yoga — op jouw ritme.
        </p>
        <div className="flex justify-center gap-4 pt-4">
          <Link href="/prijzen" className="hoe-btn-primary !w-auto px-8">
            Bekijk prijzen
          </Link>
          <Link href="/rooster" className="hoe-btn-ghost">
            Rooster
          </Link>
        </div>
      </main>
    </>
  );
}
