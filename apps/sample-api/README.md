# Sample API Applications

> **Status (2026-07-04, Wave 0 re-baseline): reserved, not built.** This directory holds README placeholders only — no runnable code, no `package.json`, not a workspace member, nothing deploys. The apps described below (including `marketplace-integration/`) do not exist yet, and "Chai VC Platform" is legacy imported branding, not a VitalCV name. Treat everything below as an aspirational spec retained for reference.

B235C-API-026: Sample Applications demonstrating how to use the public API

This directory contains example applications demonstrating how to use the Chai VC Platform public API.

## Applications

### 1. Credential Directory (`credential-directory/`)

A simple web application that demonstrates:
- Fetching credentials by provider NPI
- Displaying credential information
- Filtering and searching credentials

**Technologies**: Next.js, TypeScript, React

**Usage**:
```bash
cd credential-directory
npm install
npm run dev
```

### 2. Marketplace Integration (`marketplace-integration/`)

An example integration showing:
- Browsing marketplace modules
- Filtering by capabilities
- Displaying module details and pricing

**Technologies**: Python, Flask

**Usage**:
```bash
cd marketplace-integration
pip install -r requirements.txt
python app.py
```

## Getting Started

1. **Get an API Key**: Sign up at `/demo/dev/signup`
2. **Clone the sample**: Choose the sample app that matches your tech stack
3. **Configure**: Add your API key to the configuration
4. **Run**: Follow the instructions in each sample's README

## Documentation

- [API Documentation](/demo/api/docs)
- [GraphQL Playground](/demo/api/playground)
- [Code Snippets](/demo/api/snippets)

## Contributing

Feel free to fork these samples and adapt them for your use case. Pull requests welcome!

