import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const { query } = req.body
  if (!query) return res.status(400).json({ error: 'Query is required' })

  try {
    // First ask Claude to interpret the search query
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `A user is searching for a vehicle floorplan with this description: "${query}"
          
          Extract the key search terms from this query. Return ONLY a JSON object like this:
          {
            "keywords": ["keyword1", "keyword2", ...],
            "vehicle_type": "type or empty string",
            "must_have": ["feature1", "feature2"]
          }
          
          Keywords should be short terms like: "rear bath", "front bedroom", "bunk beds", "two slides", "outdoor kitchen", "toy hauler", etc.`
        }]
      })
    })

    const claudeData = await claudeResponse.json()
    const interpretText = claudeData.content[0].text
    
    let searchTerms
    try {
      const jsonMatch = interpretText.match(/\{[\s\S]*\}/)
      searchTerms = jsonMatch ? JSON.parse(jsonMatch[0]) : { keywords: [query], vehicle_type: '', must_have: [] }
    } catch {
      searchTerms = { keywords: [query], vehicle_type: '', must_have: [] }
    }

    // Fetch all floorplans from database
    const { data: floorplans, error } = await supabase
      .from('floorplans')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    // Score each floorplan by relevance
    const scored = floorplans.map(fp => {
      let score = 0
      const searchableText = [
        fp.vehicle_type, fp.bedroom, fp.bathroom, fp.kitchen,
        fp.living_area, fp.slides, fp.special_features, fp.description,
        fp.file_name, ...(fp.search_tags || [])
      ].join(' ').toLowerCase()

      // Score by keywords
      for (const keyword of searchTerms.keywords || []) {
        if (searchableText.includes(keyword.toLowerCase())) score += 10
      }
      for (const must of searchTerms.must_have || []) {
        if (searchableText.includes(must.toLowerCase())) score += 20
      }
      if (searchTerms.vehicle_type && searchableText.includes(searchTerms.vehicle_type.toLowerCase())) {
        score += 15
      }
      // Also check raw query words
      const queryWords = query.toLowerCase().split(/\s+/)
      for (const word of queryWords) {
        if (word.length > 3 && searchableText.includes(word)) score += 2
      }

      return { ...fp, score }
    })

    // Sort by score, return top results
    const results = scored
      .filter(fp => fp.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)

    res.status(200).json({ results, searchTerms })
  } catch (error) {
    console.error('Search error:', error)
    res.status(500).json({ error: error.message })
  }
}
