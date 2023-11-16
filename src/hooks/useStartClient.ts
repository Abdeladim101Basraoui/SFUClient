import { useEffect, useMemo, useState } from 'react';
import { createMediaSoupContext } from '../services/mediaSoupClientSession';
import { PType } from '../constant/SessionTypes';
// import { socket } from '../socket';


interface startClientProps {
    room: string;
    name: string;
    // localVideo: HTMLVideoElement | null;
    localVideo: any;
    token: string;
}
export const useStartClient = (props: startClientProps) => {
    const { room, name, localVideo, token } = props;
    const [isConnected, setIsConnected] = useState(false);

    const { socket, mediaSoup } = useMemo(() => createMediaSoupContext(room, name, token), [])

    useEffect(() => {

        function onConnect() {
            console.log("connected", socket.connected);
            setIsConnected(true);
            startSFUProcess();
        }

        function onDisconnect() {
            setIsConnected(false);
        }

        const startSFUProcess = async () => {
            //seperate the audio and video tracks from localVideo

            await mediaSoup.load();


            //produce audio
            await mediaSoup.producerStreamStart(PType.AUDIO);


            //producer video
            await mediaSoup.producerStreamStart(PType.VIDEO);
            console.log('mediaSoup.producerVideoStream', mediaSoup.producerVideoStream);

            //mixing audio and video into one stream to the localVideo
            localVideo.current.srcObject = new MediaStream([
                ...mediaSoup.producerAudioStream.getAudioTracks(),
                ...mediaSoup.producerVideoStream.getVideoTracks(),
            ]);

        }
        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);

        socket.onAny((event, ...args) => {
            console.warn(event, args);
        });

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
        };
    }, [room, name]);

    return { socket, isConnected }
}
