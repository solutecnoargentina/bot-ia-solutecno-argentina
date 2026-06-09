import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pino from 'pino';
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  isJidBroadcast,
  jidNormalizedUser,
  useMultiFileAuthState
} from '@whiskeysockets/baileys';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const config = loadConfig();
const logger = pino({ level: process.env.LOG_LEVEL || 'silent' });

const runtime = {
  socket: null,
  reconnecting: false,
  chatLocks: new Set(),
  state: await loadState(config.stateFile)
};

main().catch((error) => {
  console.error('[fatal]', error);
  process.exitCode = 1;
});

async function main() {
  await ensureDir(path.dirname(config.stateFile));
  await ensureDefaultFiles();
  console.log(`Starting ${config.botName} in premium mode`);
  await connect();
}

async function connect() {
  const authDir = path.join(__dirname, 'data', `auth-${config.sessionName}`);
  const { state: authState, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  runtime.socket = makeWASocket({
    version,
    auth: authState,
    logger,
    printQRInTerminal: true,
    browser: [config.botName, 'Chrome', '1.0.0']
  });

  runtime.socket.ev.on('creds.update', saveCreds);
  runtime.socket.ev.on('connection.update', handleConnectionUpdate);
  runtime.socket.ev.on('messages.upsert', handleMessagesUpsert);
}

async function handleConnectionUpdate(update) {
  const { connection, lastDisconnect } = update;

  if (connection === 'open') {
    runtime.reconnecting = false;
    console.log('Connected and ready.');
    return;
  }

  if (connection !== 'close') {
    return;
  }

  const statusCode = lastDisconnect?.error?.output?.statusCode;
  const loggedOut = statusCode === DisconnectReason.loggedOut;

  if (loggedOut) {
    console.error('WhatsApp session closed. Delete data/auth and scan the QR again.');
    return;
  }

  if (runtime.reconnecting) {
    return;
  }

  runtime.reconnecting = true;
  console.warn('Reconnecting in 3 seconds...');
  setTimeout(() => {
    runtime.reconnecting = false;
    connect().catch((error) => console.error('Reconnect failed:', error));
  }, 3000);
}

async function handleMessagesUpsert(event) {
  if (event.type !== 'notify' || !Array.isArray(event.messages)) {
    return;
  }

  for (const message of event.messages) {
    await handleIncomingMessage(message);
  }
}

async function handleIncomingMessage(message) {
  const remoteJid = normalizeJid(message?.key?.remoteJid);
  if (!remoteJid || !isPrivateChat(remoteJid)) {
    return;
  }

  if (message.key?.fromMe) {
    return;
  }

  const messageId = message.key?.id;
  if (!messageId || runtime.state.processedIds[messageId]) {
    return;
  }

  const timestamp = Number(message.messageTimestamp || 0);
  if (!isFreshMessage(timestamp, config.maxMessageAgeSeconds)) {
    return;
  }

  const text = extractText(message.message);
  if (!text) {
    return;
  }

  if (isBlockedNumber(remoteJid, config.blockedNumbers)) {
    return;
  }

  if (config.allowedNumbers.length > 0 && !config.allowedNumbers.includes(remoteJid)) {
    return;
  }

  if (runtime.chatLocks.has(remoteJid)) {
    return;
  }

  runtime.chatLocks.add(remoteJid);
  try {
    const context = buildContext(message, text, remoteJid);
    const reply = await resolveReply(context);
    if (!reply) {
      return;
    }

    await runtime.socket.sendMessage(remoteJid, { text: reply }, { quoted: message });
    runtime.state.processedIds[messageId] = timestamp || Math.floor(Date.now() / 1000);
    pruneProcessedIds(runtime.state.processedIds);
    await saveState(config.stateFile, runtime.state);
  } catch (error) {
    console.error('Unable to send reply:', error);
  } finally {
    runtime.chatLocks.delete(remoteJid);
  }
}

function buildContext(message, text, remoteJid) {
  const contactName = message.pushName || 'Contact';
  return {
    botName: config.botName,
    remoteJid,
    messageId: message.key?.id || '',
    text,
    contactName,
    timestamp: Number(message.messageTimestamp || 0),
    isPrivateChat: true,
    isOwner: config.ownerNumber ? remoteJid === config.ownerNumber : false
  };
}

async function resolveReply(context) {
  const rules = await loadRules(config.rulesFile);
  const ruleReply = matchRule(context.text, rules, context);
  if (ruleReply) {
    return ruleReply;
  }

  if (config.replyWebhookUrl) {
    const webhookReply = await replyFromWebhook(context);
    if (webhookReply) {
      return webhookReply;
    }
  }

  return renderTemplate(config.defaultReply, context);
}

function matchRule(text, rules, context) {
  const normalizedText = normalizeText(text);

  for (const rule of rules) {
    if (!rule || rule.enabled === false) {
      continue;
    }

    if (Array.isArray(rule.triggers) && rule.triggers.some((trigger) => normalizedText.includes(normalizeText(trigger)))) {
      return renderTemplate(rule.reply || '', context);
    }

    if (rule.pattern) {
      const flags = rule.flags || 'i';
      const regex = new RegExp(rule.pattern, flags);
      if (regex.test(text)) {
        return renderTemplate(rule.reply || '', context);
      }
    }
  }

  return '';
}

async function replyFromWebhook(context) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(config.replyWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.replyWebhookToken ? { Authorization: `Bearer ${config.replyWebhookToken}` } : {})
      },
      body: JSON.stringify(context),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Webhook responded ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      const candidate = data?.reply ?? data?.text ?? data?.message;
      return typeof candidate === 'string' ? candidate.trim() : '';
    }

    return (await response.text()).trim();
  } catch (error) {
    console.error('Webhook unavailable:', error);
    return '';
  } finally {
    clearTimeout(timeout);
  }
}

