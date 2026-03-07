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

    const analysisPrompt = `You are analyzing a vehicle floorplan for an RV/vehicle dealership. 
    Analyze this floorplan carefully and extract ALL of the following details:
    1. Vehicle type (Class A, Class B, Class C, Fifth Wheel, Travel Trailer, Toy Hauler, etc.)
    2. Approximate length if visible
    3. Bedroom layout (front bedroom, rear bedroom, mid bedroom, bunk beds, Murphy bed, etc.)
    4. Bathroom layout (front bath, rear bath, mid bath, split bath, full bath, half bath, outdoor shower, etc.)
    5. Kitchen layout (island, galley, U-shape, L-shape, slide-out kitchen, etc.)
    6. Living area features (sofa, theater seating, dinette, U-dinette, free-standing table, booth dinette, etc.)
    7. Number of slide-outs and their locations
    8. Special features (washer/dryer hookup, outdoor kitchen, toy hauler garage, loft, workspace, fireplace, etc.)
    9. Entry door location (front, mid, rear)
    10. Overall layout description in 2-3 sentences
    
    Return your response as a JSON object with these exact keys:
    {
      "vehicle_type": "",
      "length": "",
      "bedroom": "",
      "bathroom": "",
      "kitchen": "",
      "living_area": "",
      "slides": "",
      "special_features": "",
      "entry": "",
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
        length: analysis.length || '',
        bedroom: analysis.bedroom || '',
        bathroom: analysis.bathroom || '',
        kitchen: analysis.kitchen || '',
        living_area: analysis.living_area || '',
        slides: analysis.slides || '',
        special_features: analysis.special_features || '',
        entry: analysis.entry || '',
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
