import i18n from '@renderer/i18n'
import store from '@renderer/store'
import { setGenerating } from '@renderer/store/runtime'
import { Assistant, Message, Provider, Suggestion, Topic } from '@renderer/types'
import { uuid } from '@renderer/utils'
import dayjs from 'dayjs'
import { isEmpty } from 'lodash'

import {
  getAssistantProvider,
  getDefaultModel,
  getProviderByModel,
  getTopNamingModel,
  getTranslateModel
} from './assistant'
import { EVENT_NAMES, EventEmitter } from './event'
import { filterAtMessages } from './messages'
import ProviderSDK from './ProviderSDK'

export async function fetchChatCompletion({
  messages,
  topic,
  assistant,
  onResponse
}: {
  messages: Message[]
  topic: Topic
  assistant: Assistant
  onResponse: (message: Message) => void
}) {
  window.keyv.set(EVENT_NAMES.CHAT_COMPLETION_PAUSED, false)

  const provider = getAssistantProvider(assistant)
  const defaultModel = getDefaultModel()
  const model = assistant.model || defaultModel
  const providerSdk = new ProviderSDK(provider)

  store.dispatch(setGenerating(true))

  const message: Message = {
    id: uuid(),
    role: 'assistant',
    content: '',
    assistantId: assistant.id,
    topicId: topic.id,
    modelId: model.id,
    createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    status: 'sending'
  }

  onResponse({ ...message })

  try {
    await providerSdk.completions(filterAtMessages(messages), assistant, ({ text, usage }) => {
      message.content = message.content + text || ''
      message.usage = usage
      onResponse({ ...message, status: 'pending' })
    })
  } catch (error: any) {
    message.content = `Error: ${error.message}`
  }

  // Update message status
  message.status = window.keyv.get(EVENT_NAMES.CHAT_COMPLETION_PAUSED) ? 'paused' : 'success'

  // Emit chat completion event
  EventEmitter.emit(EVENT_NAMES.AI_CHAT_COMPLETION, message)

  // Reset generating state
  store.dispatch(setGenerating(false))

  return message
}

export async function fetchTranslate({ message, assistant }: { message: Message; assistant: Assistant }) {
  const model = getTranslateModel()

  if (!model) {
    return ''
  }

  const provider = getProviderByModel(model)

  if (!hasApiKey(provider)) {
    return ''
  }

  const providerSdk = new ProviderSDK(provider)

  try {
    return await providerSdk.translate(message, assistant)
  } catch (error: any) {
    return ''
  }
}

export async function fetchMessagesSummary({ messages, assistant }: { messages: Message[]; assistant: Assistant }) {
  const model = getTopNamingModel() || assistant.model || getDefaultModel()
  const provider = getProviderByModel(model)

  if (!hasApiKey(provider)) {
    return null
  }

  const providerSdk = new ProviderSDK(provider)

  try {
    return await providerSdk.summaries(messages, assistant)
  } catch (error: any) {
    return null
  }
}

export async function fetchSuggestions({
  messages,
  assistant
}: {
  messages: Message[]
  assistant: Assistant
}): Promise<Suggestion[]> {
  console.debug('fetchSuggestions', messages, assistant)
  const provider = getAssistantProvider(assistant)
  const providerSdk = new ProviderSDK(provider)
  console.debug('fetchSuggestions', provider)
  const model = assistant.model

  if (!model) {
    return []
  }

  if (model.owned_by !== 'graphrag') {
    return []
  }

  if (model.id.endsWith('global')) {
    return []
  }

  try {
    return await providerSdk.suggestions(messages, assistant)
  } catch (error: any) {
    return []
  }
}

export async function checkApi(provider: Provider) {
  const model = provider.models[0]
  const key = 'api-check'
  const style = { marginTop: '3vh' }

  if (!provider.apiKey) {
    window.message.error({ content: i18n.t('message.error.enter.api.key'), key, style })
    return false
  }

  if (!provider.apiHost) {
    window.message.error({ content: i18n.t('message.error.enter.api.host'), key, style })
    return false
  }

  if (!model) {
    window.message.error({ content: i18n.t('message.error.enter.model'), key, style })
    return false
  }

  const providerSdk = new ProviderSDK(provider)

  const { valid } = await providerSdk.check()

  window.message[valid ? 'success' : 'error']({
    key: 'api-check',
    style: { marginTop: '3vh' },
    duration: valid ? 2 : 8,
    content: valid ? i18n.t('message.api.connection.success') : i18n.t('message.api.connection.failed')
  })

  return valid
}

function hasApiKey(provider: Provider) {
  if (!provider) return false
  if (provider.id === 'ollama') return true
  return !isEmpty(provider.apiKey)
}

export async function fetchModels(provider: Provider) {
  const providerSdk = new ProviderSDK(provider)

  try {
    return await providerSdk.models()
  } catch (error) {
    return []
  }
}
