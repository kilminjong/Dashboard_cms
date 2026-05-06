import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getAccessToken(serviceAccount: any): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const now = Math.floor(Date.now() / 1000)
  const claim = btoa(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }))

  const key = serviceAccount.private_key
    .replace('-----BEGIN PRIVATE KEY-----\n', '')
    .replace('\n-----END PRIVATE KEY-----\n', '')
    .replace(/\n/g, '')

  const binaryKey = Uint8Array.from(atob(key), c => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', binaryKey, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
  )

  const input = new TextEncoder().encode(`${header}.${claim}`)
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, input)
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const jwt = `${header}.${claim}.${sig}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })

  const data = await res.json()
  if (!data.access_token) throw new Error('Failed to get access token: ' + JSON.stringify(data))
  return data.access_token
}

// 시트 GID로 시트 이름 가져오기
async function getSheetTitle(token: string, sheetId: string): Promise<string> {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  // index 3이 고객원장 (0부터 시작, 4번째 시트)
  const sheets = data.sheets || []
  for (const s of sheets) {
    if (s.properties.title.includes('고객원장') || s.properties.index === 3) {
      return s.properties.title
    }
  }
  // 찾지 못하면 3번째 인덱스 시트 반환
  if (sheets[3]) return sheets[3].properties.title
  return sheets[0]?.properties.title || 'Sheet1'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const sa = JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT') || '{}')
    const sheetId = Deno.env.get('GOOGLE_SHEET_ID') || ''
    const token = await getAccessToken(sa)
    const sheetName = await getSheetTitle(token, sheetId)
    const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`
    const encodedSheet = encodeURIComponent(sheetName)

    const { action, rowIndex, rowData, customerId, memo } = await req.json()
    const encodedMemoSheet = encodeURIComponent('memos')

    if (action === 'read') {
      const res = await fetch(`${baseUrl}/values/'${encodedSheet}'!A3:BK`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      const rows = data.values || []
      if (rows.length === 0) {
        return new Response(JSON.stringify({ data: [], headers: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const headers = rows[0]
      const customers = rows.slice(1).map((row: string[], idx: number) => {
        const obj: any = { _rowIndex: idx + 4 }
        headers.forEach((h: string, i: number) => { obj[h] = row[i] || '' })
        // 중복 헤더 회피: 사업자번호는 무조건 D열(index 3) 값으로 고정
        obj['사업자번호'] = row[3] || ''
        return obj
      }).filter((c: any) => c['고객명'] && c['고객명'].trim())
      return new Response(JSON.stringify({ data: customers, headers, sheetName }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'append') {
      const res = await fetch(`${baseUrl}/values/'${encodedSheet}'!A:BK:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [rowData] }),
      })
      const result = await res.json()
      return new Response(JSON.stringify({ success: true, result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'update') {
      const res = await fetch(`${baseUrl}/values/'${encodedSheet}'!A${rowIndex}:BK${rowIndex}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [rowData] }),
      })
      const result = await res.json()
      return new Response(JSON.stringify({ success: true, result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'delete') {
      const emptyRow = new Array(39).fill('')
      const res = await fetch(`${baseUrl}/values/'${encodedSheet}'!A${rowIndex}:AM${rowIndex}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [emptyRow] }),
      })
      const result = await res.json()
      return new Response(JSON.stringify({ success: true, result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'getMaxCode') {
      const res = await fetch(`${baseUrl}/values/'${encodedSheet}'!B4:B`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      const codes = (data.values || []).flat().filter((v: string) => v && /^\d+$/.test(v)).map(Number)
      const maxCode = codes.length > 0 ? Math.max(...codes) : 0
      return new Response(JSON.stringify({ maxCode }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ── 메모 시트 (memos) ──
    // 컬럼: A: id | B: customer_id | C: customer_name | D: content | E: created_by | F: created_at

    if (action === 'readMemos') {
      const res = await fetch(`${baseUrl}/values/'${encodedMemoSheet}'!A2:F`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      const rows = data.values || []
      const memos = rows.map((row: string[], idx: number) => ({
        _rowIndex: idx + 2,
        id: row[0] || '',
        customer_id: row[1] || '',
        customer_name: row[2] || '',
        content: row[3] || '',
        created_by: row[4] || '',
        created_at: row[5] || '',
      })).filter((m: any) => m.content && m.customer_id)
      const filtered = customerId ? memos.filter((m: any) => m.customer_id === customerId) : memos
      filtered.sort((a: any, b: any) => (b.created_at || '').localeCompare(a.created_at || ''))
      return new Response(JSON.stringify({ memos: filtered }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'appendMemo') {
      const id = crypto.randomUUID()
      const now = new Date().toISOString()
      const row = [
        id,
        memo?.customer_id || '',
        memo?.customer_name || '',
        memo?.content || '',
        memo?.created_by || '',
        now,
      ]
      const res = await fetch(`${baseUrl}/values/'${encodedMemoSheet}'!A:F:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [row] }),
      })
      const result = await res.json()
      return new Response(JSON.stringify({ success: true, id, created_at: now, result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'deleteMemo') {
      const emptyRow = ['', '', '', '', '', '']
      const res = await fetch(`${baseUrl}/values/'${encodedMemoSheet}'!A${rowIndex}:F${rowIndex}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [emptyRow] }),
      })
      const result = await res.json()
      return new Response(JSON.stringify({ success: true, result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
