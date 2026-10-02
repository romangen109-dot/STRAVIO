import { createClient } from 'npm:@supabase/supabase-js@2'

const configuredOrigin = Deno.env.get('APP_ORIGIN')
const appOrigin = configuredOrigin ?? 'null'
const corsHeaders = {
  'Access-Control-Allow-Origin': appOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
}

type RequestBody = { action?: 'respond' | 'apply' | 'cancel'; strategyId?: string; prompt?: string; currentDocumentId?: string; currentDocumentContent?: string; messageId?: string }

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown, maxLength = 2500) {
  return typeof value === 'string' ? value.slice(0, maxLength) : ''
}

function selectedTextFields(value: unknown, fields: string[], maxLength = 800) {
  const record = isRecord(value) ? value : {}
  return Object.fromEntries(fields.map((field) => [field, text(record[field])]))
}

async function readLimitedBody(request: Request, maxBytes: number) {
  if (!request.body) return ''
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > maxBytes) {
        await reader.cancel()
        return null
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(bytes)
}

function logFailure(area: string, error: unknown) {
  const code = isRecord(error) && typeof error.code === 'string' ? error.code : 'unknown'
  console.error(`[stravio-ai] ${area}`, { code })
}

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin')
  if (!configuredOrigin) {
    console.error('[stravio-ai] APP_ORIGIN is not configured')
    return jsonResponse({ error: 'AI service is not configured.' }, 503)
  }
  if (origin && origin !== appOrigin) return jsonResponse({ error: 'Origin is not allowed.' }, 403)
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)

  const authorization = request.headers.get('Authorization')
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!token) return jsonResponse({ error: 'A signed-in session is required.' }, 401)
  if (!supabaseUrl || !anonKey) {
    console.error('[stravio-ai] Supabase environment is missing')
    return jsonResponse({ error: 'AI service is not configured.' }, 503)
  }

  const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !authData.user) return jsonResponse({ error: 'A valid authenticated session is required.' }, 401)
  const userId = authData.user.id

  let body: RequestBody
  const contentLength = Number(request.headers.get('Content-Length') ?? 0)
  if (contentLength > 32_768) return jsonResponse({ error: 'Request is too large.' }, 413)
  let rawBody: string
  try {
    const limitedBody = await readLimitedBody(request, 32_768)
    if (limitedBody === null) return jsonResponse({ error: 'Request is too large.' }, 413)
    rawBody = limitedBody
    body = JSON.parse(rawBody) as RequestBody
  } catch {
    return jsonResponse({ error: 'Request body must be valid JSON.' }, 400)
  }
  if (!isRecord(body)) return jsonResponse({ error: 'Invalid request.' }, 400)

  if (body.action === 'apply' || body.action === 'cancel') {
    if (typeof body.messageId !== 'string' || !body.messageId || typeof body.strategyId !== 'string') return jsonResponse({ error: 'A message and strategy are required.' }, 400)
    const { data, error } = await supabase.rpc('resolve_ai_proposal', { p_message_id: body.messageId, p_strategy_id: body.strategyId, p_action: body.action })
    if (error) {
      logFailure('proposal resolution failed', error)
      return jsonResponse({ error: error.code === '40001' || error.code === 'P0002' || error.code === '23505' ? 'This proposal is no longer available. Review the current strategy and try again.' : 'Could not apply this proposal. Please try again.' }, error.code === '40001' || error.code === 'P0002' || error.code === '23505' ? 409 : 500)
    }
    return jsonResponse(data)
  }

  if (body.action !== 'respond' || typeof body.strategyId !== 'string' || typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > 6000) {
    return jsonResponse({ error: 'A strategy and prompt of up to 6000 characters are required.' }, 400)
  }

  const { data: withinRateLimit, error: rateLimitError } = await supabase.rpc('consume_ai_request', { p_max_requests: 12 })
  if (rateLimitError) {
    logFailure('AI rate limit failed', rateLimitError)
    return jsonResponse({ error: 'AI request could not be processed. Please try again.' }, 500)
  }
  if (!withinRateLimit) return jsonResponse({ error: 'Too many AI requests. Please wait a minute and try again.' }, 429)

  const { data: strategy, error: strategyError } = await supabase.from('strategies').select('id,name,data,workflow_step,completed').eq('id', body.strategyId).maybeSingle()
  if (strategyError) {
    logFailure('strategy lookup failed', strategyError)
    return jsonResponse({ error: 'Could not load the strategy. Please try again.' }, 500)
  }
  if (!strategy) return jsonResponse({ error: 'Strategy not found.' }, 404)
  const [tasksResult, documentsResult, historyResult] = await Promise.all([
    supabase.from('tasks').select('title,description,status,priority,deadline,stage_id').eq('strategy_id', body.strategyId).order('created_at', { ascending: false }).limit(100),
    supabase.from('documents').select('id,title,content,status,updated_at').eq('strategy_id', body.strategyId).order('updated_at', { ascending: false }).limit(5),
    supabase.from('ai_messages').select('role,content,created_at').eq('strategy_id', body.strategyId).order('created_at', { ascending: false }).limit(12),
  ])
  const contextError = tasksResult.error ?? documentsResult.error ?? historyResult.error
  if (contextError) {
    logFailure('strategy context lookup failed', contextError)
    return jsonResponse({ error: 'Could not load strategy context. Please try again.' }, 500)
  }
  const { data: currentDocument, error: currentDocumentError } = typeof body.currentDocumentId === 'string'
    ? await supabase.from('documents').select('id,title,content').eq('id', body.currentDocumentId).eq('strategy_id', body.strategyId).maybeSingle()
    : { data: null }
  if (currentDocumentError) {
    logFailure('opened document lookup failed', currentDocumentError)
    return jsonResponse({ error: 'Could not load the opened document. Please try again.' }, 500)
  }
  if (typeof body.currentDocumentId === 'string' && !currentDocument) return jsonResponse({ error: 'The opened document was not found for this strategy.' }, 404)
  const strategyData = isRecord(strategy.data) ? strategy.data : {}
  const plans = isRecord(strategyData.plans) ? strategyData.plans : {}
  const control = isRecord(strategyData.control) ? strategyData.control : {}
  const context = {
    strategy: {
      name: text(strategy.name, 200),
      workflowStep: strategy.workflow_step,
      completed: strategy.completed,
      currentState: selectedTextFields(strategyData.currentState, ['situation', 'resources', 'skills', 'constraints', 'problems', 'opportunities']),
      desiredState: selectedTextFields(strategyData.desiredState, ['destination', 'successPicture', 'indicators', 'timeframe', 'changes']),
      selectedOptions: Array.isArray(strategyData.strategicOptions) ? strategyData.strategicOptions.filter(isRecord).filter((option) => Array.isArray(strategyData.selectedOptionIds) && strategyData.selectedOptionIds.includes(option.id)).slice(0, 8).map((option) => ({
        id: text(option.id, 100),
        title: text(option.title, 200),
        description: text(option.description, 600),
        advantages: Array.isArray(option.advantages) ? option.advantages.slice(0, 5).map((item) => text(item, 200)) : [],
        risks: Array.isArray(option.risks) ? option.risks.slice(0, 5).map((item) => text(item, 200)) : [],
        requiredResources: Array.isArray(option.requiredResources) ? option.requiredResources.slice(0, 5).map((item) => text(item, 200)) : [],
      })) : [],
      plans: { A: selectedTextFields(plans.A, ['objective', 'approach', 'keyActions', 'risks', 'resources']), B: selectedTextFields(plans.B, ['objective', 'approach', 'keyActions', 'risks', 'resources']) },
      stages: Array.isArray(strategyData.stages) ? strategyData.stages.filter(isRecord).slice(0, 12).map((stage) => selectedTextFields(stage, ['id', 'title', 'objective', 'actions', 'expectedResult', 'dependencies'], 400)) : [],
      control: {
        metrics: Array.isArray(control.metrics) ? control.metrics.filter(isRecord).slice(0, 10).map((metric) => selectedTextFields(metric, ['name', 'target', 'currentValue', 'reviewDate'], 300)) : [],
        risks: text(control.risks),
        warningSigns: text(control.warningSigns),
        reviewConditions: text(control.reviewConditions),
      },
    },
    tasks: (tasksResult.data ?? []).slice(0, 50).map((task) => ({ title: text(task.title, 300), description: text(task.description, 500), status: task.status, priority: task.priority, deadline: text(task.deadline, 20), stage: text(task.stage_id, 100) })),
    documents: (documentsResult.data ?? []).slice(0, 3).map((document) => ({ title: text(document.title, 200), status: document.status, content: text(document.content, 500) })),
    openedDocument: currentDocument ? { title: text(currentDocument.title, 200), content: typeof body.currentDocumentContent === 'string' ? body.currentDocumentContent.slice(0, 6000) : currentDocument.content.slice(0, 6000) } : null,
  }
  const userMessage = { id: crypto.randomUUID(), user_id: userId, strategy_id: body.strategyId, role: 'user', content: body.prompt.trim() }
  const { error: saveUserError } = await supabase.from('ai_messages').insert(userMessage)
  if (saveUserError) {
    logFailure('user message insert failed', saveUserError)
    return jsonResponse({ error: 'Could not save your message. Please try again.' }, 500)
  }

  const apiKey = Deno.env.get('AI_API_KEY')
  if (!apiKey) {
    const assistantMessage = { id: crypto.randomUUID(), user_id: userId, strategy_id: body.strategyId, role: 'agent', content: 'AI Agent is not connected yet.', proposal: null }
    const { error } = await supabase.from('ai_messages').insert(assistantMessage)
    if (error) return jsonResponse({ error: 'AI Agent is not connected yet.' }, 503)
    return jsonResponse({ connected: false, userMessage: { ...userMessage, userId, createdAt: new Date().toISOString() }, message: { ...assistantMessage, userId, createdAt: new Date().toISOString() } })
  }

  const priorMessages = (historyResult.data ?? []).slice(0, 8).reverse().map((message) => ({ role: message.role === 'agent' ? 'assistant' : 'user', content: text(message.content, 750) }))
  const systemInstruction = 'You are the Stravio strategy assistant. Use only facts in the supplied JSON context. Do not invent user data. Return only JSON with shape {"content": string, "proposal": null | {"kind":"update-desired-state","previousValue":string,"proposedValue":string} | {"kind":"create-tasks","tasks":[{"stageId":string,"title":string,"description":string,"priority":"low"|"medium"|"high","deadline":string,"sourceStagePlanId":string|null}]}. Proposals are suggestions only and must never be executed automatically. Create at most 20 tasks. Do not include identifying user details.'
  const modelEndpoint = Deno.env.get('AI_BASE_URL') ?? 'https://api.openai.com/v1/chat/completions'
  const model = Deno.env.get('AI_MODEL') ?? 'gpt-4o-mini'
  let response: Response
  try {
    response = await fetch(modelEndpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({ model, temperature: 0.2, response_format: { type: 'json_object' }, messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: `Context JSON:\n${JSON.stringify(context)}\n\nConversation:\n${JSON.stringify(priorMessages)}\n\nRequest:\n${body.prompt.trim()}` },
      ] }),
    })
  } catch {
    console.error('[stravio-ai] provider request failed or timed out')
    return jsonResponse({ error: 'AI provider request timed out or could not connect.' }, 502)
  }
  if (!response.ok) {
    console.error('[stravio-ai] provider returned non-success status', { status: response.status })
    return jsonResponse({ error: 'AI provider request failed. Please try again.' }, 502)
  }
  let completion: { choices?: { message?: { content?: string } }[] }
  try { completion = await response.json() } catch {
    console.error('[stravio-ai] provider returned invalid response JSON')
    return jsonResponse({ error: 'AI provider returned an invalid response.' }, 502)
  }
  let result: { content?: unknown; proposal?: unknown }
  try { result = JSON.parse(completion.choices?.[0]?.message?.content ?? '') } catch {
    console.error('[stravio-ai] provider response did not match JSON mode')
    return jsonResponse({ error: 'AI provider returned an invalid response.' }, 502)
  }
  if (typeof result.content !== 'string' || result.content.length > 20000) return jsonResponse({ error: 'AI provider response did not match the expected format.' }, 502)

  let proposal: Record<string, unknown> | null = null
  if (isRecord(result.proposal) && result.proposal.kind === 'update-desired-state' && typeof result.proposal.previousValue === 'string' && typeof result.proposal.proposedValue === 'string') {
    proposal = { id: crypto.randomUUID(), kind: 'update-desired-state', status: 'pending', userId, strategyId: body.strategyId, previousValue: result.proposal.previousValue.slice(0, 4000), proposedValue: result.proposal.proposedValue.slice(0, 4000) }
  } else if (isRecord(result.proposal) && result.proposal.kind === 'create-tasks' && Array.isArray(result.proposal.tasks) && result.proposal.tasks.length > 0 && result.proposal.tasks.length <= 20) {
    const proposedTasks = result.proposal.tasks.filter((task) => isRecord(task) && typeof task.title === 'string' && typeof task.stageId === 'string')
    if (proposedTasks.length === result.proposal.tasks.length) proposal = { id: crypto.randomUUID(), kind: 'create-tasks', status: 'pending', tasks: proposedTasks.map((task) => ({ userId, strategyId: body.strategyId, stageId: task.stageId, title: task.title.slice(0, 300), description: typeof task.description === 'string' ? task.description.slice(0, 4000) : '', status: 'todo', priority: task.priority === 'high' || task.priority === 'low' ? task.priority : 'medium', deadline: typeof task.deadline === 'string' ? task.deadline : '', sourceStagePlanId: typeof task.sourceStagePlanId === 'string' ? task.sourceStagePlanId : undefined })) }
  } else if (result.proposal != null) return jsonResponse({ error: 'AI provider proposed an unsupported action.' }, 502)

  const assistantMessage = { id: crypto.randomUUID(), user_id: userId, strategy_id: body.strategyId, role: 'agent', content: result.content, proposal }
  const { error: saveAssistantError } = await supabase.from('ai_messages').insert(assistantMessage)
  if (saveAssistantError) {
    logFailure('assistant message insert failed', saveAssistantError)
    return jsonResponse({ error: 'Could not save the AI response. Please try again.' }, 500)
  }
  return jsonResponse({ connected: true, userMessage: { ...userMessage, userId, createdAt: new Date().toISOString() }, message: { id: assistantMessage.id, userId, strategyId: body.strategyId, role: 'agent', content: assistantMessage.content, proposal, createdAt: new Date().toISOString() } })
})