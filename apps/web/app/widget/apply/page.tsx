import { Suspense } from 'react';
import ApplyWidgetContent from './ApplyWidgetContent';

export default function ApplyWidgetPage() {
  return (
    <Suspense fallback={<div className="min-h-[240px] bg-background p-4" />}>
      <ApplyWidgetContent />
    </Suspense>
  );
}
