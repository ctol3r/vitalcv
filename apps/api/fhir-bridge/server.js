const express = require('express');
const fs = require('fs');
const app = express();

function mapVcToPractitionerQualification(vc) {
  const qualification = (vc.credentialSubject && vc.credentialSubject.qualification) || {};
  return {
    resourceType: 'PractitionerQualification',
    id: vc.id || 'vc-qualification',
    code: { text: qualification.code || '' },
    issuer: { display: qualification.issuer || vc.issuer || '' },
    period: {
      start: qualification.periodStart || '',
      end: qualification.periodEnd || ''
    }
  };
}

app.get('/practitionerQualification', (req, res) => {
  const path = process.env.VC_PATH || 'sample_vc.json';
  fs.readFile(path, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'VC not found' });
    }
    try {
      const vc = JSON.parse(data);
      const fhir = mapVcToPractitionerQualification(vc);
      res.json(fhir);
    } catch (e) {
      res.status(500).json({ error: 'Invalid VC JSON' });
    }
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`FHIR bridge running on port ${port}`));
