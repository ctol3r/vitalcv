from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, found {count}')
    p.write_text(text.replace(old, new, 1))

catalog = 'apps/api/backend/src/services/identity/sourceCatalog.ts'
text = Path(catalog).read_text()
if "| 'LICENSE_REPORTED'" not in text:
    replace_once(catalog, "  | 'LICENSE'                // state professional license\n", "  | 'LICENSE_REPORTED'       // license number/state reported by a non-authority source\n  | 'LICENSE'                // state professional license\n")
    replace_once(
        catalog,
        "  | 'AUTHORITY_UNAVAILABLE'; // authority contract unavailable / unresolved\n",
        """  | 'PROFESSIONAL_NAME'
  | 'PROFILE_PHOTO'
  | 'PROFESSIONAL_HEADLINE'
  | 'PROFESSIONAL_SUMMARY'
  | 'PRONOUNS'
  | 'LANGUAGE'
  | 'PUBLIC_CONTACT_POINT'
  | 'PROFESSIONAL_PROFILE_URL'
  | 'LICENSE_PRIVILEGE'
  | 'PROFESSIONAL_CERTIFICATION'
  | 'CERTIFICATION_MAINTENANCE'
  | 'CONTROLLED_SUBSTANCE_REGISTRATION'
  | 'EDUCATION'
  | 'DEGREE'
  | 'MEDICAL_SCHOOL'
  | 'POSTGRADUATE_TRAINING'
  | 'RESIDENCY'
  | 'FELLOWSHIP'
  | 'INTERNSHIP'
  | 'CME_CE_CREDIT'
  | 'EMPLOYMENT'
  | 'ACADEMIC_APPOINTMENT'
  | 'FACILITY_AFFILIATION'
  | 'HOSPITAL_AFFILIATION'
  | 'HOSPITAL_PRIVILEGE'
  | 'DEPARTMENT_AFFILIATION'
  | 'LEADERSHIP_ROLE'
  | 'TELEHEALTH_CAPABILITY'
  | 'CLINICAL_INTEREST'
  | 'SKILL'
  | 'VISIT_REASON'
  | 'PROCEDURE_CAPABILITY'
  | 'PROCEDURE_VOLUME'
  | 'PATIENT_POPULATION'
  | 'INSURANCE_ACCEPTANCE'
  | 'AVAILABILITY'
  | 'PRESENTATION'
  | 'RESEARCH_GRANT'
  | 'RESEARCH_TOPIC'
  | 'AWARD'
  | 'PROFESSIONAL_MEMBERSHIP'
  | 'COMMITTEE_ROLE'
  | 'AUTHORED_CONTENT'
  | 'MEDIA_MENTION'
  | 'MALPRACTICE_COVERAGE'
  | 'MALPRACTICE_HISTORY'
  | 'ADVERSE_ACTION'
  | 'CLINICAL_PRIVILEGE_HISTORY'
  | 'WORK_HISTORY_GAP'
  | 'PROFESSIONAL_REFERENCE'
  | 'PEER_REFERENCE'
  | 'BACKGROUND_CHECK'
  | 'HEALTH_REQUIREMENT'
  | 'AUTHORITY_UNAVAILABLE'; // authority contract unavailable / unresolved
""",
    )
    replace_once(
        catalog,
        "claimTypes: ['NPI_IDENTITY', 'PERSONAL_IDENTITY', 'SPECIALTY', 'PRACTICE_LOCATION', 'MAILING_ADDRESS', 'ENDPOINT'],\n    parserVersion: 'v1.2.0', envFlag: 'NPPES_API_ENABLED'",
        "claimTypes: ['NPI_IDENTITY', 'PERSONAL_IDENTITY', 'SPECIALTY', 'LICENSE_REPORTED', 'PRACTICE_LOCATION', 'MAILING_ADDRESS', 'ENDPOINT'],\n    parserVersion: 'v1.3.0', envFlag: 'NPPES_API_ENABLED'",
    )
    replace_once(
        catalog,
        "claimTypes: ['NPI_IDENTITY', 'PERSONAL_IDENTITY', 'SPECIALTY', 'PRACTICE_LOCATION', 'MAILING_ADDRESS', 'ENDPOINT'],\n    parserVersion: 'v1.0.0', envFlag: 'NPPES_BULK_ENABLED'",
        "claimTypes: ['NPI_IDENTITY', 'PERSONAL_IDENTITY', 'SPECIALTY', 'LICENSE_REPORTED', 'PRACTICE_LOCATION', 'MAILING_ADDRESS', 'ENDPOINT'],\n    parserVersion: 'v1.0.0', envFlag: 'NPPES_BULK_ENABLED'",
    )

