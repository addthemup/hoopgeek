# PDF Parsing Note

## Current Implementation (unpdf via esm.sh)

The function uses **unpdf** (https://github.com/unjs/unpdf) via `https://esm.sh/unpdf@0.6.1` for PDF text extraction. unpdf provides a serverless build of Mozilla PDF.js that works in Deno Edge Functions. The previous `deno.land/x/pdfjs` module was removed/changed and caused "Module not found" errors.

## Fallback / Alternatives

If unpdf fails in production, consider:

## Option 1: Use External PDF-to-Text Service

Use a service like:
- **PDF.co API** (has free tier)
- **Adobe PDF Services API**
- **CloudConvert API**

Example integration:
```typescript
async function parsePdfViaService(pdfBytes: Uint8Array): Promise<string> {
  const formData = new FormData()
  formData.append('file', new Blob([pdfBytes], { type: 'application/pdf' }))
  
  const response = await fetch('https://api.pdf.co/v1/pdf/convert/to/text', {
    method: 'POST',
    headers: {
      'x-api-key': 'YOUR_API_KEY'
    },
    body: formData
  })
  
  return await response.text()
}
```

## Option 2: Use Python Script (Recommended)

Create a separate Python script that runs on a schedule:

```python
# scripts/setup/fetch_injuries_pdf.py
import requests
from PyPDF2 import PdfReader
from supabase import create_client

def fetch_and_parse_injury_pdf():
    # Fetch PDF
    url = "https://ak-static.cms.nba.com/referee/injury/Injury-Report_2025-12-04_08AM.pdf"
    response = requests.get(url)
    
    # Parse PDF
    pdf = PdfReader(response.content)
    text = ""
    for page in pdf.pages:
        text += page.extract_text()
    
    # Parse and store injuries
    # ... (rest of logic)
```

Then call this script via cron or as a separate service.

## Option 3: Basic Text Extraction (Current Fallback)

The current implementation includes a basic fallback that extracts readable text from PDF bytes. This may work for simple PDFs but is not reliable for complex formats.

## Recommendation

For now, the function will attempt PDF parsing but may fail. Consider:
1. Using the Python script approach (most reliable)
2. Integrating an external PDF-to-text service
3. Using a different data source (if available)

