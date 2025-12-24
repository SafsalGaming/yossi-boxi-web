const { db, requireUser, admin } = require("./_lib/firebaseAdmin");

exports.handler = async (event) => {
  try{
    if(event.httpMethod !== "POST") return bad("Method not allowed", 405);

    const user = await requireUser(event);
    const uid = user.uid;
    const email = user.email || "";

    const body = JSON.parse(event.body || "{}");
    const score = Math.max(0, Math.floor(body.score || 0));
    const coinsEarned = Math.max(0, Math.floor(body.coinsEarned || 0));

    const ref = db().collection("users").doc(uid);

    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const cur = snap.exists ? snap.data() : {};

      const bestScore = Math.max(cur.bestScore || 0, score);
      const coins = (cur.coins || 0) + coinsEarned;

      const owned = Array.isArray(cur.ownedSkins) ? cur.ownedSkins : ["yossi_classic"];
      if(!owned.includes("yossi_classic")) owned.push("yossi_classic");

      tx.set(ref, {
        uid,
        email,
        username: cur.username || "Player",
        bestScore,
        coins,
        ownedSkins: owned,
        currentSkin: cur.currentSkin || "yossi_classic",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: cur.createdAt || admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    });

    const after = await ref.get();
    return ok(after.data());
  }catch(e){
    return bad(e.message || "error", 401);
  }
};

function ok(data){ return { statusCode: 200, body: JSON.stringify(data) }; }
function bad(error, statusCode=400){ return { statusCode, body: JSON.stringify({ error }) }; }
