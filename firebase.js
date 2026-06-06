// ============================================================
// firebase.js  ―  
// 表示名管理（usersコレクション）・参加キャンセル・全機能対応
// ============================================================

import { initializeApp }
  from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  increment,
  serverTimestamp,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { getAnalytics }
  from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";

// ── Firebase 設定 ─────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyA_0qj3n_4eoARjDTO1jdWRXmYNE7HZRrk",
  authDomain:        "osaka-info-gakusyukai.firebaseapp.com",
  projectId:         "osaka-info-gakusyukai",
  storageBucket:     "osaka-info-gakusyukai.firebasestorage.app",
  messagingSenderId: "222261320673",
  appId:             "1:222261320673:web:896e9b0eea9d074d7990a0",
  measurementId:     "G-DFJ1VJVVD2"
};

const app       = initializeApp(firebaseConfig);
const db        = getFirestore(app);
const analytics = getAnalytics(app);
console.log("Firebase 接続OK");

// ── docId マップ ───────────────────────────────────────────
let boardIdMap    = {};
let noticeIdMap   = {};
let memberIdMap   = {};
let scheduleIdMap = {};
let faqIdMap      = {};

// ── 表示名マップ（email → displayName）───────────────────
// index.html の resolveDisplayName() がこれを参照する
window.usersMap = {};

