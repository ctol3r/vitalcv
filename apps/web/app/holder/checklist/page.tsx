'use client';

import { HolderSubNav } from '@/components/holder/HolderSubNav';
import RoleChecklist from '@/components/holder/RoleChecklist';

export default function HolderChecklistPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 pt-10">
        <HolderSubNav />
      </div>
      <RoleChecklist />
    </main>
  );
}