function renderTemplate(template, context) {
  if (!template) {
    return '';
  }

  return template
    .replaceAll('${botName}', context.botName)
    .replaceAll('${contactName}', context.contactName)
    .replaceAll('${text}', context.text)
    .trim();
}

async function loadRules(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadConfig() {
  const rawAllowed = parseList(process.env.ALLOWED_NUMBERS);
  const rawBlocked = parseList(process.env.BLOCKED_NUMBERS);

  return {
    botName: process.env.BOT_NAME?.trim() || 'Solutecno Premium',
    ownerNumber: normalizeJid(process.env.OWNER_NUMBER || ''),
    sessionName: process.env.SESSION_NAME?.trim() || 'solutecno-premium',
    maxMessageAgeSeconds: toPositiveInteger(process.env.MAX_MESSAGE_AGE_SECONDS, 120),
    defaultReply: process.env.DEFAULT_REPLY?.trim() || 'Hola, soy el asistente automatico de Solutecno Argentina. En que te puedo ayudar?',
    replyWebhookUrl: process.env.REPLY_WEBHOOK_URL?.trim() || '',
    replyWebhookToken: process.env.REPLY_WEBHOOK_TOKEN?.trim() || '',
    rulesFile: resolvePath(process.env.RULES_FILE || path.join(__dirname, 'rules.json')),
    stateFile: resolvePath(process.env.STATE_FILE || path.join(__dirname, 'data', 'state.json')),
    allowedNumbers: rawAllowed.map(normalizeJid).filter(Boolean),
    blockedNumbers: rawBlocked.map(normalizeJid).filter(Boolean)
  };
}

function parseList(value) {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function toPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolvePath(value) {
  return path.isAbsolute(value) ? value : path.join(__dirname, value);
}

function normalizeJid(value) {
  if (!value) {
    return '';
  }

  const text = String(value).trim();
  if (!text) {
    return '';
  }

  if (text.includes('@')) {
    return jidNormalizedUser(text);
  }

  const digits = text.replace(/[^\d]/g, '');
  if (!digits) {
    return '';
  }

  return jidNormalizedUser(`${digits}@s.whatsapp.net`);
}

function isPrivateChat(remoteJid) {
  if (!remoteJid) {
    return false;
  }

  if (remoteJid === 'status@broadcast') {
    return false;
  }

  if (remoteJid.endsWith('@g.us')) {
    return false;
  }

  if (remoteJid.endsWith('@newsletter')) {
    return false;
  }

  return !isJidBroadcast(remoteJid);
}

function isFreshMessage(timestampSeconds, maxAgeSeconds) {
  if (!timestampSeconds || !Number.isFinite(timestampSeconds)) {
    return true;
  }

  const ageSeconds = Math.floor(Date.now() / 1000) - timestampSeconds;
  return ageSeconds >= 0 && ageSeconds <= maxAgeSeconds;
}

function isBlockedNumber(remoteJid, blockedNumbers) {
  return blockedNumbers.includes(remoteJid);
}

function extractText(message) {
  if (!message) {
    return '';
  }

  const candidates = [
    message.conversation,
    message.extendedTextMessage?.text,
    message.imageMessage?.caption,
    message.videoMessage?.caption,
    message.documentMessage?.caption,
    message.buttonsResponseMessage?.selectedButtonId,
    message.listResponseMessage?.singleSelectReply?.selectedRowId
  ];

  const text = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim());
  return text ? text.trim() : '';
}

async function ensureDefaultFiles() {
  await ensureFile(
    path.join(__dirname, '.env.example'),
    [
      'BOT_NAME=Solutecno Premium',
      'OWNER_NUMBER=5491112345678',
      'SESSION_NAME=solutecno-premium',
      'MAX_MESSAGE_AGE_SECONDS=120',
      'DEFAULT_REPLY=Hola, soy el asistente automatico de Solutecno Argentina. Contame en que te ayudo.',
      'REPLY_WEBHOOK_URL=',
      'REPLY_WEBHOOK_TOKEN=',
      'RULES_FILE=./rules.json',
      'STATE_FILE=./data/state.json',
      'ALLOWED_NUMBERS=',
      'BLOCKED_NUMBERS='
    ].join('\n') + '\n'
  );
}

async function ensureFile(filePath, content) {
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, content, 'utf8');
  }
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function loadState(filePath) {
  await ensureDir(path.dirname(filePath));

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const nextState = {
      processedIds: parsed.processedIds && typeof parsed.processedIds === 'object' ? parsed.processedIds : {}
    };
    pruneProcessedIds(nextState.processedIds);
    return nextState;
  } catch {
    const initialState = { processedIds: {} };
    await saveState(filePath, initialState);
    return initialState;
  }
}

async function saveState(filePath, currentState) {
  await fs.writeFile(filePath, JSON.stringify(currentState, null, 2), 'utf8');
}

function pruneProcessedIds(processedIds) {
  const now = Math.floor(Date.now() / 1000);
  const maxAge = 2 * 24 * 60 * 60;

  for (const [messageId, timestamp] of Object.entries(processedIds)) {
    if (!Number.isFinite(Number(timestamp)) || now - Number(timestamp) > maxAge) {
      delete processedIds[messageId];
    }
  }
}

function normalizeText(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
