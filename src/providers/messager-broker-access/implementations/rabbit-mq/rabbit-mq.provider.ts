// @ts-ignore
import amqp from "amqplib";
import { v4 as uuidv4 } from 'uuid';
import { IMessagerAccess, IMessagerAccessRequest, IMessagerBrokerAccess, IResponseAccessResponse } from "../imessager-broker-access.interface";
import { logger } from "../../../logger/logger.provider";

export class RabbitMQ implements IMessagerBrokerAccess {

    private url: string = 'amqp://guest:guest@localhost:5672';

    /**
     * Connect with messager broker
     */
    async connect(): Promise<any> {
        try {
            logger.info('Conectando ao RabbitMQ', { url: this.url });
            const connection = await amqp.connect(this.url);
            const channel = await connection.createChannel();
            logger.info('Conexão estabelecida com sucesso');
            return channel;
        } catch (error) {
            logger.error('Erro ao conectar com RabbitMQ', { error });
            throw error;
        }
    }

    /**
     * Listen RPC
     * @param queue
     * @param callback
     */
    listenRPC(queue: string, callback: CallableFunction) {
        logger.info('Iniciando listener RPC', { queue });
        this.connect()
            .then(channel => this.createQueue(channel, queue))
            .then(ch => {
                ch.consume(queue, async (msg: any) => {
                    if (msg !== null) {
                        logger.info('Mensagem recebida', { queue, correlationId: msg.properties.correlationId });
                        const request = this.messageConvertRequest(msg);
                        const response = await callback(request);
                        await this.responseCallRPC({
                            queue: queue,
                            replyTo: msg.properties.replyTo,
                            correlationId: msg.properties.correlationId,
                            response: response
                        });
                        ch.ack(msg);
                        logger.info('Mensagem processada com sucesso', { queue, correlationId: msg.properties.correlationId });
                    }
                });
            })
            .catch(error => {
                logger.error('Erro no listener RPC', { queue, error });
            });
    }

    /**
     * Create
     * @param channel
     * @param queue
     */
    async createQueue(channel: any, queue: string): Promise<any> {
        return new Promise((resolve, reject) => {
            try {
                channel.assertQueue(queue, { durable: true });
                resolve(channel);
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Send Pub/Sub
     * @param queue
     */
    async sendPubSub(message: IMessagerAccess): Promise<any> {
        return this.connect()
            .then(channel => this.createQueue(channel, message.queue))
            .then(channel =>
                channel.sendToQueue(
                    message.queue,
                    Buffer.from(JSON.stringify(message.message)),
                ),
            )
            .catch(err => console.log(err));
    }

    /**
     * Send RPC
     * @param message
     */
    async sendRPC(message: IMessagerAccess): Promise<IResponseAccessResponse> {
        const timeout = 5000;
        logger.info('Iniciando envio RPC', { queue: message.queue });

        return new Promise(async (resolve, reject) => {
            let isRespond = false;
            const corr = uuidv4();

            try {
                const conn = await amqp.connect(this.url);
                const ch = await conn.createChannel();
                await ch.assertQueue(message.queue, { durable: true })
                const q = await ch.assertQueue('', { exclusive: true });

                logger.info('Enviando mensagem', { queue: message.queue, correlationId: corr });
                ch.sendToQueue(
                    message.queue,
                    Buffer.from(JSON.stringify(message.message)), {
                        correlationId: corr,
                        replyTo: q.queue
                    });

                // listen responde of queue
                ch.consume(q.queue, (msg: any) => {
                    if (msg.properties.correlationId === corr) {
                        const messageResponse = this.messageConvert(msg);
                        setTimeout(function () {
                            conn.close();
                        }, 500);
                        isRespond = true;
                        return resolve(messageResponse);
                    }
                }, {
                    noAck: true
                });

                // close connection before of X seconds
                setTimeout(function () {
                    if (!isRespond) {
                        conn.close();
                        logger.warn('Timeout na resposta RPC', { queue: message.queue, correlationId: corr });
                        resolve({
                            code: 408,
                            response: {
                                message: 'Timeout'
                            }
                        });
                    }
                }, timeout);
            } catch (error) {
                logger.error('Erro no envio RPC', { queue: message.queue, error });
                reject(error);
            }
        })
    }

    /**
     * Convert Message
     * @param message
     * @returns
     */
    messageConvert(message: any): IResponseAccessResponse {
        const messageResponse: IResponseAccessResponse = {
            code: 200,
            response: {
                message: 'Ok'
            }
        };
        let result = null;
        try {
            result = JSON.parse(message.content.toString());
            messageResponse.code = result.code;
            messageResponse.response = result;
        } catch (e) {
            result = message.content.toString();
            messageResponse.code = 500;
            messageResponse.response = result;
        }
        return messageResponse;
    }

    /**
     * Message Convert Request
     * @param message
     * @returns
     */
    messageConvertRequest(message: any): IMessagerAccessRequest {
        const messageRequest: IMessagerAccessRequest = {
            body: null,
            message: ''
        };
        let result = null;
        try {
            result = JSON.parse(message.content.toString());
            messageRequest.body = result;
        } catch (e) {
            result = message.content.toString();
            messageRequest.message = result;
        }
        return messageRequest;
    }

    /**
     * Response RPC
     * @param replyTo
     * @param correlationId
     * @param response
     * @returns
     */
    async responseCallRPC(objResponse: {
        queue: string,
        replyTo: string,
        correlationId: string,
        response: IResponseAccessResponse
    }): Promise<void> {
        return this.connect()
            .then(channel => this.createQueue(channel, objResponse.queue))
            .then(channel => {
                channel.sendToQueue(
                    objResponse.replyTo,
                    Buffer.from(JSON.stringify(objResponse.response)),
                    { correlationId: objResponse.correlationId }
                );
            })
            .catch(err => console.log(err));
    }
}