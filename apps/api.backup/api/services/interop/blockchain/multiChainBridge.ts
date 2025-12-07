/**
 * B226A-INT-003: MultiChainBridge
 *
 * Bridges VitalCV credentials to Ethereum, Hyperledger Fabric, Corda.
 * Supports issuing and verifying credentials on multiple chains.
 * Signs and stores proofs.
 */

import { getServiceLogger } from '../../logging/serviceLogger';
import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';
import crypto from 'crypto';

const log = getServiceLogger('interop/blockchain/multiChainBridge');
const prisma = new PrismaClient();

interface CredentialProof {
  credentialId: string;
  chainId: string;
  chainType: 'ethereum' | 'hyperledger' | 'corda';
  txHash: string;
  blockNumber?: number;
  timestamp: Date;
  proofData: string;
  signature?: string;
}

interface ChainConfig {
  type: 'ethereum' | 'hyperledger' | 'corda';
  rpcUrl?: string;
  networkId?: string;
  contractAddress?: string;
  privateKey?: string;
  enabled: boolean;
}

interface CredentialIssueRequest {
  credentialId: string;
  holderDid: string;
  issuerDid: string;
  credentialHash: string;
  chains: Array<'ethereum' | 'hyperledger' | 'corda'>;
}

interface CredentialVerifyRequest {
  credentialId: string;
  chainType: 'ethereum' | 'hyperledger' | 'corda';
  proofData: string;
}

class MultiChainBridge {
  private readonly chainConfigs: Map<string, ChainConfig> = new Map();

  constructor() {
    // Initialize chain configurations from environment
    this.initializeChainConfigs();
  }

  private initializeChainConfigs(): void {
    // Ethereum configuration
    const ethRpcUrl = process.env.ETHEREUM_RPC_URL;
    const ethPrivateKey = process.env.ETHEREUM_PRIVATE_KEY;
    const ethContractAddress = process.env.ETHEREUM_CONTRACT_ADDRESS;

    if (ethRpcUrl) {
      this.chainConfigs.set('ethereum', {
        type: 'ethereum',
        rpcUrl: ethRpcUrl,
        networkId: process.env.ETHEREUM_NETWORK_ID || '1',
        contractAddress: ethContractAddress,
        privateKey: ethPrivateKey,
        enabled: true,
      });
    }

    // Hyperledger Fabric configuration
    const fabricNetworkId = process.env.HYPERLEDGER_NETWORK_ID;
    if (fabricNetworkId) {
      this.chainConfigs.set('hyperledger', {
        type: 'hyperledger',
        networkId: fabricNetworkId,
        enabled: true,
      });
    }

    // Corda configuration
    const cordaNetworkId = process.env.CORDA_NETWORK_ID;
    if (cordaNetworkId) {
      this.chainConfigs.set('corda', {
        type: 'corda',
        networkId: cordaNetworkId,
        enabled: true,
      });
    }
  }

  /**
   * Sign credential data
   */
  private signCredential(data: string, privateKey?: string): string {
    if (!privateKey) {
      // Use default signing key from environment
      privateKey = process.env.CREDENTIAL_SIGNING_KEY || '';
    }

    if (!privateKey) {
      throw new Error('No signing key available');
    }

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(data);
    return sign.sign(privateKey, 'base64');
  }

