// ==================== СЕРВИС FIREBASE (ДВА ПРОЕКТА + AUTH) ====================

import { FIREBASE_CONFIG } from '../config.js';
import { FIREBASE_CONFIG_WAREHOUSE } from '../config.js';

let _dbPacking = null;
let _dbWarehouse = null;
let _appPacking = null;
let _appWarehouse = null;
let _auth = null;
let _authWarehouse = null;

export function initFirebase() {
    if (typeof firebase === 'undefined') {
        console.error('Firebase SDK не загружен');
        return;
    }

    // Проект упаковщиц
    if (!_appPacking) {
        _appPacking = firebase.initializeApp(FIREBASE_CONFIG, 'packing');
        _dbPacking = firebase.firestore(_appPacking);
        _auth = firebase.auth(_appPacking);
        window.db = _dbPacking;
        try {
            _dbPacking.enablePersistence({ synchronizeTabs: true }).catch(() => {});
        } catch (e) {}
    }

    // Проект кладовщиков
    if (!_appWarehouse) {
        _appWarehouse = firebase.initializeApp(FIREBASE_CONFIG_WAREHOUSE, 'warehouse');
        _dbWarehouse = firebase.firestore(_appWarehouse);
        _authWarehouse = firebase.auth(_appWarehouse);
        try {
            _dbWarehouse.enablePersistence({ synchronizeTabs: true }).catch(() => {});
        } catch (e) {}
    }
}

// База упаковщиц (по умолчанию)
export function getDB() {
    if (!_dbPacking) initFirebase();
    return _dbPacking;
}

// База кладовщиков
export function getWarehouseDB() {
    if (!_dbWarehouse) initFirebase();
    return _dbWarehouse;
}

// Firebase Auth для packing (упаковщицы, операторы, админы)
export function getAuth() {
    if (!_auth) initFirebase();
    return _auth;
}

// Firebase Auth для warehouse (кладовщики)
export function getAuthWarehouse() {
    if (!_authWarehouse) initFirebase();
    return _authWarehouse;
}

// Вспомогательные функции для коллекций (по умолчанию — packing база)
export function collection(name) {
    return getDB().collection(name);
}

export async function queryWhere(collectionName, field, op, value) {
    const snapshot = await getDB().collection(collectionName)
        .where(field, op, value)
        .get();
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addDoc(collectionName, data) {
    const ref = await getDB().collection(collectionName).add(data);
    return ref.id;
}

export async function updateDoc(collectionName, id, data) {
    await getDB().collection(collectionName).doc(id).update(data);
}

export async function deleteDoc(collectionName, id) {
    await getDB().collection(collectionName).doc(id).delete();
}

export async function getDoc(collectionName, id) {
    const doc = await getDB().collection(collectionName).doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
}

export function batch() {
    return getDB().batch();
}

export function batchWarehouse() {
    return getWarehouseDB().batch();
}

export function serverTimestamp() {
    return firebase.firestore.FieldValue.serverTimestamp();
}