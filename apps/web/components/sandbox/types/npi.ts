export type SourceStatus = 'Checked' | 'Pending' | 'Access Required';

export interface NPPESData {
  firstName: string;
  lastName: string;
  enumerationDate: string;
  specialty: string;
  status: SourceStatus;
}

export interface OIGData {
  exclusionStatus: boolean;
  lastChecked: string;
  status: SourceStatus;
}

export interface FSMBData {
  licenseNumber: string;
  state: string;
  expirationDate: string;
  status: SourceStatus;
}

export interface PECOSData {
  enrolled: boolean;
  status: SourceStatus;
}

export interface NPIDataResponse {
  npi: string;
  timestamp: string;
  identity: NPPESData;
  sanctions: OIGData;
  licensure: FSMBData;
  pecos: PECOSData;
  readinessScore: number;
}
