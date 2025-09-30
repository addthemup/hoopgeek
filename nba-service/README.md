# NBA Data Service

A Python FastAPI service that integrates the `nba_api` library with Supabase to provide NBA player data for the HoopGeek fantasy basketball app.

## Features

- Fetch NBA player data using the official `nba_api` library
- Sync player data to Supabase database
- RESTful API endpoints for frontend consumption
- CORS enabled for frontend integration

## Setup

### 1. Install Dependencies

```bash
cd nba-service
pip install -r requirements.txt
```

### 2. Environment Variables

Create a `.env` file:

```bash
cp .env.example .env
```

Update the `.env` file with your Supabase credentials:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Run the Service

```bash
python main.py
```

The service will be available at `http://localhost:8000`

## API Endpoints

### GET `/`
Health check endpoint

### GET `/players`
Get all NBA players from Supabase

### POST `/sync-players`
Sync NBA players data from nba_api to Supabase

### GET `/player/{player_id}/stats`
Get specific player stats

## Integration with Frontend

The frontend can connect to this service in two ways:

### Option 1: Direct API Calls
```typescript
const response = await fetch('http://localhost:8000/players')
const data = await response.json()
```

### Option 2: Supabase Edge Functions
Deploy the Edge Function to Supabase and call it from the frontend:

```typescript
const { data } = await supabase.functions.invoke('fetch-nba-players')
```

## Deployment

### Local Development
```bash
python main.py
```

### Production (Docker)
```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Deploy to Railway/Render/Heroku
1. Connect your GitHub repository
2. Set environment variables
3. Deploy

## Data Flow

1. **nba_api** → Fetches player data from NBA.com APIs
2. **Python Service** → Processes and formats the data
3. **Supabase** → Stores the data in PostgreSQL
4. **Frontend** → Queries Supabase for player data

## Notes

- The `nba_api` library requires internet access to fetch data from NBA.com
- Player salaries are not available in the free NBA API and would need to be sourced separately
- The service includes rate limiting and error handling for robust operation
