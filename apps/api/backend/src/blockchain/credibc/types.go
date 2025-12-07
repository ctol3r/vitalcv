package credibc

// CredentialEvidencePacketData defines the packet payload for transferring credential evidence via IBC.
type CredentialEvidencePacketData struct {
	CredentialID string `json:"credential_id"`
	Issuer       string `json:"issuer"`
	Evidence     string `json:"evidence"`
}
