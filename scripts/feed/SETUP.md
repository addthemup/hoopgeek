# OG Image Generation Setup

## Quick Start

### 1. Install Dependencies

```bash
pip install Pillow requests supabase
```

### 2. Set Up Backend Endpoint

You need to create an endpoint that calls the Python script. Options:

#### Option A: Supabase Edge Function (Recommended)

```bash
supabase functions new generate-og-image
```

Then call the Python script via subprocess or HTTP request.

#### Option B: Simple API Server

Create a simple Flask/FastAPI endpoint:

```python
from flask import Flask, request, jsonify
import subprocess
import os

app = Flask(__name__)

@app.route('/api/generate-og-image', methods=['POST'])
def generate_og_image():
    data = request.json
    # Call Python script
    result = subprocess.run([
        'python3',
        'scripts/feed/generate_and_upload_og.py',
        data['post_id'],
        os.getenv('SUPABASE_URL'),
        os.getenv('SUPABASE_SERVICE_ROLE_KEY'),
        json.dumps({
            'team_tricodes': data.get('team_tricodes'),
            'player_ids': data.get('player_ids'),
            'metadata': data.get('metadata'),
            'game_date': data.get('game_date'),
            'title': data.get('title')
        })
    ], capture_output=True, text=True)
    
    return jsonify({'og_image_url': result.stdout.strip()})
```

### 3. Uncomment API Call in FeedContentManager.tsx

Once your endpoint is set up, uncomment the API call in `generateOGImageForPost`.

## Testing

Test the script directly:

```bash
python3 scripts/feed/generate_og_image.py \
  test-post-id \
  /tmp/test-og.png \
  '{"team_tricodes":["LAL","BOS"],"metadata":{"story_data":{"awayScore":120,"homeScore":115}},"game_date":"2025-11-03T00:00:00Z","title":"Lakers vs Celtics"}'
```

## Notes

- Team logos use PNG versions from `global/S/logo.png` endpoints
- Player avatars from `cdn.nba.com/headshots/nba/latest/1040x760/{player_id}.png`
- Images are 1200x630px (optimal OG image ratio)
- Failed generations don't block post creation (async)

