const winston = require('winston');
const { combine, timestamp, printf, colorize } = winston.format;
const config = require('../config/config');

// Format personnalisé pour les logs
const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let metaStr = '';
  if (Object.keys(metadata).length > 0) {
    metaStr = JSON.stringify(metadata);
  }
  return `${timestamp} [${level}]: ${message} ${metaStr}`;
});

// Configuration du logger
const logger = winston.createLogger({
  level: config.logging.level,
  format: combine(
    timestamp(),
    logFormat
  ),
  transports: [
    // Console transport pour le développement
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp(),
        logFormat
      )
    }),
    // Fichier pour tous les logs
    new winston.transports.File({ 
      filename: 'logs/scraper.log', 
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Fichier séparé pour les erreurs
    new winston.transports.File({ 
      filename: 'logs/errors.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

module.exports = logger;