// Propósito: Conectar a la base de datos de MongoDB
import mongoose from 'mongoose';

const connectDB = async () => {
    try {
        await mongoose.connect('mongodb+srv://JosOtero:db230166@bdjos.qd3wi.mongodb.net/sesiones_db?retryWrites=true&w=majority&appName=BDJos');
        console.log('Conexión a MongoDB establecida');
    } catch (error) {
        console.error('Error al conectar a MongoDB:', error);
    }
};

export default connectDB;
