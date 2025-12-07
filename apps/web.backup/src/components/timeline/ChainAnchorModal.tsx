import React from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
} from '@/components/design/Modal';

interface ChainAnchorModalProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
  txHash?: string;
  blockNumber?: number;
  anchoredHash?: string;
  rpcUrl?: string;
}

export function ChainAnchorModal({
  isOpen,
  onClose,
  txHash,
  blockNumber,
  anchoredHash,
  rpcUrl,
}: ChainAnchorModalProps) {
  return (
    <Modal open={isOpen} onOpenChange={onClose}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Chain Anchor Details</ModalTitle>
          <ModalDescription>
            Blockchain verification details for this event.
          </ModalDescription>
        </ModalHeader>

        <div className="space-y-4 py-4">
          {txHash && (
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Transaction Hash
              </label>
              <div className="mt-1 p-2 bg-muted rounded font-mono text-xs break-all">
                {txHash}
              </div>
            </div>
          )}

          {blockNumber !== undefined && (
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Block Number
              </label>
              <div className="mt-1 font-mono text-sm">
                {blockNumber}
              </div>
            </div>
          )}

          {anchoredHash && (
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Anchored Hash
              </label>
              <div className="mt-1 p-2 bg-muted rounded font-mono text-xs break-all">
                {anchoredHash}
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Network
            </label>
            <div className="mt-1 text-sm">
              Substrate ({rpcUrl || 'Polkadot/Kusama/Parachain'})
            </div>
          </div>

          {txHash && (
            <div className="pt-2 flex justify-end">
              <a
                href={`https://polkadot.js.org/apps/?rpc=${encodeURIComponent(
                  rpcUrl || 'wss://rpc.polkadot.io'
                )}#/explorer/query/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline text-sm font-medium"
              >
                View on Explorer &rarr;
              </a>
            </div>
          )}
        </div>
      </ModalContent>
    </Modal>
  );
}