model = 'apps/api/backend/src/services/identity/evidenceModel.ts'
if 'export interface ReportedLicenseValue' not in Path(model).read_text():
    replace_once(model, "  | EnrollmentValue\n  | LicenseValue\n", "  | EnrollmentValue\n  | ReportedLicenseValue\n  | LicenseValue\n")
    replace_once(model, "export interface LicenseValue {\n", """/** License data reported by a non-authority source. Discovery only. */
export interface ReportedLicenseValue {
  _type: 'LICENSE_REPORTED';
  state: string;
  licenseNumber: string;
  taxonomyCode: string | null;
  taxonomyDescription: string | null;
  source: string;
  authorityConfirmed: false;
  sourceDisclaimer: string;
  usageRestrictions: string[];
}

export interface LicenseValue {
""")

engine = 'apps/api/backend/src/services/identity/claimEngine.ts'
if 'type ReportedLicenseValue' not in Path(engine).read_text():
    replace_once(engine, "  type SpecialtyValue,\n  type PracticeLocationValue,", "  type SpecialtyValue,\n  type ReportedLicenseValue,\n  type PracticeLocationValue,")
    replace_once(engine, "const NPPES_PARSER_VERSION = 'v1.2.0';", "const NPPES_PARSER_VERSION = 'v1.3.0';")
    replace_once(
        engine,
        """      const sClaim = makeClaim({ ...base, claimType: 'SPECIALTY', subjectNpi: npi, value: specialtyValue, confidence: 'HIGH', confidenceScore: 0.95 });
      claims.push(sClaim);
""",
        """      const sClaim = makeClaim({ ...base, claimType: 'SPECIALTY', subjectNpi: npi, value: specialtyValue, confidence: 'HIGH', confidenceScore: 0.95 });
      claims.push(sClaim);

      // Additive only: preserve the historical SPECIALTY claim bytes and ID.
      if (tax.state?.trim() && tax.license?.trim()) {
        const value: ReportedLicenseValue = {
          _type: 'LICENSE_REPORTED',
          state: tax.state.trim().toUpperCase(),
          licenseNumber: tax.license.trim(),
          taxonomyCode: tax.code,
          taxonomyDescription: tax.desc ?? null,
          source: 'NPPES_API',
          authorityConfirmed: false,
          sourceDisclaimer: 'License number and state are reported in NPPES; CMS does not validate licensure or standing when issuing an NPI.',
          usageRestrictions: [
            'cannot imply active license status',
            'cannot imply good standing',
            'requires licensing-authority confirmation for decision use',
          ],
        };
        const claim = makeClaim({
          ...base,
          claimType: 'LICENSE_REPORTED',
          subjectNpi: npi,
          value,
          confidence: 'HIGH',
          confidenceScore: 0.95,
          status: 'UNVERIFIED',
          reviewRequired: true,
          reviewReason: 'NPPES is not the licensing authority. Confirm status and standing with the relevant board.',
        });
        claims.push(claim);
        receipts.push(buildReceipt(
          claim,
          'licenseNumber',
          `${value.state} license ${value.licenseNumber} is reported in NPPES; licensing-authority confirmation has not been completed.`,
        ));
      }
""",
    )
