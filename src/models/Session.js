import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    nickname: { type: String, required: true },
    status: {
        type: String,
        enum: ["Activa", "Inactiva", "Finalizada por el Usuario", "Finalizada por falla de Sistema"],
        required: true,
        default: "Activa",
    },
    createdAt: { type: Date, default: Date.now },
    lastAccessed: { type: Date, default: Date.now },
    clientData: {
        clientIp: { type: String },
        clientMac: { type: String },
    },
    serverData: {
        serverIp: { type: String },
        serverMac: { type: String },
    }
});

const Session = mongoose.model('Session', sessionSchema);
export default Session;
