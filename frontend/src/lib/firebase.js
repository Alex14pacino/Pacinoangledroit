// Firebase init — Auth (email/password + Google) and Firestore.
// These keys are public by design; access is gated by Firestore security rules + Auth.
import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore, doc } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyCauxHeioMVsEcADpQmnKrsghMNFnYN0VY',
  authDomain: 'fitness-d50c0.firebaseapp.com',
  projectId: 'fitness-d50c0',
  storageBucket: 'fitness-d50c0.firebasestorage.app',
  messagingSenderId: '146789096428',
  appId: '1:146789096428:web:d6f85524412a43d2567ec9',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()

// One document per user holds the whole app state — the same shape the app already keeps in
// memory (`S`). Path lives under users/{uid}/… so the published security rules cover it.
export const stateDocRef = uid => doc(db, 'users', uid, 'state', 'main')
