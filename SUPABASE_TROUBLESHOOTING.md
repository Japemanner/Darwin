# Supabase Connection Troubleshooting Guide

## Common Issues and Solutions

### 1. Environment Variables Not Set
**Problem**: The application can't connect to Supabase because the environment variables are missing or incorrect.

**Solution**: 
- Ensure you have a `.env` file in the project root
- The file should contain:
  ```
  VITE_SUPABASE_URL=your-actual-supabase-url
  VITE_SUPABASE_ANON_KEY=your-actual-anon-key
  ```
- Replace `your-actual-supabase-url` and `your-actual-anon-key` with your real Supabase credentials

### 2. Profile Data Not Loading
**Problem**: User profiles aren't loading after login.

**Solution**:
- Check that the `profiles` table exists in your Supabase database
- Verify that the table has the correct structure:
  - `id` (UUID, primary key)
  - `organization_id` (UUID)
  - `full_name` (TEXT)
  - `avatar_url` (TEXT, nullable)
  - `role` (ENUM: 'admin' or 'member')
  - `created_at` (TIMESTAMP)
  - `updated_at` (TIMESTAMP)
- Ensure Row Level Security (RLS) policies allow users to read their own profiles

### 3. Login Hanging or Failing
**Problem**: The login process hangs or fails with no clear error.

**Solution**:
- Check browser console for JavaScript errors
- Verify Supabase credentials are correct
- Increase timeout in `src/store/authStore.ts` (already updated to 10 seconds)
- Check Supabase Auth settings in the dashboard

### 4. Testing Connection
To test your Supabase connection:
1. Run `node test-supabase.js` in the project root
2. Check the output for any error messages

### 5. Production Deployment
When deploying to Netlify:
- Set environment variables in the Netlify dashboard:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Ensure the redirect rules in `netlify.toml` are correct (they are)