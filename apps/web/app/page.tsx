import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-8">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle>VitalCV Demo</CardTitle>
          <CardDescription>Select your role</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Link href="/holder" className="block">
            <Button className="h-12 w-full text-lg" variant="default">
              Holder (Clinician)
            </Button>
          </Link>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>
          <Link href="/verifier" className="block">
            <Button className="h-12 w-full text-lg" variant="outline">
              Verifier (Employer)
            </Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
