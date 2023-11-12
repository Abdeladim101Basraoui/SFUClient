import { io } from 'socket.io-client';

// "undefined" means the URL will be computed from the `window.location` object
const URL = import.meta.env.VITE_NODE_ENV === 'production' ?
  import.meta.env.VITE_SOCKET_URL_PROD :
  import.meta.env.VITE_SOCKET_URL;

export const socket = io(URL
  , {
    autoConnect: false
  }
);