# FloorPlan Finder

AI-powered vehicle floorplan search tool. Upload floorplan images and search them by describing what you're looking for.

## Setup

### 1. Supabase Setup
1. Go to your Supabase project
2. Go to **SQL Editor** and run this SQL:

```sql
-- Create floorplans table
create table floorplans (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  file_name text,
  file_url text,
  file_path text,
  vehicle_type text,
  length text,
  bedroom text,
  bathroom text,
  kitchen text,
  living_area text,
  slides text,
  special_features text,
  entry text,
  description text,
  search_tags text[],
  full_analysis jsonb
);

-- Create storage bucket
insert into storage.buckets (id, name, public) values ('floorplans', 'floorplans', true);

-- Allow public access to storage
create policy "Public Access" on storage.objects for all using (bucket_id = 'floorplans');
```

### 2. Deploy to Vercel
1. Push this code to a GitHub repo
2. Go to vercel.com and import the repo
3. Add these environment variables in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL` 
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY`

## Usage
- **Upload tab**: Drop floorplan images (JPG, PNG) — Claude analyzes each one automatically
- **Search tab**: Describe what you're looking for in plain English
- **Library tab**: Browse all uploaded floorplans
