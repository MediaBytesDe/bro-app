'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PWAStart() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);
  return (
    <div className="flex items-center justify-center h-screen bg-[#09090b] text-white">
      Laden...
    </div>
  );
}
