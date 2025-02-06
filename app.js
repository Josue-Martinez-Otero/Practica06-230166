import express from 'express';
import mongoose from 'mongoose';
import session from 'express-session';
import os from 'os';
import moment from 'moment-timezone';
import { v4 as uuidv4 } from 'uuid';
import Session from './src/models/Session.js';
import connectDB from './db.js';

const app = express();
app.use(express.json());
app.use(session({ secret: 'miSecreto', resave: false, saveUninitialized: true }));

connectDB();

// Obtener la IP local del servidor
const getLocalIP = () => {
    const networkInterfaces = os.networkInterfaces();
    for (const interfaces of Object.values(networkInterfaces)) {
        for (const iface of interfaces) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return { ip: iface.address, mac: iface.mac };
            }
        }
    }
    return { ip: null, mac: null };
};

// Ruta de bienvenida
app.get('/welcome', (req, res) => {
    res.status(200).json({
        message: 'Bienvenid@ al API de control de sesiones',
        author: 'Josue Atlai Martinez Otero',
    });
});

// Iniciar sesión
app.post('/login', async (req, res) => {
    const { email, nickname, macAddress } = req.body;
    if (!email || !nickname || !macAddress) {
        return res.status(400).json({ message: 'Se esperan campos requeridos' });
    }
    const sessionID = uuidv4();
    const now = new Date();
    const networkInfo = getLocalIP();
    
    const newSession = new Session({
        sessionId: sessionID,
        email,
        nickname,
        status: 'Activa',
        clientData: { clientIp: networkInfo.ip, clientMac: macAddress },
        serverData: { serverIp: networkInfo.ip, serverMac: networkInfo.mac },
        createdAt: now,
        lastAccessed: now,
    });
    await newSession.save();

    req.session.sessionID = sessionID;
    res.status(200).json({ message: 'Login exitoso', sessionID });
});

// Cerrar sesión
app.post('/logout', async (req, res) => {
    const { sessionID } = req.body;
    if (!sessionID) return res.status(400).json({ message: 'Session ID requerido' });
    
    const session = await Session.findOne({ sessionId: sessionID });
    if (!session) return res.status(404).json({ message: 'Sesión no encontrada' });
    
    session.status = 'Finalizada por el Usuario';
    await session.save();
    
    req.session.destroy((err) => {
        if (err) return res.status(500).send('Error al cerrar sesión');
        res.status(200).json({ message: 'Logout exitoso' });
    });
});

// Actualizar última actividad de la sesión
app.put('/update', async (req, res) => {
    const { sessionID } = req.body;
    if (!sessionID) return res.status(400).json({ message: 'Session ID requerido' });
    
    const session = await Session.findOne({ sessionId: sessionID });
    if (!session) return res.status(404).json({ message: 'Sesión no encontrada' });
    
    session.lastAccessed = new Date();
    await session.save();
    res.status(200).json({ message: 'Sesión actualizada', session });
});

// Consultar estado de la sesión
app.post('/status', async (req, res) => {
    const { sessionID } = req.body;
    if (!sessionID) return res.status(400).json({ message: 'Session ID requerido' });
    
    const session = await Session.findOne({ sessionId: sessionID });
    if (!session) return res.status(404).json({ message: 'No hay sesión activa' });
    
    const now = new Date();
    const inactivitySeconds = Math.floor((now - session.lastAccessed) / 1000);
    const hours = Math.floor(inactivitySeconds / 3600);
    const minutes = Math.floor((inactivitySeconds % 3600) / 60);
    const seconds = inactivitySeconds % 60;
    
    res.status(200).json({
        message: 'Sesión activa',
        session,
        inactivityTime: `${hours}h ${minutes}m ${seconds}s`,
    });
});

// Listar sesiones activas
app.get('/listCurrentSessions', async (req, res) => {
    const activeSessions = await Session.find({ status: 'Activa' });
    if (activeSessions.length === 0) return res.status(404).json({ message: 'No hay sesiones activas' });
    res.status(200).json({ message: 'Sesiones activas', activeSessions });
});

// Eliminar sesiones inactivas automáticamente
setInterval(async () => {
    const now = new Date();
    const twoMinutesAgo = new Date(now - 120000);
    await Session.updateMany(
        { lastAccessed: { $lt: twoMinutesAgo }, status: 'Activa' },
        { $set: { status: 'Finalizada por falla de Sistema' } }
    );
    console.log('Sesiones inactivas eliminadas');
}, 60000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
