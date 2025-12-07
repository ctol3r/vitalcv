import axios from 'axios';
import { z } from 'zod';
import { nppesService } from '../nppes';

export interface NormalizedProvider {
  id: string;
  region: 'US' | 'CA' | 'IN' | 'AU';
  type: 'individual' | 'organization';
  name: string;
  active: boolean;
  licenseNumber?: string;
  specialties: string[];
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country: string;
  };
  raw: any;
}

export class GlobalProviderAdapter {

  async getProvider(region: string, id: string): Promise<NormalizedProvider | null> {
    switch (region.toUpperCase()) {
      case 'US':
        return this.getUSProvider(id);
      case 'CA':
        return this.getCanadaProvider(id);
      case 'IN':
        return this.getIndiaProvider(id);
      case 'AU':
        return this.getAustraliaProvider(id);
      default:
        throw new Error(`Unsupported region: ${region}`);
    }
  }

  private async getUSProvider(npi: string): Promise<NormalizedProvider | null> {
    const provider = await nppesService.lookup(npi);
    if (!provider) return null;

    const type = provider.enumeration_type === 'NPI-2' ? 'organization' : 'individual';
    const name = nppesService.getProviderName(provider);
    const address = provider.addresses && provider.addresses.length > 0 ? provider.addresses[0] : undefined;

    return {
      id: provider.number,
      region: 'US',
      type,
      name,
      active: true, // NPPES providers are generally considered active if returned, logic can be refined
      specialties: provider.taxonomies?.map(t => t.desc) || [],
      address: address ? {
        street: address.address_1,
        city: address.city,
        state: address.state,
        postalCode: provider.addresses?.[0]?.postal_code, // Fix type inference if needed
        country: address.country_code
      } : undefined,
      raw: provider
    };
  }

  // College of Physicians & Surgeons (Canada) - Mock Implementation
  private async getCanadaProvider(license: string): Promise<NormalizedProvider | null> {
    // TODO: Integrate with CPSO API
    // Mock response
    if (license === '00000') return null;

    return {
      id: license,
      region: 'CA',
      type: 'individual',
      name: 'Dr. Canadian Physician',
      active: true,
      licenseNumber: license,
      specialties: ['Family Medicine'],
      address: {
        city: 'Toronto',
        state: 'ON',
        country: 'CA'
      },
      raw: { mock: true, license }
    };
  }

  // NMC (India) - Mock Implementation
  private async getIndiaProvider(registration: string): Promise<NormalizedProvider | null> {
    // TODO: Integrate with NMC API
    if (registration === '00000') return null;

    return {
      id: registration,
      region: 'IN',
      type: 'individual',
      name: 'Dr. Indian Physician',
      active: true,
      licenseNumber: registration,
      specialties: ['General Practice'],
      address: {
        city: 'Mumbai',
        state: 'MH',
        country: 'IN'
      },
      raw: { mock: true, registration }
    };
  }

  // AHPRA (Australia) - Mock Implementation
  private async getAustraliaProvider(providerId: string): Promise<NormalizedProvider | null> {
    // TODO: Integrate with AHPRA API
    if (providerId === '00000') return null;

    return {
      id: providerId,
      region: 'AU',
      type: 'individual',
      name: 'Dr. Australian Physician',
      active: true,
      licenseNumber: providerId,
      specialties: ['General Practice'],
      address: {
        city: 'Sydney',
        state: 'NSW',
        country: 'AU'
      },
      raw: { mock: true, providerId }
    };
  }
}

export const globalProviderAdapter = new GlobalProviderAdapter();














