import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  try {
    const { data, error } = await supabase
      .from('floorplans')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    res.status(200).json({ floorplans: data })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
