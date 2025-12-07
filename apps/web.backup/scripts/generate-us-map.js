// Script to generate US map TopoJSON from us-atlas
// Run: node scripts/generate-us-map.js
// This will download the official US states TopoJSON and save it to public/us.json

const https = require('https');
const fs = require('fs');
const path = require('path');

const US_ATLAS_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';
const OUTPUT_PATH = path.join(__dirname, '..', 'public', 'us.json');

console.log('Downloading US TopoJSON from us-atlas...');

https.get(US_ATLAS_URL, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const json = JSON.parse(data);

      // Add postal codes to state properties for easier lookup
      const stateNames = {
        'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
        'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
        'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
        'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
        'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
        'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
        'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
        'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
        'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
        'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
        'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
        'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
        'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC',
        'Puerto Rico': 'PR'
      };

      // Add postal codes to each state geometry
      if (json.objects && json.objects.states && json.objects.states.geometries) {
        json.objects.states.geometries.forEach(state => {
          if (state.properties && state.properties.name) {
            state.properties.postal = stateNames[state.properties.name] || '';
          }
        });
      }

      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(json, null, 2));
      console.log(`✓ US TopoJSON saved to ${OUTPUT_PATH}`);
      console.log(`  States: ${json.objects.states.geometries.length}`);
    } catch (error) {
      console.error('Error processing TopoJSON:', error);
      process.exit(1);
    }
  });
}).on('error', (error) => {
  console.error('Error downloading US TopoJSON:', error);
  process.exit(1);
});

