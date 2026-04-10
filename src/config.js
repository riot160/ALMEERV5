import dotenv from 'dotenv';
dotenv.config();

const config = {
  BOT_NAME:           'ALMEERV5',
  VERSION:            '5.0.0',
  PREFIX:             process.env.PREFIX        || '.',
  OWNER:              process.env.OWNER_NUMBER  || '',
  SESSION_PATH:       './session',
  AUTO_READ:          true,
  AUTO_TYPING:        true,
  AUTO_REACT:         true,
  AUTO_VIEW_STATUS:   true,
  AUTO_REACT_STATUS:  true,
  ANTI_DELETE_DM:     true,
  ANTI_DELETE_STATUS: true,
  GEMINI_KEY:         process.env.GEMINI_KEY    || '',
  PORT:               parseInt(process.env.PORT) || 5000,
  COOLDOWN:           3000,
  ANTI_SPAM_LIMIT:    5,
  ANTI_SPAM_WINDOW:   3000,
};

export default config;
