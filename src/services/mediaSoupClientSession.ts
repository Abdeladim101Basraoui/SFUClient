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
            console.log('mediaProduce', data);
            try {
                switch (data.kind) {
                    case 'video':
                        await this.consumerVideoStart(data.user_id);
                        break;
                    case 'audio':
                        await this.consumerAudioStart(data.user_id);
                        break;
                }
            } catch (error: any) {
                console.error(error.message, error.stack);
            }
        });


        this._socket.on('mediaProducerPause', async (data: { user_id: string; kind: any }) => {
            console.log('mediaProducerPause', data);
        });

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
                console.log('audioProducerIds', audioProducerIds);

                audioProducerIds.forEach(async (id) => {
                    await this.consumerAudioStart(id);
                });

                const videoProducerIds: string[] = await this.getProducerIds(IProducerIds.GET_VIDEO_PRODUCER_IDS) as string[];
                console.log('videoProducerIds', videoProducerIds);
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
    async producerStreamStart(produceType: PType): Promise<any> {
        try {
            if (this.mediaSoupDevice.canProduce(produceType)) {
                console.log("can produce", produceType, this.mediaSoupDevice.canProduce(produceType));

                const producerStream = await navigator.mediaDevices.getUserMedia(
                    produceType === PType.AUDIO ? { audio: true } : { video: true }
                );
                const producerTrack = produceType === PType.AUDIO
                    ? producerStream.getAudioTracks()[0]
                    : producerStream.getVideoTracks()[0];
                if (producerTrack) {

                    if (this.producerTransport && !this.producerTransport.closed) {

                        if (produceType === PType.AUDIO) {
                            this.producerAudio = await this.producerTransport.produce({ track: producerTrack });
                            console.log('producer audio', this.producerAudio);
                            this.producerAudio.on('trackended', () => {
                                console.log('producer audio trackended');

                                this.producerAudio.close();
                            }
                            );
                            this.producerAudio.on('transportclose', () => {
                                console.log('producer audio transportclose');

                                this.producerAudio.close();
                            }
                            );
                        }
                        else {
                            this.producerVideo = await this.producerTransport.produce({ track: producerTrack });
                            console.log('producer video', this.producerVideo);
                        }
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
                this.connectTransport(TPeer.PRODUCER, dtlsParameters, errback).then((data) => {
                    console.log('connectWebRtcTransport', data);
                    callback()
                }
                ).catch((err) => {
                    console.log('connectWebRtcTransport [ERROR]', err);
                    errback(err);
                }
                );

            });

            this.producerTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
                console.log('Produce Transport Onproduce', kind, rtpParameters);

                this._socket.emit('media', {
                    action: 'produce',
                    data: {
                        producerTransportId: this.producerTransport.id,
                        kind,
                        rtpParameters,
                    },
                }, ({ id }: any, err: any) => {
                    if (err)
                        errback(err);
                    else {
                        console.log('media produce', { id });

                        callback({ id })
                    }
                }
                );
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
            console.log('create Recv transport', this.consumerTransport);
            // 'connect' | 'connectionstatechange'
            this.consumerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
                console.log('Consume Transport connect', dtlsParameters);
                this.connectTransport(TPeer.CONSUMER, dtlsParameters, callback).then((data) => {
                    console.log('connectWebRtcTransport', data);
                    callback()
                }
                ).catch((err) => {
                    console.log('connectWebRtcTransport [ERROR]', err);
                    errback(err);
                }
                );
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
            console.log('consumerAudioStart', consumeData);


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
            console.log('consumerVideoStart', rtpCapabilities);

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
    connectTransport = async (type: TPeer, dtlsParameters: DtlsParameters, errback: any) => {
        return new Promise((resolve, reject) => {
            this._socket.emit(
                'media',
                {
                    action: 'connectWebRtcTransport',
                    data: {
                        type,
                        dtlsParameters,
                    },
                },
                (data: any, err: any) => {
                    if (err) {
                        console.log("connectWebRtcTransport [ERROR]", err);
                        reject(errback);
                    }
                    else { resolve(data); }
                },

            );
        });
    }
    getProducerIds = async (kind: IProducerIds) => {
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
                    , error: any) => {
                    if (error) {
                        console.log('consumeAudio [ERROR]', error);
                        reject(error);
                    }
                    else {
                        console.log('consumeAudio', data);
                        resolve(data);
                    }
                })
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