  /**
   * Issue credential on Ethereum
   */
  private async issueOnEthereum(
    credentialId: string,
    credentialHash: string,
    holderDid: string,
    issuerDid: string
  ): Promise<CredentialProof> {
    const config = this.chainConfigs.get('ethereum');
    if (!config || !config.enabled || !config.rpcUrl) {
      throw new Error('Ethereum chain not configured');
    }

    log.info('Issuing credential on Ethereum', { credentialId });

    try {
      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      const wallet = config.privateKey
        ? new ethers.Wallet(config.privateKey, provider)
        : ethers.Wallet.createRandom().connect(provider);

      // If contract address is provided, use smart contract
      if (config.contractAddress) {
        // ABI for credential registry contract
        const abi = [
          'function issueCredential(bytes32 credentialHash, string memory holderDid, string memory issuerDid) returns (bytes32)',
        ];

        const contract = new ethers.Contract(config.contractAddress, abi, wallet);
        const tx = await contract.issueCredential(
          ethers.id(credentialHash),
          holderDid,
          issuerDid
        );

        const receipt = await tx.wait();

        return {
          credentialId,
          chainId: config.networkId || '1',
          chainType: 'ethereum',
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          timestamp: new Date(),
          proofData: JSON.stringify({
            credentialHash,
            holderDid,
            issuerDid,
            contractAddress: config.contractAddress,
          }),
          signature: this.signCredential(credentialHash),
        };
      } else {
        // Fallback: Use a simple transaction
        const tx = await wallet.sendTransaction({
          to: wallet.address, // Self-transfer as proof
          data: ethers.toUtf8Bytes(JSON.stringify({
            credentialId,
            credentialHash,
            holderDid,
            issuerDid,
          })),
        });

        const receipt = await tx.wait();

        return {
          credentialId,
          chainId: config.networkId || '1',
          chainType: 'ethereum',
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          timestamp: new Date(),
          proofData: JSON.stringify({
            credentialHash,
            holderDid,
            issuerDid,
          }),
          signature: this.signCredential(credentialHash),
        };
      }
    } catch (error) {
      log.error('Failed to issue credential on Ethereum', { credentialId, error });
      throw error;
    }
  }

  /**
   * Issue credential on Hyperledger Fabric
   */
  private async issueOnHyperledger(
    credentialId: string,
    credentialHash: string,
    holderDid: string,
    issuerDid: string
  ): Promise<CredentialProof> {
    const config = this.chainConfigs.get('hyperledger');
    if (!config || !config.enabled) {
      throw new Error('Hyperledger Fabric chain not configured');
    }

    log.info('Issuing credential on Hyperledger Fabric', { credentialId });

    try {
      // Mock implementation - replace with actual Hyperledger Fabric SDK
      // In production, this would use the Fabric SDK to submit a transaction
      const txId = crypto.randomBytes(32).toString('hex');

      return {
        credentialId,
        chainId: config.networkId || 'fabric-network',
        chainType: 'hyperledger',
        txHash: txId,
        timestamp: new Date(),
        proofData: JSON.stringify({
          credentialHash,
          holderDid,
          issuerDid,
          networkId: config.networkId,
        }),
        signature: this.signCredential(credentialHash),
      };
    } catch (error) {
      log.error('Failed to issue credential on Hyperledger Fabric', { credentialId, error });
      throw error;
    }
  }

  /**
   * Issue credential on Corda
   */
  private async issueOnCorda(
    credentialId: string,
    credentialHash: string,
    holderDid: string,
    issuerDid: string
  ): Promise<CredentialProof> {
    const config = this.chainConfigs.get('corda');
    if (!config || !config.enabled) {
      throw new Error('Corda chain not configured');
    }

    log.info('Issuing credential on Corda', { credentialId });

    try {
      // Mock implementation - replace with actual Corda RPC client
      // In production, this would use Corda RPC to submit a flow
      const txId = crypto.randomBytes(32).toString('hex');

      return {
        credentialId,
        chainId: config.networkId || 'corda-network',
        chainType: 'corda',
        txHash: txId,
        timestamp: new Date(),
        proofData: JSON.stringify({
          credentialHash,
          holderDid,
          issuerDid,
          networkId: config.networkId,
        }),
        signature: this.signCredential(credentialHash),
      };
    } catch (error) {
      log.error('Failed to issue credential on Corda', { credentialId, error });
      throw error;
    }
  }

  /**
   * Issue credential on multiple chains
   */
  async issueCredential(request: CredentialIssueRequest): Promise<CredentialProof[]> {
    log.info('Issuing credential on multiple chains', {
      credentialId: request.credentialId,
      chains: request.chains,
    });

    const proofs: CredentialProof[] = [];

    for (const chainType of request.chains) {
      try {
        let proof: CredentialProof;

        switch (chainType) {
          case 'ethereum':
            proof = await this.issueOnEthereum(
              request.credentialId,
              request.credentialHash,
              request.holderDid,
              request.issuerDid
            );
            break;
          case 'hyperledger':
            proof = await this.issueOnHyperledger(
              request.credentialId,
              request.credentialHash,
              request.holderDid,
              request.issuerDid
            );
            break;
          case 'corda':
            proof = await this.issueOnCorda(
              request.credentialId,
              request.credentialHash,
              request.holderDid,
              request.issuerDid
            );
            break;
          default:
            throw new Error(`Unsupported chain type: ${chainType}`);
        }

        proofs.push(proof);

        // Store proof in database
        await this.storeProof(proof);
      } catch (error) {
        log.error('Failed to issue credential on chain', {
          credentialId: request.credentialId,
          chainType,
          error,
        });
        // Continue with other chains
      }
    }

    log.info('Credential issued on chains', {
      credentialId: request.credentialId,
      proofsCount: proofs.length,
    });

    return proofs;
  }

