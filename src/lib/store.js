const store = {
  messages:       {},
  contacts:       {},
  chats:          {},
  groupMetadata:  {},
  statusMessages: {},
  welcomeMessages:{},
  antilink:       {},
  welcomeToggle:  {},
};

export function bindStore(sock) {
  sock.ev.on('contacts.upsert', (contacts) => {
    for (const c of contacts) store.contacts[c.id] = c;
  });
  sock.ev.on('contacts.update', (updates) => {
    for (const u of updates) {
      if (store.contacts[u.id]) Object.assign(store.contacts[u.id], u);
    }
  });
  sock.ev.on('chats.upsert', (chats) => {
    for (const c of chats) store.chats[c.id] = c;
  });
  sock.ev.on('chats.update', (updates) => {
    for (const u of updates) {
      if (store.chats[u.id]) Object.assign(store.chats[u.id], u);
    }
  });
  sock.ev.on('messages.upsert', ({ messages }) => {
    for (const m of messages) {
      if (!m.key?.remoteJid || !m.message) continue;
      const jid = m.key.remoteJid;
      if (!store.messages[jid]) store.messages[jid] = {};
      const keys = Object.keys(store.messages[jid]);
      if (keys.length >= 200) delete store.messages[jid][keys[0]];
      store.messages[jid][m.key.id] = m;
      if (jid === 'status@broadcast') {
        store.statusMessages[m.key.id] = m;
        const sKeys = Object.keys(store.statusMessages);
        if (sKeys.length > 500) delete store.statusMessages[sKeys[0]];
      }
    }
  });
  sock.ev.on('groups.update', (updates) => {
    for (const u of updates) {
      if (store.groupMetadata[u.id]) Object.assign(store.groupMetadata[u.id], u);
    }
  });
}

export default store;
