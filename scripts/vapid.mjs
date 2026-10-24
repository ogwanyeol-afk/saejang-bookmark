// 웹 푸시용 VAPID 키 만들기: npm run vapid
const { subtle } = globalThis.crypto;
const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const pub = Buffer.from(await subtle.exportKey('raw', kp.publicKey)).toString('base64url');
const { d } = await subtle.exportKey('jwk', kp.privateKey);
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${pub}\nVAPID_PRIVATE_KEY=${d}`);
