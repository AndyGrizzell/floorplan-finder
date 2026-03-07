import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const { id, file_path } = req.body

  try {
    if (file_path) {
      await supabase.storage.from('floorplans').remove([file_path])
    }
    const { error } = await supabase.from('floorplans').delete().eq('id', id)
    if (error) throw error
    res.status(200).json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
