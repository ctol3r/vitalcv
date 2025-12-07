# Credential Directory Sample App

A Next.js application demonstrating how to use the Chai VC Platform API to fetch and display credential information.

## Features

- Search credentials by provider NPI
- Filter by credential type and status
- Display credential details
- Responsive design

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local`:
```env
NEXT_PUBLIC_API_URL=https://api.example.com/graphql
NEXT_PUBLIC_API_KEY=your-api-key-here
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Usage

1. Enter a provider NPI in the search box
2. Click "Search" to fetch credentials
3. View credential details in the results

## Code Structure

- `pages/index.tsx` - Main page with search functionality
- `components/CredentialCard.tsx` - Component for displaying credential info
- `lib/api.ts` - API client wrapper
- `lib/types.ts` - TypeScript type definitions

## API Integration

This sample uses the following GraphQL query:

```graphql
query GetCredentials($providerNpi: String!) {
  credentials(providerNpi: $providerNpi) {
    items {
      id
      name
      issuer
      type
      status
      issuedAt
      expiresAt
    }
    totalCount
  }
}
```

