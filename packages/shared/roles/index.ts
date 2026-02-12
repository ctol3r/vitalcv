export type Holder = Readonly<{
  holder_id: string;
  did?: string;
  npi?: string;
}>;

export type Issuer = Readonly<{
  issuer_id: string;
  verification_method: string;
}>;

export type Verifier = Readonly<{
  verifier_id: string;
  purpose: 'employment';
}>;
