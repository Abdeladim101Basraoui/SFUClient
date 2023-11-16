import { Socket } from "socket.io-client";
import { socket } from "../socket";
import * as mediasoupClient from 'mediasoup-client';
import { Ckind, IProducerIds, PType, TPeer, TState } from "../constant/SessionTypes";
import { DtlsParameters } from "mediasoup-client/lib/types";


class mediaSoupClientSession {
    mediaSoupDevice: mediasoupClient.types.Device;

    producerTransport: mediasoupClient.types.Transport;

    producerVideo: mediasoupClient.types.Producer;
    producerAudio: mediasoupClient.types.Producer;


    consumerTransport: mediasoupClient.types.Transport;

    consumerVideo: mediasoupClient.types.Consumer;
    consumerAudio: mediasoupClient.types.Consumer;


    producerAudioStream: MediaStream;
    producerVideoStream: MediaStream;


    consumersVideoStream: Map<string, MediaStream> = new Map();
    consumersAudioStream: Map<string, MediaStream> = new Map();

    consumersVideo: Map<string, any> = new Map();
    consumersAudio: Map<string, any> = new Map();


    _socket: Socket;
    constructor(clientSocket: any) {
        this._socket = clientSocket;
        this.mediaSoupDevice = new mediasoupClient.Device();

        this._socket.on('mediaProduce', async (data: { user_id: string; kind: any }) => {
            try {
                switch (data.kind) {
                    case 'video':
                        await this.consumerVideoStart(data.user_id);
                        break;
                    case 'audio':
                        await this.consumerAudioStart(data.user_id);
                        break;
                }
            } catch (error) {
                console.error(error.message, error.stack);
            }
        });

        /**
         * Когда пользователь (любой) поворачивает камеру
         */
        this._socket.on('mediaVideoOrientationChange', async (data: {
            user_id: string; videoOrientation: any
        }) => {
            console.log('mediaVideoOrientationChange', data);
        });

        /**
         * Когда пользователю (current_user) необходимо заново переподключить стрим
         */
        this._socket.on('mediaReproduce', async (data: { kind: any }) => {
            try {
                switch (data.kind) {
                    case 'audio':
                        this.producerStreamStart(PType.AUDIO);
                        break;
                    case 'video':
                        this.producerStreamStart(PType.VIDEO);
                        break;
                }
            } catch (error) {
                console.error(error.message, error.stack);
            }
        });

        /**
         * Когда пользователь (не current_user) ставит свой стрим на паузу
         */
        this._socket.on('mediaProducerPause', async (data: { user_id: string; kind: any }) => {
            console.log('mediaProducerPause', data);
        });

        /**
         * Когда пользователь (не current_user) снимает свой стрим с паузы
         */
        this._socket.on('mediaProducerResume', async (data: { user_id: string; kind: any }) => {
            console.log('mediaProducerResume', data);
        });

        /**
         * Когда кто-то разговаривает
         */
        this._socket.on('mediaActiveSpeaker', async (data: { user_id: string; volume: number }) => {
            console.log('mediaActiveSpeaker', data);
        });

        /**
         * Когда в комнате сменился воркер медиасупа и требуется переподключиться.
         */
        // this._socket.on('mediaReconfigure', async () => {
        //     try {
        //         await this.load(true);
        //         await this.producerStreamStart(PType.AUDIO);
        //         await this.producerStreamStart(PType.VIDEO);
        //     } catch (error) {
        //         console.error(error.message, error.stack);
        //     }
        // });
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

            if (!skipConsume) {

                const audioProducerIds: string[] = await this.getProducerIds(IProducerIds.GET_AUDIO_PRODUCER_IDS) as string[];

                audioProducerIds.forEach(async (id) => {
                    await this.consumerAudioStart(id);
                });

                const videoProducerIds: string[] = await this.getProducerIds(IProducerIds.GET_VIDEO_PRODUCER_IDS) as string[];
                videoProducerIds.forEach(async (id) => {
                    await this.consumerVideoStart(id);
                }
                );
            }
        } catch (error: any) {
            console.error(error.message, error.stack);

        }
    }

    /**
     * check the possibilite to produce audio and video
     * @param produceType 
     * @param setProducerType 
     */
    async producerStreamStart(produceType: PType): Promise<void> {
        try {
            if (this.mediaSoupDevice.canProduce(produceType)) {
                console.log("can produce", produceType, this.mediaSoupDevice.canProduce(produceType));

                const producerStream = await navigator.mediaDevices.getUserMedia(
                    produceType === PType.AUDIO ? { audio: true } : { video: true }
                );
                console.log("producerStream", produceType, producerStream);

                const producerTrack = produceType === PType.AUDIO
                    ? producerStream.getAudioTracks()[0]
                    : producerStream.getVideoTracks()[0];
                console.log("producerTrack", produceType, producerTrack);
                if (producerTrack) {
                    if (produceType === PType.AUDIO) {
                        this.producerAudio = await this.producerTransport.produce({ track: producerTrack });

                        this.producerAudio.on('transportclose', () => {
                            console.log('producerAudio transport close');
                        });

                        this.producerAudio.on('trackended', () => {
                            console.log('producerAudio track end');
                        });

                        this.producerAudio.on('@close', () => {
                            console.log('producerAudio close');
                        });

                        this.producerAudio.on('@pause', () => {
                            console.log('producerAudio pause');
                        });
                    }
                    else {
                        this.producerVideo = await this.producerTransport.produce({ track: producerTrack });

                        this.producerVideo.on('transportclose', () => {
                            console.log('producerVideo transport close');
                        });

                        this.producerVideo.on('trackended', () => {
                            console.log('producerVideo track end');
                        });

                        this.producerVideo.on('@close', () => {
                            console.log('producerVideo close');
                        });

                        this.producerVideo.on('@pause', () => {
                            console.log('producerVideo pause');
                        });
                    }
                }

                produceType === PType.AUDIO ?
                    this.producerAudioStream = producerStream :
                    this.producerVideoStream = producerStream;
            }
        }
        catch (error: any) {
            console.error("ProducerStreamStart, StreamType:", produceType, error.message, error.stack);
        }
    }

    /* Create a transport for transmitting your stream
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
    async createConsumerTransport(): Promise<void> {
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

    /** Accept a user's audio stream
     * @param user_id user id
     */
    async consumerAudioStart(user_id: string): Promise<void> {
        try {
            const { rtpCapabilities } = this.mediaSoupDevice;

            const consumeData: any = await this.consumeStream(rtpCapabilities, user_id, Ckind.AUDIO);

            const consumer = await this.consumerTransport.consume(consumeData);

            // 'trackended' | 'transportclose'
            consumer.on('transportclose', async () => {
                this.consumersAudioStream.delete(user_id);
                this.consumersAudio.delete(user_id);
            });

            this.consumersAudio.set(user_id, consumer);

            const stream = new MediaStream();

            stream.addTrack(consumer.track);

            this.consumersAudioStream.set(user_id, stream);
        } catch (error: any) {
            console.error(error.message, error.stack);
        }
    }
    /** Accept a user's video stream
     * @param user_id user id
     */
    async consumerVideoStart(user_id: string): Promise<void> {
        try {
            const { rtpCapabilities } = this.mediaSoupDevice;

            const consumeData: {
                id: string;
                producerId: string;
                // kind: TKind;
                kind: any;
                rtpParameters: RTCRtpParameters;
            } | any = await this.consumeStream(rtpCapabilities, user_id, Ckind.VIDEO);

            const consumer = await this.consumerTransport.consume(consumeData);

            // 'trackended' | 'transportclose'
            consumer.on('transportclose', () => {
                this.consumersVideoStream.delete(user_id);
                this.consumersVideo.delete(user_id);
            });

            this.consumersVideo.set(user_id, consumer);

            const stream = new MediaStream();

            stream.addTrack(consumer.track);

            this.consumersVideoStream.set(user_id, stream);
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
                (data: any, err: any) => {
                    console.log("Error", err);

                    if (err) {
                        console.log("connectWebRtcTransport [ERROR]", err);
                        reject(errback);
                    }
                    else
                        resolve(callback);
                },

            );
        });
    }
    getProducerIds = async (kind: IProducerIds) => {
        console.log("getProducerIds", kind);

        return new Promise((resolve, reject) => {
            this._socket.emit('media', { action: kind }
                , (data: any, err: any) => {
                    if (err) {
                        console.log("getProducerIds [ERROR]", err);
                        reject(err);
                    }
                    else
                        resolve(data);
                }
                // , (error: any) => {
                //     console.log('getAudioProducerIds [ERROR]', error);
                //     reject(error);
                // }
            );
        });

    }

    consumeStream = async (rtpCapabilities: mediasoupClient.types.RtpCapabilities, user_id: string, kind: Ckind) => {
        return new Promise((resolve, reject) => {
            this._socket.emit('media', { action: 'consume', data: { rtpCapabilities, user_id, kind } },
                (data:
                    //     {
                    //     id: string;
                    //     producerId: string;
                    //     kind: any;
                    //     // kind: TKind | any;
                    //     rtpParameters: RTCRtpParameters;
                    // }
                    any
                ) => {
                    console.log('consumeAudio', data);
                    resolve(data);
                }, (error: any) => {
                    console.log('consumeAudio [ERROR]', error);
                    reject(error);
                });
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
