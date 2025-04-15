import winston from 'winston';
import path from 'path';

class LoggerProvider {
    private logger: winston.Logger;

    constructor() {
        const logDir = path.join(__dirname, '../../../logs');

        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ 
                    filename: path.join(logDir, 'error.log'), 
                    level: 'error' 
                }),
                new winston.transports.File({ 
                    filename: path.join(logDir, 'combined.log')
                }),
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    )
                })
            ]
        });
    }

    info(message: string, metadata?: any) {
        this.logger.info(message, metadata);
    }

    error(message: string, metadata?: any) {
        this.logger.error(message, metadata);
    }

    warn(message: string, metadata?: any) {
        this.logger.warn(message, metadata);
    }

    debug(message: string, metadata?: any) {
        this.logger.debug(message, metadata);
    }
}

export const logger = new LoggerProvider(); 