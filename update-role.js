const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function updateUserRole() {
    try {
        await db.collection('users').doc('francoaguirre928@gmail.com').set({
            email: 'francoaguirre928@gmail.com',
            role: 'admin'
        }, { merge: true });

        console.log('✅ Usuario actualizado a admin exitosamente');
    } catch (error) {
        console.error('Error:', error);
    }
    process.exit();
}

updateUserRole();
