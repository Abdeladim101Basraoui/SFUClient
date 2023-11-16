export enum TPeer {
    PRODUCER = 'producer',
    CONSUMER = 'consumer',
    DATA = 'data',
}

export enum TState {
    CONNECTING = 'connecting',
    CONNECTED = 'connected',
    FAILED = 'failed',
    CLOSED = 'closed',
}

export enum IProducerIds {
    GET_AUDIO_PRODUCER_IDS = 'getAudioProducerIds',
    GET_VIDEO_PRODUCER_IDS = 'getVideoProducerIds',
}

export enum Ckind {
    AUDIO = 'audio',
    VIDEO = 'video',
    DATA = 'data',
}

export enum PType {
    AUDIO = 'audio',
    VIDEO = 'video',
}

