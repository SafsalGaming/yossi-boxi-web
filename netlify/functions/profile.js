const { db, requireUser, admin } = require("./_lib/firebaseAdmin");

const DEFAULTS = {
  coins: 0,
  bestScore: 0,
  ownedSkins: ["yossi_classic"],
  currentSkin: "yossi_classic"
};

exports.handler = async (event) => {
  try{
    const user = await requireUser(event);
    const uid = user.uid;
    const email = user.email || "";

    const ref = db().collection("users").doc(uid);

    if(event.httpMethod === "GET"){
      const snap = await ref.get();
      if(!snap.exists){
        const profile = {
          uid,
          email,
          username: "Player",
          ...DEFAULTS,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        await ref.set(profile, { merge: true });
        const after = await ref.get();
        return ok(after.data());
      }
      return ok(snap.data());
    }

    if(event.httpMethod === "PATCH"){
      const body = JSON.parse(event.body || "{}");

      const patch = {};
      if(typeof body.username === "string"){
        const u = body.username.trim();
        if(u.length < 3 || u.length > 16 || !/^[a-zA-Z0-9_]+$/.test(u)){
          return bad("Bad username");
        }
        patch.username = u;
      }

      if(typeof body.currentSkin === "string"){
        const s = body.currentSkin.trim();
        patch.currentSkin = s;
      }

      patch.updatedAt = admin.firestore.FieldValue.serverTimestamp();

      await ref.set({ uid, email, ...patch }, { merge: true });
      const after = await ref.get();
      return ok(after.data());
    }

    return bad("Method not allowed", 405);
  }catch(e){
    return bad(e.message || "error", 401);
  }
};

function ok(data){
  return { statusCode: 200, body: JSON.stringify(data) };
}
function bad(error, statusCode=400){
  return { statusCode, body: JSON.stringify({ error }) };
}
