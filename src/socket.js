import io from 'socket.io-client';

const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:3001';

export const socket = io(SERVER_URL, {
    autoConnect: false, // Connect manually after username prompt or session restore
    reconnectionAttempts: 5,
    reconnectionDelay: 3000,
});

export const connectSocket = (authPayload) => {
    if (socket.disconnected) {
        if (authPayload) {
            socket.auth = authPayload; // For session restoration attempts
        }
        socket.connect();
    }
};

export const disconnectSocket = () => {
    if (socket.connected) {
        socket.disconnect();
    }
};