import os

import firebase_admin
from firebase_admin import credentials, firestore

_db = None


def initialize_firebase():
    global _db
    cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if cred_path:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    else:
        firebase_admin.initialize_app()
    _db = firestore.client()


def get_db():
    if _db is None:
        raise RuntimeError("Firebase not initialized. Call initialize_firebase() first.")
    return _db
