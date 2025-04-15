import { Request, Response } from "express";
import { SendCreateUserApplication } from "./send-create-user.application";
import { logger } from "../../providers/logger/logger.provider";

export class SendCreateUserController {

    constructor(private readonly sendCreateUser: SendCreateUserApplication) {}

    /**
     * Handle
     * @param req
     * @param resp
     */
    async handle(req: Request, resp: Response): Promise<Response> {
        try {
            logger.info('Iniciando criação de usuário', { 
                email: req.body.email,
                name: req.body.name
            });

            const { name, email, password, cellPhone } = req.body;
            const { code, response } = await this.sendCreateUser.handle({
                name,
                email,
                password,
                cellPhone
            });

            logger.info('Usuário processado com sucesso', { 
                email,
                statusCode: code
            });

            return resp.status(code).send(response);
        } catch (error) {
            logger.error('Erro ao processar criação de usuário', { 
                error,
                email: req.body.email 
            });
            return resp.status(500).send({ 
                message: 'Erro interno do servidor' 
            });
        }
    }
}
