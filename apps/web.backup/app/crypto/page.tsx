"use client";
import SDCard from '@/app/components/SelectiveDisclosureCard';

export default function CryptoHub() {
  return (
    <div className='max-w-3xl mx-auto py-8 px-4'>
      <h1 className='text-2xl font-bold mb-2'>Selective Disclosure Demos</h1>
      <p className='text-sm text-gray-600 mb-6'>
        Explore production-ready SD-JWT and BBS+ signature demos
      </p>
      <SDCard />
    </div>
  );
}

