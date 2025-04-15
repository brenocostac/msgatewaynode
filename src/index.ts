import { app } from "./providers/web-server";
import { logger } from "./providers/logger/logger.provider";

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    logger.info('WebServer iniciado com sucesso', { port: PORT });
});