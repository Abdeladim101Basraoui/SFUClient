import { useRef } from "react";
import { useStartClient } from "../hooks/useStartClient";
// import { randomUUID } from "crypto"

const MediasoupClient = () => {

    const localVideoRef = useRef(null);
    const {
        socket,
        isConnected,
        // producerTransport,
        // consumerTransport,
        // device
    } = useStartClient({ room: "room1", name: "abdeladim", localVideo: localVideoRef, token: self.crypto.randomUUID() as string });

    return (
        <>
            {
                <div className={`text-3xl font-bold underline ${isConnected ? "text-red-500" : "text-green-400"}`}>
                    I'm connected:{isConnected ? "true" : "false"}
                </div>
            }
            <video ref={localVideoRef}></video>

            {/* <button onClick={
                () => {
                    socket.emit("getRouterRtpCapabilities", (data: any) => {
                        console.log(data);
                    });
                }
            }>

            </button> */}
        </>
    );
};

export default MediasoupClient;
