interface VerifierSettingsState {
  proofRequired: boolean;
  updatedAt: string;
}

let state: VerifierSettingsState = {
  proofRequired: false,
  updatedAt: new Date().toISOString(),
};

export function getVerifierSettings(): VerifierSettingsState {
  return { ...state };
}

export function setProofRequired(value: boolean): VerifierSettingsState {
  state = {
    proofRequired: value,
    updatedAt: new Date().toISOString(),
  };
  return getVerifierSettings();
}

export function isProofRequired(): boolean {
  return state.proofRequired;
}










