import { createClient } from '@supabase/supabase-js'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  try {
    const { fileName, fileBase64, fileType } = req.body

    const fileBuffer = Buffer.from(fileBase64, 'base64')
    const filePath = `floorplans/${Date.now()}_${fileName}`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('floorplans')
      .upload(filePath, fileBuffer, { contentType: fileType, upsert: false })

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage.from('floorplans').getPublicUrl(filePath)

    const analysisPrompt = `You are analyzing a vehicle seating/upfit floorplan for a paratransit and accessible vehicle dealer. 
These are NOT RVs or recreational vehicles. These are commercial passenger vehicles including:
- Ford Transit vans
- Ford E-Series vans  
- RAM Promaster vans
- MFSABs (Multi-Function School Activity Buses)
- Full-size buses and shuttle buses

Analyze this floorplan and extract the following details with precision:

1. VEHICLE TYPE: (e.g. Ford Transit, Ford E-450, RAM Promaster, MFSAB, Bus)
2. TOTAL AMBULATORY SEATS: Count ONLY forward or rear facing ambulatory passenger seats (NOT wheelchair positions). Give exact number.
3. TOTAL WHEELCHAIR POSITIONS (WC): Count ONLY dedicated wheelchair securement positions. Give exact number.
4. TOTAL CAPACITY: Total passengers including both ambulatory and wheelchair.
5. SEAT TYPES PRESENT: List all seat types visible:
   - Forward facing ambulatory seats
   - Rear facing ambulatory seats  
   - Double fold-down seats (DBL FLD)
   - Wheelchair positions (WC)
   - Stretcher position
6. WHEELCHAIR SECUREMENT: Brand if visible (Q'Straint QRT 360, Sure-Lok, other)
7. ENTRY TYPE: Rear Entry (RE), Side Entry, or both
8. ACCESS METHOD: Ramp, Lift, or both - and location (rear, side)
9. SEATING BRAND: (Freedman, Crow, other if visible)
10. ADA COMPLIANT: Yes or No
11. MEDICAL TRANSPORT (MTS): Yes or No - based on whether stretcher or medical features present
12. SPECIAL FEATURES: Partition, privacy curtain, oxygen storage, air conditioning zones, etc.
13. VEHICLE LENGTH: If visible
14. DESCRIPTION: 2-3 sentence summary using paratransit/accessible vehicle terminology

IMPORTANT FOR SEARCH TAGS:
- Include exact numbers like "3 ambulatory", "2 wheelchair", "5 total"
- Include all abbreviations: "WC", "AMB", "DBL FLD", "RE", "MTS"  
- Include brands: "Q'Straint", "Sure-Lok", "Freedman", "BraunAbility"
- Include access: "rear ramp", "lift", "side entry"

Return ONLY a JSON object with these exact keys:
{
  "vehicle_type": "",
  "ambulatory_seats": 0,
  "wheelchair_positions": 0,
  "total_capacity": 0,
  "seat_types": "",
  "securement_brand": "",
  "entry_type": "",
  "access_method": "",
  "seating_brand": "",
  "ada_compliant": "",
  "medical_transport": "",
  "special_features": "",
  "length": "",
  "description": "",
  "search_tags": ["tag1", "tag2", ...]
}`

    const isPDF = fileType === 'application/pdf'
    const contentBlock = isPDF ? {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 }
    } : {
      type: 'image',
      source: { type: 'base64', media_type: fileType, data: fileBase64 }
    }

    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    }
    if (isPDF) headers['anthropic-beta'] = 'pdfs-2024-09-25'

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: [contentBlock, { type: 'text', text: analysisPrompt }]
        }]
      })
    })

    const claudeData = await claudeResponse.json()
    if (!claudeData.content || !claudeData.content[0]) {
      throw new Error('Claude API error: ' + JSON.stringify(claudeData))
    }
    const analysisText = claudeData.content[0].text

    let analysis
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/)
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { description: analysisText, search_tags: [] }
    } catch {
      analysis = { description: analysisText, search_tags: [] }
    }

    const { data: dbData, error: dbError } = await supabase
      .from('floorplans')
      .insert({
        file_name: fileName,
        file_url: publicUrl,
        file_path: filePath,
        vehicle_type: analysis.vehicle_type || '',
        ambulatory_seats: analysis.ambulatory_seats || 0,
        wheelchair_positions: analysis.wheelchair_positions || 0,
        total_capacity: analysis.total_capacity || 0,
        seat_types: analysis.seat_types || '',
        securement_brand: analysis.securement_brand || '',
        entry_type: analysis.entry_type || '',
        access_method: analysis.access_method || '',
        seating_brand: analysis.seating_brand || '',
        ada_compliant: analysis.ada_compliant || '',
        medical_transport: analysis.medical_transport || '',
        special_features: analysis.special_features || '',
        length: analysis.length || '',
        description: analysis.description || '',
        search_tags: analysis.search_tags || [],
        full_analysis: analysis
      })
      .select()
      .single()

    if (dbError) throw dbError

    res.status(200).json({ success: true, floorplan: dbData })
  } catch (error) {
    console.error('Upload error:', error)
    res.status(500).json({ error: error.message })
  }
}
