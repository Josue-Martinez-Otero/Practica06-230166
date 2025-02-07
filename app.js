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
app.use(
    session({
        secret: 'P4-JMO#Pioneros-SesionesHTTP-VariablesDeSesion',
        resave: false,
        saveUninitialized: true,
        rolling: true,
        cookie: { maxAge: 30 * 60 * 1000 },
    })
);

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

app.post('/logout', async (req, res) => {
    const { sessionID } = req.body;
    if (!sessionID) return res.status(400).json({ message: 'Session ID requerido' });

    const session = await Session.findOne({ sessionId: sessionID });

    if (!session) return res.status(404).json({ message: 'Sesión no encontrada' });

    // Si la sesión ya está cerrada, evitar hacer cambios
    if (session.status !== 'Activa') {
        return res.status(400).json({ message: 'No hay sesión activa' });
    }

    //  Marcar la sesión como finalizada
    session.status = 'Finalizada por el Usuario';
    await session.save();

    //  Destruir la sesión en Express
    req.session.destroy((err) => {
        if (err) return res.status(500).json({ message: 'Error al cerrar sesión' });
        res.status(200).json({ message: 'Sesión cerrada exitosamente' });
    });
});

app.put('/update', async (req, res) => {
    const { sessionID } = req.body;
    if (!sessionID) return res.status(400).json({ message: 'Session ID requerido' });

    const session = await Session.findOne({ sessionId: sessionID });

    if (!session) return res.status(404).json({ message: 'Sesión no encontrada' });

    // Si la sesión ya está cerrada, no permitir actualizarla
    if (session.status !== 'Activa') {
        return res.status(400).json({ message: 'No hay nada que actualizar porque la sesión ya está cerrada' });
    }

    // Si la sesión sigue activa, actualizar la última actividad
    session.lastAccessed = new Date();
    await session.save();
    res.status(200).json({ message: 'Sesión actualizada', session });
});

// Consultar estado de la sesión
app.post('/status', async (req, res) => {
    console.log(req.body); // Ver qué llega en la solicitud

    const { sessionID } = req.body;
    if (!sessionID) {
        return res.status(400).json({ message: 'Session ID requerido' });
    }

    // Buscar la sesión en MongoDB
    const session = await Session.findOne({ sessionId: sessionID });

    if (!session) {
        return res.status(404).json({ message: 'Sesión no encontrada' });
    }

    //  Si la sesión ya fue cerrada, no debe devolver datos
    if (session.status !== 'Activa') {
        return res.status(403).json({ message: 'No hay sesión activa' });
    }

    // Verificar si ya pasó más de 2 minutos de inactividad
    const now = new Date();
    const twoMinutesAgo = new Date(now - 120000);

    if (session.lastAccessed < twoMinutesAgo) {
        // Cerrar sesión automáticamente y actualizar el estado en la base de datos
        session.status = 'Finalizada por inactividad';
        await session.save();
        return res.status(403).json({ message: 'No hay sesión activa' });
    }

    // Calcular el tiempo de inactividad
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


// Obtener todas las sesiones sin importar su estado
app.get('/allSessions', async (req, res) => {
    try {
        const allSessions = await Session.find({});
        res.status(200).json({ message: 'Todas las sesiones', allSessions });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener todas las sesiones', error });
    }
});

// Obtener todas las sesiones activas
app.get('/allCurrentSessions', async (req, res) => {
    try {
        const activeSessions = await Session.find({ status: 'Activa' });
        if (activeSessions.length === 0) {
            return res.status(404).json({ message: 'No hay sesiones activas' });
        }
        res.status(200).json({ message: 'Sesiones activas', activeSessions });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener sesiones activas', error });
    }
});

// Eliminar todas las sesiones (PELIGROSO)
app.delete('/deleteAllSessions', async (req, res) => {
    try {
        await Session.deleteMany({});
        res.status(200).json({ message: 'Todas las sesiones eliminadas' });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar sesiones', error });
    }
});

// Cerrar sesiones inactivas automáticamente después de 2 minutos
setInterval(async () => {
    const now = new Date();
    const twoMinutesAgo = new Date(now - 120000);

    // Buscar sesiones inactivas y cambiar su estado
    const sessionsToClose = await Session.find({
        lastAccessed: { $lt: twoMinutesAgo },
        status: 'Activa',
    });

    if (sessionsToClose.length > 0) {
        for (const session of sessionsToClose) {
            session.status = 'Finalizada por falla de Sistema';
            await session.save();
        }
        console.log(`Cerradas ${sessionsToClose.length} sesiones inactivas.`);
    }
}, 60000); // Se ejecuta cada 60 segundos

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