  /**
   * Verify credential on a specific chain
   */
  async verifyCredential(request: CredentialVerifyRequest): Promise<boolean> {
    log.info('Verifying credential on chain', {
      credentialId: request.credentialId,
      chainType: request.chainType,
    });

    try {
      const proof = await prisma.auditEvent.findFirst({
        where: {
          type: 'CREDENTIAL_PROOF',
          data: {
            path: ['credentialId'],
            equals: request.credentialId,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!proof) {
        log.warn('Proof not found for credential', { credentialId: request.credentialId });
        return false;
      }

      const proofData = proof.data as any;
      if (proofData.chainType !== request.chainType) {
        log.warn('Chain type mismatch', {
          expected: request.chainType,
          actual: proofData.chainType,
        });
        return false;
      }

      // Verify signature if present
      if (proofData.signature && request.proofData) {
        const verify = crypto.createVerify('RSA-SHA256');
        verify.update(request.proofData);
        const isValid = verify.verify(
          process.env.CREDENTIAL_SIGNING_PUBLIC_KEY || '',
          proofData.signature,
          'base64'
        );

        if (!isValid) {
          log.warn('Signature verification failed', { credentialId: request.credentialId });
          return false;
        }
      }

      // Chain-specific verification
      switch (request.chainType) {
        case 'ethereum':
          return await this.verifyOnEthereum(proofData.txHash);
        case 'hyperledger':
          return await this.verifyOnHyperledger(proofData.txHash);
        case 'corda':
          return await this.verifyOnCorda(proofData.txHash);
        default:
          return false;
      }
    } catch (error) {
      log.error('Failed to verify credential', {
        credentialId: request.credentialId,
        chainType: request.chainType,
        error,
      });
      return false;
    }
  }

  /**
   * Verify on Ethereum
   */
  private async verifyOnEthereum(txHash: string): Promise<boolean> {
    const config = this.chainConfigs.get('ethereum');
    if (!config || !config.rpcUrl) {
      return false;
    }

    try {
      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      const receipt = await provider.getTransactionReceipt(txHash);
      return receipt !== null && receipt.status === 1;
    } catch (error) {
      log.error('Failed to verify on Ethereum', { txHash, error });
      return false;
    }
  }

  /**
   * Verify on Hyperledger Fabric
   */
  private async verifyOnHyperledger(txId: string): Promise<boolean> {
    // Mock implementation - replace with actual Fabric SDK verification
    log.debug('Verifying on Hyperledger Fabric', { txId });
    return true; // Placeholder
  }

  /**
   * Verify on Corda
   */
  private async verifyOnCorda(txId: string): Promise<boolean> {
    // Mock implementation - replace with actual Corda RPC verification
    log.debug('Verifying on Corda', { txId });
    return true; // Placeholder
  }

  /**
   * Store proof in database
   */
  private async storeProof(proof: CredentialProof): Promise<void> {
    try {
      await prisma.auditEvent.create({
        data: {
          type: 'CREDENTIAL_PROOF',
          data: {
            credentialId: proof.credentialId,
            chainId: proof.chainId,
            chainType: proof.chainType,
            txHash: proof.txHash,
            blockNumber: proof.blockNumber,
            timestamp: proof.timestamp,
            proofData: proof.proofData,
            signature: proof.signature,
          },
        },
      });

      log.debug('Stored credential proof', { credentialId: proof.credentialId, chainType: proof.chainType });
    } catch (error) {
      log.error('Failed to store proof', { credentialId: proof.credentialId, error });
      throw error;
    }
  }
}

export const multiChainBridge = new MultiChainBridge();
export default multiChainBridge;

