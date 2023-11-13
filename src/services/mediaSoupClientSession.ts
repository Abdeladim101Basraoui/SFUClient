import { Socket } from "socket.io-client";
import { socket } from "../socket";
import * as mediasoupClient from 'mediasoup-client';
import { TPeer } from "../constant/SessionTypes";
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
            this._socket.emit('media', { action: 'getRouterRtpCapabilities' },
                (_data: { routerRtpCapabilities: mediasoupClient.types.RtpCapabilities }) => {
                    console.log('getRouterRtpCapabilities', _data);

                    if (!this.mediaSoupDevice.loaded) {
                        this.mediaSoupDevice.load({ routerRtpCapabilities: _data.routerRtpCapabilities });
                    }
                }
            );

            await this.createProducerTransport();
            // await this.createConsumerTransport();




        } catch (error: any) {
            console.error(error.message, error.stack);

        }

    }

    /**
     * Create a transport for transmitting your stream
     */
    async createProducerTransport(): Promise<void> {
        try {
            const response: any = await this.getProducerTransport();
            // this._socket.emit('media', { action: 'createWebRtcTransport', data: { type: 'producer' } }
            //     , (
            //         data: {
            //             type: TPeer,
            //             params: {
            //                 id: string;
            //                 // iceParameters: mediasoupClient.types.IceParameters; 
            //                 iceParameters: any;
            //                 // iceCandidates: RTCIceCandidate[];
            //                 iceCandidates: any;
            //                 dtlsParameters: DtlsParameters
            //             }
            //         }
            //     ) => {
            //         console.log('createWebRtcTransport', data);
            //         this.producerTransport = this.mediaSoupDevice.createSendTransport(data.params);
            //         console.log('producerTransport', this.producerTransport);
            //     }
            // );
            this.producerTransport = this.mediaSoupDevice.createSendTransport(response.params);
            console.log('producerTransport', this.producerTransport);


            // 'connect' | 'produce' | 'producedata' | 'connectionstatechange'

            // this.producerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
            // console.log("connect", dtlsParameters);

            //     this._socket.emit('media', { action: 'connectWebRtcTransport', data: { dtlsParameters, type: 'producer' } }
            //         , (data: { type: TPeer, params: { id: string } }) => {
            //             console.log('connectWebRtcTransport', data);
            //             callback();
            //         }, errback);

            // });
            // this.producerTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
            //     await this.socket.request('media', {
            //         action: 'produce',
            //         data: {
            //             producerTransportId: this.producerTransport.id,
            //             kind,
            //             rtpParameters,
            //         },
            //     }).then(({ id }) => callback({ id }))
            //         .catch(errback);
            // });

            // this.producerTransport.on('connectionstatechange', async (state: TState) => {
            //     switch (state) {
            //         case 'connecting': break;
            //         case 'connected': break;
            //         case 'failed':
            //             this.producerTransport.close();
            //             break;
            //         default: break;
            //     }
            // });
            
        } catch (error) {
            console.error(error.message, error.stack);
        }
    }


    getProducerTransport = async () => {
        return new Promise((resolve, reject) => {
            this._socket.emit(
                'media',
                { action: 'createWebRtcTransport', data: { type: 'producer' } },
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
                    resolve(data);
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
