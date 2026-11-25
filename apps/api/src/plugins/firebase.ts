import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

export interface DecodedFirebaseUser {
  uid: string;
  email: string;
  name?: string;
  picture?: string;
}

export function getFirebaseAuth(): Auth {
  if (getApps().length === 0) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (projectId && clientEmail && privateKey) {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    } else {
      initializeApp();
    }
  }

  return getAuth();
}

export async function verifyFirebaseIdToken(idToken: string): Promise<DecodedFirebaseUser> {
  const decoded = await getFirebaseAuth().verifyIdToken(idToken);
  if (!decoded.email) {
    throw new Error('Firebase token does not contain an email address');
  }
  return {
    uid: decoded.uid,
    email: decoded.email.toLowerCase(),
    name: typeof decoded.name === 'string' ? decoded.name : undefined,
    picture: typeof decoded.picture === 'string' ? decoded.picture : undefined,
  };
}
