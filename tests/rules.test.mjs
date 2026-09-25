import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, collection, setDoc, getDoc, getDocs, updateDoc, deleteDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { DEFAULT_CONFIG, SESSION_ID } from '../js/default-config.js';
import { hashPin } from '../js/common.js';
let env, student, admin, outsider;
const pins = { team1: '11112222', team2: '22223333', team3: '33334444', team4: '44445555' };
const config = { ...structuredClone(DEFAULT_CONFIG), revision: 'test-v1', budget: 105, unit: 10, isOpen: true };
const session = db => doc(db, 'sessions', SESSION_ID);
const ref = (db, id = 'team1-01') => doc(db, 'sessions', SESSION_ID, 'submissions', id);
const payload = () => ({ sessionId: SESSION_ID, revision: 'test-v1', teamId: 'team1', personNo: 1,
  pin: pins.team1, investments: { team1: 0, team2: 20, team3: 10, team4: 0 },
  usedAmount: 30, remainingAmount: 75, createdAt: serverTimestamp() });
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-venture-pick', firestore: {
    host: '127.0.0.1', port: 8088, rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')
  }});
  student = env.unauthenticatedContext().firestore();
  admin = env.authenticatedContext('teacher').firestore();
  outsider = env.authenticatedContext('random-signed-in-user').firestore();
  for (const id of config.teamIds) config.teamPinHashes[id] = await hashPin(SESSION_ID, id, pins[id]);
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'admins', 'teacher'), { enabled: true });
    await setDoc(session(db), { ...config, updatedAt: serverTimestamp() });
    await setDoc(doc(db, 'sessions', SESSION_ID, 'private', 'pins'), { teamPins: pins });
  });
});
after(async () => { await env?.cleanup(); });
test('students can get settings only; PIN originals and all submissions are private', async () => {
  const snap = await assertSucceeds(getDoc(session(student)));
  assert.equal(snap.data().teamPins, undefined);
  await assertFails(getDocs(collection(student, 'sessions')));
  await assertFails(getDoc(doc(student, 'sessions', SESSION_ID, 'private', 'pins')));
  await assertSucceeds(setDoc(ref(student), payload()));
  await assertFails(getDoc(ref(student)));
  await assertFails(getDocs(collection(student, 'sessions', SESSION_ID, 'submissions')));
  await assertFails(deleteDoc(ref(student)));
  await assertFails(updateDoc(session(student), { isOpen: false }));
});
test('login alone does not grant admin rights or self-registration', async () => {
  await assertFails(getDocs(collection(outsider, 'sessions', SESSION_ID, 'submissions')));
  await assertFails(updateDoc(session(outsider), { isOpen: false, updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(outsider, 'admins', 'random-signed-in-user'), { enabled: true }));
  await assertSucceeds(getDoc(doc(outsider, 'admins', 'random-signed-in-user')));
});
test('partial and zero investments succeed; deterministic identity prevents duplicate and alternate IDs', async () => {
  await assertSucceeds(setDoc(ref(student), payload()));
  await assertFails(setDoc(ref(student), payload()));
  await assertFails(setDoc(ref(student, 'another-document'), payload()));
  await assertFails(setDoc(ref(student, 'team1-1'), payload()));
  const zero = { ...payload(), personNo: 2, investments: { team1: 0, team2: 0, team3: 0, team4: 0 }, usedAmount: 0, remainingAmount: 105 };
  await assertSucceeds(setDoc(ref(student, 'team1-02'), zero));
});
test('concurrent duplicate writes accept exactly one submission', async () => {
  const results = await Promise.allSettled([setDoc(ref(student), payload()), setDoc(ref(outsider), payload())]);
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
});
test('forged amounts, keys, PIN, identity, timestamps and stale revisions are denied', async () => {
  const p = payload();
  const variants = [
    { ...p, investments: { ...p.investments, team1: 10 }, usedAmount: 40, remainingAmount: 65 },
    { ...p, investments: { ...p.investments, team2: -10 }, usedAmount: 0, remainingAmount: 105 },
    { ...p, investments: { ...p.investments, team2: 0.5 } },
    { ...p, investments: { ...p.investments, team2: 15 }, usedAmount: 25, remainingAmount: 80 },
    { ...p, investments: { ...p.investments, team2: 100 }, usedAmount: 110, remainingAmount: -5 },
    { ...p, investments: { ...p.investments, team5: 0 } },
    { ...p, investments: { team1: 0, team2: 30 } },
    { ...p, usedAmount: 0, remainingAmount: 105 }, { ...p, remainingAmount: 1 },
    { ...p, pin: '9999' }, { ...p, revision: 'old' }, { ...p, personNo: 5 },
    { ...p, teamId: 'team5' }, { ...p, personNo: 1.5 },
    { ...p, createdAt: new Date(0) }, { ...p, extra: 'unexpected' }
  ];
  for (const value of variants) await assertFails(setDoc(ref(student), value));
});
test('admin can read, close, edit, reopen and delete; updates to existing votes are never allowed', async () => {
  await assertSucceeds(setDoc(ref(student), payload()));
  await assertSucceeds(getDocs(collection(admin, 'sessions', SESSION_ID, 'submissions')));
  await assertFails(deleteDoc(ref(admin))); // Must close first.
  await assertFails(updateDoc(session(admin), { budget: 200, updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(session(admin), { isOpen: false, updatedAt: serverTimestamp() }));
  await assertFails(setDoc(ref(student, 'team1-02'), { ...payload(), personNo: 2 }));
  await assertFails(updateDoc(ref(admin), { usedAmount: 0 }));
  const batch = writeBatch(admin);
  batch.update(session(admin), { title: '프로젝트 테스트', unit: 5, updatedAt: serverTimestamp() });
  batch.set(doc(admin, 'sessions', SESSION_ID, 'private', 'pins'), { teamPins: pins });
  await assertSucceeds(batch.commit());
  await assertSucceeds(deleteDoc(ref(admin)));
  await assertSucceeds(updateDoc(session(admin), { isOpen: true, updatedAt: serverTimestamp() }));
});
test('default closed project can be created but cannot open until PINs are configured', async () => {
  const id = 'new-project';
  const batch = writeBatch(admin);
  batch.set(doc(admin, 'sessions', id), { ...DEFAULT_CONFIG, sessionId: id, revision: 'initial', updatedAt: serverTimestamp() });
  batch.set(doc(admin, 'sessions', id, 'private', 'pins'), { teamPins: { team1: '', team2: '', team3: '', team4: '' } });
  await assertSucceeds(batch.commit());
  await assertFails(updateDoc(doc(admin, 'sessions', id), { isOpen: true, updatedAt: serverTimestamp() }));
});