// ── 日時フォーマット ───────────────────────────────────────
function formatDateTime(timestamp) {
  if (!timestamp) return "";
  const d  = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  const h  = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${y}/${mo}/${dy} ${h}:${mi}`;
}

// ============================================================
// 【表示名管理】usersコレクション
// ============================================================

/**
 * ログイン後に呼ばれる。
 * Firestoreのusers/{email}を確認し、
 * - 表示名あり → そのままログイン完了
 * - 表示名なし → STEP3（表示名設定画面）を表示
 */
window.checkAndLoadDisplayName = async function (email) {
  try {
    // メールアドレスをドキュメントIDに使うためエンコード
    const safeEmail = email.replace(/\./g, "_dot_");
    const userDoc = await getDoc(doc(db, "users", safeEmail));
    if (userDoc.exists() && userDoc.data().displayName) {
      // 表示名あり → ログイン完了
      const displayName = userDoc.data().displayName;
      window.currentDisplayName = displayName;
      window.usersMap[email] = displayName;
      if (window.showLoginHeader) window.showLoginHeader(email, displayName);
      if (window.updateBoardNameField)  window.updateBoardNameField();
      if (window.updateMemberNameField) window.updateMemberNameField();
      // Firestoreリスナー開始
      window.startFirestoreListeners();
    } else {
      // 表示名なし → STEP3を表示
      document.getElementById("displayNameOverlay").style.display = "flex";
    }
  } catch (err) {
    console.error("表示名確認失敗:", err);
    // エラー時もSTEP3を表示
    document.getElementById("displayNameOverlay").style.display = "flex";
  }
};

/**
 * 表示名をFirestoreに保存する
 */
window.firebaseSaveDisplayName = async function (email, displayName) {
  try {
    const safeEmail = email.replace(/\./g, "_dot_");
    await setDoc(doc(db, "users", safeEmail), {
      email       : email,
      displayName : displayName,
      updatedAt   : serverTimestamp()
    });
    // usersMapも更新
    window.usersMap[email] = displayName;
    // 掲示板・メンバーを再描画（最新名に更新）
    if (window.renderBoard)   window.renderBoard();
    if (window.renderMembers) window.renderMembers();
    console.log("表示名保存OK:", displayName);
  } catch (err) {
    console.error("表示名保存失敗:", err);
  }
};

/**
 * 全ユーザーの表示名をFirestoreから読み込んでusersMapに格納
 */
async function loadAllDisplayNames() {
  try {
    const snap = await getDocs(collection(db, "users"));
    snap.forEach(d => {
      const raw = d.data();
      if (raw.email && raw.displayName) {
        window.usersMap[raw.email] = raw.displayName;
      }
    });
    console.log("表示名マップ読込OK:", Object.keys(window.usersMap).length, "件");
    // 読込後に再描画
    if (window.renderBoard)   window.renderBoard();
    if (window.renderMembers) window.renderMembers();
  } catch (err) {
    console.error("表示名マップ読込失敗:", err);
  }
}

// ============================================================
// 【Firestoreリスナー開始】
// ============================================================

window.startFirestoreListeners = function () {
  loadAllDisplayNames();  // 全ユーザーの表示名を先に読み込む
  initBoardListener();
  initNoticeListener();
  initMemberListener();
  initScheduleListener();
  initFaqListener();
  initSettingsListener();
  initOfficerListener();
  initRulesListener();
  console.log("Firestoreリスナー全開始");
};

// ページ読み込み時、すでにログイン済みなら自動でチェック
window.addEventListener("load", () => {
  const access = localStorage.getItem("siteAccess");
  const email  = localStorage.getItem("kindaiEmail");
  if (access === "ok" && email && email.endsWith("@kindai.ac.jp")) {
    setTimeout(() => {
      window.checkAndLoadDisplayName(email);
    }, 600);
  }
});

// ============================================================
// 【掲示板】
// ============================================================

window.firebaseSaveBoardPost = async function (post) {
  try {
    await addDoc(collection(db, "boardPosts"), {
      category    : post.category,
      title       : post.title,
      body        : post.body,
      author      : post.author,
      authorEmail : post.authorEmail || "",
      likes       : 0,
      solved      : false,
      stamps      : post.stamps,
      created     : serverTimestamp()
    });
    console.log("掲示板投稿保存OK");
  } catch (err) {
    console.error("掲示板投稿保存失敗:", err);
  }
};

window.firebaseLikePost = async function (localIndex) {
  const docId = boardIdMap[localIndex];
  if (!docId) return;
  try {
    await updateDoc(doc(db, "boardPosts", docId), { likes: increment(1) });
  } catch (err) {
    console.error("いいね更新失敗:", err);
  }
};

window.firebaseStampPost = async function (localIndex, stampKey) {
  const docId = boardIdMap[localIndex];
  if (!docId) return;
  try {
    await updateDoc(doc(db, "boardPosts", docId), {
      [`stamps.${stampKey}`]: increment(1)
    });
  } catch (err) {
    console.error("スタンプ更新失敗:", err);
  }
};

window.firebaseToggleSolved = async function (localIndex, newValue) {
  const docId = boardIdMap[localIndex];
  if (!docId) return;
  try {
    await updateDoc(doc(db, "boardPosts", docId), { solved: newValue });
  } catch (err) {
    console.error("解決済み更新失敗:", err);
  }
};

window.firebaseAddReply = async function (localIndex, reply) {
  const docId = boardIdMap[localIndex];
  if (!docId) return;
  try {
    await addDoc(
      collection(db, "boardPosts", docId, "replies"),
      {
        text        : reply.text,
        author      : reply.author      || "匿名",
        authorEmail : reply.authorEmail || "",
        created     : serverTimestamp()
      }
    );
    console.log("返信保存OK");
  } catch (err) {
    console.error("返信保存失敗:", err);
  }
};
window.firebaseLikeReply = async function (postIndex, replyIndex) {
  const docId = boardIdMap[postIndex];
  if (!docId) return;
  try {
    const rSnap = await getDocs(
      query(collection(db, "boardPosts", docId, "replies"), orderBy("created", "asc"))
    );
    const replyDoc = rSnap.docs[replyIndex];
    if (!replyDoc) return;
    await updateDoc(doc(db, "boardPosts", docId, "replies", replyDoc.id), {
      likes: increment(1)
    });
    console.log("返信いいねOK");
  } catch (err) {
    console.error("返信いいね失敗:", err);
  }
};

window.firebaseDeleteBoardPost = async function (localIndex) {
  const docId = boardIdMap[localIndex];
  if (!docId) { console.warn("掲示板docId不明:", localIndex); return; }
  try {
    await deleteDoc(doc(db, "boardPosts", docId));
    console.log("掲示板投稿削除OK");
  } catch (err) {
    console.error("掲示板投稿削除失敗:", err);
  }
};

async function initBoardListener() {
  const q = query(collection(db, "boardPosts"), orderBy("created", "desc"));
  onSnapshot(q, async (snapshot) => {
    const posts = [];
    boardIdMap = {};
    for (let i = 0; i < snapshot.docs.length; i++) {
      const d   = snapshot.docs[i];
      const raw = d.data();
      let replies = [];
      try {
        const rSnap = await getDocs(
          query(collection(db, "boardPosts", d.id, "replies"), orderBy("created", "asc"))
        );
replies = rSnap.docs.map(r => ({
  text        : r.data().text,
  author      : r.data().author      || "匿名",
  authorEmail : r.data().authorEmail || "",
  created     : formatDateTime(r.data().created),
  likes       : r.data().likes       || 0
}));
      } catch (_) {}
      posts.push({
        category    : raw.category    || "質問",
        title       : raw.title       || "",
        body        : raw.body        || "",
        author      : raw.author      || "匿名",
        authorEmail : raw.authorEmail || "",
        likes       : raw.likes       || 0,
        solved      : raw.solved      || false,
        stamps      : raw.stamps      || { "❤":0,"👍":0,"😊":0,"🎉":0,"💪":0 },
        replies     : replies,
        created     : formatDateTime(raw.created)
      });
      boardIdMap[i] = d.id;
    }
    if (window.data && window.renderBoard) {
      window.data.boardPosts = posts;
      window.renderBoard();
      console.log(`掲示板を同期: ${posts.length}件`);
    }
  }, (err) => console.error("掲示板onSnapshotエラー:", err));
}

// ============================================================
// 【お知らせ】
// ============================================================

window.firebaseSaveNotice = async function (notice) {
  try {
    await addDoc(collection(db, "notices"), {
      title    : notice.title,
      body     : notice.body,
      type     : notice.type,
      pinned   : notice.pinned,
      formUrl  : notice.formUrl  || "",
      created  : notice.created  || "",
      createdAt: serverTimestamp()
    });
    console.log("お知らせ保存OK");
  } catch (err) {
    console.error("お知らせ保存失敗:", err);
  }
};

window.firebaseDeleteNotice = async function (localIndex) {
  const docId = noticeIdMap[localIndex];
  if (!docId) { console.warn("お知らせdocId不明:", localIndex); return; }
  try {
    await deleteDoc(doc(db, "notices", docId));
    console.log("お知らせ削除OK");
  } catch (err) {
    console.error("お知らせ削除失敗:", err);
  }
};

window.firebaseUpdateNotice = async function (localIndex, updatedData) {
  const docId = noticeIdMap[localIndex];
  if (!docId) return;
  try {
    await updateDoc(doc(db, "notices", docId), updatedData);
    console.log("お知らせ更新OK");
  } catch (err) {
    console.error("お知らせ更新失敗:", err);
  }
};

function initNoticeListener() {
  const q = query(collection(db, "notices"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    const notices = [];
    noticeIdMap = {};
    snapshot.docs.forEach((d, i) => {
      const raw = d.data();
      notices.push({
        title   : raw.title   || "",
        body    : raw.body    || "",
        type    : raw.type    || "お知らせ",
        pinned  : raw.pinned  || false,
        formUrl : raw.formUrl || "",
        created : raw.created || ""
      });
      noticeIdMap[i] = d.id;
    });
    if (window.data && window.renderNotices) {
      window.data.notices = notices;
      window.renderNotices();
      console.log(`お知らせを同期: ${notices.length}件`);
    }
  }, (err) => console.error("お知らせonSnapshotエラー:", err));
}

// ============================================================
// 【メンバー】
// ============================================================

window.firebaseSaveMember = async function (member) {
  try {
    await addDoc(collection(db, "members"), {
      name      : member.name,
      email     : member.email     || "",
      icon      : member.icon      || "👤",
      comment   : member.comment   || "",
      subject   : member.subject   || "",
      style     : member.style     || "",
      grade     : member.grade     || "",
      password  : member.password  || "",
      createdAt : serverTimestamp()
    });
    console.log("メンバー保存OK");
  } catch (err) {
    console.error("メンバー保存失敗:", err);
  }
};

window.firebaseDeleteMember = async function (localIndex) {
  const docId = memberIdMap[localIndex];
  if (!docId) { console.warn("メンバーdocId不明:", localIndex); return; }
  try {
    await deleteDoc(doc(db, "members", docId));
    console.log("メンバー削除OK");
  } catch (err) {
    console.error("メンバー削除失敗:", err);
  }
};

window.firebaseUpdateMember = async function (localIndex, updatedData) {
  const docId = memberIdMap[localIndex];
  if (!docId) return;
  try {
    await updateDoc(doc(db, "members", docId), updatedData);
    console.log("メンバー更新OK");
  } catch (err) {
    console.error("メンバー更新失敗:", err);
  }
};

function initMemberListener() {
  const q = query(collection(db, "members"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    const members = [];
    memberIdMap = {};
    snapshot.docs.forEach((d, i) => {
      const raw = d.data();
      members.push({
        name     : raw.name     || "",
        email    : raw.email    || "",
        icon     : raw.icon     || "👤",
        comment  : raw.comment  || "",
        subject  : raw.subject  || "",
        style    : raw.style    || "",
        grade    : raw.grade    || "",
        password : raw.password || ""
      });
      memberIdMap[i] = d.id;
    });
    if (window.data && window.renderMembers) {
      window.data.members = members;
      // usersMapが読み込まれていれば即描画、なければ少し待って再描画
      if (window.usersMap && Object.keys(window.usersMap).length > 0) {
        window.renderMembers();
      } else {
        setTimeout(() => { if (window.renderMembers) window.renderMembers(); }, 1500);
      }
      console.log(`メンバーを同期: ${members.length}件`);
    }
  }, (err) => console.error("メンバーonSnapshotエラー:", err));
}

// ============================================================
// 【スケジュール】（参加キャンセル対応）
// ============================================================

window.firebaseSaveSchedule = async function (schedule) {
  try {
await addDoc(collection(db, "schedules"), {
  date        : schedule.date,
  endDate     : schedule.endDate || "",
  title       : schedule.title,
  place       : schedule.place  || "",
  type        : schedule.type   || "勉強会",
  participants: 0,
  createdAt   : serverTimestamp()
});
    console.log("スケジュール保存OK");
  } catch (err) {
    console.error("スケジュール保存失敗:", err);
  }
};

window.firebaseDeleteSchedule = async function (localIndex) {
  const docId = scheduleIdMap[localIndex];
  if (!docId) { console.warn("スケジュールdocId不明:", localIndex); return; }
  try {
    await deleteDoc(doc(db, "schedules", docId));
    console.log("スケジュール削除OK");
  } catch (err) {
    console.error("スケジュール削除失敗:", err);
  }
};

window.firebaseUpdateSchedule = async function (localIndex, updatedData) {
  const docId = scheduleIdMap[localIndex];
  if (!docId) return;
  try {
    await updateDoc(doc(db, "schedules", docId), updatedData);
    console.log("スケジュール更新OK");
  } catch (err) {
    console.error("スケジュール更新失敗:", err);
  }
};

window.firebaseJoinSchedule = async function (localIndex) {
  const docId = scheduleIdMap[localIndex];
  if (!docId) return;
  try {
    await updateDoc(doc(db, "schedules", docId), { participants: increment(1) });
    console.log("参加登録OK");
  } catch (err) {
    console.error("参加登録失敗:", err);
  }
};

window.firebaseCancelSchedule = async function (localIndex) {
  const docId = scheduleIdMap[localIndex];
  if (!docId) return;
  try {
    await updateDoc(doc(db, "schedules", docId), { participants: increment(-1) });
    console.log("参加キャンセルOK");
  } catch (err) {
    console.error("参加キャンセル失敗:", err);
  }
};

function initScheduleListener() {
  const q = query(collection(db, "schedules"), orderBy("date", "asc"));
  onSnapshot(q, (snapshot) => {
    const schedules = [];
    scheduleIdMap = {};
    snapshot.docs.forEach((d, i) => {
      const raw = d.data();
      schedules.push({
        date        : raw.date         || "",
        title       : raw.title        || "",
        place       : raw.place        || "",
        type        : raw.type         || "勉強会",
        participants: raw.participants  || 0,
        joined      : false
      });
      scheduleIdMap[i] = d.id;
    });
    if (window.data && window.renderSchedules) {
      const prevJoined = (window.data.schedules || []).map(s => s.joined);
      schedules.forEach((s, i) => { s.joined = prevJoined[i] || false; });
      window.data.schedules = schedules;
      window.renderSchedules();
      window.renderSideEvents();
      console.log(`スケジュールを同期: ${schedules.length}件`);
    }
  }, (err) => console.error("スケジュールonSnapshotエラー:", err));
}

// ============================================================
// 【FAQ】
// ============================================================

window.firebaseSaveFaq = async function (faq) {
  try {
    await addDoc(collection(db, "faqs"), {
      category  : faq.category || "履修",
      q         : faq.q        || "",
      a         : faq.a        || "",
      createdAt : serverTimestamp()
    });
    console.log("FAQ保存OK");
  } catch (err) {
    console.error("FAQ保存失敗:", err);
  }
};

window.firebaseUpdateFaq = async function (localIndex, updatedData) {
  const docId = faqIdMap[localIndex];
  if (!docId) return;
  try {
    await updateDoc(doc(db, "faqs", docId), updatedData);
    console.log("FAQ更新OK");
  } catch (err) {
    console.error("FAQ更新失敗:", err);
  }
};

window.firebaseDeleteFaq = async function (localIndex) {
  const docId = faqIdMap[localIndex];
  if (!docId) { console.warn("FAQdocId不明:", localIndex); return; }
  try {
    await deleteDoc(doc(db, "faqs", docId));
    console.log("FAQ削除OK");
  } catch (err) {
    console.error("FAQ削除失敗:", err);
  }
};

function initFaqListener() {
  const q = query(collection(db, "faqs"), orderBy("createdAt", "asc"));
  onSnapshot(q, (snapshot) => {
    const faqs = [];
    faqIdMap = {};
    snapshot.docs.forEach((d, i) => {
      const raw = d.data();
      faqs.push({
        category : raw.category || "履修",
        q        : raw.q        || "",
        a        : raw.a        || ""
      });
      faqIdMap[i] = d.id;
    });
    if (window.data && window.renderFaq) {
      window.data.faqs = faqs;
      window.renderFaq();
      console.log(`FAQを同期: ${faqs.length}件`);
    }
  }, (err) => console.error("FAQonSnapshotエラー:", err));
}

// ============================================================
// 【設定】Firestore同期
// ============================================================

window.firebaseSaveSettings = async function (settings) {
  try {
    await setDoc(doc(db, "settings", "main"), {
      driveUrl       : settings.driveUrl       || "#",
      driveDesc      : settings.driveDesc      || "",
      contactEmail   : settings.contactEmail   || "",
      contactTel     : settings.contactTel     || "",
      contactHours   : settings.contactHours   || "",
      circleDesc     : settings.circleDesc     || "",
      circleEmail    : settings.circleEmail    || "",
      circleChat     : settings.circleChat     || "",
      circleChatLabel: settings.circleChatLabel|| ""
    });
    console.log("設定保存OK（Firestore）");
  } catch (err) {
    console.error("設定保存失敗:", err);
  }
};

function initSettingsListener() {
  onSnapshot(doc(db, "settings", "main"), (snap) => {
    if (!snap.exists()) {
      console.log("settings/main がまだありません");
      return;
    }
    const raw = snap.data();
    if (window.data) {
      window.data.settings = {
        driveUrl       : raw.driveUrl       || "#",
        driveDesc      : raw.driveDesc      || "",
        contactEmail   : raw.contactEmail   || "",
        contactTel     : raw.contactTel     || "",
        contactHours   : raw.contactHours   || "",
        circleDesc     : raw.circleDesc     || "",
        circleEmail    : raw.circleEmail    || "",
        circleChat     : raw.circleChat     || "",
        circleChatLabel: raw.circleChatLabel|| ""
      };
      if (window.renderMaterials) window.renderMaterials();
      if (window.renderContact)   window.renderContact();
      console.log("設定を同期しました");
    }
  }, (err) => console.error("設定onSnapshotエラー:", err));
}

// ============================================================
// 【役員メッセージ】officersコレクション
// ============================================================

let officerIdMap = {};

window.firebaseSaveOfficer = async function (officer) {
  try {
    await addDoc(collection(db, "officers"), {
      role      : officer.role    || "",
      name      : officer.name    || "",
      message   : officer.message || "",
      createdAt : serverTimestamp()
    });
    console.log("役員メッセージ保存OK");
  } catch (err) {
    console.error("役員メッセージ保存失敗:", err);
  }
};

window.firebaseDeleteOfficer = async function (localIndex) {
  const docId = officerIdMap[localIndex];
  if (!docId) { console.warn("役員docId不明:", localIndex); return; }
  try {
    await deleteDoc(doc(db, "officers", docId));
    console.log("役員メッセージ削除OK");
  } catch (err) {
    console.error("役員メッセージ削除失敗:", err);
  }
};

function initOfficerListener() {
  const q = query(collection(db, "officers"), orderBy("createdAt", "asc"));
  onSnapshot(q, (snapshot) => {
    const officers = [];
    officerIdMap = {};
    snapshot.docs.forEach((d, i) => {
      const raw = d.data();
      officers.push({
        role    : raw.role    || "",
        name    : raw.name    || "",
        message : raw.message || ""
      });
      officerIdMap[i] = d.id;
    });
    if (window.data) {
      window.data.officers = officers;
      if (window.renderRules) window.renderRules();
      console.log(`役員メッセージを同期: ${officers.length}件`);
    }
  }, (err) => console.error("役員onSnapshotエラー:", err));
}

// ============================================================
// 【会則・ルール本文】rulesコレクション
// ============================================================

window.firebaseSaveRules = async function (text) {
  try {
    await setDoc(doc(db, "rules", "main"), {
      text      : text || "",
      updatedAt : serverTimestamp()
    });
    console.log("会則保存OK");
  } catch (err) {
    console.error("会則保存失敗:", err);
  }
};

function initRulesListener() {
  onSnapshot(doc(db, "rules", "main"), (snap) => {
    if (!snap.exists()) return;
    const raw = snap.data();
    if (window.data) {
      window.data.rulesText = raw.text || "";
      if (window.renderRules) window.renderRules();
      console.log("会則を同期しました");
    }
  }, (err) => console.error("会則onSnapshotエラー:", err));
}

console.log("firebase.js 読込OK");

