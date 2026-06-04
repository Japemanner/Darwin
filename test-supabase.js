import { createClient } from '@supabase/supabase-js'

// Get environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

console.log('Supabase URL:', supabaseUrl)
console.log('Supabase Anon Key:', supabaseAnonKey ? 'Present' : 'Missing')

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Test connection
async function testConnection() {
  try {
    console.log('Testing Supabase connection...')
    const { data, error } = await supabase.from('profiles').select('id').limit(1)
    
    if (error) {
      console.error('Connection test failed:', error.message)
      process.exit(1)
    } else {
      console.log('Connection successful!')
      console.log('Test query result:', data)
    }
  } catch (error) {
    console.error('Connection test failed:', error.message)
    process.exit(1)
  }
}

testConnection()