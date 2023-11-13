import { Socket } from "socket.io-client";
import { socket } from "../socket";
import * as mediasoupClient from 'mediasoup-client';
import { TPeer, TState } from "../constant/SessionTypes";
import { DtlsParameters } from "mediasoup-client/lib/types";


class mediaSoupClientSession {
    mediaSoupDevice: mediasoupClient.types.Device;

    producerTransport: mediasoupClient.types.Transport;

    producerVideo: mediasoupClient.types.Producer;
    producerAudio: mediasoupClient.types.Producer;


    consumerTransport: mediasoupClient.types.Transport;

    consumerVideo: mediasoupClient.types.Consumer;
    consumerAudio: mediasoupClient.types.Consumer;


    _socket: Socket;
    constructor(clientSocket: any) {
        this._socket = clientSocket;
        this.mediaSoupDevice = new mediasoupClient.Device();

    }

    /**
     * when someone's talking
     */
    onActiveSpeaker = () => {
        this._socket.on('mediaActiveSpeaker', async (data: { user_id: string; volume: number }) => {
            console.log('mediaActiveSpeaker', data);
        });
    }

    /**
     *  Connect to a media soup
     * @param skipConsume skip consume if a user is already connected
     */
    async load(skipConsume: boolean = false): Promise<void> {
        try {
            const response: any = await this.getRTPCapabilities();
            if (!this.mediaSoupDevice.loaded) {
                this.mediaSoupDevice.load({ routerRtpCapabilities: response.routerRtpCapabilities });
            }

            await this.createProducerTransport();
            await this.createConsumerTransport();




        } catch (error: any) {
            console.error(error.message, error.stack);

        }

    }

    /**
     * Create a transport for transmitting your stream
     */
    async createProducerTransport(): Promise<void> {
        try {
            //get Producer Transport
            const response: any = await this.getTransport(TPeer.PRODUCER);
            
            // create transport
            this.producerTransport = this.mediaSoupDevice.createSendTransport(response.params);

            // on transport creation established triggers the on connect event
            // emit a socket event to connect the transport
            // 'connect' | 'produce' | 'producedata' | 'connectionstatechange'
            this.producerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
                console.log('Produce Transport connect', dtlsParameters);
                const response: any = await this.connectTransport(TPeer.PRODUCER, dtlsParameters, callback, errback);
                console.log('connectWebRtcTransport', response);
            });

            this.producerTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
                this._socket.emit('media', {
                    action: 'produce',
                    data: {
                        producerTransportId: this.producerTransport.id,
                        kind,
                        rtpParameters,
                    },
                }, ({ id }: any) => callback({ id }), errback);
            });

            this.producerTransport.on('connectionstatechange', async (state: TState | any) => {
                switch (state) {
                    case 'connecting': break;
                    case 'connected': break;
                    case 'failed':
                        this.producerTransport.close();
                        break;
                    default: break;
                }
            });

        } catch (error: any) {
            console.error(error.message, error.stack);
        }
    }

    /** create a consumer transport
     */
    private async createConsumerTransport(): Promise<void> {
        try {
            //get consumer transport
            const response: any = await this.getTransport(TPeer.CONSUMER);

            // create Recvtransport
            this.consumerTransport = this.mediaSoupDevice.createRecvTransport(response.params);

            // 'connect' | 'connectionstatechange'
            this.consumerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
                console.log('Consume Transport connect', dtlsParameters);
                const response: any = await this.connectTransport(TPeer.CONSUMER, dtlsParameters, callback, errback);
                console.log('connectWebRtcTransport', response);
            });

            this.consumerTransport.on('connectionstatechange', async (state: TState) => {
                switch (state) {
                    case 'connecting': break;
                    case 'connected': break;
                    case 'failed':
                        this.consumerTransport.close();
                        break;
                    default: break;
                }
            });

        } catch (error: any) {
            console.error(error.message, error.stack);
        }
    }

    getTransport = async (transportType: TPeer) => {
        return new Promise((resolve, reject) => {
            this._socket.emit(
                'media',
                { action: 'createWebRtcTransport', data: { type: transportType } },
                (data: {
                    type: TPeer,
                    params: {
                        id: string;
                        // iceParameters: mediasoupClient.types.IceParameters; 
                        iceParameters: any;
                        // iceCandidates: RTCIceCandidate[];
                        iceCandidates: any;
                        dtlsParameters: DtlsParameters
                    }
                }) => {
                    // Resolve the Promise with the producerTransport
                    console.log("create producer transport", data);
                    resolve(data);
                }
            );
        });
    }
    getRTPCapabilities = async () => {
        return new Promise((resolve, reject) => {
            this._socket.emit('media', { action: 'getRouterRtpCapabilities' },
                (_data: { routerRtpCapabilities: mediasoupClient.types.RtpCapabilities }) => {
                    console.log('getRouterRtpCapabilities', _data);
                    resolve(_data);
                }
            );
        });
    }
    connectTransport = async (type: TPeer, dtlsParameters: DtlsParameters, callback: any, errback: any) => {
        return new Promise((resolve, reject) => {
            this._socket.emit(
                'media',
                {
                    action: 'connectWebRtcTransport',
                    data: {
                        dtlsParameters,
                        type,
                    },
                },
                () => {
                    resolve(callback);
                },
                (error: any) => {
                    console.log('connectWebRtcTransport [ERROR]', error);

                    reject(errback);
                }
            );
        });
    }

}

export const createMediaSoupContext = (room: string, name: string, token: string) => {
    if (room && name) {
        socket.auth = { session_id: token, token, user_id: socket.id };
        console.log("socket.auth", socket.auth);
        socket.connect();
    }
    const mediaSoup = new mediaSoupClientSession(socket);
    return { socket, mediaSoup };
}
