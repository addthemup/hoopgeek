# Migrate OG Images to Cloudflare R2

## Why R2?
- **10GB free tier** (vs 50MB Supabase)
- **200x more capacity** at same price ($0)
- **Same ecosystem** - you're already on Cloudflare
- **No egress fees** - unlike S3

## Setup Steps

### 1. Create R2 Bucket
1. Go to Cloudflare Dashboard → R2
2. Create bucket named `og-images`
3. Make it public (or use custom domain)

### 2. Get R2 Credentials
1. R2 Dashboard → Manage R2 API Tokens
2. Create API token with read/write permissions
3. Save: `Account ID`, `Access Key ID`, `Secret Access Key`

### 3. Update Edge Function

Update `supabase/functions/generate-og-image/index.ts` to upload to R2:

```typescript
// Add at top of file
import { S3Client, PutObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3.490.0'

// R2 is S3-compatible
const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID')
const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID')
const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY')
const R2_BUCKET_NAME = 'og-images'

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID!,
    secretAccessKey: R2_SECRET_ACCESS_KEY!,
  },
})

// Replace Supabase Storage upload with:
const filePath = `feed-posts/${post_id}.${fileExt}`

const uploadCommand = new PutObjectCommand({
  Bucket: R2_BUCKET_NAME,
  Key: filePath,
  Body: imageData,
  ContentType: contentType,
  CacheControl: 'public, max-age=31536000', // 1 year cache
})

await r2Client.send(uploadCommand)

// Get public URL
const publicUrl = `https://pub-${R2_ACCOUNT_ID}.r2.dev/${filePath}`
// OR use custom domain if configured
// const publicUrl = `https://og-images.yourdomain.com/${filePath}`
```

### 4. Set Environment Variables
In Supabase Dashboard → Edge Functions → Settings:
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

### 5. Test Migration
1. Deploy updated Edge Function
2. Generate one test image
3. Verify it's in R2 bucket
4. Check public URL works

### 6. Migrate Existing Images (Optional)
If you want to move existing images:
```bash
# Script to download from Supabase and upload to R2
# Can create a migration script if needed
```

## Cost Comparison

| Storage | Supabase Free | Cloudflare R2 Free |
|---------|--------------|-------------------|
| Limit | 50 MB | 10 GB |
| Images (2.19KB each) | ~22,800 | ~4.5 million |
| Cost | $0 | $0 |

**R2 gives you 200x more storage for free!**

## Next Steps

Would you like me to:
1. **Implement R2 migration** - Update Edge Function to use R2?
2. **Implement on-demand generation** - Generate images on-the-fly instead of storing?
3. **Both** - Generate on-demand, cache in R2?

