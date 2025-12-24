const { db, requireUser, admin } = require("./_lib/firebaseAdmin");

const PRICES = {
  yossi_classic: 0,
  yossi_bossi: 200,
  yoyo_yossi: 500,
  yossi_dossi: 1000,
};

exports.handler = async (event) => {
  try{
    if(event.httpMethod !== "POST") return bad("Method not allowed", 405);

    const user = await requireUser(event);
    const uid = user.uid;
    const email = user.email || "";

    const body = JSON.parse(event.body || "{}");
    const skinId = String(body.skinId || "").trim();
    if(!(skinId in PRICES)) return bad("Unknown skin");

    const price = PRICES[skinId];
    const ref = db().collection("users").doc(uid);

    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const cur = snap.exists ? snap.data() : {};

      const owned = Array.isArray(cur.ownedSkins) ? cur.ownedSkins : [];
      if(!owned.includes("yossi_classic")) owned.push("yossi_classic");

      if(owned.includes(skinId) || price === 0){
        tx.set(ref, {
          uid, email,
          ownedSkins: Array.from(new Set([...owned, skinId])),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge:true });
        return;
      }

      const coins = cur.coins || 0;
      if(coins < price) throw new Error("Not enough coins");

      tx.set(ref, {
        uid, email,
        coins: coins - price,
        ownedSkins: Array.from(new Set([...owned, skinId])),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge:true });
    });

    const after = await ref.get();
    return ok(after.data());
  }catch(e){
    return bad(e.message || "error", 401);
  }
};

function ok(data){ return { statusCode: 200, body: JSON.stringify(data) }; }
function bad(error, statusCode=400){ return { statusCode, body: JSON.stringify({ error }) }; }
