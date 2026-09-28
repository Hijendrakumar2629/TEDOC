# Tender AI backend setup

1. Create a .env file in the project root with:
   OPENAI_API_KEY=your_openai_key_here
   PORT=4001

2. Start the backend:
   node server.js

3. Start the frontend:
   npm run dev

4. Upload a PDF or paste a public government tender URL in the app to run the review flow.

## Product recommendations

Product candidates are matched from a local catalog at `uploads/product-catalog.json`. The prototype does not ship with made-up product or BIS approval data. Import real products from an authorized catalog using `POST http://localhost:4001/api/products/import`:

```json
{
   "products": [
      {
         "id": "vendor-model-001",
         "name": "Product name from the authorized catalog",
         "brand": "Brand as listed by the source",
         "model": "Model identifier",
         "category": "Tender product category",
         "description": "Verified product specification",
         "standards": ["IS number exactly as sourced"],
         "bisLicenceNumber": "Licence number as sourced",
         "bisSourceUrl": "https://www.bis.gov.in/official-record",
         "sourceName": "Catalog/source name"
      }
   ]
}
```

Imported entries start as `Needs Verification`. To record an officer's manual verification, call `POST /api/products/{id}/verify` with `humanReviewed: true`, `verifiedBy`, the official BIS source URL, and the licence number. This only records that a human checked the source; the prototype does not connect to a BIS verification API and does not certify products itself. The catalog import and verification endpoints are intended for a local prototype and must be protected by authentication and authorization before deployment.

`GET /api/products` lists the local catalog. Tender analysis returns matching candidates, matched terms, source metadata, and a warning to verify technical fit and current licence status. No match means there is no matching product in the local catalog, not that compliant products do not exist.
