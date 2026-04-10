import { getContentType, downloadMediaMessage } from '@whiskeysockets/baileys';
import pino from 'pino';
import config from '../config.js';

const logger = pino({ level: 'silent' });

export function serialize(sock, raw) {
  if (!raw || !raw.message) return null;

  const msg  = raw.message;
  const key  = raw.key;
  const jid  = key.remoteJid;
  if (!jid) return null;

  const isGroup = jid.endsWith('@g.us');
  const fromMe  = key.fromMe;
  const sender  = isGroup
    ? (key.participant || raw.participant || '')
    : (fromMe ? (sock.user?.id?.split(':')[0] + '@s.whatsapp.net') : jid);

  const type = getContentType(msg) || 'unknown';

  let body = '';
  if (type === 'conversation')                body = msg.conversation || '';
  else if (type === 'extendedTextMessage')    body = msg.extendedTextMessage?.text || '';
  else if (type === 'imageMessage')           body = msg.imageMessage?.caption || '';
  else if (type === 'videoMessage')           body = msg.videoMessage?.caption || '';
  else if (type === 'documentMessage')        body = msg.documentMessage?.caption || '';
  else if (type === 'buttonsResponseMessage') body = msg.buttonsResponseMessage?.selectedButtonId || '';
  else if (type === 'listResponseMessage')    body = msg.listResponseMessage?.singleSelectReply?.selectedRowId || '';

  const prefix = config.PREFIX;
  const isCmd  = body.startsWith(prefix);
  let command  = '', args = [], text = '';
  if (isCmd) {
    const parts = body.slice(prefix.length).trim().split(/\s+/);
    command     = parts[0].toLowerCase();
    args        = parts.slice(1);
    text        = args.join(' ');
  }

  const contextInfo = msg[type]?.contextInfo;
  let quoted = null;
  if (contextInfo?.quotedMessage) {
    const qMsg  = contextInfo.quotedMessage;
    const qType = getContentType(qMsg) || 'unknown';
    let qBody   = '';
    if (qType === 'conversation')             qBody = qMsg.conversation || '';
    else if (qType === 'extendedTextMessage') qBody = qMsg.extendedTextMessage?.text || '';
    else if (qType === 'imageMessage')        qBody = qMsg.imageMessage?.caption || '';
    else if (qType === 'videoMessage')        qBody = qMsg.videoMessage?.caption || '';

    quoted = {
      type: qType, message: qMsg,
      sender: contextInfo.participant,
      id: contextInfo.stanzaId,
      body: qBody,
      key: {
        id: contextInfo.stanzaId, remoteJid: jid,
        participant: contextInfo.participant, fromMe: false,
      },
      download: () => downloadMediaMessage(
        { key: { id: contextInfo.stanzaId, remoteJid: jid, participant: contextInfo.participant }, message: qMsg },
        'buffer', {}, { logger, reuploadRequest: sock.updateMediaMessage }
      ),
    };
  }

  const mentions = contextInfo?.mentionedJid || [];

  raw.jid      = jid;
  raw.sender   = sender;
  raw.fromMe   = fromMe;
  raw.isGroup  = isGroup;
  raw.type     = type;
  raw.body     = body;
  raw.isCmd    = isCmd;
  raw.command  = command;
  raw.args     = args;
  raw.text     = text;
  raw.quoted   = quoted;
  raw.mentions = mentions;

  raw.reply = (content, opts = {}) => {
    const payload = typeof content === 'string' ? { text: content } : content;
    return sock.MQ
      ? sock.MQ.add(() => sock.sendMessage(jid, payload, { quoted: raw, ...opts }))
      : sock.sendMessage(jid, payload, { quoted: raw, ...opts });
  };

  raw.react = (emoji) =>
    sock.sendMessage(jid, { react: { text: emoji, key: raw.key } });

  raw.download = () =>
    downloadMediaMessage(raw, 'buffer', {}, { logger, reuploadRequest: sock.updateMediaMessage });

  return raw;
                 }
