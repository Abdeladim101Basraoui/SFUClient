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
    } = useStartClient({ room: "room1", name: "abdeladim", localVideo: localVideoRef, token: "57d2fb9d-925c-431c-b716-b5502115fd11" as string });

    return (
        <>
            {
                <div className={`text-3xl font-bold underline ${isConnected ? "text-red-500" : "text-green-400"}`}>
                    I'm connected:{isConnected ? "true" : "false"}
                </div>
            }
            <div className="flex ">
            <label htmlFor="video">local Video Stream: </label>
            <video ref={localVideoRef} className={"bg-black"}autoPlay controls></video>
            <button>Start Call</button>
            <br />
            <label htmlFor="video">remote Video Stream: </label>
            <video className={"bg-black"} autoPlay controls></video>
            <button>Join Call</button>
            </div>

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
