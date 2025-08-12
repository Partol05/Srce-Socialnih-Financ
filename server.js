const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://mxph65:FY5FIjjwMPTjUj68@srce-financ-cluster.xl0fga4.mongodb.net/srce-financ?retryWrites=true&w=majority&appName=srce-financ-cluster';
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('✅ Connecté à MongoDB');
}).catch(err => {
    console.error('❌ Erreur MongoDB:', err);
});

// Schémas MongoDB
const ApplicationSchema = new mongoose.Schema({
    applicationId: { type: String, unique: true, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true }, 
    country: { type: String, required: true },
    city: { type: String, required: true },
    address: { type: String, required: true },
    amount: { type: Number, required: true },
    months: { type: Number, required: true },
    income: { type: Number, required: true },
    status: { type: String, default: 'pending', enum: ['pending', 'approved', 'rejected'] },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const MessageSchema = new mongoose.Schema({
    applicationId: { type: String, required: true },
    message: { type: String, required: true },
    from: { type: String, required: true, enum: ['user', 'admin'] },
    createdAt: { type: Date, default: Date.now }
});

const Application = mongoose.model('Application', ApplicationSchema);
const Message = mongoose.model('Message', MessageSchema);

// Fonction pour générer un ID unique
function generateApplicationId() {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `KR-${year}-${random}`;
}

// Routes API

// Page d'accueil - servir index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Créer une nouvelle demande de crédit
app.post('/api/applications', async (req, res) => {
    try {
        let applicationId;
        let isUnique = false;
        
        // Générer un ID unique
        while (!isUnique) {
            applicationId = generateApplicationId();
            const existing = await Application.findOne({ applicationId });
            if (!existing) {
                isUnique = true;
            }
        }

        const application = new Application({
            applicationId,
            ...req.body
        });

        await application.save();
        console.log(`✅ Nouvelle demande créée: ${applicationId}`);
        
        res.status(201).json({ 
            success: true, 
            applicationId,
            message: 'Demande de crédit soumise avec succès'
        });
    } catch (error) {
        console.error('❌ Erreur création demande:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur lors de la création de la demande'
        });
    }
});

// Récupérer une demande par ID
app.get('/api/applications/:id', async (req, res) => {
    try {
        const application = await Application.findOne({ applicationId: req.params.id });
        
        if (!application) {
            return res.status(404).json({ 
                success: false, 
                message: 'Demande non trouvée' 
            });
        }

        res.json({
            success: true,
            ...application.toObject()
        });
    } catch (error) {
        console.error('❌ Erreur récupération demande:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur serveur' 
        });
    }
});

// Admin: Récupérer toutes les demandes
app.get('/api/admin/applications', async (req, res) => {
    try {
        const applications = await Application.find().sort({ createdAt: -1 });
        res.json(applications);
    } catch (error) {
        console.error('❌ Erreur récupération demandes admin:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur serveur' 
        });
    }
});

// Admin: Mettre à jour le statut d'une demande
app.put('/api/admin/applications/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        
        if (!['pending', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Statut invalide' 
            });
        }

        const application = await Application.findOneAndUpdate(
            { applicationId: req.params.id },
            { status, updatedAt: new Date() },
            { new: true }
        );

        if (!application) {
            return res.status(404).json({ 
                success: false, 
                message: 'Demande non trouvée' 
            });
        }

        console.log(`✅ Statut mis à jour: ${req.params.id} → ${status}`);
        
        res.json({ 
            success: true, 
            application 
        });
    } catch (error) {
        console.error('❌ Erreur mise à jour statut:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur serveur' 
        });
    }
});

// Ajouter un message (user)
app.post('/api/applications/:id/messages', async (req, res) => {
    try {
        const { message, from } = req.body;
        
        // Vérifier que la demande existe
        const application = await Application.findOne({ applicationId: req.params.id });
        if (!application) {
            return res.status(404).json({ 
                success: false, 
                message: 'Demande non trouvée' 
            });
        }

        const newMessage = new Message({
            applicationId: req.params.id,
            message,
            from
        });

        await newMessage.save();
        console.log(`✅ Message ajouté: ${req.params.id} (${from})`);
        
        res.status(201).json({ 
            success: true, 
            message: newMessage 
        });
    } catch (error) {
        console.error('❌ Erreur ajout message:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur serveur' 
        });
    }
});

// Admin: Ajouter un message
app.post('/api/admin/applications/:id/messages', async (req, res) => {
    try {
        const { message } = req.body;
        
        const newMessage = new Message({
            applicationId: req.params.id,
            message,
            from: 'admin'
        });

        await newMessage.save();
        console.log(`✅ Message admin ajouté: ${req.params.id}`);
        
        res.status(201).json({ 
            success: true, 
            message: newMessage 
        });
    } catch (error) {
        console.error('❌ Erreur ajout message admin:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur serveur' 
        });
    }
});

// Récupérer les messages d'une demande
app.get('/api/applications/:id/messages', async (req, res) => {
    try {
        const messages = await Message.find({ applicationId: req.params.id }).sort({ createdAt: 1 });
        res.json(messages);
    } catch (error) {
        console.error('❌ Erreur récupération messages:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur serveur' 
        });
    }
});

// Route de test
app.get('/api/test', (req, res) => {
    res.json({ 
        success: true, 
        message: 'API fonctionne correctement!',
        timestamp: new Date().toISOString()
    });
});

// Gestion des erreurs 404
app.use('*', (req, res) => {
    res.status(404).json({ 
        success: false, 
        message: 'Route non trouvée' 
    });
});

// Démarrage du serveur
app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    console.log(`📱 Application accessible sur: http://localhost:${PORT}`);
});

// Gestion gracieuse de l'arrêt
process.on('SIGTERM', () => {
    console.log('🛑 Arrêt du serveur...');
    mongoose.connection.close();
    process.exit(0);
});
