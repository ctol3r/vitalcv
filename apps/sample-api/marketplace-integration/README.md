# Marketplace Integration Sample App

A Python Flask application demonstrating how to integrate with the Chai VC Platform marketplace API.

## Features

- Browse marketplace modules
- Filter by capabilities
- View module details and pricing
- Simple REST API wrapper around GraphQL

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Create `.env`:
```env
API_URL=https://api.example.com/graphql
API_KEY=your-api-key-here
```

3. Run the application:
```bash
python app.py
```

4. Open [http://localhost:5000](http://localhost:5000)

## Usage

- `GET /modules` - List all modules
- `GET /modules?capability=credentialing` - Filter by capability
- `GET /modules/<module_id>` - Get module details

## Code Structure

- `app.py` - Flask application
- `api_client.py` - GraphQL API client
- `templates/` - HTML templates
- `static/` - CSS and JavaScript

## API Integration

This sample uses the following GraphQL query:

```graphql
query GetModules($capability: String) {
  modules(capability: $capability) {
    id
    name
    version
    description
    vendorName
    capabilities
    price
    currency
    licenseType
    averageRating
    ratingCount
  }
}
```

