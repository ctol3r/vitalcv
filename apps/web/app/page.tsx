import { Button } from '@/components/ui/button'
import { Shield } from 'lucide-react'
import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center p-4">
      <div className="max-w-md space-y-8">
        <div className="flex justify-center">
          <Shield className="h-16 w-16 text-blue-600" />
        </div>

        <div className="space-y-4">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            VitalCV Active
          </h1>
          <p className="text-gray-600 text-lg">
            This system exists to remove friction from credentialing.
            It appears only when verification is required.
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-900">For Clinicians</h3>
            <p className="text-sm text-gray-500">
              Need to prove your authority to an employer?
            </p>
            <Button asChild className="w-full">
              <Link href="/onboarding">Verify Identity & Get Recognition</Link>
            </Button>
          </div>

          <div className="pt-4 border-t space-y-2">
            <h3 className="font-semibold text-gray-900">For Employers</h3>
            <p className="text-sm text-gray-500">
              To verify a clinician, please request their
              <strong> VitalCV Recognition Link</strong>.
            </p>
          </div>
        </div>

        <p className="text-xs text-gray-400">
          Antigravity Contract: Active
        </p>
      </div>
    </main>
  )
}
