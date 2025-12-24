const { db, requireUser } = require("./_lib/firebaseAdmin");

exports.handler = async (event) => {
  try{
    const usersRef = db().collection("users");

    // top 10
    const topSnap = await usersRef.orderBy("bestScore", "desc").limit(10).get();
    const top = topSnap.docs.map((d, i) => {
      const x = d.data() || {};
      return {
        rank: i + 1,
        uid: x.uid || d.id,
        username: x.username || "Player",
        bestScore: x.bestScore || 0,
        isMe: false,
      };
    });

    // אם יש טוקן ננסה להביא "me" ולהדגיש
    let me = null;
    try{
      const decoded = await requireUser(event);
      const uid = decoded.uid;
      const mySnap = await usersRef.doc(uid).get();
      const my = mySnap.exists ? mySnap.data() : null;

      if(my){
        const myScore = my.bestScore || 0;

        // rank = count(bestScore > myScore) + 1
        const agg = await usersRef.where("bestScore", ">", myScore).count().get();
        const better = agg.data().count || 0;
        const rank = better + 1;

        const inTop = top.some(r => r.uid === uid);
        for(const r of top) if(r.uid === uid) r.isMe = true;

        me = {
          rank,
          uid,
          username: my.username || "Player",
          bestScore: myScore,
          inTop,
          isMe: true,
        };
      }
    }catch{
      // guest, שקט
    }

    return ok({ top, me });
  }catch(e){
    return bad(e.message || "error");
  }
};

function ok(data){ return { statusCode: 200, body: JSON.stringify(data) }; }
function bad(error, statusCode=400){ return { statusCode, body: JSON.stringify({ error }) }; }
